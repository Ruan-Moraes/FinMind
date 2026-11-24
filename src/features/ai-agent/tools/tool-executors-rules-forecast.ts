import { prisma } from '@/shared/lib/prisma';
import { formatCentsToBRL } from '@/shared/lib/currency';
import { upsertValueForecastToolSchema } from '@/features/ai-agent/tools/tool-catalog';
import type { AgentToolExecutor } from '@/features/ai-agent/tools/tool-executor-types';

const brlToCents = (val: number) => Math.round(val * 100);

export const upsertValueForecastExecutor: AgentToolExecutor = {
  async preparePreview(_userId, rawArgs) {
    const parsed = upsertValueForecastToolSchema.parse(rawArgs);
    const cents = brlToCents(parsed.amountBRL);
    const label = parsed.type === 'INCOME' ? 'Vou Ganhar' : 'Provável Gasto';
    return {
      title: `${label}: ${parsed.title}`,
      summary: `Registrar previsão "${parsed.title}" (${label}) de ${formatCentsToBRL(cents)} para ${parsed.expectedDate}.`,
      beforePreview: [{ label: 'Previsão de Valor', value: 'Novo evento futuro' }],
      afterPreview: [
        { label: 'Tipo', value: label },
        { label: 'Valor', value: formatCentsToBRL(cents) },
        { label: 'Data prevista', value: parsed.expectedDate },
      ],
      beforeState: { action: 'CREATE' },
      normalizedParams: parsed,
      postConfirmVisualSteps: [
        { id: 's1', action: 'SWITCH_TAB', tab: 'forecast', targetId: 'nav.tab.forecast', caption: 'Abrindo Previsão de Valor' },
        {
          id: 's2',
          action: 'HIGHLIGHT',
          targetId: parsed.type === 'INCOME' ? 'forecast.btn.addIncome' : 'forecast.btn.addExpense',
          caption: `Registrando ${label}: ${parsed.title}`,
          pauseMs: 320,
        },
      ],
      reversible: true,
    };
  },
  async executeAndVerify(userId, params) {
    const parsed = upsertValueForecastToolSchema.parse(params);
    const cents = brlToCents(parsed.amountBRL);
    const created = await prisma.valueForecastItem.create({
      data: {
        userId,
        title: parsed.title,
        type: parsed.type,
        amountInCents: cents,
        expectedDate: new Date(`${parsed.expectedDate}T12:00:00.000Z`),
        notes: parsed.notes || null,
      },
    });
    const verified = Boolean(await prisma.valueForecastItem.findFirst({ where: { id: created.id, userId } }));
    return {
      ok: verified,
      verified,
      summary: verified
        ? `Previsão "${created.title}" (${formatCentsToBRL(cents)}) salva e verificada em Previsão de Valor.`
        : 'Não foi possível verificar a gravação da previsão.',
      afterState: created,
    };
  },
  async rollback(userId, _beforeState, afterState) {
    const after = afterState as { id?: string } | null;
    if (!after?.id) return { ok: false, summary: 'Previsão não encontrada para reversão.' };
    await prisma.valueForecastItem.deleteMany({ where: { id: after.id, userId } });
    return { ok: true, summary: 'Evento de previsão removido (ação desfeita).' };
  },
};
