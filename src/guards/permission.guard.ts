import type { NextFunction, Request, Response } from "express";

import type { PermissionCode } from "../config/permissions";
import { HttpError } from "../common/http-error";

export function permissionGuard(permission: PermissionCode) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user?.permissions.includes(permission)) {
      next(new HttpError(403, "FORBIDDEN", "Bạn không có quyền thực hiện thao tác này"));
      return;
    }

    next();
  };
}
