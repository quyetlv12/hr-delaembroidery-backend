import { Column, Entity, ManyToOne } from "typeorm";

import { AppBaseEntity } from "../common/base.entity";
import { User } from "./User";

@Entity("audit_logs")
export class AuditLog extends AppBaseEntity {
  @ManyToOne(() => User, { nullable: true })
  actor?: User | null;

  @Column({ name: "action", type: "varchar", length: 120 })
  action!: string;

  @Column({ name: "entity_name", type: "varchar", length: 120 })
  entityName!: string;

  @Column({ name: "entity_id", type: "varchar", nullable: true, length: 80 })
  entityId?: string | null;

  @Column({ name: "metadata", type: "json", nullable: true })
  metadata?: Record<string, unknown> | null;

  @Column({ name: "ip_address", type: "varchar", nullable: true, length: 80 })
  ipAddress?: string | null;
}
