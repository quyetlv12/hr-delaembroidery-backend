export const payrollEmployeeViewColumns = [
  "employeeCode",
  "employeeName",
  "departmentName",
  "positionName",
  "email",
  "configuredSalary",
  "insuranceSalary",
  "fixedDailySalary",
  "responsibilityAllowance",
  "mealAllowance",
  "phoneAllowance",
  "kpiAllowance",
  "dailyTotal",
  "workDay",
  "overtimeWorkDay",
  "totalWorkDay",
  "earnedSalary",
  "overtimeTotal",
  "grossSalary",
  "employerInsuranceTotal",
  "insuranceTotal",
  "taxTotal",
  "advanceTotal",
  "deductionTotal",
  "bonus",
  "netSalary",
  "dependentNote",
  "status",
] as const;

export const attendanceEmployeeViewColumns = [
  "employeeCode",
  "employeeName",
  "workDate",
  "morningCheckInAt",
  "morningCheckOutAt",
  "afternoonCheckInAt",
  "afternoonCheckOutAt",
  "nightCheckInAt",
  "nightCheckOutAt",
  "workDay",
  "lateMinutes",
  "earlyLeaveMinutes",
  "overtimeMinutes",
  "status",
] as const;

export const defaultEmployeeViewSettings = {
  payrollColumns: [...payrollEmployeeViewColumns],
  attendanceColumns: [...attendanceEmployeeViewColumns],
};

export type PayrollEmployeeViewColumn = (typeof payrollEmployeeViewColumns)[number];
export type AttendanceEmployeeViewColumn = (typeof attendanceEmployeeViewColumns)[number];
