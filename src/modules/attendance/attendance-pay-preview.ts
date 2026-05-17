export type AttendancePayPreviewRecordInput = {
  employeeId?: string;
  employeeCode: string;
  employeeName: string;
  departmentName?: string;
  positionName?: string;
  email?: string;
  configuredSalary: number;
  workDay: number;
  standardWorkDay: number;
};

export function buildAttendancePayPreviewRecord(input: AttendancePayPreviewRecordInput) {
  const configuredSalary = sanitizeMoney(input.configuredSalary);
  const workDay = roundNumber(input.workDay);
  const standardWorkDay = input.standardWorkDay > 0 ? roundNumber(input.standardWorkDay) : 0;
  const dailyWage = standardWorkDay > 0 ? roundCurrency(configuredSalary / standardWorkDay) : 0;
  const attendanceWage = roundCurrency(dailyWage * workDay);

  return {
    employeeId: input.employeeId,
    employeeCode: input.employeeCode,
    employeeName: input.employeeName,
    departmentName: input.departmentName,
    positionName: input.positionName,
    email: input.email,
    configuredSalary,
    insuranceSalary: 0,
    workDay,
    standardWorkDay,
    fixedDailySalary: dailyWage,
    responsibilityAllowance: 0,
    mealAllowance: 0,
    phoneAllowance: 0,
    kpiAllowance: 0,
    dailyTotal: dailyWage,
    overtimeWorkDay: 0,
    totalWorkDay: workDay,
    baseSalary: attendanceWage,
    earnedSalary: attendanceWage,
    allowanceTotal: 0,
    bonusTotal: 0,
    overtimeTotal: 0,
    grossSalary: attendanceWage,
    employerInsuranceTotal: 0,
    insuranceTotal: 0,
    totalInsurance: 0,
    taxTotal: 0,
    advanceTotal: 0,
    deductionTotal: 0,
    netSalary: attendanceWage,
  };
}

function sanitizeMoney(value: number) {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function roundCurrency(value: number) {
  return Math.round(value);
}

function roundNumber(value: number) {
  return Math.round(value * 100) / 100;
}
