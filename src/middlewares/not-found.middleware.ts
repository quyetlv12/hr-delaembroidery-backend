import type { Request, Response } from "express";

export function notFoundMiddleware(req: Request, res: Response) {
  return res.status(404).json({
    success: false,
    error: {
      code: "NOT_FOUND",
      message: `Không tìm thấy đường dẫn ${req.method} ${req.path}`,
    },
  });
}
