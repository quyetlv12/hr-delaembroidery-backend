import type { Request, Response } from "express";

import { ok } from "../../common/api-response";
import { HttpError } from "../../common/http-error";
import { AuthService } from "./auth.service";
import type { ChangePasswordDto } from "./auth.dto";

const authService = new AuthService();

export async function loginController(req: Request, res: Response) {
  const session = await authService.login(req.body);
  return ok(res, session, "Đăng nhập thành công");
}

export async function profileController(req: Request, res: Response) {
  if (!req.user?.id) {
    throw new HttpError(401, "UNAUTHENTICATED", "Vui lòng đăng nhập");
  }

  const profile = await authService.profile(req.user.id);
  return ok(res, profile);
}

export async function changePasswordController(req: Request<unknown, unknown, ChangePasswordDto>, res: Response) {
  if (!req.user?.id) {
    throw new HttpError(401, "UNAUTHENTICATED", "Vui lòng đăng nhập");
  }

  const result = await authService.changePassword(req.user.id, req.body);
  return ok(res, result, "Đã đổi mật khẩu");
}
