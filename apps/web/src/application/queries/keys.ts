/** Query keys in one place so invalidation stays consistent. */
export const keys = {
  appConfig: ['app-config'] as const,
  profiles: ['profiles'] as const,
  profile: (profileId: string) => ['profiles', profileId] as const,
  medications: (profileId: string) => ['profiles', profileId, 'medications'] as const,
  check: (profileId: string) => ['profiles', profileId, 'check'] as const,
  members: (profileId: string) => ['profiles', profileId, 'members'] as const,
  invites: (profileId: string) => ['profiles', profileId, 'invites'] as const,
  normalize: (term: string) => ['normalize', term.toLowerCase()] as const,
};
