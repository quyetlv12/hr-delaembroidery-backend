import { MigrationInterface, QueryRunner } from "typeorm";

type FormulaRow = {
  id: string;
  column_formulas?: unknown;
};

type FormulaItem = {
  key?: string;
  name?: string;
  formula?: string;
};

export class UseDefaultDailyAllowanceFormulas20260517165500 implements MigrationInterface {
  name = "UseDefaultDailyAllowanceFormulas20260517165500";

  async up(queryRunner: QueryRunner): Promise<void> {
    await this.updateFormulaSettings(queryRunner, {
      mealFormula: "anCaMacDinh",
      phoneFormula: "dienThoaiMacDinh",
    });
    await this.updateTemplateSnapshots(queryRunner, {
      mealFormula: "anCaMacDinh",
      phoneFormula: "dienThoaiMacDinh",
    });
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await this.updateFormulaSettings(queryRunner, {
      mealFormula: "phuCapAnCa / ngayCong",
      phoneFormula: "phuCapDienThoai / ngayCong",
    });
    await this.updateTemplateSnapshots(queryRunner, {
      mealFormula: "phuCapAnCa / ngayCong",
      phoneFormula: "phuCapDienThoai / ngayCong",
    });
  }

  private async updateFormulaSettings(
    queryRunner: QueryRunner,
    formulas: { mealFormula: string; phoneFormula: string },
  ) {
    const rows = await queryRunner.query("SELECT id, column_formulas FROM payroll_formula_settings");
    for (const row of rows as FormulaRow[]) {
      const columnFormulas = parseJsonArray(row.column_formulas);
      const updatedFormulas = updateAllowanceFormulas(columnFormulas, formulas);
      await queryRunner.query("UPDATE payroll_formula_settings SET column_formulas = ? WHERE id = ?", [
        JSON.stringify(updatedFormulas),
        row.id,
      ]);
    }
  }

  private async updateTemplateSnapshots(
    queryRunner: QueryRunner,
    formulas: { mealFormula: string; phoneFormula: string },
  ) {
    const rows = await queryRunner.query("SELECT id, snapshot FROM payroll_formula_templates");
    for (const row of rows as Array<{ id: string; snapshot?: unknown }>) {
      const snapshot = parseJsonObject(row.snapshot);
      const columnFormulas = parseJsonArray(snapshot.columnFormulas);
      snapshot.columnFormulas = updateAllowanceFormulas(columnFormulas, formulas);
      await queryRunner.query("UPDATE payroll_formula_templates SET snapshot = ? WHERE id = ?", [
        JSON.stringify(snapshot),
        row.id,
      ]);
    }
  }
}

function updateAllowanceFormulas(
  columnFormulas: FormulaItem[],
  formulas: { mealFormula: string; phoneFormula: string },
) {
  return columnFormulas.map((item) => {
    if (item.key === "mealAllowance") {
      return { ...item, formula: formulas.mealFormula };
    }
    if (item.key === "phoneAllowance") {
      return { ...item, formula: formulas.phoneFormula };
    }
    return item;
  });
}

function parseJsonArray(value: unknown): FormulaItem[] {
  if (Array.isArray(value)) {
    return value as FormulaItem[];
  }
  if (typeof value !== "string" || !value.trim()) {
    return [];
  }
  const parsedValue = JSON.parse(value);
  return Array.isArray(parsedValue) ? (parsedValue as FormulaItem[]) : [];
}

function parseJsonObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value !== "string" || !value.trim()) {
    return {};
  }
  const parsedValue = JSON.parse(value);
  return parsedValue && typeof parsedValue === "object" && !Array.isArray(parsedValue)
    ? (parsedValue as Record<string, unknown>)
    : {};
}
