import { Router } from "express";

import { ok } from "../../common/api-response";
import { moduleStatus } from "../../common/module-status";
import { PERMISSIONS } from "../../config/permissions";
import { authGuard } from "../../guards/auth.guard";
import { permissionGuard } from "../../guards/permission.guard";

export const bankTransferRoutes = Router();

bankTransferRoutes.use(authGuard);
bankTransferRoutes.get("/", permissionGuard(PERMISSIONS.bankTransferRead), (_req, res) =>
  ok(res, moduleStatus("bank-transfer", ["tạo file ngân hàng", "xuất TXT", "xuất XLSX"])),
);
