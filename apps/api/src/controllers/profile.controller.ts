import type {
  CreateInviteRequest,
  CreateProfileRequest,
  CursorQuery,
  InviteAcceptanceRequest,
  ProfileParams,
  ReplaceMemberRequest,
  UpdateProfileRequest,
} from '@medmap/shared';
import { API_PREFIX } from '../config/constants.js';
import { toAuditLogDto, toInviteDto, toMemberDto, toProfileDto } from '../dto/mappers.js';
import type { AuditService } from '../services/audit.service.js';
import type { AccessService } from '../services/access.service.js';
import type { ProfileService } from '../services/profile.service.js';
import type { SharingService } from '../services/sharing.service.js';
import type { Handler } from '../utils/http.js';

interface MemberParams {
  profileId: string;
  userId: string;
}
interface InviteParams {
  profileId: string;
  inviteId: string;
}

/** HTTP handlers for profiles, members, invites and the profile audit log. */
export class ProfileController {
  public constructor(
    private readonly profiles: ProfileService,
    private readonly sharing: SharingService,
    private readonly audit: AuditService,
    private readonly access: AccessService,
  ) {}

  public list: Handler<unknown, CursorQuery, unknown> = async (ctx) => {
    const page = await this.profiles.list(ctx.userId, ctx.query);
    return {
      status: 200,
      body: { items: page.items.map(toProfileDto), nextCursor: page.nextCursor },
    };
  };

  public create: Handler<unknown, unknown, CreateProfileRequest> = async (ctx) => {
    const view = await this.profiles.create(ctx.userId, ctx.body);
    return {
      status: 201,
      body: toProfileDto(view),
      location: `${API_PREFIX}/profiles/${view.profile.id}`,
      version: view.profile.version,
    };
  };

  public get: Handler<ProfileParams, unknown, unknown> = async (ctx) => {
    const view = await this.profiles.get(ctx.userId, ctx.params.profileId);
    return { status: 200, body: toProfileDto(view), version: view.profile.version };
  };

  public update: Handler<ProfileParams, unknown, UpdateProfileRequest> = async (ctx) => {
    const view = await this.profiles.update(
      ctx.userId,
      ctx.params.profileId,
      ctx.expectedVersion,
      ctx.body,
    );
    return { status: 200, body: toProfileDto(view), version: view.profile.version };
  };

  public remove: Handler<ProfileParams, unknown, unknown> = async (ctx) => {
    await this.profiles.delete(ctx.userId, ctx.params.profileId);
    return { status: 204 };
  };

  public listMembers: Handler<ProfileParams, CursorQuery, unknown> = async (ctx) => {
    const page = await this.sharing.listMembers(ctx.userId, ctx.params.profileId, ctx.query);
    return {
      status: 200,
      body: { items: page.items.map(toMemberDto), nextCursor: page.nextCursor },
    };
  };

  public replaceMember: Handler<MemberParams, unknown, ReplaceMemberRequest> = async (ctx) => {
    const view = await this.sharing.replaceMember(
      ctx.userId,
      ctx.params.profileId,
      ctx.params.userId,
      ctx.expectedVersion,
      ctx.body.role,
    );
    return { status: 200, body: toMemberDto(view), version: view.member.version };
  };

  public removeMember: Handler<MemberParams, unknown, unknown> = async (ctx) => {
    await this.sharing.removeMember(ctx.userId, ctx.params.profileId, ctx.params.userId);
    return { status: 204 };
  };

  public listInvites: Handler<ProfileParams, CursorQuery, unknown> = async (ctx) => {
    const page = await this.sharing.listInvites(ctx.userId, ctx.params.profileId, ctx.query);
    return {
      status: 200,
      body: { items: page.items.map(toInviteDto), nextCursor: page.nextCursor },
    };
  };

  public createInvite: Handler<ProfileParams, unknown, CreateInviteRequest> = async (ctx) => {
    const { invite, token } = await this.sharing.createInvite(
      ctx.userId,
      ctx.params.profileId,
      ctx.body,
    );
    return {
      status: 201,
      body: { ...toInviteDto(invite), token },
      location: `${API_PREFIX}/profiles/${invite.profileId}/invites/${invite.id}`,
    };
  };

  public revokeInvite: Handler<InviteParams, unknown, unknown> = async (ctx) => {
    await this.sharing.revokeInvite(ctx.userId, ctx.params.profileId, ctx.params.inviteId);
    return { status: 204 };
  };

  public acceptInvite: Handler<unknown, unknown, InviteAcceptanceRequest> = async (ctx) => {
    const view = await this.sharing.acceptInvite(ctx.userId, ctx.body.token);
    return {
      status: 201,
      body: toMemberDto(view),
      location: `${API_PREFIX}/profiles/${view.member.profileId}`,
    };
  };

  public listAuditLog: Handler<ProfileParams, CursorQuery, unknown> = async (ctx) => {
    await this.access.require(ctx.params.profileId, ctx.userId, 'audit.read');
    const page = await this.audit.listForProfile(ctx.params.profileId, ctx.query);
    return {
      status: 200,
      body: { items: page.items.map(toAuditLogDto), nextCursor: page.nextCursor },
    };
  };
}
