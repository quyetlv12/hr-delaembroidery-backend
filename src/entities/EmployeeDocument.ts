import { Column, Entity, ManyToOne } from "typeorm";

import { AppBaseEntity } from "../common/base.entity";
import { Employee } from "./Employee";

@Entity("employee_documents")
export class EmployeeDocument extends AppBaseEntity {
  @ManyToOne(() => Employee)
  employee!: Employee;

  @Column({ name: "original_name", type: "varchar", length: 255 })
  originalName!: string;

  @Column({ name: "stored_name", type: "varchar", length: 255 })
  storedName!: string;

  @Column({ name: "mime_type", type: "varchar", length: 120, nullable: true })
  mimeType?: string | null;

  @Column({ name: "size", type: "bigint", default: 0 })
  size!: string;

  @Column({ name: "storage_path", type: "varchar", length: 500 })
  storagePath!: string;
}
