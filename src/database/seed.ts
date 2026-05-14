import "reflect-metadata";

import bcrypt from "bcryptjs";
import type { Repository } from "typeorm";

import { allPermissions, systemRoles } from "../config/permissions";
import { env } from "../config/env";
import { generateLoginCode, getLoginCodeFromEmployeeCode } from "../common/login-code";
import {
  BankAccount,
  Department,
  Employee,
  EmployeeViewSetting,
  PayrollFormulaSetting,
  Permission,
  Position,
  Role,
  User,
} from "../entities";
import { defaultEmployeeViewSettings } from "../modules/employee-view-settings/employee-view-settings.constants";
import { DEFAULT_PAYROLL_FORMULA_SETTING } from "../modules/payroll/payroll-formula";
import { AppDataSource } from "./data-source";

async function seed() {
  await AppDataSource.initialize();
  await AppDataSource.runMigrations();

  const departmentRepository = AppDataSource.getRepository(Department);
  const employeeRepository = AppDataSource.getRepository(Employee);
  const employeeViewSettingRepository = AppDataSource.getRepository(EmployeeViewSetting);
  const bankAccountRepository = AppDataSource.getRepository(BankAccount);
  const payrollFormulaSettingRepository = AppDataSource.getRepository(PayrollFormulaSetting);
  const permissionRepository = AppDataSource.getRepository(Permission);
  const positionRepository = AppDataSource.getRepository(Position);
  const roleRepository = AppDataSource.getRepository(Role);
  const userRepository = AppDataSource.getRepository(User);

  await seedPayrollFormulaSetting(payrollFormulaSettingRepository);
  await seedEmployeeViewSetting(employeeViewSettingRepository);

  const permissions = await Promise.all(
    allPermissions.map(async (code) => {
      const [module, action] = code.split(":");
      const existingPermission = await permissionRepository.findOne({ where: { code } });
      return (
        existingPermission ??
        permissionRepository.save(
          permissionRepository.create({
            code,
            module,
            action,
          }),
        )
      );
    }),
  );

  for (const roleConfig of Object.values(systemRoles)) {
    const roleNames = [roleConfig.name, ...(roleConfig.legacyNames ?? [])];
    const existingRole = await roleRepository.findOne({
      where: roleNames.map((name) => ({ name })),
      relations: { permissions: true },
    });
    const allowedPermissionCodes = new Set<string>(roleConfig.permissions);
    const rolePermissions = permissions.filter((permission) => allowedPermissionCodes.has(permission.code));

    if (existingRole) {
      existingRole.name = roleConfig.name;
      existingRole.permissions = rolePermissions;
      existingRole.isSystem = roleConfig.isSystem;
      await roleRepository.save(existingRole);
      continue;
    }

    await roleRepository.save(
      roleRepository.create({
        name: roleConfig.name,
        isSystem: roleConfig.isSystem,
        permissions: rolePermissions,
      }),
    );
  }

  if (env.ADMIN_EMAIL && env.ADMIN_PASSWORD) {
    const adminRole = await roleRepository.findOneOrFail({ where: { name: systemRoles.admin.name } });
    await upsertUser(userRepository, {
      email: env.ADMIN_EMAIL,
      fullName: "Quản trị viên hệ thống",
      password: env.ADMIN_PASSWORD,
      role: adminRole,
    });
  }

  const employeeRole = await roleRepository.findOneOrFail({ where: { name: systemRoles.employee.name } });
  const employeeUser = await upsertUser(userRepository, {
    email: env.TEST_EMPLOYEE_EMAIL,
    fullName: "Nguyễn Văn Test",
    password: env.TEST_EMPLOYEE_PASSWORD,
    role: employeeRole,
  });

  const department = await upsertDepartment(departmentRepository);
  const position = await upsertPosition(positionRepository, department);
  const employee = await upsertEmployee(employeeRepository, {
    department,
    position,
    user: employeeUser,
  });
  await upsertBankAccount(bankAccountRepository, employee);
  await seedCompanyOrganization(departmentRepository, positionRepository, employeeRepository);
  await syncEmployeeUserAccounts(employeeRepository, userRepository, employeeRole);

  await AppDataSource.destroy();
}

