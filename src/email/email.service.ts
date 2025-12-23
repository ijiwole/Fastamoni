import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';
import * as ejs from 'ejs';
import * as path from 'path';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: Transporter;
  private readonly disabled: boolean;

  constructor(private readonly configService: ConfigService) {
    const disableEmail =
      this.configService.get<string>('DISABLE_EMAIL', 'false') === 'true';

    if (disableEmail) {
      this.transporter = nodemailer.createTransport({ jsonTransport: true });
      this.logger.warn('Email service disabled (DISABLE_EMAIL=true)');
      this.disabled = true;
      return;
    }
    this.disabled = false;

    const host = this.configService.get<string>('MAIL_HOST');
    const portStr = this.configService.get<string>('MAIL_PORT');
    const port = portStr ? Number.parseInt(portStr, 10) : undefined;
    const secureStr = this.configService.get<string>('MAIL_SECURE', 'false');
    const secureFlag = secureStr === 'true' || secureStr === '1';
    const user = this.configService.get<string>('MAIL_USER');
    const password = this.configService.get<string>('MAIL_PASSWORD');

    if (host && port && user && password) {
      // Configure SMTP transport with provided credentials
      const secure = port === 465 ? true : secureFlag; // 465 requires secure; 587 should be secure=false
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        requireTLS: port === 587, // enforce TLS upgrade on 587
        auth: {
          user,
          pass: password,
        },
      });
      this.logger.log(
        `Email service configured for ${host}:${port} (secure=${secure}, requireTLS=${port === 587})`,
      );
      // Verify connection on startup to surface SMTP issues early
      this.transporter.verify().catch((err) => {
        this.logger.error('SMTP verify failed', err as Error);
      });
    } else {
      // Fallback transport that logs emails to the console (for development)
      this.transporter = nodemailer.createTransport({
            jsonTransport: true,
      });
      this.logger.warn('Email service using console transport (SMTP not configured)');
    }
  }

  async sendVerificationCode(email: string, name: string, code: string) {
    if (this.disabled) return;
    const from =
      this.configService.get<string>('MAIL_FROM') ||
      this.configService.get<string>('MAIL_USER') ||
      'no-reply@fastamoni.test';
    const subject = 'Verify your email address';

    try {
      // Render EJS template
      const templatePath = path.join(
        __dirname,
        'templates',
        'verify-email.ejs',
      );
      const html = await ejs.renderFile(templatePath, {
        name,
        email,
        code,
      });

      // Plain text fallback
      const text = `Hi ${name},

Please use the following code to verify your email address:

${code}

This code will expire in 15 minutes.

If you didn't request this code, please ignore this email.

Cheers,
Fastamoni Team`;

      await this.transporter.sendMail({
        to: email,
        from,
        subject,
        text,
        html,
      });

      this.logger.log(`Verification code sent to ${email}`);
    } catch (error) {
      this.logger.error('Failed to send verification code', error as Error);
      throw error;
    }
  }

  async sendThankYou(email: string, name: string, donationCount: number) {
    if (this.disabled) return;
    if (donationCount < 2) return;
    
    const from =
      this.configService.get<string>('MAIL_FROM') ||
      this.configService.get<string>('MAIL_USER') ||
      'no-reply@fastamoni.test';
    const subject = 'Thank you for supporting the community';

    try {
      // Render EJS template
      // Template path works in both development and production
      const templatePath = path.join(__dirname, 'templates', 'thank-you.ejs');
      const html = await ejs.renderFile(templatePath, {
        name,
        email,
        donationCount,
      });

      // Plain text fallback
    const text = `Hi ${name},

Thank you for making ${donationCount} donations. Your generosity keeps the community thriving.

Cheers,
Fastamoni Team`;

      await this.transporter.sendMail({
        to: email,
        from,
        subject,
        text,
        html,
      });

      this.logger.log(`Thank you email sent to ${email}`);
    } catch (error) {
      this.logger.error('Failed to send thank you email', error as Error);
      throw error;
    }
  }
}

