import { api } from "@/utils/api";

export type CategoryType = "expense" | "income";

type ApiCategoryType = "EXPENSE" | "INCOME";

export interface Category {
  id: string;
  userId: string;
  name: string;
  type: CategoryType;
  transactionCount: number;
  createdAt: string;
  updatedAt: string;
}

interface ApiCategory extends Omit<Category, "type"> {
  type: ApiCategoryType;
}

interface CategoriesResponse {
  data: ApiCategory[];
  meta?: { total: number };
}

// Prefixo comum: invalidar esta chave atualiza a tela de categorias e os
// formulários de transação, que usam a lista completa.
export const CATEGORIES_QUERY_KEY = ["categories"] as const;

let cachedCategories: Category[] = [];

function toCategory(category: ApiCategory): Category {
  return {
    ...category,
    type: category.type === "INCOME" ? "income" : "expense",
  };
}

function toApiType(type: CategoryType): ApiCategoryType {
  return type === "income" ? "INCOME" : "EXPENSE";
}

// Chave da lista filtrada por tipo. "all" reaproveita a mesma lista completa
// usada pelos formulários de transação.
export function categoriesQueryKey(type?: CategoryType) {
  return type ? ([...CATEGORIES_QUERY_KEY, "type", type] as const) : CATEGORIES_QUERY_KEY;
}

/**
 * Lista as categorias filtrando o tipo no servidor (GET /categories?type=).
 * Não altera o cache usado pelos formulários de transação.
 */
export async function getCategoriesByType(type?: CategoryType): Promise<Category[]> {
  if (!type) return getCategories();

  const response = await api.get<CategoriesResponse | ApiCategory[]>("categories", {
    params: { type: toApiType(type) },
  });
  const data = Array.isArray(response.data) ? response.data : response.data.data;

  return data.map(toCategory);
}

export async function getCategories(): Promise<Category[]> {
  const response = await api.get<CategoriesResponse | ApiCategory[]>(
    "categories",
  );
  const data = Array.isArray(response.data)
    ? response.data
    : response.data.data;

  cachedCategories = data.map(toCategory);

  return cachedCategories;
}

export async function createCategory(
  name: string,
  type: CategoryType,
): Promise<Category> {
  const response = await api.post<ApiCategory | { data: ApiCategory }>(
    "categories",
    {
      name,
      type: toApiType(type),
    },
  );
  const data = response.data;

  return toCategory("data" in data ? data.data : data);
}

// A API só permite renomear: o tipo da categoria não muda depois de criada,
// porque as transações vinculadas dependem dele.
export async function updateCategory(
  id: string,
  name: string,
): Promise<Category> {
  const response = await api.patch<ApiCategory | { data: ApiCategory }>(
    `categories/${id}`,
    { name },
  );
  const data = response.data;

  return toCategory("data" in data ? data.data : data);
}

export async function deleteCategory(id: string): Promise<void> {
  await api.delete(`categories/${id}`);
}

export const categoriesService = {
  getCategories(): Category[] {
    return cachedCategories;
  },
};
