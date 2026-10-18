
import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Mailjet, { SendEmailV3_1 } from 'node-mailjet';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly mailjet: InstanceType<typeof Mailjet>;
  private readonly fromEmail: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService
      .get<string>('MJ_APIKEY_PUBLIC')
      ?.trim();

    const apiSecret = this.configService
      .get<string>('MJ_APIKEY_PRIVATE')
      ?.trim();

    this.fromEmail =
      this.configService.get<string>('MJ_SENDER_EMAIL')?.trim() ?? '';

    if (!apiKey || !apiSecret || !this.fromEmail) {
      throw new Error(
        'Mailjet configuration is missing. Check server/.env.',
      );
    }

    this.mailjet = new Mailjet({
      apiKey,
      apiSecret,
    });
  }

  async sendPasswordResetEmail(
    to: string,
    resetUrl: string,
  ): Promise<void> {
    const data: SendEmailV3_1.Body = {
      Messages: [
        {
          From: {
            Email: this.fromEmail,
            Name: 'Trade Monitor',
          },
          To: [{ Email: to }],
          Subject: 'Reset your Trade Monitor password',
          TextPart: [
            'We received a request to reset your Trade Monitor password.',
            '',
            `Open this link to reset your password: ${resetUrl}`,
            '',
            'This link expires in 15 minutes.',
            'If you did not request this, you can ignore this email.',
          ].join('\n'),
          HTMLPart: `
            <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:20px">
              <h2>Reset your password</h2>
              <p>
                We received a request to reset your Trade Monitor password.
              </p>
              <p>
                <a
                  href="${resetUrl}"
                  style="display:inline-block;padding:12px 20px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px"
                >
                  Reset password
                </a>
              </p>
              <p>This link expires in 15 minutes.</p>
              <p>If you did not request this, you can ignore this email.</p>
            </div>
          `,
        },
      ],
    };

    try {
      const result = await this.mailjet
        .post('send', { version: 'v3.1' })
        .request<SendEmailV3_1.Response>(data);

      const message = result.body.Messages?.[0];

      if (message?.Status !== 'success') {
        this.logger.error(
          `Mailjet rejected the email: ${JSON.stringify(
            message?.Errors ?? [],
          )}`,
        );

        throw new Error('Mailjet did not accept the email.');
      }

      this.logger.log('Password reset email accepted by Mailjet.');
    } catch (error: unknown) {
      const err = error as {
        message?: string;
        statusCode?: number;
        response?: {
          statusCode?: number;
          data?: unknown;
        };
      };

      this.logger.error(
        `Mailjet error: ${err.message ?? 'Unknown error'}; ` +
          `status: ${
            err.statusCode ??
            err.response?.statusCode ??
            'unknown'
          }`,
      );

      throw new InternalServerErrorException(
        'Unable to send email.',
      );
    }
  }
}
