import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

import { env } from "../config/env";
import type { PermissionCode } from "../config/permissions";
import { HttpError } from "../common/http-error";

type JwtPayload = {
  sub: string;
  loginCode: string;
  email: string;
  employeeId?: string;
  permissions: PermissionCode[];
};

export function authGuard(req: Request, _res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) {
    next(new HttpError(401, "UNAUTHENTICATED", "Vui lòng đăng nhập"));
    return;
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    req.user = {
      id: payload.sub,
      loginCode: payload.loginCode,
      email: payload.email,
      employeeId: payload.employeeId,
      permissions: payload.permissions,
    };
    next();
  } catch {
    next(new HttpError(401, "INVALID_TOKEN", "Phiên đăng nhập không hợp lệ hoặc đã hết hạn"));
  }
}
