import type { ProfileRole } from '@medmap/shared';
import { MAX_PROFILES_PER_USER } from '../config/constants.js';
import type { AuditLogRepository } from '../repositories/audit-log.repository.js';
import type { PageRequest, PageResult } from '../repositories/helpers.js';
import type { InteractionCheckRepository } from '../repositories/interaction-check.repository.js';
import type { InviteRepository } from '../repositories/invite.repository.js';
import type { MedicationRepository } from '../repositories/medication.repository.js';
import type { MemberRepository } from '../repositories/member.repository.js';
import type { ProfileChanges, ProfileRepository } from '../repositories/profile.repository.js';
import type { ProfileEntity } from '../types/entities.js';
import { ConflictError, NotFoundError, PreconditionFailedError } from '../utils/errors.js';
import type { AccessService } from './access.service.js';
import type { AuditService } from './audit.service.js';

/** A profile as one particular user sees it. */
export interface ProfileView {
  profile: ProfileEntity;
  role: ProfileRole;
  activeMedicationCount: number;
}

export class ProfileService {
  public constructor(
    private readonly profiles: ProfileRepository,
    private readonly members: MemberRepository,
    private readonly medications: MedicationRepository,
    private readonly invites: InviteRepository,
    private readonly checks: InteractionCheckRepository,
    private readonly auditLogs: AuditLogRepository,
    private readonly access: AccessService,
    private readonly audit: AuditService,
  ) {}

  /** @throws ConflictError when the user already owns the maximum number of profiles. */
  public async create(
    userId: string,
    input: {
      displayName: string;
      birthYear?: number | null | undefined;
      notes?: string | null | undefined;
    },
  ): Promise<ProfileView> {
    if ((await this.profiles.countByOwner(userId)) >= MAX_PROFILES_PER_USER) {
      throw new ConflictError(
        `You can have up to ${String(MAX_PROFILES_PER_USER)} profiles.`,
        'profile-limit-reached',
      );
    }
    const profile = await this.profiles.create({
      ownerId: userId,
      displayName: input.displayName,
      birthYear: input.birthYear ?? null,
      notes: input.notes ?? null,
    });
    await this.members.create({ profileId: profile.id, userId, role: 'owner', invitedBy: null });
    await this.audit.record({
      actorId: userId,
      profileId: profile.id,
      action: 'profile.created',
      target: { type: 'profile', id: profile.id },
    });
    return { profile, role: 'owner', activeMedicationCount: 0 };
  }

  /** Lists every profile the user owns or was invited to. */
  public async list(userId: string, page: PageRequest): Promise<PageResult<ProfileView>> {
    const memberships = await this.members.listForUser(userId, page);
    const ids = memberships.items.map((membership) => membership.profileId);
    const [profiles, counts] = await Promise.all([
      this.profiles.findByIds(ids),
      this.medications.countActiveByProfile(ids),
    ]);
    const byId = new Map(profiles.map((profile) => [profile.id, profile]));
    const items: ProfileView[] = [];
    for (const membership of memberships.items) {
      const profile = byId.get(membership.profileId);
      if (profile !== undefined) {
        items.push({
          profile,
          role: membership.role,
          activeMedicationCount: counts.get(profile.id) ?? 0,
        });
      }
    }
    return { items, nextCursor: memberships.nextCursor };
  }

  public async get(userId: string, profileId: string): Promise<ProfileView> {
    const membership = await this.access.require(profileId, userId, 'profile.read');
    const profile = await this.profiles.findById(profileId);
    if (profile === null) {
      throw new NotFoundError('Profile not found.');
    }
    return {
      profile,
      role: membership.role,
      activeMedicationCount: await this.medications.countActive(profileId),
    };
  }

  /** @throws PreconditionFailedError when `expectedVersion` is stale. */
  public async update(
    userId: string,
    profileId: string,
    expectedVersion: number,
    changes: ProfileChanges,
  ): Promise<ProfileView> {
    const membership = await this.access.require(profileId, userId, 'profile.update');
    const profile = await this.profiles.updateIfVersion(profileId, expectedVersion, changes);
    if (profile === null) {
      throw new PreconditionFailedError();
    }
    await this.audit.record({
      actorId: userId,
      profileId,
      action: 'profile.updated',
      target: { type: 'profile', id: profileId },
    });
    return {
      profile,
      role: membership.role,
      activeMedicationCount: await this.medications.countActive(profileId),
    };
  }

  /** Deletes a profile and everything in it. Only the owner may do this. */
  public async delete(userId: string, profileId: string): Promise<void> {
    await this.access.require(profileId, userId, 'profile.delete');
    await this.purge(profileId);
    await this.audit.record({
      actorId: userId,
      action: 'profile.deleted',
      target: { type: 'profile', id: profileId },
    });
  }

  /** Removes a profile with all dependent data. Callers must have authorised the action. */
  public async purge(profileId: string): Promise<void> {
    await Promise.all([
      this.medications.deleteAllForProfile(profileId),
      this.invites.deleteAllForProfile(profileId),
      this.checks.deleteAllForProfile(profileId),
      this.auditLogs.eraseForProfile(profileId),
    ]);
    await this.members.deleteAllForProfile(profileId);
    await this.profiles.delete(profileId);
  }
}
