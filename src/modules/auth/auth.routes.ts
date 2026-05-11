import { Router } from "express";

import { validateBody } from "../../common/validate";
import { authGuard } from "../../guards/auth.guard";
import { changePasswordDto, loginDto } from "./auth.dto";
import { changePasswordController, loginController, profileController } from "./auth.controller";

export const authRoutes = Router();

authRoutes.post("/login", validateBody(loginDto), loginController);
authRoutes.get("/profile", authGuard, profileController);
authRoutes.put("/password", authGuard, validateBody(changePasswordDto), changePasswordController);
