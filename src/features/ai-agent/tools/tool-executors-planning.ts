import { prisma } from '@/shared/lib/prisma';
import { formatCentsToBRL, MONTH_NAMES_PT } from '@/shared/lib/currency';
import { upsertStaticRuleToolSchema } from '@/features/ai-agent/tools/tool-catalog';
import {
  deleteBudgetToolSchema,
  deleteStaticRuleToolSchema,
  deleteValueForecastToolSchema,
  setStaticRuleMonthToolSchema,
  upsertBalanceTargetToolSchema,
  upsertBudgetToolSchema,
} from '@/features/ai-agent/tools/tool-catalog-extended';
import {
  brlToCents,
  normalizeName,
  resolveActiveAccount,
  resolveByName,
  resolveCategory,
} from '@/features/ai-agent/tools/entity-resolvers';
import type { AgentToolExecutor } from '@/features/ai-agent/tools/tool-executor-types';
import {
  deleteBudgetForUser,
  deleteRecurrenceRuleForUser,
  saveRecurrenceRuleForUser,
  upsertBudgetForUser,
} from '@/features/planning/services/planning-mutations';
import {
  formatMonthKey,
  parseMonthlyOverrides,
  parseSkippedMonths,
} from '@/features/planning/domain/recurrence-month-skip';
import { syncUserFinancialKnowledge } from '@/features/ai-copilot/rag';

const syncRag = (userId: string) => syncUserFinancialKnowledge(userId).catch(() => undefined);
const periodLabel = (m: number, y: number) => `${MONTH_NAMES_PT[m - 1]}/${y}`;
const centsInput = (c: number) => (c / 100).toFixed(2);

async function findRuleOrThrow(userId: string, matchDescription: string) {
  const rules = await prisma.recurrenceRule.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } });
  return resolveByName(rules.map((r) => ({ ...r, name: r.description })), matchDescription, 'regra fixa');
}

