import type { Request, Response } from "express";

import { ok } from "../../common/api-response";
import { DashboardService, type DashboardFilter } from "./dashboard.service";

const dashboardService = new DashboardService();

export async function dashboardSummaryController(req: Request, res: Response) {
  const filter: DashboardFilter = {
    employeeId: typeof req.query.employeeId === "string" ? req.query.employeeId : undefined,
    from: typeof req.query.from === "string" ? req.query.from : undefined,
    to: typeof req.query.to === "string" ? req.query.to : undefined,
  };
  const summary = await dashboardService.getSummary(filter);
  return ok(res, summary);
}
