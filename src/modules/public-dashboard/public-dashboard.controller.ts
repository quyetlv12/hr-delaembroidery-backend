import type { Request, Response } from "express";

import { ok } from "../../common/api-response";
import { DashboardService } from "../dashboard/dashboard.service";

const dashboardService = new DashboardService();

export async function publicDashboardSummaryController(_req: Request, res: Response) {
  const summary = await dashboardService.getPublicSummary();
  return ok(res, summary);
}
