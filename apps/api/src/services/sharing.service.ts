import type { InvitableRole } from '@medmap/shared';
import { INVITE_TTL_DAYS, MAX_PENDING_INVITES_PER_PROFILE } from '../config/constants.js';
import type { EmailAdapter } from '../integrations/email/email.js';
import type { PageRequest, PageResult } from '../repositories/helpers.js';
import type { InviteRepository } from '../repositories/invite.repository.js';
import type { MemberRepository } from '../repositories/member.repository.js';
import type { ProfileRepository } from '../repositories/profile.repository.js';
import type { UserRepository } from '../repositories/user.repository.js';
import type { InviteEntity, ProfileMemberEntity } from '../types/entities.js';
import { addDays } from '../utils/clock.js';
import type { Clock } from '../utils/clock.js';
import { randomToken, sha256 } from '../utils/crypto.js';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  PreconditionFailedError,
} from '../utils/errors.js';
import type { AccessService } from './access.service.js';
import type { AuditService } from './audit.service.js';

export interface MemberView {
  member: ProfileMemberEntity;
  email: string;
}

/** Caregiver sharing: members, roles and invites. */
export class SharingService {
  public constructor(
    private readonly members: MemberRepository,
    private readonly invites: InviteRepository,
    private readonly users: UserRepository,
    private readonly profiles: ProfileRepository,
    private readonly access: AccessService,
    private readonly audit: AuditService,
    private readonly email: EmailAdapter,
    private readonly clock: Clock,
    private readonly appBaseUrl: string,
  ) {}

  public async listMembers(
    userId: string,
    profileId: string,
    page: PageRequest,
  ): Promise<PageResult<MemberView>> {
    await this.access.require(profileId, userId, 'member.read');
    const result = await this.members.listForProfile(profileId, page);
    return { items: await this.withEmails(result.items), nextCursor: result.nextCursor };
  }

  /**
   * Replaces a member's role.
   * @throws ForbiddenError when the target is the owner: ownership cannot be changed here.
   * @throws PreconditionFailedError on a stale version.
   */
  public async replaceMember(
    actorId: string,
    profileId: string,
    targetUserId: string,
    expectedVersion: number,
    role: InvitableRole,
  ): Promise<MemberView> {
    await this.access.require(profileId, actorId, 'member.manage');
    const existing = await this.members.find(profileId, targetUserId);
    if (existing === null) {
      throw new NotFoundError('Member not found.');
    }
    if (existing.role === 'owner') {
      throw new ForbiddenError("The owner's role cannot be changed.");
    }
    const updated = await this.members.updateRoleIfVersion(
      profileId,
      targetUserId,
      expectedVersion,
      role,
    );
    if (updated === null) {
      throw new PreconditionFailedError();
    }
    await this.audit.record({
      actorId,
      profileId,
      action: 'member.role_changed',
      target: { type: 'user', id: targetUserId },
    });
    const [view] = await this.withEmails([updated]);
    if (view === undefined) {
      throw new NotFoundError('Member not found.');
    }
    return view;
  }

  /**
   * Removes a member. Owners can remove anyone but themselves; other members can remove
   * only themselves (leave the profile).
   */
  public async removeMember(
    actorId: string,
    profileId: string,
    targetUserId: string,
  ): Promise<void> {
    const actor = await this.access.require(profileId, actorId, 'member.read');
    const target = await this.members.find(profileId, targetUserId);
    if (target === null) {
      throw new NotFoundError('Member not found.');
    }
    if (target.role === 'owner') {
      throw new ForbiddenError('The owner cannot be removed. Delete the profile instead.');
    }
    if (actor.role !== 'owner' && actorId !== targetUserId) {
      throw new ForbiddenError('Only the owner can remove other members.');
    }
    await this.members.delete(profileId, targetUserId);
    await this.audit.record({
      actorId,
      profileId,
      action: 'member.removed',
      target: { type: 'user', id: targetUserId },
    });
  }

  public async listInvites(
    userId: string,
    profileId: string,
    page: PageRequest,
  ): Promise<PageResult<InviteEntity>> {
    await this.access.require(profileId, userId, 'invite.manage');
    return this.invites.listForProfile(profileId, page);
  }

