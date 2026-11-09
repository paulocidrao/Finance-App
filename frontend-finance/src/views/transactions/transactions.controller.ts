import { useQuery, useQueryClient } from "@tanstack/vue-query";
import { isAxiosError } from "axios";
import { computed, nextTick, ref, watch } from "vue";
import { toast } from "vue-sonner";
import { useNetworkStatus } from '@/utils/network-status';
import { CATEGORIES_QUERY_KEY, type Category } from "@/views/categories/categories.service";
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
export type TransactionsViewState = "loading" | "error" | "empty" | "no-results" | "ready";

/** Campo de busca da tela; recebe o foco depois de uma exclusão. */
export const TRANSACTIONS_SEARCH_ID = "transactions-search";

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
    .replace(/[̀-ͯ]/g, "")
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

const createdAtFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

// A API envia createdAt em UTC (…Z); exibe no fuso de quem está usando.
function formatCreatedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const parts = Object.fromEntries(
    createdAtFormatter.formatToParts(date).map((part) => [part.type, part.value]),
  );

  return `${parts.day}/${parts.month}/${parts.year} às ${parts.hour}:${parts.minute}`;
}

function formatSignedAmount(transaction: Transaction): string {
  const sign = transaction.type === "income" ? "+" : "−";

  return `${sign} ${currencyFormatter.format(transaction.amount)}`;
}

function errorStatus(error: unknown): number | undefined {
  return isAxiosError(error) ? error.response?.status : undefined;
}

// Sem resposta do servidor: offline, API fora do ar ou CORS.
function isNetworkError(error: unknown): boolean {
  return isAxiosError(error) && !error.response;
}

