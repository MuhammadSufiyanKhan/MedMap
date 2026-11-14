import { createTransport } from 'nodemailer';
import type { Logger } from '../../utils/logger.js';

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

/** Outbound email port. Adapters must not log message bodies in production. */
export interface EmailAdapter {
  readonly name: string;
  send(message: EmailMessage): Promise<void>;
}

/**
 * Development adapter: prints the message to stdout so links can be copied by hand.
 * In production it prints nothing but a notice, because message bodies contain
 * single-use tokens.
 */
export class ConsoleEmailAdapter implements EmailAdapter {
  public readonly name = 'console';

  public constructor(
    private readonly logger: Logger,
    private readonly isProduction: boolean,
  ) {}

  public send(message: EmailMessage): Promise<void> {
    if (this.isProduction) {
      this.logger.warn('email not sent: EMAIL_ADAPTER=console in production');
      return Promise.resolve();
    }
    process.stdout.write(
      `\n--- email (console adapter) ---\nTo: ${message.to}\nSubject: ${message.subject}\n\n${message.text}\n-------------------------------\n`,
    );
    return Promise.resolve();
  }
}

/** Sends through any SMTP server described by a connection URL. */
export class SmtpEmailAdapter implements EmailAdapter {
  public readonly name = 'smtp';
  private readonly transport;

  public constructor(
    smtpUrl: string,
    private readonly from: string,
  ) {
    this.transport = createTransport(smtpUrl);
  }

  public async send(message: EmailMessage): Promise<void> {
    await this.transport.sendMail({
      from: this.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
    });
  }
}

/** Test adapter that keeps messages in memory. */
export class MemoryEmailAdapter implements EmailAdapter {
  public readonly name = 'memory';
  public readonly sent: EmailMessage[] = [];

  public send(message: EmailMessage): Promise<void> {
    this.sent.push(message);
    return Promise.resolve();
  }
}