/* ───────────── upsert_static_rule (cria ou edita) ───────────── */
export const upsertStaticRuleExecutor: AgentToolExecutor = {
  async preparePreview(userId, rawArgs) {
    const parsed = upsertStaticRuleToolSchema.parse(rawArgs);
    const cents = brlToCents(parsed.amountBRL);
    const existing = parsed.matchDescription ? await findRuleOrThrow(userId, parsed.matchDescription) : null;
    const category = parsed.categoryName ? await resolveCategory(userId, parsed.categoryName, parsed.type) : null;
    const account = parsed.accountName ? await resolveActiveAccount(userId, parsed.accountName) : null;

    if (!existing) {
      const dup = await prisma.recurrenceRule.findMany({ where: { userId, type: parsed.type } });
      const same = dup.find((r) => normalizeName(r.description) === normalizeName(parsed.description));
      if (same) {
        throw new Error(
          `Já existe uma regra fixa "${same.description}" (${formatCentsToBRL(same.amountInCents)}). Para alterá-la, peça a edição informando o nome atual; para outra regra, use uma descrição diferente.`
        );
      }
    }

    const isIncome = parsed.type === 'INCOME';
    const dayLabel = parsed.dayType === 'BUSINESS_DAY' ? `${parsed.dayOfMonth}º dia útil` : `Dia ${parsed.dayOfMonth}`;
    const label = isIncome ? 'Ganho Estático' : 'Custo Estático';

    return {
      title: existing ? `Editar ${label}: ${existing.description}` : `Novo ${label}: ${parsed.description}`,
      summary: existing
        ? `Atualizar a regra "${existing.description}" para ${formatCentsToBRL(cents)} (${dayLabel}).`
        : `Cadastrar ${isIncome ? 'ganho fixo' : 'custo fixo'} "${parsed.description}" de ${formatCentsToBRL(cents)} (${dayLabel}).`,
      beforePreview: existing
        ? [
            { label: 'Descrição', value: existing.description },
            { label: 'Valor', value: formatCentsToBRL(existing.amountInCents) },
            { label: 'Vencimento', value: existing.dayType === 'BUSINESS_DAY' ? `${existing.dayOfMonth}º dia útil` : `Dia ${existing.dayOfMonth}` },
          ]
        : [{ label: 'Linha de base fixa', value: 'Nova regra mensal' }],
      afterPreview: [
        { label: 'Descrição', value: parsed.description },
        { label: 'Valor', value: formatCentsToBRL(cents) },
        { label: 'Vencimento', value: dayLabel },
        ...(category ? [{ label: 'Categoria', value: category.name }] : []),
        ...(account ? [{ label: 'Conta', value: account.name }] : []),
      ],
      beforeState: existing
        ? { action: 'UPDATE', id: existing.id, description: existing.description, type: existing.type, nature: existing.nature, amountInCents: existing.amountInCents, dayOfMonth: existing.dayOfMonth, dayType: existing.dayType, includeSaturday: existing.includeSaturday, categoryId: existing.categoryId, accountId: existing.accountId }
        : { action: 'CREATE' },
      normalizedParams: { ...parsed, existingId: existing?.id ?? null, resolvedCategoryId: category?.id ?? null, resolvedAccountId: account?.id ?? null },
      postConfirmVisualSteps: [
        { id: 's1', action: 'SWITCH_TAB', tab: 'goals', targetId: 'nav.tab.goals', caption: 'Navegando para Custos & Ganhos Estáticos' },
        {
          id: 's2', action: 'SCROLL_TO', targetId: 'goals.table.staticRules', caption: `Salvando regra "${parsed.description}"`,
          tooltipTitle: label, tooltipBody: `Registrando "${parsed.description}" (${formatCentsToBRL(cents)} • ${dayLabel}).`, tone: 'emerald', pauseMs: 650,
        },
      ],
      reversible: true,
    };
  },

  async executeAndVerify(userId, params) {
    const parsed = upsertStaticRuleToolSchema.parse(params);
    const existingId = typeof params.existingId === 'string' ? params.existingId : undefined;
    const before = existingId ? await prisma.recurrenceRule.findFirst({ where: { id: existingId, userId } }) : null;
    if (existingId && !before) return { ok: false, verified: false, summary: 'Regra não encontrada.', error: 'Regra não encontrada.' };

    const res = await saveRecurrenceRuleForUser(userId, {
      id: before?.id,
      description: parsed.description,
      type: parsed.type,
      nature: 'STATIC',
      amountRaw: centsInput(brlToCents(parsed.amountBRL)),
      dayOfMonth: parsed.dayOfMonth,
      dayType: parsed.dayType,
      includeSaturday: parsed.includeSaturday,
      categoryId: (params.resolvedCategoryId as string) || before?.categoryId || undefined,
      accountId: (params.resolvedAccountId as string) || before?.accountId || undefined,
    });
    if (!res.ok) return { ok: false, verified: false, summary: res.error, error: res.error };

    const row = await prisma.recurrenceRule.findFirst({
      where: before ? { id: before.id, userId } : { userId, description: parsed.description, type: parsed.type },
      orderBy: { createdAt: 'desc' },
    });
    const verified = Boolean(row && row.amountInCents === brlToCents(parsed.amountBRL));
    return {
      ok: verified,
      verified,
      summary: verified
        ? `Regra fixa "${row!.description}" (${formatCentsToBRL(row!.amountInCents)}) ${before ? 'atualizada' : 'salva'} e verificada no banco.`
        : 'Não foi possível confirmar a regra fixa.',
      afterState: row,
    };
  },

  async rollback(userId, beforeState, afterState) {
    const before = beforeState as { action?: string; id?: string; description?: string; type?: string; nature?: string; amountInCents?: number; dayOfMonth?: number; dayType?: string; includeSaturday?: boolean; categoryId?: string | null; accountId?: string | null } | null;
    const after = afterState as { id?: string } | null;
    if (before?.action === 'UPDATE' && before.id) {
      await prisma.recurrenceRule.updateMany({
        where: { id: before.id, userId },
        data: {
          description: before.description, type: before.type, nature: before.nature, amountInCents: before.amountInCents,
          dayOfMonth: before.dayOfMonth, dayType: before.dayType, includeSaturday: before.includeSaturday,
          categoryId: before.categoryId ?? null, accountId: before.accountId ?? null,
        },
      });
      await syncRag(userId);
      return { ok: true, summary: `Regra "${before.description}" restaurada ao estado anterior.` };
    }
    if (!after?.id) return { ok: false, summary: 'Regra não encontrada para desfazer.' };
    await deleteRecurrenceRuleForUser(userId, after.id);
    return { ok: true, summary: 'Regra fixa recém-criada removida (ação desfeita).' };
  },
};