async function focusElement(id: string): Promise<void> {
  await nextTick();
  document.getElementById(id)?.focus();
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

  const hasFilters = computed(
    () =>
      normalizedSearch.value !== "" ||
      categoryFilter.value !== "all" ||
      typeFilter.value !== "all",
  );

  const viewState = computed<TransactionsViewState>(() => {
    if (transactionsQuery.isPending.value) return "loading";
    if (transactionsQuery.isError.value) return "error";
    if (filteredTransactions.value.length === 0) {
      return hasFilters.value ? "no-results" : "empty";
    }
    return "ready";
  });

  // Recarregando em segundo plano (ex.: depois de criar ou excluir), com dados na tela.
  const isRefreshing = computed(
    () => transactionsQuery.isFetching.value && !transactionsQuery.isPending.value,
  );

  // Anunciado por leitores de tela (aria-live) quando a lista muda.
  const statusMessage = computed(() => {
    switch (viewState.value) {
      case "loading":
        return "Carregando transações…";
      case "error":
        return "Não foi possível carregar as transações.";
      case "empty":
        return `Nenhuma transação em ${periodLabel.value}.`;
      case "no-results":
        return "Nenhuma transação encontrada com esses filtros.";
      default:
        return isRefreshing.value ? "Atualizando transações…" : rangeLabel.value;
    }
  });

  function retry(): void {
    void transactionsQuery.refetch();
  }

  function clearFilters(): void {
    search.value = "";
    categoryFilter.value = "all";
    typeFilter.value = "all";
  }

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

  function canMutate(): boolean {
    if (isOnline.value) return true;
    toast.error("Você está offline. Conecte-se para salvar alterações.");
    return false;
  }

  // Lista, resumo do mês e despesas por categoria dependem das transações.
  function refreshTransactionData(): Promise<unknown> {
    return Promise.all([
      queryClient.invalidateQueries({ queryKey: TRANSACTIONS_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: ["home", "summary"] }),
      queryClient.invalidateQueries({ queryKey: HOME_CATEGORY_SUMMARY_QUERY_KEY }),
    ]);
  }

  function openNewTransaction(): void {
    if (!canMutate()) return;
    isNewTransactionOpen.value = true;
  }

  async function addTransaction(payload: NewTransactionInput): Promise<void> {
    if (!canMutate()) return;
    try {
      await createTransaction(payload);
      await refreshTransactionData();
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

  // ── Drawer de detalhes ──────────────────────────────────────────────────
  // Depois de uma exclusão, o elemento que abriu o drawer/diálogo some da
  // lista; o foco vai para a busca em vez de se perder no <body>.
  let focusSearchOnClose = false;

  function openDetails(transaction: Transaction): void {
    focusSearchOnClose = false;
    selectedTransaction.value = transaction;
    isDetailsOpen.value = true;
  }

  function handleCloseAutoFocus(event: Event): void {
    if (!focusSearchOnClose) return;
    event.preventDefault();
    void focusElement(TRANSACTIONS_SEARCH_ID);
  }

  // ── Edição ──────────────────────────────────────────────────────────────
  const isSavingEdit = ref(false);
  const editError = ref("");

  function editTransaction(transaction: Transaction): void {
    if (!canMutate()) return;
    focusSearchOnClose = false;
    selectedTransaction.value = transaction;
    editError.value = "";
    // O drawer continua aberto por baixo: ao cancelar, a pessoa volta para ele.
    isEditTransactionOpen.value = true;
  }

  function findCategoryName(categoryId: string): string | undefined {
    return queryClient
      .getQueryData<Category[]>(CATEGORIES_QUERY_KEY)
      ?.find((category) => category.id === categoryId)?.name;
  }

  async function saveEditedTransaction(payload: NewTransactionInput): Promise<void> {
    if (!canMutate() || isSavingEdit.value) return;
    const transaction = selectedTransaction.value;
    if (!transaction) return;

    isSavingEdit.value = true;
    editError.value = "";

    try {
      const updated = await updateTransaction(transaction.id, payload);
      const base = updated ?? {
        ...transaction,
        type: payload.type,
        amount: payload.amount,
        description: payload.description,
        date: payload.date,
      };

      // O PATCH não devolve o nome da categoria; ele vem da lista em cache.
      selectedTransaction.value = {
        ...base,
        categoryId: payload.category,
        category: findCategoryName(payload.category) ?? transaction.category,
      };
      isEditTransactionOpen.value = false;
      toast.success("Transação atualizada", {
        description: `“${payload.description}” foi atualizada.`,
      });
      void refreshTransactionData();
    } catch (error) {
      const status = errorStatus(error);

      if (status === 404) {
        isEditTransactionOpen.value = false;
        isDetailsOpen.value = false;
        toast.info("Essa transação já tinha sido excluída.");
        void refreshTransactionData();
      } else if (status === 400) {
        editError.value =
          "Não foi possível salvar com os dados informados. Revise os campos e tente novamente.";
      } else if (isNetworkError(error)) {
        editError.value =
          "Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.";
      } else {
        editError.value = "Não foi possível salvar as alterações. Tente novamente em instantes.";
      }
    } finally {
      isSavingEdit.value = false;
    }
  }

  // ── Exclusão com confirmação ────────────────────────────────────────────
  const isDeleting = ref(false);
  const deleteError = ref("");

  function requestDeleteTransaction(transaction: Transaction): void {
    if (!canMutate()) return;
    focusSearchOnClose = false;
    transactionPendingDelete.value = transaction;
    deleteError.value = "";
    isDeleteDialogOpen.value = true;
  }

  // Pedido vindo do diálogo de edição: a confirmação abre por cima dele, e
  // "Cancelar" devolve a pessoa à edição sem perder o que foi digitado.
  function deleteEditedTransaction(): void {
    const transaction = selectedTransaction.value;
    if (transaction) requestDeleteTransaction(transaction);
  }

  // Esc, clique fora e Cancelar ficam bloqueados enquanto a exclusão é enviada.
  function setDeleteDialogOpen(value: boolean): void {
    if (!value && isDeleting.value) return;
    isDeleteDialogOpen.value = value;
  }

  function finishDelete(transaction: Transaction): void {
    focusSearchOnClose = true;
    isDeleteDialogOpen.value = false;
    if (selectedTransaction.value?.id === transaction.id) {
      isEditTransactionOpen.value = false;
      isDetailsOpen.value = false;
    }
    void refreshTransactionData();
  }

  async function confirmDeleteTransaction(): Promise<void> {
    if (!canMutate()) return;
    const transaction = transactionPendingDelete.value;
    if (!transaction || isDeleting.value) return;

    isDeleting.value = true;
    deleteError.value = "";

    try {
      await deleteTransaction(transaction.id);
      finishDelete(transaction);
      toast.success("Transação excluída", {
        description: `“${transaction.description}” foi removida.`,
      });
    } catch (error) {
      if (errorStatus(error) === 404) {
        finishDelete(transaction);
        toast.info("Essa transação já tinha sido excluída.");
      } else if (isNetworkError(error)) {
        deleteError.value =
          "Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.";
      } else {
        deleteError.value = "Não foi possível excluir. Tente novamente em instantes.";
      }
    } finally {
      isDeleting.value = false;
    }
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
    viewState,
    isRefreshing,
    statusMessage,
    retry,
    clearFilters,
    filteredTransactions,
    paginatedTransactions,
    rangeLabel,
    selectedTransaction,
    isDetailsOpen,
    transactionPendingDelete,
    isDeleteDialogOpen,
    isDeleting,
    deleteError,
    isNewTransactionOpen,
    isEditTransactionOpen,
    isSavingEdit,
    editError,
    formatDate,
    formatLongDate,
    formatCreatedAt,
    formatSignedAmount,
    setCategoryFilter,
    setTypeFilter,
    openNewTransaction,
    addTransaction,
    openDetails,
    handleCloseAutoFocus,
    editTransaction,
    saveEditedTransaction,
    deleteEditedTransaction,
    requestDeleteTransaction,
    setDeleteDialogOpen,
    confirmDeleteTransaction,
  };
}
