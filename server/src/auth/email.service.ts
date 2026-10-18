import { Injectable } from '@nestjs/common';

import { MailjetService } from './services/mailjet.service';
import { EmailTemplateService } from './services/email-template.service';

@Injectable()
export class EmailService {
  constructor(
    private readonly mailjetService: MailjetService,
    private readonly emailTemplateService: EmailTemplateService,
  ) {}

  async sendPasswordResetEmail(
    to: string,
    resetUrl: string,
  ): Promise<void> {
    const email = this.emailTemplateService.createPasswordResetEmail(
      this.mailjetService.getSenderEmail(),
      to,
      resetUrl,
    );

    await this.mailjetService.sendEmail(
      email,
      'Password reset email accepted by Mailjet.',
      'Unable to send email.',
    );
  }

  async sendWelcomeEmail(to: string): Promise<void> {
    const email = this.emailTemplateService.createWelcomeEmail(
      this.mailjetService.getSenderEmail(),
      to,
    );

    await this.mailjetService.sendEmail(
      email,
      'Welcome email accepted by Mailjet.',
      'Unable to send welcome email.',
    );
  }
}
