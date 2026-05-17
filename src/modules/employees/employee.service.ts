import { unlink } from "node:fs/promises";
import path from "node:path";

import { HttpError } from "../../common/http-error";
import { AppDataSource } from "../../database/data-source";
import { Employee, EmployeeDocument, EmployeeSalaryHistory } from "../../entities";
import { PayrollService } from "../payroll/payroll.service";
import type { CreateEmployeeDto, IncreaseEmployeeSalaryDto, UpdateEmployeeDto, UpdateEmployeeSalaryDto } from "./employee.dto";
import { EmployeeRepository } from "./employee.repository";

const storageRoot = path.resolve(process.cwd(), "storage");
const employeeAvatarDirectory = path.resolve(storageRoot, "employee-avatars");

type SalaryChangeActor = {
  id?: string;
  loginCode?: string;
};

export class EmployeeService {
  private readonly employeeOrmRepository = AppDataSource.getRepository(Employee);
  private readonly documentRepository = AppDataSource.getRepository(EmployeeDocument);
  private readonly salaryHistoryRepository = AppDataSource.getRepository(EmployeeSalaryHistory);

  constructor(
    private readonly employeeRepository = new EmployeeRepository(),
    private readonly payrollService = new PayrollService(),
  ) {}

  async list(employeeId?: string) {
    const employees = employeeId
      ? [await this.employeeRepository.findById(employeeId)].filter((employee): employee is Employee => Boolean(employee))
      : await this.employeeRepository.findAll();
    return employees.map((employee) => this.toDto(employee));
  }

  async create(dto: CreateEmployeeDto) {
    const employee = await this.employeeRepository.create(dto);
    if (!employee) {
      throw new HttpError(500, "EMPLOYEE_CREATE_FAILED", "Không thể tạo nhân viên");
    }
    return this.toDto(employee);
  }

  async detail(id: string) {
    const employee = await this.employeeRepository.findById(id);
    if (!employee) {
      throw new HttpError(404, "EMPLOYEE_NOT_FOUND", "Không tìm thấy nhân viên");
    }

    return this.toDto(employee);
  }

  async update(id: string, dto: UpdateEmployeeDto, actor?: SalaryChangeActor) {
    const previousEmployee = await this.employeeRepository.findById(id);
    const employee = await this.employeeRepository.update(id, dto);
    if (!employee) {
      throw new HttpError(404, "EMPLOYEE_NOT_FOUND", "Không tìm thấy nhân viên");
    }

    await this.recordSalaryHistory({
      actor,
      changeSource: "form_update",
      employee,
      newSalary: Number(employee.baseSalary),
      previousSalary: previousEmployee ? Number(previousEmployee.baseSalary) : Number(employee.baseSalary),
    });
    await this.payrollService.recalculateUnlockedPeriodsForEmployee(id);
    return this.toDto(employee);
  }

  async updateSalary(id: string, dto: UpdateEmployeeSalaryDto, actor?: SalaryChangeActor) {
    const previousEmployee = await this.employeeRepository.findById(id);
    const employee = await this.employeeRepository.updateSalary(id, dto.salary);
    if (!employee) {
      throw new HttpError(404, "EMPLOYEE_NOT_FOUND", "Không tìm thấy nhân viên");
    }

    await this.recordSalaryHistory({
      actor,
      changeSource: "manual_update",
      employee,
      newSalary: Number(employee.baseSalary),
      previousSalary: previousEmployee ? Number(previousEmployee.baseSalary) : Number(employee.baseSalary),
    });
    await this.payrollService.recalculateUnlockedPeriodsForEmployee(id);
    return this.toDto(employee);
  }

  async increaseSalaries(dto: IncreaseEmployeeSalaryDto, actor?: SalaryChangeActor) {
    const changes = await this.employeeRepository.increaseSalaries(dto);
    for (const change of changes) {
      await this.recordSalaryHistory({
        actor,
        changeMode: dto.mode,
        changeSource: "salary_increase",
        changeValue: dto.value,
        employee: change.employee,
        newSalary: change.newSalary,
        previousSalary: change.previousSalary,
      });
      await this.payrollService.recalculateUnlockedPeriodsForEmployee(change.employee.id);
    }

    return {
      updated: changes.length,
      employees: changes.map((change) => this.toDto(change.employee)),
    };
  }

