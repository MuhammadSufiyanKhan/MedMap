import type { Express, RequestHandler } from 'express';
import { buildApp } from './app.js';
import type { AppConfig } from './config/env.js';
import { AuthController } from './controllers/auth.controller.js';
import { InteractionController } from './controllers/interaction.controller.js';
import { MedicationController } from './controllers/medication.controller.js';
import { ProfileController } from './controllers/profile.controller.js';
import { ConsoleEmailAdapter, SmtpEmailAdapter } from './integrations/email/email.js';
import type { EmailAdapter } from './integrations/email/email.js';
import { DemoNormalizer } from './integrations/rxnorm/demo-normalizer.js';
import type { DrugNormalizer } from './integrations/rxnorm/normalizer.js';
import { RxNormNormalizer } from './integrations/rxnorm/rxnorm-client.js';
import { CacheRepository } from './repositories/cache.repository.js';
import { DatasetRepository } from './repositories/dataset.repository.js';
import { AuditLogRepository } from './repositories/audit-log.repository.js';
import { pingDatabase } from './repositories/db.js';
import { IdempotencyRepository } from './repositories/idempotency.repository.js';
import { InteractionCheckRepository } from './repositories/interaction-check.repository.js';
import { InviteRepository } from './repositories/invite.repository.js';
import { MedicationRepository } from './repositories/medication.repository.js';
import { MemberRepository } from './repositories/member.repository.js';
import { ProfileRepository } from './repositories/profile.repository.js';
import { EmailTokenRepository, RefreshTokenRepository } from './repositories/token.repository.js';
import { UserRepository } from './repositories/user.repository.js';
import { buildRoutes } from './routes/index.js';
import { AccessService } from './services/access.service.js';
import { AuditService } from './services/audit.service.js';
import { AuthService } from './services/auth.service.js';
import { DatasetService } from './services/dataset.service.js';
import { IdempotencyService } from './services/idempotency.service.js';
import { InteractionCheckService } from './services/interaction-check.service.js';
import { MedicationService } from './services/medication.service.js';
import { NormalizationService } from './services/normalization.service.js';
import { ProfileService } from './services/profile.service.js';
import { SharingService } from './services/sharing.service.js';
import { TokenService } from './services/token.service.js';
import { systemClock } from './utils/clock.js';
import type { Clock } from './utils/clock.js';
import type { AnyRouteSpec } from './utils/http.js';
import type { Logger } from './utils/logger.js';
import { readVersion } from './utils/version.js';

/** Replaceable edges of the system. Tests pass fakes; production uses the defaults. */
export interface ContainerOverrides {
  clock?: Clock;
  email?: EmailAdapter;
  /** Replaces the live RxNorm client. `null` means "no real lookup available". */
  drugNormalizer?: DrugNormalizer | null;
  pingDatabase?: () => Promise<boolean>;
}

export interface Container {
  app: Express;
  routes: AnyRouteSpec[];
  datasets: DatasetService;
}

function createEmailAdapter(config: AppConfig, logger: Logger): EmailAdapter {
  if (config.email.adapter === 'smtp' && config.email.smtpUrl !== undefined) {
    return new SmtpEmailAdapter(config.email.smtpUrl, config.email.from);
  }
  return new ConsoleEmailAdapter(logger, config.isProduction);
}

const passthrough: RequestHandler = (_req, _res, next) => {
  next();
};

/**
 * Composition root: builds every repository, service and controller once and wires them
 * into the Express app. Nothing here touches the network or the database.
 */
export function createContainer(
  config: AppConfig,
  logger: Logger,
  overrides: ContainerOverrides = {},
): Container {
  const clock = overrides.clock ?? systemClock;
  const email = overrides.email ?? createEmailAdapter(config, logger);

  const users = new UserRepository();
  const refreshTokens = new RefreshTokenRepository();
  const emailTokens = new EmailTokenRepository();
  const profiles = new ProfileRepository();
  const members = new MemberRepository();
  const invites = new InviteRepository();
  const medications = new MedicationRepository();
  const checks = new InteractionCheckRepository();
  const auditLogs = new AuditLogRepository();
  const idempotencyRecords = new IdempotencyRepository();

  const tokens = new TokenService(config.auth.accessSecret, config.auth.accessTtlSeconds);
  const audit = new AuditService(auditLogs, clock);
  const access = new AccessService(members);
  const idempotency = new IdempotencyService(idempotencyRecords, clock);
  const auth = new AuthService(users, refreshTokens, emailTokens, tokens, email, audit, clock, {
    refreshTtlDays: config.auth.refreshTtlDays,
    appBaseUrl: config.appBaseUrl,
  });
  const profileService = new ProfileService(
    profiles,
    members,
    medications,
    invites,
    checks,
    auditLogs,
    access,
    audit,
  );
  const sharing = new SharingService(
    members,
    invites,
    users,
    profiles,
    access,
    audit,
    email,
    clock,
    config.appBaseUrl,
  );

  const datasetRepository = new DatasetRepository();
  const datasets = new DatasetService(datasetRepository, clock);
  const realNormalizer =
    overrides.drugNormalizer !== undefined
      ? overrides.drugNormalizer
      : config.rxnorm.enabled
        ? new RxNormNormalizer(config.rxnorm.baseUrl, (url, init) => fetch(url, init))
        : null;
  const normalization = new NormalizationService(
    realNormalizer,
    new DemoNormalizer(),
    datasetRepository,
    new CacheRepository(),
    clock,
  );
  const medicationService = new MedicationService(medications, normalization, access, audit);
  const interactionChecks = new InteractionCheckService(
    datasetRepository,
    medications,
    checks,
    access,
    audit,
  );

  const routes = buildRoutes({
    auth: new AuthController(auth, config.auth.cookieSecure),
    profiles: new ProfileController(profileService, sharing, audit, access),
    medications: new MedicationController(medicationService, normalization),
    interactions: new InteractionController(interactionChecks, datasets, {
      enabled: config.extraction.enabled,
      provider: config.extraction.adapter,
    }),
  });

  const app = buildApp({
    config,
    logger,
    routes,
    verifyAccessToken: (token) => tokens.verifyAccessToken(token),
    idempotency,
    multipart: passthrough,
    pingDatabase: overrides.pingDatabase ?? pingDatabase,
    version: readVersion(),
  });

  return { app, routes, datasets };
}
