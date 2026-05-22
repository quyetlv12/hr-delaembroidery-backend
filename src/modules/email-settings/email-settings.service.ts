import nodemailer from "nodemailer";

import { HttpError } from "../../common/http-error";
import { env } from "../../config/env";
import { AppDataSource } from "../../database/data-source";
import { EmailSetting } from "../../entities";
import type { EmailSettingsDto, EmailTestDto } from "./email-settings.dto";

type CurrentUser = {
  id?: string;
  loginCode?: string;
};

export type EmailTransportSettings = {
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  mailFrom: string;
};

export class EmailSettingsService {
  private readonly repository = AppDataSource.getRepository(EmailSetting);

  async getSettings() {
    return this.toResponse(await this.findSetting());
  }

  async updateSettings(dto: EmailSettingsDto, user?: CurrentUser) {
    const existing = await this.findSetting();
    const setting = existing ?? this.repository.create();
    const smtpPass = dto.smtpPass.trim() || existing?.smtpPass || "";

    this.repository.merge(setting, {
      smtpHost: dto.smtpHost.trim(),
      smtpPort: dto.smtpPort,
      smtpUser: dto.smtpUser.trim(),
      smtpPass,
      mailFrom: dto.mailFrom.trim(),
      updatedByUserId: user?.id ?? null,
      updatedByLoginCode: user?.loginCode ?? null,
    });

    const savedSetting = await this.repository.save(setting);
    return this.toResponse(savedSetting);
  }

  async resolveEffectiveSettings(): Promise<EmailTransportSettings> {
    const setting = await this.findSetting();
    const smtpHost = setting?.smtpHost?.trim() || env.SMTP_HOST?.trim() || "";
    const smtpPort = Number(setting?.smtpPort ?? env.SMTP_PORT);
    const smtpUser = setting?.smtpUser?.trim() || env.SMTP_USER?.trim() || "";
    const smtpPass = setting?.smtpPass?.trim() || env.SMTP_PASS?.trim() || "";
    const mailFrom = setting?.mailFrom?.trim() || env.MAIL_FROM;

    if (!smtpHost) {
      throw new HttpError(
        500,
        "SMTP_NOT_CONFIGURED",
        "Chưa cấu hình SMTP. Vào màn hình Cài đặt email để lưu cấu hình gửi phiếu lương.",
      );
    }

    return {
      smtpHost,
      smtpPort: Number.isFinite(smtpPort) ? smtpPort : 587,
      smtpUser,
      smtpPass,
      mailFrom,
    };
  }

  async sendTestEmail(dto: EmailTestDto) {
    const settings = await this.resolveEffectiveSettings();
    const transporter = createMailTransporter(settings);
    const sentAt = new Intl.DateTimeFormat("vi-VN", {
      dateStyle: "short",
      timeStyle: "medium",
      timeZone: "Asia/Ho_Chi_Minh",
    }).format(new Date());

    let info: Awaited<ReturnType<typeof transporter.sendMail>>;
    try {
      info = await transporter.sendMail({
        from: settings.mailFrom,
        to: dto.email,
        subject: "Dela HRM - Test cấu hình email",
        text: [
          "Đây là email test từ hệ thống HRM Dela Embroidery.",
          `Thời gian gửi: ${sentAt}`,
          "",
          "Nếu bạn nhận được email này thì cấu hình SMTP đang hoạt động.",
        ].join("\n"),
        html: `
          <div style="font-family:Arial,sans-serif;line-height:1.5;color:#17202a">
            <h2 style="margin:0 0 12px">Test cấu hình email</h2>
            <p>Đây là email test từ hệ thống HRM Dela Embroidery.</p>
            <p><strong>Thời gian gửi:</strong> ${sentAt}</p>
            <p>Nếu bạn nhận được email này thì cấu hình SMTP đang hoạt động.</p>
          </div>
        `,
      });
    } catch (error) {
      throw new HttpError(502, "SMTP_TEST_EMAIL_FAILED", "Không gửi được email test", {
        reason: getErrorMessage(error),
      });
    }

    return {
      email: dto.email,
      messageId: info.messageId,
      sentAt: new Date().toISOString(),
    };
  }

  private async findSetting() {
    return this.repository.findOne({
      where: {},
      order: { createdAt: "ASC" },
    });
  }

  private toResponse(setting: EmailSetting | null) {
    const fallbackHost = env.SMTP_HOST?.trim() || "";
    const fallbackUser = env.SMTP_USER?.trim() || "";
    const fallbackPass = env.SMTP_PASS?.trim() || "";
    const smtpHost = setting?.smtpHost?.trim() || fallbackHost;
    const smtpUser = setting?.smtpUser?.trim() || fallbackUser;
    const smtpPass = setting?.smtpPass?.trim() || fallbackPass;
    const source = setting?.smtpHost?.trim() ? "database" : fallbackHost ? "env" : "none";

    return {
      smtpHost,
      smtpPort: Number(setting?.smtpPort ?? env.SMTP_PORT),
      smtpUser,
      mailFrom: setting?.mailFrom?.trim() || env.MAIL_FROM,
      hasPassword: Boolean(smtpPass),
      passwordPreview: maskSecret(smtpPass),
      source,
      isConfigured: Boolean(smtpHost),
      updatedAt: setting?.updatedAt ? setting.updatedAt.toISOString() : null,
      updatedByLoginCode: setting?.updatedByLoginCode ?? null,
    };
  }
}

function createMailTransporter(settings: EmailTransportSettings) {
  return nodemailer.createTransport({
    host: settings.smtpHost,
    port: settings.smtpPort,
    secure: settings.smtpPort === 465,
    auth:
      settings.smtpUser && settings.smtpPass
        ? {
            user: settings.smtpUser,
            pass: settings.smtpPass,
          }
        : undefined,
  });
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "Không rõ nguyên nhân";
}

function maskSecret(value?: string | null) {
  const secret = value?.trim();
  if (!secret) {
    return "";
  }
  if (secret.length <= 4) {
    return "****";
  }
  return `${"*".repeat(Math.max(4, secret.length - 4))}${secret.slice(-4)}`;
}
