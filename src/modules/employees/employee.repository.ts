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

  softDelete(id: string) {
    return this.repository.softDelete(id);
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
}

function mergeRoles(currentRoles: Role[] = [], role: Role) {
  const roleMap = new Map(currentRoles.map((currentRole) => [currentRole.id, currentRole]));
  roleMap.set(role.id, role);
  return Array.from(roleMap.values());
}
