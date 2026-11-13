import type { AuditLogRepository } from '../repositories/audit-log.repository.js';
import type { PageRequest, PageResult } from '../repositories/helpers.js';
import type { AuditEntryInput, AuditLogEntity } from '../types/entities.js';
import type { Clock } from '../utils/clock.js';

/**
 * Records who did what to which resource. Entries carry ids only: medicine names, notes
 * and other health data must never be passed in.
 */
export class AuditService {
  public constructor(
    private readonly auditLogs: AuditLogRepository,
    private readonly clock: Clock,
  ) {}

  public async record(entry: AuditEntryInput): Promise<void> {
    await this.auditLogs.append(entry, this.clock());
  }

  public listForProfile(profileId: string, page: PageRequest): Promise<PageResult<AuditLogEntity>> {
    return this.auditLogs.listForProfile(profileId, page);
  }
}
