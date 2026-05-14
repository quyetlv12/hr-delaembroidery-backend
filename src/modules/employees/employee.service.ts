import { unlink } from "node:fs/promises";

import { HttpError } from "../../common/http-error";
import { AppDataSource } from "../../database/data-source";
import { Employee, EmployeeDocument } from "../../entities";
import { PayrollService } from "../payroll/payroll.service";
import type { CreateEmployeeDto, UpdateEmployeeDto } from "./employee.dto";
import { EmployeeRepository } from "./employee.repository";

export class EmployeeService {
  private readonly documentRepository = AppDataSource.getRepository(EmployeeDocument);

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

  async update(id: string, dto: UpdateEmployeeDto) {
    const employee = await this.employeeRepository.update(id, dto);
    if (!employee) {
      throw new HttpError(404, "EMPLOYEE_NOT_FOUND", "Không tìm thấy nhân viên");
    }

    await this.payrollService.recalculateUnlockedPeriodsForEmployee(id);
    return this.toDto(employee);
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
}
