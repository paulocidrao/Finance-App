import { parseRangeEnd, parseRangeStart } from './date-range';

describe('date-range', () => {
  it('fim sem horário inclui o dia inteiro', () => {
    expect(parseRangeEnd('2026-11-30').toISOString()).toBe('2026-11-30T23:59:59.999Z');
  });

  it('transação do último dia (meio-dia UTC) fica dentro do período', () => {
    const lastDayNoon = new Date('2026-11-30T12:00:00.000Z');
    expect(lastDayNoon <= parseRangeEnd('2026-11-30')).toBe(true);
  });

  it('fim com horário é respeitado', () => {
    expect(parseRangeEnd('2026-11-30T10:00:00.000Z').toISOString()).toBe('2026-11-30T10:00:00.000Z');
  });

  it('início sem horário começa à meia-noite UTC', () => {
    expect(parseRangeStart('2026-11-01').toISOString()).toBe('2026-11-01T00:00:00.000Z');
  });
});
