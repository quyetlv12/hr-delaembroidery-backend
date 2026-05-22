import { z } from "zod";

export const emailSettingsDto = z.object({
  smtpHost: z.string().trim().max(255).optional().default(""),
  smtpPort: z.coerce.number().int().min(1).max(65535).default(587),
  smtpUser: z.string().trim().max(180).optional().default(""),
  smtpPass: z.string().max(255).optional().default(""),
  mailFrom: z.string().trim().max(255).optional().default(""),
});

export const emailTestDto = z.object({
  email: z.string().trim().email().max(255),
});

export type EmailSettingsDto = z.infer<typeof emailSettingsDto>;
export type EmailTestDto = z.infer<typeof emailTestDto>;