  async remove(id: string) {
    const result = await this.employeeRepository.softDelete(id);
    if (!result.affected) {
      throw new HttpError(404, "EMPLOYEE_NOT_FOUND", "Không tìm thấy nhân viên");
    }

    return { id };
  }

  formOptions() {
    return this.employeeRepository.getFormOptions();
  }

  async listDocuments(employeeId: string) {
    await this.ensureEmployeeExists(employeeId);
    const documents = await this.documentRepository.find({
      where: { employee: { id: employeeId } },
      relations: { employee: true },
      order: { createdAt: "DESC" },
    });
    return documents.map((document) => this.toDocumentDto(document));
  }

  async listSalaryHistory(employeeId: string) {
    await this.ensureEmployeeExists(employeeId);
    return this.listSalaryHistories(employeeId);
  }

  async listSalaryHistories(employeeId?: string) {
    const histories = await this.salaryHistoryRepository.find({
      ...(employeeId ? { where: { employee: { id: employeeId } } } : {}),
      relations: { employee: { department: true, position: true } },
      order: { createdAt: "DESC" },
    });
    return histories.map((history) => this.toSalaryHistoryDto(history));
  }

  async uploadAvatar(employeeId: string, file?: Express.Multer.File) {
    const employee = await this.ensureEmployeeExists(employeeId);
    if (!file) {
      throw new HttpError(400, "EMPLOYEE_AVATAR_REQUIRED", "Vui lòng chọn ảnh đại diện");
    }

    await this.removeAvatarFile(employee);
    employee.avatarUrl = this.toStorageUrl(file.path);
    employee.avatarPublicId = file.filename;
    employee.avatarUploadedAt = new Date();

    const savedEmployee = await this.employeeOrmRepository.save(employee);
    const reloadedEmployee = await this.employeeRepository.findById(savedEmployee.id);
    return this.toDto(reloadedEmployee ?? savedEmployee);
  }

  async deleteAvatar(employeeId: string) {
    const employee = await this.ensureEmployeeExists(employeeId);
    await this.removeAvatarFile(employee);
    employee.avatarUrl = null;
    employee.avatarPublicId = null;
    employee.avatarUploadedAt = null;

    const savedEmployee = await this.employeeOrmRepository.save(employee);
    const reloadedEmployee = await this.employeeRepository.findById(savedEmployee.id);
    return this.toDto(reloadedEmployee ?? savedEmployee);
  }

  async uploadDocuments(employeeId: string, files: Express.Multer.File[]) {
    const employee = await this.ensureEmployeeExists(employeeId);
    if (files.length === 0) {
      throw new HttpError(400, "EMPLOYEE_DOCUMENT_REQUIRED", "Vui lòng chọn file để tải lên");
    }

    const documents = await this.documentRepository.save(
      files.map((file) =>
        this.documentRepository.create({
          employee,
          originalName: file.originalname,
          storedName: file.filename,
          mimeType: file.mimetype,
          size: String(file.size),
          storagePath: file.path,
        }),
      ),
    );
    return documents.map((document) => this.toDocumentDto(document));
  }

  async getDocumentForDownload(employeeId: string, documentId: string) {
    const document = await this.findDocument(employeeId, documentId);
    return {
      path: document.storagePath,
      fileName: document.originalName,
      mimeType: document.mimeType ?? "application/octet-stream",
    };
  }

  async deleteDocument(employeeId: string, documentId: string) {
    const document = await this.findDocument(employeeId, documentId);
    await this.documentRepository.softDelete(document.id);
    await unlink(document.storagePath).catch(() => undefined);
    return { id: document.id };
  }

  private async ensureEmployeeExists(employeeId: string) {
    const employee = await this.employeeRepository.findById(employeeId);
    if (!employee) {
      throw new HttpError(404, "EMPLOYEE_NOT_FOUND", "Không tìm thấy nhân viên");
    }
    return employee;
  }

  private async findDocument(employeeId: string, documentId: string) {
    const document = await this.documentRepository.findOne({
      where: { id: documentId, employee: { id: employeeId } },
      relations: { employee: true },
    });
    if (!document) {
      throw new HttpError(404, "EMPLOYEE_DOCUMENT_NOT_FOUND", "Không tìm thấy file nhân viên");
    }
    return document;
  }