async function upsertUser(
  userRepository: Repository<User>,
  input: {
    email: string;
    fullName: string;
    password: string;
    role: Role;
  },
) {
  const passwordHash = await bcrypt.hash(input.password, 12);
  const existingUser = await userRepository.findOne({
    where: { email: input.email },
    relations: { roles: true },
  });

  if (existingUser) {
    if (!existingUser.loginCode) {
      existingUser.loginCode = await generateLoginCode(userRepository);
    }
    existingUser.fullName = input.fullName;
    existingUser.passwordHash = passwordHash;
    existingUser.isActive = true;
    existingUser.roles = mergeRoles(existingUser.roles, input.role);
    return userRepository.save(existingUser);
  }

  return userRepository.save(
    userRepository.create({
      loginCode: await generateLoginCode(userRepository),
      email: input.email,
      fullName: input.fullName,
      passwordHash,
      roles: [input.role],
    }),
  );
}

function mergeRoles(currentRoles: Role[] = [], role: Role) {
  const roleMap = new Map(currentRoles.map((currentRole) => [currentRole.id, currentRole]));
  roleMap.set(role.id, role);
  return Array.from(roleMap.values());
}

async function upsertDepartment(
  departmentRepository: Repository<Department>,
) {
  const existingDepartment = await departmentRepository.findOne({ where: { code: "HR" } });
  if (existingDepartment) {
    existingDepartment.name = "Nhân sự";
    existingDepartment.description = "Phòng nhân sự mặc định cho dữ liệu kiểm thử";
    return departmentRepository.save(existingDepartment);
  }

  return departmentRepository.save(
    departmentRepository.create({
      code: "HR",
      name: "Nhân sự",
      description: "Phòng nhân sự mặc định cho dữ liệu kiểm thử",
    }),
  );
}

async function upsertPosition(
  positionRepository: Repository<Position>,
  department: Department,
) {
  const existingPosition = await positionRepository.findOne({
    where: { code: "HR-STAFF" },
    relations: { department: true },
  });
  if (existingPosition) {
    existingPosition.name = "Nhân viên nhân sự";
    existingPosition.department = department;
    return positionRepository.save(existingPosition);
  }

  return positionRepository.save(
    positionRepository.create({
      code: "HR-STAFF",
      name: "Nhân viên nhân sự",
      department,
    }),
  );
}

async function upsertEmployee(
  employeeRepository: Repository<Employee>,
  input: {
    department: Department;
    position: Position;
    user: User;
  },
) {
  const existingEmployee = await employeeRepository.findOne({
    where: { employeeCode: "EMP001" },
    relations: { user: true, department: true, position: true },
  });

  const employeeData = {
    employeeCode: "EMP001",
    timekeepingCode: "EMP001",
    fullName: "Nguyễn Văn Test",
    gender: "male",
    birthday: "1995-01-15",
    email: env.TEST_EMPLOYEE_EMAIL,
    phone: "0900000001",
    cccd: "001095000001",
    address: "Thành phố Hồ Chí Minh",
    joinDate: "2026-01-01",
    contractType: "Toàn thời gian",
    shiftCount: 2,
    baseSalary: "15000000",
    taxCode: "TAX-EMP001",
    insuranceCode: "INS-EMP001",
    status: "active",
    department: input.department,
    position: input.position,
    user: input.user,
  };

  if (existingEmployee) {
    employeeRepository.merge(existingEmployee, employeeData);
    return employeeRepository.save(existingEmployee);
  }

  return employeeRepository.save(employeeRepository.create(employeeData));
}

async function upsertBankAccount(
  bankAccountRepository: Repository<BankAccount>,
  employee: Employee,
) {
  const existingBankAccount = await bankAccountRepository.findOne({
    where: {
      employee: { id: employee.id },
      isPrimary: true,
    },
    relations: { employee: true },
  });

  const bankAccountData = {
    bankName: "Vietcombank",
    accountNumber: "0123456789",
    accountHolder: employee.fullName,
    isPrimary: true,
    employee,
  };

  if (existingBankAccount) {
    bankAccountRepository.merge(existingBankAccount, bankAccountData);
    return bankAccountRepository.save(existingBankAccount);
  }

  return bankAccountRepository.save(bankAccountRepository.create(bankAccountData));
}

