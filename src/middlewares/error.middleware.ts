import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

import { HttpError } from "../common/http-error";
import { env } from "../config/env";

export function errorMiddleware(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (error instanceof ZodError) {
    return res.status(422).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Dữ liệu gửi lên không hợp lệ",
        details: error.flatten(),
      },
    });
  }

  if (error instanceof HttpError) {
    return res.status(error.statusCode).json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    });
  }

  return res.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "Lỗi máy chủ không mong muốn",
      details: env.NODE_ENV === "production" ? undefined : error,
    },
  });
}