  private async removeAvatarFile(employee: Employee) {
    if (!employee.avatarPublicId || !employee.avatarUrl?.startsWith("/storage/employee-avatars/")) {
      return;
    }

    const avatarPath = path.resolve(employeeAvatarDirectory, employee.avatarPublicId);
    if (!avatarPath.startsWith(employeeAvatarDirectory)) {
      return;
    }

    await unlink(avatarPath).catch(() => undefined);
  }

  private toStorageUrl(filePath: string) {
    const relativePath = path.relative(storageRoot, filePath).split(path.sep).join("/");
    return `/storage/${relativePath}`;
  }

  private async recordSalaryHistory({
    actor,
    changeMode,
    changeSource,
    changeValue,
    employee,
    newSalary,
    previousSalary,
  }: {
    actor?: SalaryChangeActor;
    changeMode?: string;
    changeSource: string;
    changeValue?: number;
    employee: Employee;
    newSalary: number;
    previousSalary: number;
  }) {
    if (Math.abs(newSalary - previousSalary) < 1) {
      return;
    }

    const changeAmount = roundCurrency(newSalary - previousSalary);
    const changePercent = previousSalary > 0 ? (changeAmount / previousSalary) * 100 : null;
    await this.salaryHistoryRepository.save(
      this.salaryHistoryRepository.create({
        employee,
        previousSalary: String(roundCurrency(previousSalary)),
        newSalary: String(roundCurrency(newSalary)),
        changeAmount: String(changeAmount),
        changePercent: changePercent === null ? null : changePercent.toFixed(4),
        changeSource,
        changeMode: changeMode ?? null,
        changeValue: changeValue === undefined ? null : String(changeValue),
        changedByUserId: actor?.id ?? null,
        changedByLoginCode: actor?.loginCode ?? null,
      }),
    );
  }

  private toDto(employee: Employee) {
    const primaryBankAccount = employee.bankAccounts?.find((bankAccount) => bankAccount.isPrimary);

    return {
      id: employee.id,
      employeeCode: employee.employeeCode,
      loginCode: employee.user?.loginCode,
      timekeepingCode: employee.timekeepingCode ?? undefined,
      fullName: employee.fullName,
      avatarUrl: employee.avatarUrl ?? undefined,
      gender: employee.gender,
      birthday: employee.birthday ?? undefined,
      email: employee.email,
      phone: employee.phone ?? undefined,
      cccd: employee.cccd ?? undefined,
      address: employee.address ?? undefined,
      department: employee.department?.name,
      departmentId: employee.department?.id,
      position: employee.position?.name,
      positionId: employee.position?.id,
      joinDate: employee.joinDate,
      contractType: employee.contractType ?? undefined,
      shiftCount: employee.shiftCount,
      salary: Number(employee.baseSalary),
      bankAccount: primaryBankAccount?.accountNumber,
      bankName: primaryBankAccount?.bankName,
      taxCode: employee.taxCode ?? undefined,
      insuranceCode: employee.insuranceCode ?? undefined,
      status: employee.status,
    };
  }

  private toDocumentDto(document: EmployeeDocument) {
    return {
      id: document.id,
      originalName: document.originalName,
      mimeType: document.mimeType ?? undefined,
      size: Number(document.size),
      uploadedAt: document.createdAt,
    };
  }

  private toSalaryHistoryDto(history: EmployeeSalaryHistory) {
    return {
      id: history.id,
      employeeId: history.employee?.id,
      employeeCode: history.employee?.employeeCode,
      employeeName: history.employee?.fullName,
      departmentName: history.employee?.department?.name,
      positionName: history.employee?.position?.name,
      previousSalary: Number(history.previousSalary),
      newSalary: Number(history.newSalary),
      changeAmount: Number(history.changeAmount),
      changePercent: history.changePercent === null || history.changePercent === undefined
        ? undefined
        : Number(history.changePercent),
      changeSource: history.changeSource,
      changeMode: history.changeMode ?? undefined,
      changeValue: history.changeValue === null || history.changeValue === undefined
        ? undefined
        : Number(history.changeValue),
      changedByLoginCode: history.changedByLoginCode ?? undefined,
      createdAt: history.createdAt,
    };
  }
}

function roundCurrency(value: number) {
  return Math.round(value);
}
