import type { Response } from "express";

export type ApiMeta = {
  page?: number;
  limit?: number;
  total?: number;
};

export function ok<T>(res: Response, data: T, message?: string, meta?: ApiMeta) {
  return res.json({
    success: true,
    data,
    message,
    meta,
  });
}

export function created<T>(res: Response, data: T, message = "Đã tạo thành công") {
  return res.status(201).json({
    success: true,
    data,
    message,
  });
}
