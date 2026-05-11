import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";

import { HttpError } from "../../common/http-error";
import { normalizeLoginCode } from "../../common/login-code";
import { env } from "../../config/env";
import { AppDataSource } from "../../database/data-source";
import { User } from "../../entities";
import type { ChangePasswordDto, LoginDto } from "./auth.dto";

export class AuthService {
  private readonly userRepository = AppDataSource.getRepository(User);

  async login(dto: LoginDto) {
    const user = await this.userRepository.findOne({
      where: { loginCode: normalizeLoginCode(dto.loginCode), isActive: true },
      relations: {
        employee: true,
        roles: {
          permissions: true,
        },
      },
    });

    if (!user) {
      throw new HttpError(401, "INVALID_CREDENTIALS", "Mã đăng nhập hoặc mật khẩu không đúng");
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatches) {
      throw new HttpError(401, "INVALID_CREDENTIALS", "Mã đăng nhập hoặc mật khẩu không đúng");
    }

    const signOptions: SignOptions = {
      expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"],
      subject: user.id,
    };

    const accessToken = jwt.sign(
      {
        loginCode: user.loginCode,
        email: user.email,
        employeeId: user.employee?.id,
        permissions: this.getUserPermissions(user),
      },
      env.JWT_SECRET,
      signOptions,
    );

    return {
      accessToken,
      user: this.toUserDto(user),
    };
  }

  async profile(userId: string) {
    const user = await this.findActiveUser(userId);
    return this.toUserDto(user);
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.findActiveUser(userId);
    const currentPasswordMatches = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!currentPasswordMatches) {
      throw new HttpError(400, "INVALID_CURRENT_PASSWORD", "Mật khẩu hiện tại không đúng");
    }

    user.passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.userRepository.save(user);
    return { changed: true };
  }

  private async findActiveUser(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId, isActive: true },
      relations: {
        employee: true,
        roles: {
          permissions: true,
        },
      },
    });

    if (!user) {
      throw new HttpError(404, "USER_NOT_FOUND", "Không tìm thấy tài khoản");
    }

    return user;
  }

  private getUserPermissions(user: User) {
    return Array.from(new Set(user.roles.flatMap((role) => role.permissions.map((permission) => permission.code))));
  }

  private toUserDto(user: User) {
    return {
      id: user.id,
      loginCode: user.loginCode,
      email: user.email,
      fullName: user.fullName,
      employeeId: user.employee?.id,
      roles: user.roles.map((role) => ({
        id: role.id,
        name: role.name,
        isSystem: role.isSystem,
      })),
      permissions: this.getUserPermissions(user),
    };
  }
}
