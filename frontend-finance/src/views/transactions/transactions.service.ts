import { api } from "@/utils/api";

export type TransactionType = "income" | "expense";

export interface Transaction {
  id: string | number;
  date: string;
  createdAt: string;
  description: string;
  /** Nome da categoria, para exibição. */
  category: string;
  /** Id da categoria na API; é o valor usado pelos formulários. */
  categoryId?: string | null;
  type: TransactionType;
  amount: number;
}

export interface NewTransactionInput {
  date: string;
  description: string;
  category: string;
  type: TransactionType;
  amount: number;
}

const TOTAL_TRANSACTIONS = 134;

const baseTransactions: Transaction[] = [
  {
    id: 1,
    date: "2026-10-28",
    createdAt: "2026-10-28T09:15:00",
    description: "Salário",
    category: "Salário",
    type: "income",
    amount: 7500,
  },
  {
    id: 2,
    date: "2026-10-27",
    createdAt: "2026-10-27T19:42:00",
    description: "Mercado do mês",
    category: "Alimentação",
    type: "expense",
    amount: 486.3,
  },
  {
    id: 3,
    date: "2026-10-25",
    createdAt: "2026-10-25T08:32:00",
    description: "Uber",
    category: "Transporte",
    type: "expense",
    amount: 32.9,
  },
  {
    id: 4,
    date: "2026-10-24",
    createdAt: "2026-10-24T14:20:00",
    description: "Freelance site",
    category: "Outras entradas",
    type: "income",
    amount: 950,
  },
  {
    id: 5,
    date: "2026-10-22",
    createdAt: "2026-10-22T10:05:00",
    description: "Aluguel",
    category: "Moradia",
    type: "expense",
    amount: 1850,
  },
  {
    id: 6,
    date: "2026-10-20",
    createdAt: "2026-10-20T21:10:00",
    description: "Cinema",
    category: "Lazer",
    type: "expense",
    amount: 58,
  },
  {
    id: 7,
    date: "2026-10-18",
    createdAt: "2026-10-18T11:45:00",
    description: "Spotify",
    category: "Lazer",
    type: "expense",
    amount: 21.9,
  },
  {
    id: 8,
    date: "2026-10-17",
    createdAt: "2026-10-17T16:30:00",
    description: "Farmácia",
    category: "Saúde",
    type: "expense",
    amount: 74.2,
  },
];

const fillerTemplates: Omit<Transaction, "id" | "date" | "createdAt">[] = [
  {
    description: "Restaurante",
    category: "Alimentação",
    type: "expense",
    amount: 89.9,
  },
  {
    description: "Combustível",
    category: "Transporte",
    type: "expense",
    amount: 210,
  },
  { description: "Cinema", category: "Lazer", type: "expense", amount: 58 },
  {
    description: "Supermercado",
    category: "Alimentação",
    type: "expense",
    amount: 320.45,
  },
  {
    description: "Freelance design",
    category: "Outras entradas",
    type: "income",
    amount: 1200,
  },
  {
    description: "Conta de luz",
    category: "Moradia",
    type: "expense",
    amount: 142.7,
  },
  { description: "Farmácia", category: "Saúde", type: "expense", amount: 64.3 },
  { description: "Salário", category: "Salário", type: "income", amount: 7500 },
  {
    description: "Uber",
    category: "Transporte",
    type: "expense",
    amount: 27.5,
  },
];

const categories = [
  "Salário",
  "Alimentação",
  "Transporte",
  "Outras entradas",
  "Moradia",
  "Lazer",
  "Saúde",
  "Outras despesas",
];

function buildTransactions(): Transaction[] {
  const transactions = baseTransactions.map((transaction) => ({
    ...transaction,
  }));
  const missing = TOTAL_TRANSACTIONS - transactions.length;

  for (let index = 0; index < missing; index += 1) {
    const template = fillerTemplates[index % fillerTemplates.length];
    const day = String(
      16 - Math.floor(index / fillerTemplates.length),
    ).padStart(2, "0");
    const hour = String(8 + (index % 13)).padStart(2, "0");
    const minute = String((index * 7) % 60).padStart(2, "0");

    transactions.push({
      ...template,
      id: transactions.length + 1,
      date: `2026-10-${day}`,
      createdAt: `2026-10-${day}T${hour}:${minute}:00`,
    });
  }

  return transactions;
}

interface ApiTransaction {
  id: string;
  userId: string;
  type: "INCOME" | "EXPENSE";
  amountCents: number;
  description: string;
  date: string;
  categoryId: string | null;
  createdAt: string;
  updatedAt: string;
  categoryName: string | null;
}

interface TransactionsResponse {
  data: ApiTransaction[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

function getMonthRange(month: string): { from: string; to: string } {
  const [year, monthNumber] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();

  return {
    from: `${month}-01`,
    to: `${month}-${String(lastDay).padStart(2, "0")}`,
  };
}

function toApiTransaction(input: NewTransactionInput) {
  return {
    date: input.date.includes("T")
      ? new Date(input.date).toISOString()
      : new Date(`${input.date}T12:00:00.000Z`).toISOString(),
    description: input.description,
    categoryId: input.category,
    type: input.type === "income" ? "INCOME" : "EXPENSE",
    amountCents: Math.round(input.amount * 100),
  };
}

export async function createTransaction(
  input: NewTransactionInput,
): Promise<Transaction | undefined> {
  const response = await api.post<ApiTransaction | { data: ApiTransaction }>(
    "transactions",
    toApiTransaction(input),
  );
  const data = response.data;

  return "data" in data ? toTransaction(data.data) : toTransaction(data);
}

function toTransaction(transaction: ApiTransaction): Transaction {
  return {
    id: transaction.id,
    date: transaction.date.slice(0, 10),
    createdAt: transaction.createdAt,
    description: transaction.description,
    category: transaction.categoryName ?? "Sem categoria",
    categoryId: transaction.categoryId,
    type: transaction.type === "INCOME" ? "income" : "expense",
    amount: transaction.amountCents / 100,
  };
}

export async function updateTransaction(
  id: string | number,
  input: NewTransactionInput,
): Promise<Transaction | undefined> {
  const response = await api.patch<ApiTransaction | { data: ApiTransaction }>(
    `transactions/${id}`,
    toApiTransaction(input),
  );
  const data = response.data;

  return "data" in data ? toTransaction(data.data) : toTransaction(data);
}

export async function deleteTransaction(id: string | number): Promise<void> {
  await api.delete(`transactions/${id}`);
}

export async function getTransactions(month?: string): Promise<Transaction[]> {
  const response = await api.get<TransactionsResponse>("transactions", {
    params: {
      page: 1,
      limit: 100,
      sort: "date",
      order: "desc",
      ...(month ? getMonthRange(month) : {}),
    },
  });

  return response.data.data.map(toTransaction);
}

export const transactionsService = {
  getInitialTransactions(): Transaction[] {
    return buildTransactions();
  },

  getCategories(): string[] {
    return categories;
  },

  getPeriodLabel(): string {
    return "Outubro de 2026";
  },
};
