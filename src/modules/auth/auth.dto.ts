import { z } from "zod";

export const loginDto = z.object({
  loginCode: z.preprocess(
    (value) => (typeof value === "string" ? value.trim().toUpperCase() : value),
    z.string().regex(/^DLE\d{3}$/),
  ),
  password: z.string().min(8),
});

export const changePasswordDto = z
  .object({
    currentPassword: z.string().min(8),
    newPassword: z.string().min(8),
    confirmPassword: z.string().min(8),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: "Mật khẩu xác nhận không khớp",
    path: ["confirmPassword"],
  });

export type LoginDto = z.infer<typeof loginDto>;
export type ChangePasswordDto = z.infer<typeof changePasswordDto>;
