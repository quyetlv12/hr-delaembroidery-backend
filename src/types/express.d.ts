import type { PermissionCode } from "../config/permissions";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        loginCode: string;
        email: string;
        employeeId?: string;
        permissions: PermissionCode[];
      };
    }
  }
}

export {};
