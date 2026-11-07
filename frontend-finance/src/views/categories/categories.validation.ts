import type { CategoryType } from "./categories.service";

// Mesmo limite do backend (CreateCategoryDto / UpdateCategoryDto: @Length(1, 40)).
export const CATEGORY_NAME_MAX_LENGTH = 40;

export interface CategoryFormValues {
  name: string;
  type: CategoryType;
}

export type CategoryField = keyof CategoryFormValues;
export type CategoryFormErrors = Partial<Record<CategoryField, string>>;

export const CATEGORY_TYPE_LABELS: Record<CategoryType, string> = {
  expense: "Despesa",
  income: "Entrada",
};

export function validateCategoryName(name: string): string | undefined {
  const value = name.trim();

  if (!value) return "Informe o nome da categoria.";
  if (value.length > CATEGORY_NAME_MAX_LENGTH) {
    return `Use no máximo ${CATEGORY_NAME_MAX_LENGTH} caracteres (hoje são ${value.length}).`;
  }
  return undefined;
}

export function duplicatedNameMessage(type: CategoryType): string {
  const kind = type === "income" ? "entrada" : "despesa";
  return `Já existe uma categoria de ${kind} com esse nome.`;
}
