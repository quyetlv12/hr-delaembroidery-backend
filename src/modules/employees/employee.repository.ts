import bcrypt from "bcryptjs";

import { generateLoginCode, getLoginCodeFromEmployeeCode } from "../../common/login-code";
import { systemRoles } from "../../config/permissions";
import { AppDataSource } from "../../database/data-source";
import { BankAccount, Department, Employee, Position, Role, User } from "../../entities";
import type { CreateEmployeeDto, UpdateEmployeeDto } from "./employee.dto";

const DEFAULT_EMPLOYEE_PASSWORD = "123456789";

export class EmployeeRepository {
  private readonly repository = AppDataSource.getRepository(Employee);
  private readonly bankAccountRepository = AppDataSource.getRepository(BankAccount);
  private readonly departmentRepository = AppDataSource.getRepository(Department);
  private readonly positionRepository = AppDataSource.getRepository(Position);
  private readonly roleRepository = AppDataSource.getRepository(Role);
  private readonly userRepository = AppDataSource.getRepository(User);

  findAll() {
    return this.repository.find({
      relations: {
        department: true,
        position: true,
        bankAccounts: true,
        user: true,
      },
      order: {
        employeeCode: "ASC",
      },
    });
  }

  findById(id: string) {
    return this.repository.findOne({
      where: { id },
      relations: {
        department: true,
        position: true,
        bankAccounts: true,
        user: true,
      },
    });
  }

  async create(dto: CreateEmployeeDto) {
    const employee = this.repository.create({
      employeeCode: dto.employeeCode,
      timekeepingCode: dto.timekeepingCode,
      fullName: dto.fullName,
      gender: dto.gender,
      birthday: dto.birthday,
      email: dto.email,
      phone: dto.phone,
      cccd: dto.cccd,
      address: dto.address,
      joinDate: dto.joinDate,
      contractType: dto.contractType,
      shiftCount: dto.shiftCount,
      baseSalary: String(dto.salary),
      taxCode: dto.taxCode,
      insuranceCode: dto.insuranceCode,
      status: dto.status,
      department: dto.departmentId ? ({ id: dto.departmentId } as Department) : null,
      position: dto.positionId ? ({ id: dto.positionId } as Position) : null,
    });

    const savedEmployee = await this.repository.save(employee);
    await this.savePrimaryBankAccount(savedEmployee, dto);
    await this.ensureEmployeeUser(savedEmployee, dto);
    return this.findById(savedEmployee.id);
  }

  async update(id: string, dto: UpdateEmployeeDto) {
    const employee = await this.findById(id);
    if (!employee) {
      return null;
    }

    this.repository.merge(employee, {
      employeeCode: dto.employeeCode,
      timekeepingCode: dto.timekeepingCode,
      fullName: dto.fullName,
      gender: dto.gender,
      birthday: dto.birthday,
      email: dto.email,
      phone: dto.phone,
      cccd: dto.cccd,
      address: dto.address,
      joinDate: dto.joinDate,
      contractType: dto.contractType,
      shiftCount: dto.shiftCount,
      baseSalary: String(dto.salary),
      taxCode: dto.taxCode,
      insuranceCode: dto.insuranceCode,
      status: dto.status,
      department: dto.departmentId ? ({ id: dto.departmentId } as Department) : null,
      position: dto.positionId ? ({ id: dto.positionId } as Position) : null,
    });

    const savedEmployee = await this.repository.save(employee);
    await this.savePrimaryBankAccount(savedEmployee, dto);
    await this.ensureEmployeeUser(savedEmployee, dto);
    return this.findById(savedEmployee.id);
  }

