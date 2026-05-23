import type { NextFunction, Request, Response } from "express";
import { Router } from "express";

import { env } from "../../config/env";
import { publicDashboardSummaryController } from "./public-dashboard.controller";

export const publicDashboardRoutes = Router();

const allowedOrigins = env.PUBLIC_DASHBOARD_ALLOWED_ORIGINS.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

publicDashboardRoutes.use(publicDashboardOriginGuard);
publicDashboardRoutes.get("/summary", publicDashboardSummaryController);

function publicDashboardOriginGuard(req: Request, res: Response, next: NextFunction) {
  const origin = req.headers.origin;

  if (!origin || !allowedOrigins.includes(origin)) {
    return res.status(403).json({
      success: false,
      error: {
        code: allowedOrigins.length === 0 ? "PUBLIC_DASHBOARD_CORS_NOT_CONFIGURED" : "PUBLIC_DASHBOARD_ORIGIN_DENIED",
        message:
          allowedOrigins.length === 0
            ? "Chưa cấu hình domain được phép gọi public dashboard"
            : "Domain không được phép gọi public dashboard",
      },
    });
  }

  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Accept, Authorization, Content-Type");
  res.setHeader("Access-Control-Max-Age", "600");
  res.setHeader("Vary", "Origin");

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  return next();
}
