import { Injectable } from '@nestjs/common';
import { SendEmailV3_1 } from 'node-mailjet';

@Injectable()
export class EmailTemplateService {
  createPasswordResetEmail(
    fromEmail: string,
    to: string,
    resetUrl: string,
  ): SendEmailV3_1.Body {
    return {
      Messages: [
        {
          From: {
            Email: fromEmail,
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
              <p>We received a request to reset your Trade Monitor password.</p>
              <p>
                <a href="${resetUrl}"
                   style="display:inline-block;padding:12px 20px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px">
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
  }

  createWelcomeEmail(
    fromEmail: string,
    to: string,
  ): SendEmailV3_1.Body {
    return {
      Messages: [
        {
          From: {
            Email: fromEmail,
            Name: 'Trade Monitor',
          },
          To: [{ Email: to }],
          Subject: 'Welcome to Trade Monitor!',
          TextPart: [
            'Welcome to Trade Monitor!',
            '',
            'Your account has been successfully created.',
            'You can now log in and explore the platform.',
            '',
            'Keep your password private and never share it.',
            '',
            'Thank you for joining us!',
            'The Trade Monitor Team',
          ].join('\n'),
          HTMLPart: `
            <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:24px;color:#1f2937">
              <h1 style="color:#2563eb">Welcome to Trade Monitor!</h1>
              <p>Hello,</p>
              <p>Your account has been successfully created.</p>
              <p>You can now log in and explore the Trade Monitor platform.</p>
              <p>For your security, keep your password private and never share it with anyone.</p>
              <p>Thank you for joining us!</p>
              <p><strong>The Trade Monitor Team</strong></p>
            </div>
          `,
        },
      ],
    };
  }
}