  async softDelete(id: string) {
    return AppDataSource.transaction(async (manager) => {
      const employee = await manager.getRepository(Employee).findOne({
        where: { id },
        relations: { user: true },
      });
      if (!employee) {
        return { affected: 0 };
      }

      const deletedAt = new Date();
      const suffix = deletedAt.getTime().toString(36);
      await this.softDeleteEmployeeData(manager, id);

      if (employee.user) {
        await manager.query("DELETE FROM `user_roles` WHERE `user_id` = ?", [employee.user.id]);
        await manager.query(
          "UPDATE `users` SET `login_code` = ?, `email` = ?, `is_active` = 0, `deleted_at` = ? WHERE `id` = ?",
          [
            await this.generateDeletedLoginCode(manager),
            buildDeletedEmail(employee.user.email, suffix),
            deletedAt,
            employee.user.id,
          ],
        );
      }

      await manager.query(
        "UPDATE `employees` SET `employee_code` = ?, `timekeeping_code` = ?, `email` = ?, `status` = 'inactive', `user_id` = NULL, `deleted_at` = ? WHERE `id` = ?",
        [
          buildDeletedCode(employee.employeeCode, suffix),
          employee.timekeepingCode ? buildDeletedCode(employee.timekeepingCode, suffix) : null,
          buildDeletedEmail(employee.email, suffix),
          deletedAt,
          id,
        ],
      );

      return { affected: 1 };
    });
  }

  async getFormOptions() {
    const [departments, positions] = await Promise.all([
      this.departmentRepository.find({ order: { name: "ASC" } }),
      this.positionRepository.find({
        relations: { department: true },
        order: { name: "ASC" },
      }),
    ]);

    return {
      departments: departments.map((department) => ({
        label: department.name,
        value: department.id,
      })),
      positions: positions.map((position) => ({
        label: position.department ? `${position.name} (${position.department.name})` : position.name,
        value: position.id,
      })),
    };
  }

  private async savePrimaryBankAccount(employee: Employee, dto: CreateEmployeeDto | UpdateEmployeeDto) {
    const bankName = dto.bankName?.trim();
    const accountNumber = dto.bankAccount?.trim();
    const existingBankAccount = await this.bankAccountRepository.findOne({
      where: {
        employee: { id: employee.id },
        isPrimary: true,
      },
      relations: { employee: true },
    });

    if (!bankName && !accountNumber) {
      if (existingBankAccount) {
        await this.bankAccountRepository.softDelete(existingBankAccount.id);
      }
      return;
    }

    const bankAccountData = {
      bankName: bankName ?? "",
      accountNumber: accountNumber ?? "",
      accountHolder: employee.fullName,
      isPrimary: true,
      employee,
    };

    if (existingBankAccount) {
      this.bankAccountRepository.merge(existingBankAccount, bankAccountData);
      await this.bankAccountRepository.save(existingBankAccount);
      return;
    }

    await this.bankAccountRepository.save(this.bankAccountRepository.create(bankAccountData));
  }

  private async ensureEmployeeUser(employee: Employee, dto: CreateEmployeeDto | UpdateEmployeeDto) {
    const employeeRole = await this.roleRepository.findOneOrFail({
      where: { name: systemRoles.employee.name },
    });
    const employeeWithUser = await this.repository.findOne({
      where: { id: employee.id },
      relations: {
        user: {
          roles: true,
        },
      },
    });
    let user =
      employeeWithUser?.user ??
      (await this.userRepository.findOne({
        where: { email: dto.email },
        relations: { roles: true },
      }));

    if (user) {
      if (!user.loginCode) {
        const loginCode = await this.resolveLoginCode(dto.employeeCode, user.id);
        if (!loginCode) {
          throw new Error("Không thể tạo mã đăng nhập");
        }
        user.loginCode = loginCode;
      } else {
        const preferredLoginCode = await this.resolveLoginCode(dto.employeeCode, user.id, false);
        if (preferredLoginCode && user.loginCode !== preferredLoginCode) {
          user.loginCode = preferredLoginCode;
        }
      }
      user.email = dto.email;
      user.fullName = dto.fullName;
      user.isActive = dto.status !== "inactive";
      user.roles = mergeRoles(user.roles, employeeRole);
      if (dto.loginPassword) {
        user.passwordHash = await bcrypt.hash(dto.loginPassword, 12);
      }
    } else {
      const loginCode = await this.resolveLoginCode(dto.employeeCode);
      if (!loginCode) {
        throw new Error("Không thể tạo mã đăng nhập");
      }
      user = this.userRepository.create({
        loginCode,
        email: dto.email,
        fullName: dto.fullName,
        passwordHash: await bcrypt.hash(dto.loginPassword ?? DEFAULT_EMPLOYEE_PASSWORD, 12),
        isActive: dto.status !== "inactive",
        roles: [employeeRole],
      });
    }

    const savedUser = await this.userRepository.save(user);
    const nextEmployee = employeeWithUser ?? employee;
    nextEmployee.user = savedUser;
    await this.repository.save(nextEmployee);
  }