/* ───────────── delete_static_rule ───────────── */
export const deleteStaticRuleExecutor: AgentToolExecutor = {
  async preparePreview(userId, rawArgs) {
    const parsed = deleteStaticRuleToolSchema.parse(rawArgs);
    const rule = await findRuleOrThrow(userId, parsed.matchDescription);
    return {
      title: `Excluir Regra Fixa: ${rule.description}`,
      summary: `Remover permanentemente a regra "${rule.description}" (${formatCentsToBRL(rule.amountInCents)}). Para só não contar em um mês, use "pular mês".`,
      beforePreview: [{ label: 'Regra', value: rule.description }, { label: 'Valor', value: formatCentsToBRL(rule.amountInCents) }],
      afterPreview: [{ label: 'Resultado', value: 'Regra excluída da linha de base' }],
      beforeState: rule,
      normalizedParams: { ruleId: rule.id },
      postConfirmVisualSteps: [
        { id: 'r1', action: 'SWITCH_TAB', tab: 'goals', targetId: 'nav.tab.goals', caption: 'Abrindo Custos & Ganhos Estáticos' },
        { id: 'r2', action: 'SCROLL_TO', targetId: 'goals.table.staticRules', caption: `Removendo "${rule.description}"`, pauseMs: 400 },
      ],
      reversible: true,
    };
  },
  async executeAndVerify(userId, params) {
    const id = String(params.ruleId || '');
    await deleteRecurrenceRuleForUser(userId, id);
    const gone = !(await prisma.recurrenceRule.findFirst({ where: { id, userId } }));
    return { ok: gone, verified: gone, summary: gone ? 'Regra fixa excluída e ausência confirmada.' : 'Falha ao confirmar exclusão.', afterState: { deletedId: id } };
  },
  async rollback(userId, beforeState) {
    const r = beforeState as Record<string, unknown> | null;
    if (!r?.description) return { ok: false, summary: 'Não foi possível restaurar a regra.' };
    await prisma.recurrenceRule.create({
      data: {
        userId, description: String(r.description), type: String(r.type), nature: String(r.nature), amountInCents: Number(r.amountInCents),
        dayOfMonth: Number(r.dayOfMonth), dayType: String(r.dayType), includeSaturday: Boolean(r.includeSaturday),
        skippedMonths: String(r.skippedMonths ?? '[]'), monthlyOverrides: String(r.monthlyOverrides ?? '{}'),
        categoryId: (r.categoryId as string) || null, accountId: (r.accountId as string) || null,
      },
    });
    await syncRag(userId);
    return { ok: true, summary: `Regra "${r.description}" restaurada.` };
  },
};

