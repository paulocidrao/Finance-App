import { useQuery, useQueryClient } from "@tanstack/vue-query";
import { computed, ref, watch } from "vue";
import { toast } from "vue-sonner";
import { useNetworkStatus } from '@/utils/network-status';
import {
  createTransaction,
  deleteTransaction,
  transactionsService,
  type NewTransactionInput,
  type Transaction,
  type TransactionType,
  updateTransaction,
} from "./transactions.service";
import { getTransactions } from "./transactions.service";

export type TypeFilter = "all" | TransactionType;

const PAGE_SIZE = 8;
const TRANSACTIONS_QUERY_KEY = ["transactions"] as const;

const MONTHS_LONG = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
] as const;

function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthLabel(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);

  return `${MONTHS_LONG[monthNumber - 1]} de ${year}`;
}
const HOME_CATEGORY_SUMMARY_QUERY_KEY = [
  "home",
  "summary",
  "by-category",
] as const;

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

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function formatDate(value: string): string {
  const [year, month, day] = value.split("-");

  return `${Number(day)} ${MONTHS[Number(month) - 1]} ${year}`;
}

function formatLongDate(value: string): string {
  const [year, month, day] = value.split("-");

  return `${Number(day)} de ${MONTHS_LONG[Number(month) - 1]} de ${year}`;
}

function formatCreatedAt(value: string): string {
  const [datePart, timePart = "00:00"] = value.split("T");
  const [year, month, day] = datePart.split("-");
  const [hour, minute] = timePart.split(":");

  return `${day}/${month}/${year} às ${hour}:${minute}`;
}

function formatSignedAmount(transaction: Transaction): string {
  const sign = transaction.type === "income" ? "+" : "−";

  return `${sign} ${currencyFormatter.format(transaction.amount)}`;
}

