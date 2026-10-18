import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Mailjet, { SendEmailV3_1 } from 'node-mailjet';

@Injectable()
export class MailjetService {
  private readonly logger = new Logger(MailjetService.name);
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

  getSenderEmail(): string {
    return this.fromEmail;
  }

  async sendEmail(
    data: SendEmailV3_1.Body,
    successMessage: string,
    failureMessage: string,
  ): Promise<void> {
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

      this.logger.log(successMessage);
    } catch (error: unknown) {
      const err = error as {
        message?: string;
        statusCode?: number;
        response?: {
          statusCode?: number;
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

      throw new InternalServerErrorException(failureMessage);
    }
  }
}
