import { prisma } from '@/shared/lib/prisma';
import { formatCentsToBRL } from '@/shared/lib/currency';
import {
  upsertStaticRuleToolSchema,
  upsertValueForecastToolSchema,
} from '@/features/ai-agent/tools/tool-catalog';
import type { AgentToolExecutor } from '@/features/ai-agent/tools/tool-executor-types';

const brlToCents = (val: number) => Math.round(val * 100);

export const upsertStaticRuleExecutor: AgentToolExecutor = {
  async preparePreview(_userId, rawArgs) {
    const parsed = upsertStaticRuleToolSchema.parse(rawArgs);
    const cents = brlToCents(parsed.amountBRL);
    const isIncome = parsed.type === 'INCOME';
    const dayLabel =
      parsed.dayType === 'BUSINESS_DAY' ? `${parsed.dayOfMonth}º dia útil` : `Dia ${parsed.dayOfMonth}`;
    return {
      title: isIncome ? `Novo Ganho Estático: ${parsed.description}` : `Novo Custo Estático: ${parsed.description}`,
      summary: `Cadastrar ${isIncome ? 'ganho fixo' : 'custo fixo'} "${parsed.description}" de ${formatCentsToBRL(cents)} (${dayLabel}).`,
      beforePreview: [{ label: 'Linha de base fixa', value: 'Nova regra mensal' }],
      afterPreview: [
        { label: 'Descrição', value: parsed.description },
        { label: 'Valor', value: formatCentsToBRL(cents) },
        { label: 'Vencimento', value: dayLabel },
      ],
      beforeState: { action: 'CREATE' },
      normalizedParams: parsed,
      postConfirmVisualSteps: [
        { id: 's1', action: 'SWITCH_TAB', tab: 'goals', targetId: 'nav.tab.goals', caption: 'Navegando para Custos & Ganhos Estáticos' },
        {
          id: 's2',
          action: 'SCROLL_TO',
          targetId: 'goals.table.staticRules',
          caption: `Salvando regra "${parsed.description}"`,
          tooltipTitle: isIncome ? 'Novo Ganho Estático' : 'Novo Custo Estático',
          tooltipBody: `Registrando "${parsed.description}" (${formatCentsToBRL(cents)} • ${dayLabel}) na tabela de Regras Fixas Mensais.`,
          tone: 'emerald',
          pauseMs: 650,
        },
      ],
      reversible: true,
    };
  },
  async executeAndVerify(userId, params) {
    const parsed = upsertStaticRuleToolSchema.parse(params);
    const cents = brlToCents(parsed.amountBRL);
    const created = await prisma.recurrenceRule.create({
      data: {
        userId,
        description: parsed.description,
        type: parsed.type,
        nature: 'STATIC',
        amountInCents: cents,
        dayOfMonth: parsed.dayOfMonth,
        dayType: parsed.dayType,
        includeSaturday: parsed.includeSaturday,
      },
    });
    const verified = Boolean(await prisma.recurrenceRule.findFirst({ where: { id: created.id, userId } }));
    return {
      ok: verified,
      verified,
      summary: verified
        ? `Regra fixa "${created.description}" (${formatCentsToBRL(cents)}) salva e verificada no banco.`
        : 'Não foi possível confirmar a criação da regra fixa.',
      afterState: created,
    };
  },
  async rollback(userId, _beforeState, afterState) {
    const after = afterState as { id?: string } | null;
    if (!after?.id) return { ok: false, summary: 'Regra não encontrada para desfazer.' };
    await prisma.recurrenceRule.deleteMany({ where: { id: after.id, userId } });
    return { ok: true, summary: 'Regra fixa recém-criada removida (ação desfeita).' };
  },
};

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
