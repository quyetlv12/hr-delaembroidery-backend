export const APP_TIME_ZONE = "Asia/Ho_Chi_Minh";
export const MYSQL_TIME_ZONE = "+07:00";
export const VIETNAM_TIMEZONE_OFFSET_MINUTES = 7 * 60;
export const VIETNAM_TIMEZONE_OFFSET_MS = VIETNAM_TIMEZONE_OFFSET_MINUTES * 60 * 1000;

export function getVietnamDateParts(value = new Date()) {
  const vietnamTime = new Date(value.getTime() + VIETNAM_TIMEZONE_OFFSET_MS);
  return {
    year: vietnamTime.getUTCFullYear(),
    month: vietnamTime.getUTCMonth() + 1,
    day: vietnamTime.getUTCDate(),
    hour: vietnamTime.getUTCHours(),
    minute: vietnamTime.getUTCMinutes(),
    second: vietnamTime.getUTCSeconds(),
  };
}

export function toVietnamDateString(value = new Date()) {
  const { year, month, day } = getVietnamDateParts(value);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function formatVietnamTime(value?: Date | null) {
  if (!value || Number.isNaN(value.getTime())) {
    return null;
  }

  const { hour, minute } = getVietnamDateParts(value);
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function getDaysInVietnamMonth(month: number, year: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function getVietnamDayOfWeek(dateOnly: string) {
  const parsed = parseDateOnly(dateOnly);
  if (!parsed) {
    return Number.NaN;
  }

  return new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day)).getUTCDay();
}

export function isValidVietnamDateOnly(value: string) {
  const parsed = parseDateOnly(value);
  if (!parsed) {
    return false;
  }

  return parsed.day <= getDaysInVietnamMonth(parsed.month, parsed.year);
}

function parseDateOnly(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }
  if (month < 1 || month > 12 || day < 1) {
    return null;
  }

  return { year, month, day };
}