async function seedPayrollFormulaSetting(
  payrollFormulaSettingRepository: Repository<PayrollFormulaSetting>,
) {
  const existingSetting = await payrollFormulaSettingRepository.findOne({
    where: {},
    order: { createdAt: "ASC" },
  });
  if (existingSetting) {
    return existingSetting;
  }

  return payrollFormulaSettingRepository.save(
    payrollFormulaSettingRepository.create({
      insuranceBaseSalary: String(DEFAULT_PAYROLL_FORMULA_SETTING.insuranceBaseSalary),
      employeeInsuranceRate: String(DEFAULT_PAYROLL_FORMULA_SETTING.employeeInsuranceRate),
      employerInsuranceRate: String(DEFAULT_PAYROLL_FORMULA_SETTING.employerInsuranceRate),
      earningCategories: DEFAULT_PAYROLL_FORMULA_SETTING.earningCategories.map((category) => ({ ...category })),
      deductionCategories: DEFAULT_PAYROLL_FORMULA_SETTING.deductionCategories.map((category) => ({ ...category })),
      dailySalaryFormula: DEFAULT_PAYROLL_FORMULA_SETTING.dailySalaryFormula,
      grossSalaryFormula: DEFAULT_PAYROLL_FORMULA_SETTING.grossSalaryFormula,
      deductionFormula: DEFAULT_PAYROLL_FORMULA_SETTING.deductionFormula,
      netSalaryFormula: DEFAULT_PAYROLL_FORMULA_SETTING.netSalaryFormula,
    }),
  );
}

async function seedEmployeeViewSetting(
  employeeViewSettingRepository: Repository<EmployeeViewSetting>,
) {
  const existingSetting = await employeeViewSettingRepository.findOne({
    where: {},
    order: { createdAt: "ASC" },
  });
  if (existingSetting) {
    return existingSetting;
  }

  return employeeViewSettingRepository.save(
    employeeViewSettingRepository.create({
      payrollColumns: [...defaultEmployeeViewSettings.payrollColumns],
      attendanceColumns: [...defaultEmployeeViewSettings.attendanceColumns],
    }),
  );
}

async function syncEmployeeUserAccounts(
  employeeRepository: Repository<Employee>,
  userRepository: Repository<User>,
  employeeRole: Role,
) {
  const employees = await employeeRepository.find({
    relations: {
      user: {
        roles: true,
      },
    },
  });

  for (const employee of employees) {
    const user =
      employee.user ??
      (await userRepository.findOne({
        where: { email: employee.email },
        relations: { roles: true },
      }));

    if (user) {
      if (!user.loginCode) {
        const loginCode = await resolveEmployeeLoginCode(userRepository, employee.employeeCode, user.id);
        if (!loginCode) {
          throw new Error("Không thể tạo mã đăng nhập");
        }
        user.loginCode = loginCode;
      } else {
        const preferredLoginCode = await resolveEmployeeLoginCode(userRepository, employee.employeeCode, user.id, false);
        if (preferredLoginCode && user.loginCode !== preferredLoginCode) {
          user.loginCode = preferredLoginCode;
        }
      }
      user.email = employee.email;
      user.fullName = employee.fullName;
      user.isActive = true;
      user.roles = mergeRoles(user.roles, employeeRole);
      await userRepository.save(user);
      employee.user = user;
      await employeeRepository.save(employee);
      continue;
    }

    const createdUser = await upsertUser(userRepository, {
      email: employee.email,
      fullName: employee.fullName,
      password: "123456789",
      role: employeeRole,
    });
    const preferredLoginCode = await resolveEmployeeLoginCode(userRepository, employee.employeeCode, createdUser.id, false);
    if (preferredLoginCode && createdUser.loginCode !== preferredLoginCode) {
      createdUser.loginCode = preferredLoginCode;
      await userRepository.save(createdUser);
    }
    employee.user = createdUser;
    await employeeRepository.save(employee);
  }
}

async function resolveEmployeeLoginCode(
  userRepository: Repository<User>,
  employeeCode: string,
  currentUserId?: string,
  fallbackToGenerated = true,
) {
  const preferredLoginCode = getLoginCodeFromEmployeeCode(employeeCode);
  if (preferredLoginCode) {
    const existingUser = await userRepository.findOne({
      where: { loginCode: preferredLoginCode },
      withDeleted: true,
    });
    if (!existingUser || existingUser.id === currentUserId) {
      return preferredLoginCode;
    }
  }

  return fallbackToGenerated ? generateLoginCode(userRepository) : null;
}

