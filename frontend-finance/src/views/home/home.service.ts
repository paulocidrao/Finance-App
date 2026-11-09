import { api } from "@/utils/api";
import { getTransactions } from "@/views/transactions/transactions.service";

export interface HomeTransaction {
  id: string | number;
  description: string;
  category: string;
  date: string;
  amount: number;
}

export interface HomeCategoryExpense {
  name: string;
  amount: number;
  percentage: number;
  tone?: "primary" | "muted";
}

export interface HomeSummary {
  periodLabel: string;
  balance: number;
  income: number;
  expenses: number;
  transactionsCount: number;
  transactions: HomeTransaction[];
  categories: HomeCategoryExpense[];
}

export interface HomeSummaryResponse {
  period: {
    from: string;
    to: string;
  };
  totalIncomeCents: number;
  totalExpenseCents: number;
  balanceCents: number;
  transactionsCount: number;
}

// Resposta de GET /summary/by-category (backend: SummaryController.byCategory).
interface ApiCategorySummary {
  categoryId: string | null;
  name: string;
  totalCents: number;
  percentage: number;
}

interface CategorySummaryResponse {
  period: { from: string; to: string };
  type: "INCOME" | "EXPENSE";
  items: ApiCategorySummary[];
}

export const HOME_CATEGORY_SUMMARY_QUERY_KEY = [
  "home",
  "summary",
  "by-category",
] as const;

function getMonthRange(month: string): { from: string; to: string } {
  const [year, monthNumber] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();

  return {
    from: `${month}-01`,
    to: `${month}-${String(lastDay).padStart(2, "0")}`,
  };
}

const MONTHS = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
] as const;

const summary: HomeSummary = {
  periodLabel: "Outubro de 2026",
  balance: 3218.1,
  income: 8450,
  expenses: 5231.9,
  transactionsCount: 5,
  transactions: [
    {
      id: 1,
      description: "Salário",
      category: "Salário",
      date: "28 out",
      amount: 7500,
    },
    {
      id: 2,
      description: "Mercado do mês",
      category: "Alimentação",
      date: "27 out",
      amount: -486.3,
    },
    {
      id: 3,
      description: "Uber",
      category: "Transporte",
      date: "25 out",
      amount: -32.9,
    },
    {
      id: 4,
      description: "Freelance site",
      category: "Outras entradas",
      date: "24 out",
      amount: 950,
    },
    {
      id: 5,
      description: "Aluguel",
      category: "Moradia",
      date: "22 out",
      amount: -1850,
    },
  ],
  categories: [
    { name: "Moradia", amount: 1850, percentage: 35.4 },
    { name: "Alimentação", amount: 1342.5, percentage: 25.7 },
    { name: "Transporte", amount: 628.4, percentage: 12 },
    { name: "Sem categoria", amount: 1001, percentage: 19.1, tone: "muted" },
  ],
};

export async function getSummary(month?: string): Promise<HomeSummary> {
  const response = await api.get<HomeSummaryResponse>("summary", {
    params: month ? getMonthRange(month) : undefined,
  });
  const data = response.data;
  const transactions = await getTransactions(month);
  const monthTransactions = transactions
    .filter((transaction) => transaction.date >= data.period.from && transaction.date <= data.period.to)
    .sort((first, second) => {
      const dateComparison = second.date.localeCompare(first.date);

      return dateComparison !== 0
        ? dateComparison
        : second.createdAt.localeCompare(first.createdAt);
    })
  const periodTransactions = monthTransactions
    .slice(0, 5)
    .map((transaction) => ({
      id: transaction.id,
      description: transaction.description,
      category: transaction.category,
      date: formatShortDate(transaction.date),
      amount: transaction.type === "income" ? transaction.amount : -transaction.amount,
    }));
  const categoryAmounts = new Map<string, number>();

  monthTransactions
    .filter((transaction) => transaction.type === "expense")
    .forEach((transaction) => {
      const amount = categoryAmounts.get(transaction.category) ?? 0;
      categoryAmounts.set(transaction.category, amount + transaction.amount);
    });

  const categories = [...categoryAmounts.entries()]
    .sort((first, second) => second[1] - first[1])
    .map(([name, amount]) => ({
      name,
      amount,
      percentage:
        data.totalExpenseCents > 0
          ? (amount * 100) / (data.totalExpenseCents / 100)
          : 0,
    }));

  return {
    periodLabel: formatPeriod(data.period),
    balance: centsToAmount(data.balanceCents),
    income: centsToAmount(data.totalIncomeCents),
    expenses: centsToAmount(data.totalExpenseCents),
    transactionsCount: data.transactionsCount,
    transactions: periodTransactions,
    categories,
  };
}

export async function getCategoryExpenses(month?: string): Promise<HomeCategoryExpense[]> {
  const response = await api.get<CategorySummaryResponse>(
    "summary/by-category",
    { params: month ? getMonthRange(month) : undefined },
  );

  return response.data.items.map((category) => ({
    name: category.name,
    amount: centsToAmount(category.totalCents),
    percentage: category.percentage,
    // Despesas sem categoria aparecem com a barra em cinza.
    tone: category.categoryId ? "primary" : "muted",
  }));
}

function formatShortDate(value: string): string {
  const [, month, day] = value.split("-");

  return `${Number(day)} ${MONTHS[Number(month) - 1]}`;
}

function centsToAmount(cents: number): number {
  return cents / 100;
}

function formatPeriod(period: HomeSummaryResponse["period"]): string {
  const from = new Date(`${period.from}T00:00:00`);
  const to = new Date(`${period.to}T00:00:00`);

  if (from.getMonth() === to.getMonth() && from.getFullYear() === to.getFullYear()) {
    return new Intl.DateTimeFormat("pt-BR", {
      month: "long",
      year: "numeric",
    }).format(from);
  }

  return `${period.from} a ${period.to}`;
}

export function getInitialSummary(): HomeSummary {
  return {
    ...summary,
    transactions: summary.transactions.map((transaction) => ({ ...transaction })),
    categories: summary.categories.map((category) => ({ ...category })),
  };
}
