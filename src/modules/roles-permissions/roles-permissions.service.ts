import { AppDataSource } from "../../database/data-source";
import { HttpError } from "../../common/http-error";
import { Permission, Role } from "../../entities";
import type { SaveRoleDto } from "./roles-permissions.dto";

export class RolesPermissionsService {
  private readonly roleRepository = AppDataSource.getRepository(Role);
  private readonly permissionRepository = AppDataSource.getRepository(Permission);

  async listRoles() {
    const roles = await this.roleRepository.find({
      relations: {
        permissions: true,
      },
      order: {
        name: "ASC",
      },
    });

    return roles.map((role) => ({
      id: role.id,
      name: role.name,
      isSystem: role.isSystem,
      permissions: role.permissions.map((permission) => permission.code),
    }));
  }

  async formOptions() {
    const permissions = await this.permissionRepository.find({
      order: {
        module: "ASC",
        action: "ASC",
      },
    });

    return {
      permissions: permissions.map((permission) => ({
        label: permission.code,
        value: permission.code,
        module: permission.module,
        action: permission.action,
      })),
    };
  }

  async detail(id: string) {
    const role = await this.findRoleOrFail(id);
    return this.toDto(role);
  }

  async create(dto: SaveRoleDto) {
    const permissions = await this.findPermissions(dto.permissionCodes);
    const role = await this.roleRepository.save(
      this.roleRepository.create({
        name: dto.name,
        isSystem: false,
        permissions,
      }),
    );

    return this.toDto(role);
  }

  async update(id: string, dto: SaveRoleDto) {
    const role = await this.findRoleOrFail(id);
    role.name = dto.name;
    role.permissions = await this.findPermissions(dto.permissionCodes);
    const savedRole = await this.roleRepository.save(role);
    return this.toDto(savedRole);
  }

  async remove(id: string) {
    const role = await this.findRoleOrFail(id);
    if (role.isSystem) {
      throw new HttpError(400, "SYSTEM_ROLE_LOCKED", "Không thể xóa vai trò hệ thống");
    }

    const result = await this.roleRepository.softDelete(id);
    if (!result.affected) {
      throw new HttpError(404, "ROLE_NOT_FOUND", "Không tìm thấy vai trò");
    }

    return { id };
  }

  private async findRoleOrFail(id: string) {
    const role = await this.roleRepository.findOne({
      where: { id },
      relations: { permissions: true },
    });

    if (!role) {
      throw new HttpError(404, "ROLE_NOT_FOUND", "Không tìm thấy vai trò");
    }

    return role;
  }

  private async findPermissions(permissionCodes: string[]) {
    if (permissionCodes.length === 0) {
      return [];
    }

    const permissions = await this.permissionRepository
      .createQueryBuilder("permission")
      .where("permission.code IN (:...permissionCodes)", { permissionCodes })
      .getMany();
    const foundCodes = new Set(permissions.map((permission) => permission.code));
    const missingCode = permissionCodes.find((code) => !foundCodes.has(code));

    if (missingCode) {
      throw new HttpError(400, "INVALID_PERMISSION", `Quyền ${missingCode} không hợp lệ`);
    }

    return permissions;
  }

  private toDto(role: Role) {
    return {
      id: role.id,
      name: role.name,
      isSystem: role.isSystem,
      permissions: role.permissions.map((permission) => permission.code),
    };
  }
}
