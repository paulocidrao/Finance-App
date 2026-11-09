// Uma data sem horário ("2026-11-30") vira meia-noite UTC. Usada como limite
// final, ela deixaria de fora as transações do próprio dia (salvas ao meio-dia
// UTC). Por isso o limite final sem horário avança até o fim do dia.
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Início do período: a data informada, como está. */
export function parseRangeStart(value: string): Date {
  return new Date(value);
}

/** Fim do período: com só a data, inclui o dia inteiro (até 23:59:59.999 UTC). */
export function parseRangeEnd(value: string): Date {
  return DATE_ONLY.test(value)
    ? new Date(`${value}T23:59:59.999Z`)
    : new Date(value);
}
