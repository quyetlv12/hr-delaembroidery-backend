import type { Request, Response } from "express";

import { ok } from "../../common/api-response";
import { DashboardService } from "./dashboard.service";

const dashboardService = new DashboardService();

export async function dashboardSummaryController(_req: Request, res: Response) {
  const summary = await dashboardService.getSummary();
  return ok(res, summary);
}