  private async resolveLoginCode(employeeCode: string, currentUserId?: string, fallbackToGenerated = true) {
    const preferredLoginCode = getLoginCodeFromEmployeeCode(employeeCode);
    if (preferredLoginCode) {
      const existingUser = await this.userRepository.findOne({
        where: { loginCode: preferredLoginCode },
        withDeleted: true,
      });
      if (!existingUser || existingUser.id === currentUserId) {
        return preferredLoginCode;
      }
    }

    return fallbackToGenerated ? generateLoginCode(this.userRepository) : null;
  }

  private async softDeleteEmployeeData(manager: typeof AppDataSource.manager, employeeId: string) {
    const deletedAt = new Date();
    await softDeleteTableRows(manager, "bank_accounts", "`employeeId` = ?", [employeeId], deletedAt);
    await softDeleteTableRows(manager, "attendance_logs", "`employeeId` = ?", [employeeId], deletedAt);
    await softDeleteTableRows(manager, "attendance_summary", "`employeeId` = ?", [employeeId], deletedAt);
    await softDeleteTableRows(manager, "employee_documents", "`employeeId` = ?", [employeeId], deletedAt);
    await softDeleteTableRows(manager, "allowances", "`employeeId` = ?", [employeeId], deletedAt);
    await softDeleteTableRows(manager, "deductions", "`employeeId` = ?", [employeeId], deletedAt);

    if (await tableExists(manager, "salary_records")) {
      const salaryRecords = (await manager.query("SELECT `id` FROM `salary_records` WHERE `employeeId` = ?", [
        employeeId,
      ])) as Array<{ id: string }>;
      const salaryRecordIds = salaryRecords.map((record) => record.id);
      if (salaryRecordIds.length > 0) {
        await softDeleteTableRows(
          manager,
          "salary_email_logs",
          "`salaryRecordId` IN (?)",
          [salaryRecordIds],
          deletedAt,
        );
        await softDeleteTableRows(
          manager,
          "salary_details",
          "`salaryRecordId` IN (?)",
          [salaryRecordIds],
          deletedAt,
        );
      }
      await softDeleteTableRows(manager, "salary_records", "`employeeId` = ?", [employeeId], deletedAt);
    }
  }

  private async generateDeletedLoginCode(manager: typeof AppDataSource.manager) {
    for (let index = 0; index < 100; index += 1) {
      const code = `X${Math.random().toString(36).slice(2, 7).toUpperCase()}`.slice(0, 6);
      const existing = (await manager.query("SELECT `id` FROM `users` WHERE `login_code` = ? LIMIT 1", [code])) as unknown[];
      if (existing.length === 0) {
        return code;
      }
    }

    return `X${Date.now().toString(36).slice(-5).toUpperCase()}`.slice(0, 6);
  }
}

function mergeRoles(currentRoles: Role[] = [], role: Role) {
  const roleMap = new Map(currentRoles.map((currentRole) => [currentRole.id, currentRole]));
  roleMap.set(role.id, role);
  return Array.from(roleMap.values());
}

async function softDeleteTableRows(
  manager: typeof AppDataSource.manager,
  tableName: string,
  whereClause: string,
  parameters: unknown[],
  deletedAt: Date,
) {
  if (!(await tableExists(manager, tableName))) {
    return;
  }

  await manager.query(`UPDATE \`${tableName}\` SET \`deleted_at\` = ? WHERE ${whereClause}`, [deletedAt, ...parameters]);
}

async function tableExists(manager: typeof AppDataSource.manager, tableName: string) {
  const rows = (await manager.query("SHOW TABLES LIKE ?", [tableName])) as unknown[];
  return rows.length > 0;
}

function buildDeletedCode(value: string, suffix: string) {
  return `DEL-${suffix}-${value}`.slice(0, 50);
}

function buildDeletedEmail(value: string, suffix: string) {
  const [localPart, domain = "deleted.local"] = value.split("@");
  return `deleted-${suffix}-${localPart}@${domain}`.slice(0, 180);
}
