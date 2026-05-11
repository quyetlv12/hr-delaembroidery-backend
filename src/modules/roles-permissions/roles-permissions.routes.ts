import { Router } from "express";

import { validateBody } from "../../common/validate";
import { PERMISSIONS } from "../../config/permissions";
import { authGuard } from "../../guards/auth.guard";
import { permissionGuard } from "../../guards/permission.guard";
import {
  createRoleController,
  deleteRoleController,
  getRoleController,
  listRoleFormOptionsController,
  listRolesController,
  updateRoleController,
} from "./roles-permissions.controller";
import { saveRoleDto } from "./roles-permissions.dto";

export const rolesPermissionRoutes = Router();

rolesPermissionRoutes.use(authGuard);
rolesPermissionRoutes.get("/", permissionGuard(PERMISSIONS.rolesRead), listRolesController);
rolesPermissionRoutes.get("/form-options", permissionGuard(PERMISSIONS.rolesRead), listRoleFormOptionsController);
rolesPermissionRoutes.get("/:id", permissionGuard(PERMISSIONS.rolesRead), getRoleController);
rolesPermissionRoutes.post(
  "/",
  permissionGuard(PERMISSIONS.rolesManage),
  validateBody(saveRoleDto),
  createRoleController,
);
rolesPermissionRoutes.put(
  "/:id",
  permissionGuard(PERMISSIONS.rolesManage),
  validateBody(saveRoleDto),
  updateRoleController,
);
rolesPermissionRoutes.delete("/:id", permissionGuard(PERMISSIONS.rolesManage), deleteRoleController);
