# Backend Agent Rules

This `.agent` folder is scoped to the Express backend only. Read it after the
root `.agent` files whenever a task touches `backend/`.

## Scope

- Node.js, Express, TypeScript.
- TypeORM and MySQL.
- JWT authentication.
- RBAC permissions.
- Repository and service layers.
- DTO validation.
- TypeORM migrations and seed data.
- Multer uploads.
- Nodemailer and Redis-backed queues.
- ExcelJS import/export.
- PDFKit payslip generation.

## Required Read Order

1. Root `.agent/ARCHITECTURE.md`.
2. Root `.agent/rules/HRM.md`.
3. Root workflow file for the task.
4. `backend/.agent/README.md`.
5. `memory.md`.

## Backend Structure

```text
backend/src/
├── modules/
│   ├── auth/
│   ├── users/
│   ├── employees/
│   ├── attendance/
│   ├── payroll/
│   ├── bank-transfer/
│   ├── dashboard/
│   ├── reports/
│   └── roles-permissions/
├── entities/
├── migrations/
├── middlewares/
├── guards/
├── decorators/
├── config/
├── database/
├── utils/
└── common/
```

## Backend Rules

- Controllers validate and delegate only.
- Services own business logic.
- Repositories isolate TypeORM queries.
- Protected routes must use `authGuard`.
- Protected business actions must use `permissionGuard`.
- Permission codes use `<module>:<action>`.
- Do not expose payroll, bank, tax, insurance, or password data without explicit permission.
- Never log secrets, JWTs, salary details, or bank account numbers.
- Use TypeORM migrations for schema changes.
- Seed system roles and permissions.
- Audit important create, update, delete, lock, email, and bank export actions.
- Use soft delete on mutable business records.
- Keep each file under 700 lines.

## Module Workflow

- Employee: create employee, upload avatar, assign role, setup salary, setup bank account.
- Attendance: sync/import logs, calculate daily summary, calculate OT, generate monthly summary.
- Payroll: generate payroll, review, lock, generate payslip PDF, send email.
- Bank transfer: generate file from locked payroll, export TXT/XLSX/CSV, log details.