/* ───────────── set_static_rule_month ───────────── */
export const setStaticRuleMonthExecutor: AgentToolExecutor = {
  async preparePreview(userId, rawArgs) {
    const parsed = setStaticRuleMonthToolSchema.parse(rawArgs);
    const rule = await findRuleOrThrow(userId, parsed.matchDescription);
    const key = formatMonthKey(parsed.year, parsed.month);
    const skipped = parseSkippedMonths(rule.skippedMonths).includes(key);
    const override = parseMonthlyOverrides(rule.monthlyOverrides)[key];
    const label = periodLabel(parsed.month, parsed.year);

    if (parsed.action === 'SKIP' && skipped) throw new Error(`A regra "${rule.description}" já está pulada em ${label}.`);
    if (parsed.action === 'UNSKIP' && !skipped) throw new Error(`A regra "${rule.description}" não está pulada em ${label}.`);
    if (parsed.action === 'CLEAR_OVERRIDE' && override === undefined) throw new Error(`Não há valor ajustado em ${label} para "${rule.description}".`);

    const current = formatCentsToBRL(override ?? rule.amountInCents);
    const summaryMap = {
      SKIP: `Pular "${rule.description}" em ${label} (volta a contar no mês seguinte).`,
      UNSKIP: `Reativar "${rule.description}" em ${label}.`,
      OVERRIDE: `Ajustar "${rule.description}" para ${formatCentsToBRL(brlToCents(parsed.amountBRL || 0))} apenas em ${label}.`,
      CLEAR_OVERRIDE: `Voltar "${rule.description}" ao valor base em ${label}.`,
    } as const;
    const afterValue = {
      SKIP: 'Pulada neste mês', UNSKIP: current,
      OVERRIDE: formatCentsToBRL(brlToCents(parsed.amountBRL || 0)), CLEAR_OVERRIDE: formatCentsToBRL(rule.amountInCents),
    }[parsed.action];

    return {
      title: `Regra fixa em ${label}: ${rule.description}`,
      summary: summaryMap[parsed.action],
      beforePreview: [{ label: `Situação em ${label}`, value: skipped ? 'Pulada' : current }],
      afterPreview: [{ label: `Situação em ${label}`, value: afterValue }],
      beforeState: { id: rule.id, skippedMonths: rule.skippedMonths, monthlyOverrides: rule.monthlyOverrides },
      normalizedParams: { ruleId: rule.id, month: parsed.month, year: parsed.year, action: parsed.action, amountBRL: parsed.amountBRL ?? null },
      postConfirmVisualSteps: [
        { id: 'm1', action: 'SWITCH_TAB', tab: 'goals', targetId: 'nav.tab.goals', caption: 'Abrindo Custos & Ganhos Estáticos' },
        { id: 'm2', action: 'SCROLL_TO', targetId: 'goals.table.staticRules', caption: summaryMap[parsed.action], pauseMs: 500 },
      ],
      reversible: true,
    };
  },
  async executeAndVerify(userId, params) {
    const rule = await prisma.recurrenceRule.findFirst({ where: { id: String(params.ruleId || ''), userId } });
    if (!rule) return { ok: false, verified: false, summary: 'Regra não encontrada.', error: 'Regra não encontrada.' };
    const month = Number(params.month);
    const year = Number(params.year);
    const key = formatMonthKey(year, month);
    const action = String(params.action);

    let skipped = parseSkippedMonths(rule.skippedMonths);
    const overrides = parseMonthlyOverrides(rule.monthlyOverrides);
    if (action === 'SKIP') skipped = Array.from(new Set([...skipped, key]));
    if (action === 'UNSKIP') skipped = skipped.filter((k) => k !== key);
    if (action === 'OVERRIDE') {
      const cents = brlToCents(Number(params.amountBRL));
      if (cents === rule.amountInCents) delete overrides[key];
      else overrides[key] = cents;
    }
    if (action === 'CLEAR_OVERRIDE') delete overrides[key];

    await prisma.recurrenceRule.update({
      where: { id: rule.id },
      data: { skippedMonths: JSON.stringify(skipped), monthlyOverrides: JSON.stringify(overrides) },
    });
    const row = await prisma.recurrenceRule.findFirst({ where: { id: rule.id, userId } });
    const isSkipped = parseSkippedMonths(row?.skippedMonths).includes(key);
    const ov = parseMonthlyOverrides(row?.monthlyOverrides)[key];
    const verified =
      action === 'SKIP' ? isSkipped
        : action === 'UNSKIP' ? !isSkipped
          : action === 'OVERRIDE' ? ov === brlToCents(Number(params.amountBRL)) || ov === undefined
            : ov === undefined;
    await syncRag(userId);
    return { ok: verified, verified, summary: verified ? `Regra "${rule.description}" atualizada para ${periodLabel(month, year)} e verificada.` : 'Não foi possível verificar a alteração do mês.', afterState: row };
  },
  async rollback(userId, beforeState) {
    const b = beforeState as { id?: string; skippedMonths?: string; monthlyOverrides?: string } | null;
    if (!b?.id) return { ok: false, summary: 'Estado anterior indisponível.' };
    await prisma.recurrenceRule.updateMany({ where: { id: b.id, userId }, data: { skippedMonths: b.skippedMonths ?? '[]', monthlyOverrides: b.monthlyOverrides ?? '{}' } });
    await syncRag(userId);
    return { ok: true, summary: 'Situação anterior da regra neste mês restaurada.' };
  },
};

