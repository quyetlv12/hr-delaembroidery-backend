export const PERMISSIONS = {
  dashboardRead: "dashboard:read",
  employeesRead: "employees:read",
  employeesCreate: "employees:create",
  employeesUpdate: "employees:update",
  employeesDelete: "employees:delete",
  attendanceRead: "attendance:read",
  attendanceImport: "attendance:import",
  payrollRead: "payroll:read",
  payrollCalculate: "payroll:calculate",
  payrollLock: "payroll:lock",
  payslipEmailSend: "payslip-email:send",
  bankTransferRead: "bank-transfer:read",
  bankTransferExport: "bank-transfer:export",
  rolesRead: "roles:read",
  rolesManage: "roles:manage",
  reportsRead: "reports:read",
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const allPermissions = Object.values(PERMISSIONS);

export const systemRoles = {
  admin: {
    name: "Quản trị viên",
    legacyNames: ["Admin"],
    permissions: allPermissions,
    isSystem: true,
  },
  employee: {
    name: "Nhân viên",
    legacyNames: ["Nhan vien"],
    permissions: [PERMISSIONS.attendanceRead, PERMISSIONS.payrollRead],
    isSystem: true,
  },
} as const;
