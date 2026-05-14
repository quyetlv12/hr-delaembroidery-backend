import { z } from "zod";

import { attendanceEmployeeViewColumns, payrollEmployeeViewColumns } from "./employee-view-settings.constants";

export const employeeViewSettingsDto = z.object({
  payrollColumns: z.array(z.enum(payrollEmployeeViewColumns)).min(1),
  attendanceColumns: z.array(z.enum(attendanceEmployeeViewColumns)).min(1),
});

export type EmployeeViewSettingsDto = z.infer<typeof employeeViewSettingsDto>;