/* ───────────── orçamentos ───────────── */
function resolvePeriod(m?: number, y?: number) {
  const now = new Date();
  return { month: m ?? now.getMonth() + 1, year: y ?? now.getFullYear() };
}

export const upsertBudgetExecutor: AgentToolExecutor = {
  async preparePreview(userId, rawArgs) {
    const parsed = upsertBudgetToolSchema.parse(rawArgs);
    const { month, year } = resolvePeriod(parsed.month, parsed.year);
    const category = await resolveCategory(userId, parsed.categoryName, 'EXPENSE');
    const existing = await prisma.budget.findUnique({
      where: { userId_categoryId_month_year: { userId, categoryId: category.id, month, year } },
    });
    const cents = brlToCents(parsed.amountBRL);
    return {
      title: `${existing ? 'Alterar' : 'Definir'} Limite: ${category.name}`,
      summary: `Limite de ${formatCentsToBRL(cents)} para "${category.name}" em ${periodLabel(month, year)}.`,
      beforePreview: [{ label: 'Limite atual', value: existing ? formatCentsToBRL(existing.maxAmountInCents) : 'Sem limite definido' }],
      afterPreview: [
        { label: 'Categoria', value: category.name },
        { label: 'Limite', value: formatCentsToBRL(cents) },
        { label: 'Período', value: periodLabel(month, year) },
      ],
      beforeState: existing ? { action: 'UPDATE', categoryId: category.id, month, year, maxAmountInCents: existing.maxAmountInCents } : { action: 'CREATE', categoryId: category.id, month, year },
      normalizedParams: { categoryId: category.id, categoryName: category.name, month, year, amountBRL: parsed.amountBRL },
      postConfirmVisualSteps: [
        { id: 'b1', action: 'SWITCH_TAB', tab: 'goals', targetId: 'nav.tab.goals', caption: 'Abrindo Limites de Gastos' },
        { id: 'b2', action: 'SCROLL_TO', targetId: 'goals.section.budgets', caption: `Definindo limite de "${category.name}"`, pauseMs: 500 },
      ],
      reversible: true,
    };
  },
  async executeAndVerify(userId, params) {
    const categoryId = String(params.categoryId || '');
    const month = Number(params.month);
    const year = Number(params.year);
    const cents = brlToCents(Number(params.amountBRL));
    const res = await upsertBudgetForUser(userId, { categoryId, month, year, maxAmountRaw: centsInput(cents) });
    if (!res.ok) return { ok: false, verified: false, summary: res.error, error: res.error };
    const row = await prisma.budget.findUnique({ where: { userId_categoryId_month_year: { userId, categoryId, month, year } } });
    const verified = row?.maxAmountInCents === cents;
    return { ok: verified, verified, summary: verified ? `Limite de ${formatCentsToBRL(cents)} salvo e verificado para ${periodLabel(month, year)}.` : 'Não foi possível verificar o limite.', afterState: row };
  },
  async rollback(userId, beforeState) {
    const b = beforeState as { action?: string; categoryId?: string; month?: number; year?: number; maxAmountInCents?: number } | null;
    if (!b?.categoryId || !b.month || !b.year) return { ok: false, summary: 'Estado anterior indisponível.' };
    if (b.action === 'UPDATE' && b.maxAmountInCents) {
      await prisma.budget.updateMany({ where: { userId, categoryId: b.categoryId, month: b.month, year: b.year }, data: { maxAmountInCents: b.maxAmountInCents } });
    } else {
      await prisma.budget.deleteMany({ where: { userId, categoryId: b.categoryId, month: b.month, year: b.year } });
    }
    await syncRag(userId);
    return { ok: true, summary: 'Limite restaurado ao estado anterior.' };
  },
};