const departmentAssignments = [
  {
    code: "SAN-XUAT",
    name: "Sản xuất",
    employees: [
      { name: "Trần Khắc Hùng", positionCode: "TP1" },
      { name: "Hoàng Anh Tuấn", positionCode: "TP2" },
      { name: "Chu Đức Anh", positionCode: "NV" },
      { name: "Hoàng Văn Hiếu", positionCode: "NV" },
      { name: "Bùi Hồng Quân", positionCode: "NV" },
      { name: "Vũ Xuân Tuấn", positionCode: "NV" },
      { name: "Phạm Đức Mạnh", positionCode: "NV" },
    ],
  },
  {
    code: "THIET-KE",
    name: "Thiết kế",
    employees: [
      { name: "Nguyễn Thanh Hải", positionCode: "TP1" },
      { name: "Trịnh Khắc Hiếu", positionCode: "TP2" },
      { name: "Đoàn Văn Hùng", positionCode: "NV" },
      { name: "Lê Quang Thắng", positionCode: "NV" },
      { name: "Lê Viết Trung", positionCode: "NV" },
    ],
  },
  {
    code: "CHAM-SOC-KH",
    name: "Chăm sóc KH",
    employees: [
      { name: "Nguyễn Thị Thu", positionCode: "TP" },
      { name: "Tô Hương Giang", positionCode: "NV" },
      { name: "Hà Thị Hương", positionCode: "NV" },
    ],
  },
  {
    code: "KHO-DONG-GOI",
    name: "Kho và đóng gói",
    employees: [
      { name: "Ngô Hoàng Phúc", positionCode: "TP" },
      { name: "Tào Thu Phương", positionCode: "NV" },
      { name: "Mai Thị Hiền", positionCode: "NV" },
      { name: "Mai Hoàng Điệp", positionCode: "NV" },
      { name: "Lê Thị Thùy Linh", positionCode: "NV" },
    ],
  },
] as const;

async function seedCompanyOrganization(
  departmentRepository: Repository<Department>,
  positionRepository: Repository<Position>,
  employeeRepository: Repository<Employee>,
) {
  for (const departmentConfig of departmentAssignments) {
    const department = await upsertNamedDepartment(departmentRepository, departmentConfig.code, departmentConfig.name);
    const positionMap = new Map<string, Position>();
    const positionCodes = Array.from(new Set(departmentConfig.employees.map((employee) => employee.positionCode)));

    for (const positionCode of positionCodes) {
      const position = await upsertDepartmentPosition(positionRepository, department, positionCode);
      positionMap.set(positionCode, position);
    }

    for (const assignment of departmentConfig.employees) {
      const employee = await employeeRepository.findOne({ where: { fullName: assignment.name } });
      const position = positionMap.get(assignment.positionCode);
      if (!employee || !position) {
        continue;
      }

      employee.department = department;
      employee.position = position;
      await employeeRepository.save(employee);
    }
  }
}

async function upsertNamedDepartment(
  departmentRepository: Repository<Department>,
  code: string,
  name: string,
) {
  const existingDepartment = await departmentRepository.findOne({ where: { code } });
  if (existingDepartment) {
    existingDepartment.name = name;
    existingDepartment.description = `Bộ phận ${name}`;
    return departmentRepository.save(existingDepartment);
  }

  return departmentRepository.save(
    departmentRepository.create({
      code,
      name,
      description: `Bộ phận ${name}`,
    }),
  );
}

async function upsertDepartmentPosition(
  positionRepository: Repository<Position>,
  department: Department,
  positionCode: string,
) {
  const code = `${department.code}-${positionCode}`;
  const existingPosition = await positionRepository.findOne({
    where: { code },
    relations: { department: true },
  });
  const positionData = {
    code,
    name: getPositionName(positionCode),
    department,
  };

  if (existingPosition) {
    positionRepository.merge(existingPosition, positionData);
    return positionRepository.save(existingPosition);
  }

  return positionRepository.save(positionRepository.create(positionData));
}

function getPositionName(positionCode: string) {
  const names: Record<string, string> = {
    TP1: "Tổ trưởng 1",
    TP2: "Tổ trưởng 2",
    TP: "Trưởng phòng",
    NV: "Nhân viên",
  };

  return names[positionCode] ?? positionCode;
}

void seed();