export function useTransactionsController() {
  const { isOnline } = useNetworkStatus();
  const queryClient = useQueryClient();
  const selectedMonth = ref(getMonthKey(new Date()));
  const monthOptions = computed(() => {
    const current = new Date();

    return Array.from({ length: 12 }, (_, index) => {
      const date = new Date(current.getFullYear(), current.getMonth() - index, 1);
      const value = getMonthKey(date);

      return { value, label: getMonthLabel(value) };
    });
  });
  const transactionsQuery = useQuery({
    queryKey: computed(() => [...TRANSACTIONS_QUERY_KEY, selectedMonth.value]),
    queryFn: () => getTransactions(selectedMonth.value),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
  const transactions = computed(() => transactionsQuery.data.value ?? []);

  const search = ref("");
  const categoryFilter = ref("all");
  const typeFilter = ref<TypeFilter>("all");
  const page = ref(1);
  const selectedTransaction = ref<Transaction | null>(null);
  const isDetailsOpen = ref(false);
  const transactionPendingDelete = ref<Transaction | null>(null);
  const isDeleteDialogOpen = ref(false);
  const isNewTransactionOpen = ref(false);
  const isEditTransactionOpen = ref(false);

  const categories = transactionsService.getCategories();
  const periodLabel = computed(() => getMonthLabel(selectedMonth.value));

  function setMonth(value: unknown): void {
    if (typeof value === "string" && monthOptions.value.some((month) => month.value === value)) {
      selectedMonth.value = value;
    }
  }

  const normalizedSearch = computed(() => normalizeText(search.value));

  const filteredTransactions = computed(() => {
    return transactions.value.filter((transaction) => {
      const matchesSearch =
        !normalizedSearch.value ||
        normalizeText(transaction.description).includes(normalizedSearch.value);
      const matchesCategory =
        categoryFilter.value === "all" ||
        transaction.category === categoryFilter.value;
      const matchesType =
        typeFilter.value === "all" || transaction.type === typeFilter.value;

      return matchesSearch && matchesCategory && matchesType;
    });
  });

  const pageCount = computed(() =>
    Math.max(1, Math.ceil(filteredTransactions.value.length / PAGE_SIZE)),
  );

  const paginatedTransactions = computed(() => {
    const start = (page.value - 1) * PAGE_SIZE;

    return filteredTransactions.value.slice(start, start + PAGE_SIZE);
  });

  const rangeLabel = computed(() => {
    if (filteredTransactions.value.length === 0) {
      return "Nenhuma transação encontrada";
    }

    const start = (page.value - 1) * PAGE_SIZE + 1;
    const end = Math.min(
      page.value * PAGE_SIZE,
      filteredTransactions.value.length,
    );

    return `Mostrando ${start}–${end} de ${filteredTransactions.value.length} transações`;
  });

  const categoryLabel = computed(() =>
    categoryFilter.value === "all" ? "Todas" : categoryFilter.value,
  );

  watch([search, categoryFilter, typeFilter], () => {
    page.value = 1;
  });

  watch(pageCount, (count) => {
    if (page.value > count) {
      page.value = count;
    }
  });

  function setCategoryFilter(value: unknown): void {
    categoryFilter.value = typeof value === "string" ? value : "all";
  }

  function setTypeFilter(value: unknown): void {
    typeFilter.value =
      value === "income" || value === "expense" ? value : "all";
  }

  async function removeTransaction(id: string | number): Promise<boolean> {
    if (!isOnline.value) {
      toast.error('Você está offline. Conecte-se para salvar alterações.');
      return false;
    }
    try {
      await deleteTransaction(id);
      await queryClient.invalidateQueries({ queryKey: TRANSACTIONS_QUERY_KEY });
      await queryClient.invalidateQueries({ queryKey: ["home", "summary"] });
      await queryClient.invalidateQueries({ queryKey: HOME_CATEGORY_SUMMARY_QUERY_KEY });
      return true;
    } catch {
      toast.error("Não foi possível excluir", {
        description: "Tente novamente em instantes.",
      });
      return false;
    }
  }

  function openNewTransaction(): void {
    if (!isOnline.value) {
      toast.error('Você está offline. Conecte-se para salvar alterações.');
      return;
    }
    isNewTransactionOpen.value = true;
  }

  async function addTransaction(payload: NewTransactionInput): Promise<void> {
    if (!isOnline.value) {
      toast.error('Você está offline. Conecte-se para salvar alterações.');
      return;
    }
    try {
      await createTransaction(payload);
      await queryClient.invalidateQueries({ queryKey: TRANSACTIONS_QUERY_KEY });
      await queryClient.invalidateQueries({ queryKey: ["home", "summary"] });
      await queryClient.invalidateQueries({ queryKey: HOME_CATEGORY_SUMMARY_QUERY_KEY });
      search.value = "";
      categoryFilter.value = "all";
      typeFilter.value = "all";
      page.value = 1;

      toast.success(
        payload.type === "income" ? "Entrada registrada" : "Despesa registrada",
        {
          description: `“${payload.description}” foi adicionada ao período.`,
        },
      );
    } catch {
      toast.error("Não foi possível registrar a transação", {
        description: "Tente novamente em instantes.",
      });
    }
  }

  function openDetails(transaction: Transaction): void {
    selectedTransaction.value = transaction;
    isDetailsOpen.value = true;
  }

  function editTransaction(transaction: Transaction): void {
    if (!isOnline.value) {
      toast.error('Você está offline. Conecte-se para salvar alterações.');
      return;
    }
    isDetailsOpen.value = false;
    selectedTransaction.value = transaction;
    isEditTransactionOpen.value = true;
  }

  async function saveEditedTransaction(payload: NewTransactionInput): Promise<void> {
    if (!isOnline.value) {
      toast.error('Você está offline. Conecte-se para salvar alterações.');
      return;
    }
    const transaction = selectedTransaction.value;

    if (!transaction) return;

    try {
      const updated = await updateTransaction(transaction.id, payload);

      await queryClient.invalidateQueries({ queryKey: TRANSACTIONS_QUERY_KEY });
      await queryClient.invalidateQueries({ queryKey: ["home", "summary"] });
      await queryClient.invalidateQueries({ queryKey: HOME_CATEGORY_SUMMARY_QUERY_KEY });
      selectedTransaction.value = updated ?? { ...transaction, ...payload };
      isEditTransactionOpen.value = false;
      toast.success("Transação atualizada", {
        description: `“${selectedTransaction.value.description}” foi atualizada.`,
      });
    } catch {
      toast.error("Não foi possível atualizar", {
        description: "Tente novamente em instantes.",
      });
    }
  }

  function deleteEditedTransaction(): void {
    if (!isOnline.value) {
      toast.error('Você está offline. Conecte-se para salvar alterações.');
      return;
    }
    const transaction = selectedTransaction.value;

    if (!transaction) return;

    isEditTransactionOpen.value = false;
    requestDeleteTransaction(transaction);
  }

  function requestDeleteTransaction(transaction: Transaction): void {
    if (!isOnline.value) {
      toast.error('Você está offline. Conecte-se para salvar alterações.');
      return;
    }
    transactionPendingDelete.value = transaction;
    isDeleteDialogOpen.value = true;
  }

  async function confirmDeleteTransaction(): Promise<void> {
    if (!isOnline.value) {
      toast.error('Você está offline. Conecte-se para salvar alterações.');
      return;
    }
    const transaction = transactionPendingDelete.value;
    if (!transaction) {
      return;
    }

    const deleted = await removeTransaction(transaction.id);

    if (!deleted) {
      return;
    }

    if (selectedTransaction.value?.id === transaction.id) {
      isDetailsOpen.value = false;
    }

    isDeleteDialogOpen.value = false;

    toast.success("Transação excluída", {
      description: `“${transaction.description}” foi removida.`,
    });
  }

  return {
    isOnline,
    search,
    categoryFilter,
    typeFilter,
    page,
    pageSize: PAGE_SIZE,
    categories,
    periodLabel,
    selectedMonth,
    monthOptions,
    setMonth,
    categoryLabel,
    filteredTransactions,
    paginatedTransactions,
    rangeLabel,
    selectedTransaction,
    isDetailsOpen,
    transactionPendingDelete,
    isDeleteDialogOpen,
    isNewTransactionOpen,
    isEditTransactionOpen,
    formatDate,
    formatLongDate,
    formatCreatedAt,
    formatSignedAmount,
    setCategoryFilter,
    setTypeFilter,
    openNewTransaction,
    addTransaction,
    openDetails,
    editTransaction,
    saveEditedTransaction,
    deleteEditedTransaction,
    requestDeleteTransaction,
    confirmDeleteTransaction,
  };
}
