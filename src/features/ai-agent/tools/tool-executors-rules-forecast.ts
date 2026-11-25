import { z } from 'zod';
import { prisma } from '@/shared/lib/prisma';
import { formatCentsToBRL } from '@/shared/lib/currency';
import { upsertValueForecastToolSchema } from '@/features/ai-agent/tools/tool-catalog';
import { normalizeName, resolveByName } from '@/features/ai-agent/tools/entity-resolvers';
import type { AgentToolExecutor } from '@/features/ai-agent/tools/tool-executor-types';

const brlToCents = (val: number) => Math.round(val * 100);
const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const forecastLabel = (type: string) => (type === 'INCOME' ? 'Vou Ganhar' : 'Provável Gasto');

const resolvedForecastSchema = z.object({
  title: z.string().trim().min(1),
  type: z.enum(['INCOME', 'EXPENSE']),
  amountBRL: z.coerce.number().positive(),
  expectedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().optional(),
});

export const upsertValueForecastExecutor: AgentToolExecutor = {
  async preparePreview(userId, rawArgs) {
    const parsed = upsertValueForecastToolSchema.parse(rawArgs);
    const items = await prisma.valueForecastItem.findMany({ where: { userId }, orderBy: { expectedDate: 'asc' } });
    const existing = parsed.matchTitle
      ? items.find((i) => i.id === resolveByName(items.map((x) => ({ ...x, name: x.title })), parsed.matchTitle!, 'previsão').id) ?? null
      : null;

    if (!existing) {
      const missing = [
        !parsed.title && 'title',
        !parsed.type && 'type (INCOME = Vou Ganhar, EXPENSE = Provável Gasto)',
        parsed.amountBRL === undefined && 'amountBRL',
        !parsed.expectedDate && 'expectedDate',
      ].filter(Boolean);
      if (missing.length > 0) {
        throw new Error(`Para criar a previsão, faltam: ${missing.join(', ')}. Para editar uma existente, informe matchTitle.`);
      }
      const dup = items.find((i) => normalizeName(i.title) === normalizeName(parsed.title!));
      if (dup) {
        throw new Error(
          `Já existe a previsão "${dup.title}" (${formatCentsToBRL(dup.amountInCents)} em ${isoDay(dup.expectedDate)}). Para alterá-la, peça a edição informando o título.`
        );
      }
    }

    // Na edição, campos omitidos mantêm o valor atual.
    const merged = resolvedForecastSchema.parse({
      title: parsed.title ?? existing?.title,
      type: parsed.type ?? existing?.type,
      amountBRL: parsed.amountBRL ?? (existing ? existing.amountInCents / 100 : undefined),
      expectedDate: parsed.expectedDate ?? (existing ? isoDay(existing.expectedDate) : undefined),
      notes: parsed.notes ?? existing?.notes ?? undefined,
    });
    const cents = brlToCents(merged.amountBRL);
    const label = forecastLabel(merged.type);
    return {
      title: existing ? `Editar Previsão: ${existing.title}` : `${label}: ${merged.title}`,
      summary: existing
        ? `Atualizar a previsão "${existing.title}" para ${formatCentsToBRL(cents)} (${label}) em ${merged.expectedDate}.`
        : `Registrar previsão "${merged.title}" (${label}) de ${formatCentsToBRL(cents)} para ${merged.expectedDate}.`,
      beforePreview: existing
        ? [
            { label: 'Previsão', value: `${existing.title} (${forecastLabel(existing.type)})` },
            { label: 'Valor', value: formatCentsToBRL(existing.amountInCents) },
            { label: 'Data prevista', value: isoDay(existing.expectedDate) },
          ]
        : [{ label: 'Previsão de Valor', value: 'Novo evento futuro' }],
      afterPreview: [
        { label: 'Tipo', value: label },
        { label: 'Valor', value: formatCentsToBRL(cents) },
        { label: 'Data prevista', value: merged.expectedDate },
      ],
      beforeState: existing
        ? {
            action: 'UPDATE', id: existing.id, title: existing.title, type: existing.type,
            amountInCents: existing.amountInCents, expectedDate: existing.expectedDate.toISOString(), notes: existing.notes,
          }
        : { action: 'CREATE' },
      normalizedParams: { ...merged, existingId: existing?.id ?? null },
      postConfirmVisualSteps: [
        { id: 's1', action: 'SWITCH_TAB', tab: 'forecast', targetId: 'nav.tab.forecast', caption: 'Abrindo Previsão de Valor' },
        {
          id: 's2',
          action: 'HIGHLIGHT',
          targetId: merged.type === 'INCOME' ? 'forecast.btn.addIncome' : 'forecast.btn.addExpense',
          caption: `Registrando ${label}: ${merged.title}`,
          pauseMs: 320,
        },
      ],
      reversible: true,
    };
  },

  async executeAndVerify(userId, params) {
    const parsed = resolvedForecastSchema.parse(params);
    const cents = brlToCents(parsed.amountBRL);
    const existingId = typeof params.existingId === 'string' ? params.existingId : null;
    const data = {
      title: parsed.title,
      type: parsed.type,
      amountInCents: cents,
      expectedDate: new Date(`${parsed.expectedDate}T12:00:00.000Z`),
      notes: parsed.notes || null,
    };
    let savedId: string;
    if (existingId) {
      const res = await prisma.valueForecastItem.updateMany({ where: { id: existingId, userId }, data });
      if (res.count === 0) return { ok: false, verified: false, summary: 'Previsão não encontrada.', error: 'Previsão não encontrada.' };
      savedId = existingId;
    } else {
      savedId = (await prisma.valueForecastItem.create({ data: { userId, ...data } })).id;
    }
    const row = await prisma.valueForecastItem.findFirst({ where: { id: savedId, userId } });
    const verified = Boolean(row && row.amountInCents === cents);
    return {
      ok: verified,
      verified,
      summary: verified
        ? `Previsão "${row!.title}" (${formatCentsToBRL(cents)}) ${existingId ? 'atualizada' : 'salva'} e verificada em Previsão de Valor.`
        : 'Não foi possível verificar a gravação da previsão.',
      afterState: row,
    };
  },

  async rollback(userId, beforeState, afterState) {
    const before = beforeState as {
      action?: string; id?: string; title?: string; type?: string; amountInCents?: number; expectedDate?: string; notes?: string | null;
    } | null;
    const after = afterState as { id?: string } | null;
    if (before?.action === 'UPDATE' && before.id) {
      await prisma.valueForecastItem.updateMany({
        where: { id: before.id, userId },
        data: {
          title: before.title, type: before.type, amountInCents: before.amountInCents,
          expectedDate: before.expectedDate ? new Date(before.expectedDate) : undefined, notes: before.notes ?? null,
        },
      });
      return { ok: true, summary: `Previsão "${before.title}" restaurada.` };
    }
    if (!after?.id) return { ok: false, summary: 'Previsão não encontrada para reversão.' };
    await prisma.valueForecastItem.deleteMany({ where: { id: after.id, userId } });
    return { ok: true, summary: 'Evento de previsão removido (ação desfeita).' };
  },
};