  /**
   * Creates an invite and emails the link.
   * @returns the invite and its raw token. The token is shown once and stored only hashed.
   * @throws ConflictError when the person is already a member or too many invites are pending.
   */
  public async createInvite(
    actorId: string,
    profileId: string,
    input: { email: string; role: InvitableRole },
  ): Promise<{ invite: InviteEntity; token: string }> {
    await this.access.require(profileId, actorId, 'invite.manage');
    const now = this.clock();
    const invitee = await this.users.findByEmail(input.email);
    if (invitee !== null && (await this.members.find(profileId, invitee.id)) !== null) {
      throw new ConflictError('This person already has access to the profile.', 'already-member');
    }
    if ((await this.invites.countPending(profileId, now)) >= MAX_PENDING_INVITES_PER_PROFILE) {
      throw new ConflictError(
        'Too many invites are waiting. Revoke one first.',
        'invite-limit-reached',
      );
    }
    const token = randomToken();
    const invite = await this.invites.create({
      profileId,
      email: input.email,
      role: input.role,
      tokenHash: sha256(token),
      invitedBy: actorId,
      expiresAt: addDays(now, INVITE_TTL_DAYS),
    });
    await this.audit.record({
      actorId,
      profileId,
      action: 'invite.created',
      target: { type: 'invite', id: invite.id },
    });
    // The email names no medicine and no profile: only that someone shared a profile.
    await this.email.send({
      to: input.email,
      subject: 'You have been invited to a MedMap profile',
      text: [
        'Someone has invited you to help with a medicine list on MedMap.',
        `Open this link within ${String(INVITE_TTL_DAYS)} days to accept:`,
        `${this.appBaseUrl}/invites/accept?token=${token}`,
        'You need a MedMap account with this email address.',
        'MedMap is an information tool. It is not medical advice.',
      ].join('\n\n'),
    });
    return { invite, token };
  }

  public async revokeInvite(actorId: string, profileId: string, inviteId: string): Promise<void> {
    await this.access.require(profileId, actorId, 'invite.manage');
    const invite = await this.invites.findInProfile(profileId, inviteId);
    if (invite === null) {
      throw new NotFoundError('Invite not found.');
    }
    await this.invites.delete(invite.id);
    await this.audit.record({
      actorId,
      profileId,
      action: 'invite.revoked',
      target: { type: 'invite', id: invite.id },
    });
  }

  /**
   * Accepts an invite for the signed-in user.
   * @throws BadRequestError when the token is unknown, expired or already used.
   * @throws ForbiddenError when the invite was sent to a different email address.
   */
  public async acceptInvite(userId: string, token: string): Promise<MemberView> {
    const now = this.clock();
    const invalid = new BadRequestError(
      'This invite is not valid or has expired.',
      'invalid-invite',
    );
    const invite = await this.invites.findByHash(sha256(token));
    if (invite === null) {
      throw invalid;
    }
    if (invite.acceptedAt !== null || invite.expiresAt <= now) {
      throw invalid;
    }
    const user = await this.users.findById(userId);
    if (user === null) {
      throw invalid;
    }
    if (user.email !== invite.email) {
      throw new ForbiddenError(
        'This invite was sent to a different email address. Sign in with that address.',
        'invite-email-mismatch',
      );
    }
    if ((await this.profiles.findById(invite.profileId)) === null) {
      throw invalid;
    }
    if (!(await this.invites.markAccepted(invite.id, now))) {
      throw invalid;
    }
    const member =
      (await this.members.create({
        profileId: invite.profileId,
        userId,
        role: invite.role,
        invitedBy: invite.invitedBy,
      })) ?? (await this.members.find(invite.profileId, userId));
    if (member === null) {
      throw invalid;
    }
    await this.audit.record({
      actorId: userId,
      profileId: invite.profileId,
      action: 'invite.accepted',
      target: { type: 'invite', id: invite.id },
    });
    return { member, email: user.email };
  }

  private async withEmails(members: ProfileMemberEntity[]): Promise<MemberView[]> {
    const users = await this.users.findByIds(members.map((member) => member.userId));
    const emails = new Map(users.map((user) => [user.id, user.email]));
    return members.map((member) => ({ member, email: emails.get(member.userId) ?? '' }));
  }
}
