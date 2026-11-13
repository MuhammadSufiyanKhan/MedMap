import type { ProfileRole } from '@medmap/shared';
import type { MemberRepository } from '../repositories/member.repository.js';
import type { ProfileMemberEntity } from '../types/entities.js';
import { ForbiddenError, NotFoundError } from '../utils/errors.js';

const RANK: Record<ProfileRole, number> = { viewer: 1, caregiver: 2, owner: 3 };

/** What each role may do. This table is the single place permissions are defined. */
export const PERMISSIONS = {
  'profile.read': 'viewer',
  'profile.update': 'owner',
  'profile.delete': 'owner',
  'medication.read': 'viewer',
  'medication.write': 'caregiver',
  'label_extraction.create': 'caregiver',
  'interaction_check.read': 'viewer',
  'interaction_check.run': 'viewer',
  'member.read': 'viewer',
  'member.manage': 'owner',
  'invite.manage': 'owner',
  'audit.read': 'owner',
} as const satisfies Record<string, ProfileRole>;

export type Permission = keyof typeof PERMISSIONS;

/**
 * Authorisation for everything scoped to a profile. Every profile-scoped service method
 * calls {@link AccessService.require} first, with the user id taken from the verified token.
 */
export class AccessService {
  public constructor(private readonly members: MemberRepository) {}

  /**
   * @returns the caller's membership.
   * @throws NotFoundError when the caller is not a member. The same error is used for a
   * profile that does not exist, so outsiders cannot probe for valid profile ids.
   * @throws ForbiddenError when the caller is a member but the role is too low.
   */
  public async require(
    profileId: string,
    userId: string,
    permission: Permission,
  ): Promise<ProfileMemberEntity> {
    const membership = await this.members.find(profileId, userId);
    if (membership === null) {
      throw new NotFoundError('Profile not found.');
    }
    if (RANK[membership.role] < RANK[PERMISSIONS[permission]]) {
      throw new ForbiddenError('Your role on this profile does not allow this.');
    }
    return membership;
  }
}
