import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  buildFallbackNationalHolidays,
  buildStateHolidays,
  computeEasterSundayUtc,
} from '@/features/planning/domain/brazil-holidays-catalog';
import {
  computeNthBusinessDay,
  resolveRecurrenceRuleDueDate,
} from '@/features/planning/domain/business-days';
import { fetchNationalHolidaysForYear } from '@/features/planning/services/holidays-sync-service';

describe('Cálculo de Dias Úteis & Calendário de Feriados Brasileiros (2026–2028)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calcula Páscoa e feriados nacionais/estaduais corretamente para 2026, 2027 e 2028', () => {
    // Páscoa real: 05/04/2026, 28/03/2027, 16/04/2028
    expect(computeEasterSundayUtc(2026).toISOString().slice(0, 10)).toBe('2026-04-05');
    expect(computeEasterSundayUtc(2027).toISOString().slice(0, 10)).toBe('2027-03-28');
    expect(computeEasterSundayUtc(2028).toISOString().slice(0, 10)).toBe('2028-04-16');

    const nat2026 = buildFallbackNationalHolidays(2026);
    expect(nat2026.some((h) => h.date === '2026-04-03' && h.name.includes('Sexta'))).toBe(true);
    expect(nat2026.some((h) => h.date === '2026-11-02' && h.name === 'Finados')).toBe(true);

    const sp2026 = buildStateHolidays('SP', 2026);
    expect(sp2026.some((h) => h.date === '2026-07-09')).toBe(true);
  });

  it('calcula o 5º dia útil em Novembro/2026 pulando Finados (02/11) e fim de semana', () => {
    // Nov/2026: 01 dom, 02 seg (Finados!), 03 ter (1º), 04 qua (2º), 05 qui (3º), 06 sex (4º), 07 sáb, 08 dom, 09 seg (5º)
    const res = computeNthBusinessDay({
      year: 2026,
      month: 11,
      nthBusinessDay: 5,
      holidays: [],
      includeSaturday: false,
    });

    expect(res.dateIso).toBe('2026-11-09');
    expect(res.formattedDate).toBe('09/11/2026');
    expect(res.weekdayFull).toBe('segunda-feira');
    expect(res.skippedHolidays.some((h) => h.date === '02/11')).toBe(true);

    // No modo CLT (sábado conta como dia útil): 07/11 (sáb) vira o 5º dia útil!
    const resClt = computeNthBusinessDay({
      year: 2026,
      month: 11,
      nthBusinessDay: 5,
      holidays: [],
      includeSaturday: true,
    });
    expect(resClt.dateIso).toBe('2026-11-07');
    expect(resClt.weekdayShort).toBe('sáb');
  });

  it('respeita feriados municipais cadastrados pelo usuário e ignora feriados desativados', () => {
    // Nov/2026 com feriado municipal extra em 04/11 -> 5º dia útil empurra de 09/11 para 10/11!
    const withMunicipal = resolveRecurrenceRuleDueDate({
      dayOfMonth: 5,
      dayType: 'BUSINESS_DAY',
      year: 2026,
      month: 11,
      holidays: [
        { id: '1', date: '2026-11-02', year: 2026, name: 'Finados', scope: 'NATIONAL', source: 'BRASIL_API', isActive: true },
        { id: '2', date: '2026-11-04', year: 2026, name: 'Feriado Municipal Teste', scope: 'MUNICIPAL', source: 'MANUAL', isActive: true },
      ],
    });
    expect(withMunicipal.isBusinessDay).toBe(true);
    expect(withMunicipal.label).toBe('5º dia útil');
    expect(withMunicipal.resolution.dateIso).toBe('2026-11-10');

    // Com feriado municipal desativado, volta para 09/11
    const disabledMunicipal = resolveRecurrenceRuleDueDate({
      dayOfMonth: 5,
      dayType: 'BUSINESS_DAY',
      year: 2026,
      month: 11,
      holidays: [
        { id: '1', date: '2026-11-02', year: 2026, name: 'Finados', scope: 'NATIONAL', source: 'BRASIL_API', isActive: true },
        { id: '2', date: '2026-11-04', year: 2026, name: 'Feriado Municipal Teste', scope: 'MUNICIPAL', source: 'MANUAL', isActive: false },
      ],
    });
    expect(disabledMunicipal.resolution.dateIso).toBe('2026-11-09');
  });

  it('busca feriados na BrasilAPI e cai para fallback offline se a API falhar', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify([{ date: '2027-01-01', name: 'Confraternização mundial', type: 'national' }]),
        { status: 200 }
      )
    );
    const live = await fetchNationalHolidaysForYear(2027);
    expect(live.source).toBe('BRASIL_API');
    expect(live.items).toHaveLength(1);

    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('offline'));
    const fallback = await fetchNationalHolidaysForYear(2028);
    expect(fallback.source).toBe('FALLBACK_LOCAL');
    expect(fallback.items.length).toBeGreaterThanOrEqual(12);
  });
});
