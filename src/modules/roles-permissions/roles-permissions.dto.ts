import { z } from "zod";

export const saveRoleDto = z.object({
  name: z.string().min(2),
  permissionCodes: z.array(z.string().min(1)).default([]),
});

export type SaveRoleDto = z.infer<typeof saveRoleDto>;
