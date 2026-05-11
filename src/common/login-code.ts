import type { Repository } from "typeorm";

import { User } from "../entities";

export const LOGIN_CODE_PREFIX = "DLE";
export const LOGIN_CODE_REGEX = /^DLE\d{3}$/;

export function normalizeLoginCode(value: string) {
  return value.trim().toUpperCase();
}

export function getLoginCodeFromEmployeeCode(employeeCode: string) {
  if (!/^\d{1,3}$/.test(employeeCode)) {
    return null;
  }

  const numericCode = Number(employeeCode);
  if (numericCode < 1 || numericCode > 999) {
    return null;
  }

  return `${LOGIN_CODE_PREFIX}${String(numericCode).padStart(3, "0")}`;
}

export async function generateLoginCode(userRepository: Repository<User>) {
  const users = await userRepository.find({
    select: {
      loginCode: true,
    },
    withDeleted: true,
  });
  const usedCodes = new Set(
    users
      .map((user) => user.loginCode)
      .filter((code): code is string => Boolean(code) && LOGIN_CODE_REGEX.test(code)),
  );

  for (let index = 1; index <= 999; index += 1) {
    const code = `${LOGIN_CODE_PREFIX}${String(index).padStart(3, "0")}`;
    if (!usedCodes.has(code)) {
      return code;
    }
  }

  throw new Error("Đã hết mã đăng nhập DLE001-DLE999");
}
