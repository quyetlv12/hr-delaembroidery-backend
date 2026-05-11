import { HttpError } from "../../common/http-error";
import { AppDataSource } from "../../database/data-source";
import { Department, Employee, Position } from "../../entities";
import type { SaveDepartmentDto, SavePositionDto } from "./organization.dto";

export class OrganizationService {
  private readonly departmentRepository = AppDataSource.getRepository(Department);
  private readonly employeeRepository = AppDataSource.getRepository(Employee);
  private readonly positionRepository = AppDataSource.getRepository(Position);

  async listDepartments() {
    const departments = await this.departmentRepository.find({
      relations: { employees: true, positions: true },
      order: { code: "ASC" },
    });
    return departments.map((department) => this.toDepartmentDto(department));
  }

  async getDepartment(id: string) {
    const department = await this.findDepartmentOrFail(id);
    return this.toDepartmentDto(department);
  }

  async createDepartment(dto: SaveDepartmentDto) {
    const department = await this.departmentRepository.save(
      this.departmentRepository.create({
        code: dto.code.trim(),
        name: dto.name.trim(),
        description: dto.description?.trim(),
      }),
    );

    return this.getDepartment(department.id);
  }

  async updateDepartment(id: string, dto: SaveDepartmentDto) {
    const department = await this.findDepartmentOrFail(id);
    this.departmentRepository.merge(department, {
      code: dto.code.trim(),
      name: dto.name.trim(),
      description: dto.description?.trim(),
    });
    const savedDepartment = await this.departmentRepository.save(department);
    return this.getDepartment(savedDepartment.id);
  }

  async deleteDepartment(id: string) {
    await this.findDepartmentOrFail(id);
    const [employeeCount, positionCount] = await Promise.all([
      this.employeeRepository.count({ where: { department: { id } } }),
      this.positionRepository.count({ where: { department: { id } } }),
    ]);
    if (employeeCount > 0 || positionCount > 0) {
      throw new HttpError(400, "DEPARTMENT_IN_USE", "Phòng ban đang có nhân viên hoặc chức vụ");
    }

    await this.departmentRepository.softDelete(id);
    return { id };
  }

  async listPositions() {
    const positions = await this.positionRepository.find({
      relations: { department: true, employees: true },
      order: { code: "ASC" },
    });
    return positions.map((position) => this.toPositionDto(position));
  }

  async getPosition(id: string) {
    const position = await this.findPositionOrFail(id);
    return this.toPositionDto(position);
  }

  async createPosition(dto: SavePositionDto) {
    const position = await this.positionRepository.save(
      this.positionRepository.create({
        code: dto.code.trim(),
        name: dto.name.trim(),
        department: dto.departmentId ? ({ id: dto.departmentId } as Department) : null,
      }),
    );

    return this.getPosition(position.id);
  }

  async updatePosition(id: string, dto: SavePositionDto) {
    const position = await this.findPositionOrFail(id);
    this.positionRepository.merge(position, {
      code: dto.code.trim(),
      name: dto.name.trim(),
      department: dto.departmentId ? ({ id: dto.departmentId } as Department) : null,
    });
    const savedPosition = await this.positionRepository.save(position);
    return this.getPosition(savedPosition.id);
  }

  async deletePosition(id: string) {
    await this.findPositionOrFail(id);
    const employeeCount = await this.employeeRepository.count({ where: { position: { id } } });
    if (employeeCount > 0) {
      throw new HttpError(400, "POSITION_IN_USE", "Chức vụ đang có nhân viên");
    }

    await this.positionRepository.softDelete(id);
    return { id };
  }

  private async findDepartmentOrFail(id: string) {
    const department = await this.departmentRepository.findOne({
      where: { id },
      relations: { employees: true, positions: true },
    });
    if (!department) {
      throw new HttpError(404, "DEPARTMENT_NOT_FOUND", "Không tìm thấy phòng ban");
    }
    return department;
  }

  private async findPositionOrFail(id: string) {
    const position = await this.positionRepository.findOne({
      where: { id },
      relations: { department: true, employees: true },
    });
    if (!position) {
      throw new HttpError(404, "POSITION_NOT_FOUND", "Không tìm thấy chức vụ");
    }
    return position;
  }

  private toDepartmentDto(department: Department) {
    return {
      id: department.id,
      code: department.code,
      name: department.name,
      description: department.description ?? undefined,
      employeeCount: department.employees?.length ?? 0,
      positionCount: department.positions?.length ?? 0,
    };
  }

  private toPositionDto(position: Position) {
    return {
      id: position.id,
      code: position.code,
      name: position.name,
      departmentId: position.department?.id,
      departmentName: position.department?.name,
      employeeCount: position.employees?.length ?? 0,
    };
  }
}