export const deleteBudgetExecutor: AgentToolExecutor = {
  async preparePreview(userId, rawArgs) {
    const parsed = deleteBudgetToolSchema.parse(rawArgs);
    const { month, year } = resolvePeriod(parsed.month, parsed.year);
    const category = await resolveCategory(userId, parsed.categoryName, 'EXPENSE');
    const existing = await prisma.budget.findUnique({ where: { userId_categoryId_month_year: { userId, categoryId: category.id, month, year } } });
    if (!existing) throw new Error(`Não há limite definido para "${category.name}" em ${periodLabel(month, year)}.`);
    return {
      title: `Remover Limite: ${category.name}`,
      summary: `Remover o limite de ${formatCentsToBRL(existing.maxAmountInCents)} de "${category.name}" em ${periodLabel(month, year)}.`,
      beforePreview: [{ label: 'Limite', value: formatCentsToBRL(existing.maxAmountInCents) }],
      afterPreview: [{ label: 'Resultado', value: 'Sem limite definido' }],
      beforeState: { categoryId: category.id, month, year, maxAmountInCents: existing.maxAmountInCents },
      normalizedParams: { budgetId: existing.id },
      postConfirmVisualSteps: [
        { id: 'bd1', action: 'SWITCH_TAB', tab: 'goals', targetId: 'nav.tab.goals', caption: 'Abrindo Limites de Gastos' },
        { id: 'bd2', action: 'SCROLL_TO', targetId: 'goals.section.budgets', caption: 'Removendo limite', pauseMs: 400 },
      ],
      reversible: true,
    };
  },
  async executeAndVerify(userId, params) {
    const id = String(params.budgetId || '');
    await deleteBudgetForUser(userId, id);
    const gone = !(await prisma.budget.findFirst({ where: { id, userId } }));
    return { ok: gone, verified: gone, summary: gone ? 'Limite removido e ausência confirmada.' : 'Falha ao confirmar a remoção.', afterState: { deletedId: id } };
  },
  async rollback(userId, beforeState) {
    const b = beforeState as { categoryId?: string; month?: number; year?: number; maxAmountInCents?: number } | null;
    if (!b?.categoryId || !b.month || !b.year || !b.maxAmountInCents) return { ok: false, summary: 'Estado anterior indisponível.' };
    await prisma.budget.create({ data: { userId, categoryId: b.categoryId, month: b.month, year: b.year, maxAmountInCents: b.maxAmountInCents } });
    await syncRag(userId);
    return { ok: true, summary: 'Limite restaurado.' };
  },
};

/* ───────────── previsão de valor / meta de saldo ───────────── */
export const deleteValueForecastExecutor: AgentToolExecutor = {
  async preparePreview(userId, rawArgs) {
    const parsed = deleteValueForecastToolSchema.parse(rawArgs);
    const items = await prisma.valueForecastItem.findMany({ where: { userId }, orderBy: { expectedDate: 'asc' } });
    const item = resolveByName(items.map((i) => ({ ...i, name: i.title })), parsed.matchTitle, 'previsão');
    const label = item.type === 'INCOME' ? 'Vou Ganhar' : 'Provável Gasto';
    return {
      title: `Excluir Previsão: ${item.title}`,
      summary: `Remover "${item.title}" (${label}, ${formatCentsToBRL(item.amountInCents)}) da Previsão de Valor.`,
      beforePreview: [{ label, value: `${item.title} • ${formatCentsToBRL(item.amountInCents)}` }],
      afterPreview: [{ label: 'Resultado', value: 'Previsão excluída' }],
      beforeState: item,
      normalizedParams: { itemId: item.id },
      postConfirmVisualSteps: [{ id: 'f1', action: 'SWITCH_TAB', tab: 'forecast', targetId: 'nav.tab.forecast', caption: 'Abrindo Previsão de Valor' }],
      reversible: true,
    };
  },
  async executeAndVerify(userId, params) {
    const id = String(params.itemId || '');
    await prisma.valueForecastItem.deleteMany({ where: { id, userId } });
    const gone = !(await prisma.valueForecastItem.findFirst({ where: { id, userId } }));
    await syncRag(userId);
    return { ok: gone, verified: gone, summary: gone ? 'Previsão excluída e ausência confirmada.' : 'Falha ao confirmar exclusão.', afterState: { deletedId: id } };
  },
  async rollback(userId, beforeState) {
    const i = beforeState as { title?: string; type?: string; amountInCents?: number; expectedDate?: string; notes?: string | null } | null;
    if (!i?.title) return { ok: false, summary: 'Não foi possível restaurar a previsão.' };
    await prisma.valueForecastItem.create({
      data: { userId, title: i.title, type: String(i.type), amountInCents: Number(i.amountInCents), expectedDate: new Date(String(i.expectedDate)), notes: i.notes ?? null },
    });
    return { ok: true, summary: `Previsão "${i.title}" restaurada.` };
  },
};

export const upsertBalanceTargetExecutor: AgentToolExecutor = {
  async preparePreview(userId, rawArgs) {
    const parsed = upsertBalanceTargetToolSchema.parse(rawArgs);
    const existing = parsed.matchTitle
      ? resolveByName(
          (await prisma.balanceTargetCheck.findMany({ where: { userId } })).map((t) => ({ ...t, name: t.title })),
          parsed.matchTitle,
          'meta de saldo'
        )
      : null;
    const cents = brlToCents(parsed.plannedBalanceBRL);
    return {
      title: existing ? `Alterar Meta de Saldo: ${existing.title}` : `Nova Meta de Saldo: ${parsed.title}`,
      summary: `Ter ${formatCentsToBRL(cents)} acumulados em ${parsed.targetDate}.`,
      beforePreview: existing
        ? [{ label: 'Meta', value: `${formatCentsToBRL(existing.plannedBalanceInCents)} em ${existing.targetDate.toISOString().slice(0, 10)}` }]
        : [{ label: 'Metas de saldo', value: 'Nova meta' }],
      afterPreview: [
        { label: 'Título', value: parsed.title },
        { label: 'Saldo desejado', value: formatCentsToBRL(cents) },
        { label: 'Data', value: parsed.targetDate },
      ],
      beforeState: existing ? { action: 'UPDATE', id: existing.id, title: existing.title, plannedBalanceInCents: existing.plannedBalanceInCents, targetDate: existing.targetDate.toISOString(), notes: existing.notes } : { action: 'CREATE' },
      normalizedParams: { ...parsed, existingId: existing?.id ?? null },
      postConfirmVisualSteps: [
        { id: 't1', action: 'SWITCH_TAB', tab: 'forecast', targetId: 'nav.tab.forecast', caption: 'Abrindo Previsão de Valor' },
        { id: 't2', action: 'HIGHLIGHT', targetId: 'forecast.btn.addTarget', caption: `Meta de saldo "${parsed.title}"`, pauseMs: 400 },
      ],
      reversible: true,
    };
  },
  async executeAndVerify(userId, params) {
    const parsed = upsertBalanceTargetToolSchema.parse(params);
    const cents = brlToCents(parsed.plannedBalanceBRL);
    const targetDate = new Date(`${parsed.targetDate}T12:00:00.000Z`);
    const existingId = typeof params.existingId === 'string' ? params.existingId : null;
    const saved = existingId
      ? await prisma.balanceTargetCheck.update({ where: { id: existingId }, data: { title: parsed.title, plannedBalanceInCents: cents, targetDate, notes: parsed.notes ?? null } })
      : await prisma.balanceTargetCheck.create({ data: { userId, title: parsed.title, plannedBalanceInCents: cents, targetDate, notes: parsed.notes ?? null } });
    const row = await prisma.balanceTargetCheck.findFirst({ where: { id: saved.id, userId } });
    const verified = row?.plannedBalanceInCents === cents;
    return { ok: verified, verified, summary: verified ? `Meta de saldo "${parsed.title}" salva e verificada.` : 'Não foi possível verificar a meta de saldo.', afterState: row };
  },
  async rollback(userId, beforeState, afterState) {
    const b = beforeState as { action?: string; id?: string; title?: string; plannedBalanceInCents?: number; targetDate?: string; notes?: string | null } | null;
    const a = afterState as { id?: string } | null;
    if (b?.action === 'UPDATE' && b.id) {
      await prisma.balanceTargetCheck.updateMany({ where: { id: b.id, userId }, data: { title: b.title, plannedBalanceInCents: b.plannedBalanceInCents, targetDate: new Date(String(b.targetDate)), notes: b.notes ?? null } });
      return { ok: true, summary: 'Meta de saldo restaurada.' };
    }
    if (!a?.id) return { ok: false, summary: 'Meta de saldo não encontrada.' };
    await prisma.balanceTargetCheck.deleteMany({ where: { id: a.id, userId } });
    return { ok: true, summary: 'Meta de saldo recém-criada removida.' };
  },
};
