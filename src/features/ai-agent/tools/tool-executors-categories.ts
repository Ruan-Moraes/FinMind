import { prisma } from '@/shared/lib/prisma';
import {
  categorizeTransactionsToolSchema,
  upsertCategoryToolSchema,
} from '@/features/ai-agent/tools/tool-catalog-mutations';
import { deleteCategoryToolSchema } from '@/features/ai-agent/tools/tool-catalog-extended';
import { resolveByName } from '@/features/ai-agent/tools/entity-resolvers';
import type { AgentToolExecutor } from '@/features/ai-agent/tools/tool-executor-types';
import { normalizeName } from '@/features/ai-agent/tools/entity-resolvers';
import { getMonthDateRange } from '@/features/analytics/domain/fiscal-calendar';
import { buildMemoryPatternKey } from '@/features/reconciliation/engine';

const MAX_CATEGORIZE = 500;

const DEFAULT_EXPENSE_COLOR = '#f43f5e';
const DEFAULT_INCOME_COLOR = '#10b981';

function pickCategoryIcon(requestedIcon: string | undefined, name: string): string {
  const clean = requestedIcon?.trim();
  if (clean && clean !== 'Tag') return clean;
  const n = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (/(aliment|restaur|ifood|food|lanche|delivery)/.test(n)) return 'Utensils';
  if (/(supermercad|mercad)/.test(n)) return 'ShoppingCart';
  if (/(educac|faculd|curso|uninter|escola)/.test(n)) return 'GraduationCap';
  if (/(morad|aluguel|agua|luz|energia|copasa|internet|casa)/.test(n)) return 'Home';
  if (/(transport|uber|gasolina|carro|moto|combust)/.test(n)) return 'Car';
  if (/(saude|farmac|medic|academia)/.test(n)) return 'HeartPulse';
  if (/(lazer|viagem|cinema|stream|assinat|openai|ia)/.test(n)) return 'Sparkles';
  if (/(cartao|fatura)/.test(n)) return 'CreditCard';
  if (/(salari|renda|freela|bonus|rendiment)/.test(n)) return 'Wallet';
  return 'Tag';
}

/** Recorta pelo ciclo mensal fiscal do usuário (o mesmo usado pelo dashboard e pelas consultas). */
async function buildFiscalMonthRange(userId: string, month?: number, year?: number): Promise<{ gte: Date; lte: Date } | undefined> {
  if (!month || !year) return undefined;
  const settings = await prisma.userSettings.findUnique({ where: { userId }, select: { fiscalMonthStartDay: true } });
  const { start, end } = getMonthDateRange(month, year, settings?.fiscalMonthStartDay || 1);
  return { gte: start, lte: end };
}

const sameName = (a: string, b: string) => normalizeName(a) === normalizeName(b);

export const upsertCategoryExecutor: AgentToolExecutor = {
  async preparePreview(userId, rawArgs) {
    const parsed = upsertCategoryToolSchema.parse(rawArgs);
    const categories = await prisma.category.findMany({ where: { userId } });
    const existing = categories.find((c) => sameName(c.name, parsed.name) && c.type === parsed.type) || null;
    const resolvedIcon = pickCategoryIcon(parsed.icon || existing?.icon, parsed.name);
    const resolvedColor =
      parsed.color || existing?.color || (parsed.type === 'INCOME' ? DEFAULT_INCOME_COLOR : DEFAULT_EXPENSE_COLOR);
    const typeLabel = parsed.type === 'INCOME' ? 'Receita (Ganho)' : 'Despesa (Gasto)';
    const natureLabel = parsed.defaultNature === 'STATIC' ? 'Fixo / Estático' : 'Variável';

    return {
      title: existing ? `Atualizar Categoria: ${existing.name}` : `Nova Categoria: ${parsed.name}`,
      summary: existing
        ? `Atualizar categoria "${existing.name}" (${typeLabel} • ${natureLabel}).`
        : `Cadastrar categoria "${parsed.name}" (${typeLabel} • ${natureLabel}).`,
      beforePreview: existing
        ? [
            { label: 'Categoria existente', value: existing.name },
            { label: 'Tipo atual', value: existing.type === 'INCOME' ? 'Receita' : 'Despesa' },
          ]
        : [{ label: 'Categorias', value: 'Nova categoria personalizada' }],
      afterPreview: [
        { label: 'Nome', value: parsed.name },
        { label: 'Tipo', value: typeLabel },
        { label: 'Natureza padrão', value: natureLabel },
      ],
      beforeState: existing
        ? {
            id: existing.id,
            name: existing.name,
            type: existing.type,
            defaultNature: existing.defaultNature,
            color: existing.color,
            icon: existing.icon,
          }
        : null,
      normalizedParams: {
        existingId: existing?.id || null,
        name: parsed.name,
        type: parsed.type,
        defaultNature: parsed.defaultNature,
        color: resolvedColor,
        icon: resolvedIcon,
      },
      postConfirmVisualSteps: [
        { id: 'c1', action: 'SWITCH_TAB', tab: 'goals', targetId: 'nav.tab.goals', caption: 'Abrindo aba de Categorias' },
        { id: 'c2', action: 'SCROLL_TO', targetId: 'goals.section.categories', caption: `Destacando categoria "${parsed.name}"`, pauseMs: 400 },
      ],
      reversible: true,
    };
  },

  async executeAndVerify(userId, p) {
    const name = String(p.name || '').trim();
    const type = p.type === 'INCOME' ? 'INCOME' : 'EXPENSE';
    const defaultNature = p.defaultNature === 'STATIC' ? 'STATIC' : 'VARIABLE';
    const color = String(p.color || (type === 'INCOME' ? DEFAULT_INCOME_COLOR : DEFAULT_EXPENSE_COLOR));
    const icon = String(p.icon || 'Tag');

    const categories = await prisma.category.findMany({ where: { userId } });
    const existing =
      (p.existingId ? categories.find((c) => c.id === String(p.existingId)) : null) ||
      categories.find((c) => sameName(c.name, name) && c.type === type) ||
      null;

    const saved = existing
      ? await prisma.category.update({
          where: { id: existing.id },
          data: { name, type, defaultNature, color, icon },
        })
      : await prisma.category.create({
          data: { userId, name, type, defaultNature, color, icon },
        });

    const verified = await prisma.category.findFirst({ where: { id: saved.id, userId } });
    if (!verified) {
      return { ok: false, verified: false, summary: 'Categoria não localizada após gravação.', error: 'Falha de verificação.' };
    }
    return {
      ok: true,
      verified: true,
      summary: `Categoria "${verified.name}" (${verified.type === 'INCOME' ? 'Ganho' : 'Gasto'}) salva e verificada no banco.`,
      afterState: { id: verified.id, wasCreated: !existing },
      verificationDetail: { categoryId: verified.id, name: verified.name, type: verified.type },
    };
  },

  async rollback(userId, beforeState, afterState) {
    const after = afterState as { id?: string; wasCreated?: boolean } | null;
    if (!after?.id) return { ok: false, summary: 'ID da categoria não encontrado para rollback.' };
    if (after.wasCreated) {
      await prisma.category.deleteMany({ where: { id: after.id, userId } });
      return { ok: true, summary: 'Categoria recém-criada removida com sucesso.' };
    }
    const prev = beforeState as {
      id: string;
      name: string;
      type: string;
      defaultNature: string;
      color: string;
      icon: string;
    } | null;
    if (!prev?.id) return { ok: false, summary: 'Estado anterior da categoria indisponível.' };
    await prisma.category.updateMany({
      where: { id: prev.id, userId },
      data: { name: prev.name, type: prev.type, defaultNature: prev.defaultNature, color: prev.color, icon: prev.icon },
    });
    return { ok: true, summary: `Categoria "${prev.name}" restaurada ao estado anterior.` };
  },
};

export const categorizeTransactionsExecutor: AgentToolExecutor = {
  async preparePreview(userId, rawArgs) {
    const parsed = categorizeTransactionsToolSchema.parse(rawArgs);
    if (!parsed.descriptionContains && !parsed.transactionIds?.length && !(parsed.month && parsed.year)) {
      throw new Error('Diga quais lançamentos classificar: um trecho da descrição, os IDs ou o mês/ano.');
    }
    const dateRange = await buildFiscalMonthRange(userId, parsed.month, parsed.year);
    const categories = await prisma.category.findMany({ where: { userId } });
    const sameNameCats = categories.filter((c) => sameName(c.name, parsed.categoryName));
    const existingCat = sameNameCats.find((c) => c.type === parsed.categoryType) || sameNameCats[0] || null;
    const categoryType = (existingCat?.type ?? parsed.categoryType) as 'INCOME' | 'EXPENSE';

    // Filtro no banco (e não em amostra): o tipo do lançamento precisa casar com o da categoria.
    const candidates = await prisma.transaction.findMany({
      where: {
        userId,
        type: categoryType,
        ...(parsed.transactionIds?.length ? { id: { in: parsed.transactionIds } } : {}),
        ...(dateRange ? { date: dateRange } : {}),
        ...(parsed.onlyUncategorized ? { categoryId: null } : {}),
      },
      select: { id: true, description: true, categoryId: true, rawBankDescription: true },
      orderBy: { date: 'desc' },
    });

    const needle = parsed.descriptionContains ? normalizeName(parsed.descriptionContains) : '';
    const matched = (needle
      ? candidates.filter((t) => normalizeName(t.description).includes(needle) || normalizeName(t.rawBankDescription || '').includes(needle))
      : candidates
    ).filter((t) => !existingCat || t.categoryId !== existingCat.id);

    if (matched.length === 0) {
      const typeLabel = categoryType === 'INCOME' ? 'receitas' : 'despesas';
      throw new Error(`Nenhum lançamento (${typeLabel}${parsed.onlyUncategorized ? ' sem categoria' : ''}) encontrado para classificar como "${parsed.categoryName}".`);
    }
    if (matched.length > MAX_CATEGORIZE) {
      throw new Error(`Encontrei ${matched.length} lançamentos; o limite por operação é ${MAX_CATEGORIZE}. Restrinja por mês ou por descrição.`);
    }

    const finalName = existingCat?.name ?? parsed.categoryName;
    return {
      title: `Classificar ${matched.length} lançamento(s) em "${finalName}"`,
      summary: `Associar ${matched.length} lançamento(s)${needle ? ` contendo "${parsed.descriptionContains}"` : ''} à categoria "${finalName}"${existingCat ? '' : ' (categoria NOVA, será criada)'}${parsed.rememberForFuture ? '. Futuras importações semelhantes serão classificadas assim' : ''}.`,
      beforePreview: [{ label: 'Lançamentos encontrados', value: `${matched.length} registro(s)` }],
      afterPreview: [
        { label: 'Categoria destino', value: existingCat ? finalName : `${finalName} (nova ${categoryType === 'INCOME' ? 'categoria de ganho' : 'categoria de gasto'})` },
        { label: 'Exemplos', value: matched.slice(0, 3).map((m) => m.description).join(', ') },
        ...(parsed.rememberForFuture ? [{ label: 'Aprendizado', value: 'Memorizado para próximas importações' }] : []),
      ],
      beforeState: { previous: matched.map((m) => ({ id: m.id, categoryId: m.categoryId })) },
      normalizedParams: {
        categoryName: finalName,
        categoryType,
        categoryId: existingCat?.id ?? null,
        transactionIds: matched.map((m) => m.id),
        rememberForFuture: parsed.rememberForFuture,
      },
      postConfirmVisualSteps: [
        { id: 'ct1', action: 'SWITCH_TAB', tab: 'transactions', targetId: 'nav.tab.transactions', caption: 'Abrindo Extrato atualizado' },
      ],
      reversible: true,
    };
  },

  async executeAndVerify(userId, p) {
    const categoryName = String(p.categoryName || '').trim();
    const categoryType = p.categoryType === 'INCOME' ? 'INCOME' : 'EXPENSE';
    const txIds = Array.isArray(p.transactionIds) ? p.transactionIds.map(String) : [];
    if (!categoryName || txIds.length === 0) {
      return { ok: false, verified: false, summary: 'Parâmetros inválidos para categorização.', error: 'Lista vazia.' };
    }

    const categories = await prisma.category.findMany({ where: { userId } });
    let cat =
      (typeof p.categoryId === 'string' ? categories.find((c) => c.id === p.categoryId) : undefined) ||
      categories.find((c) => sameName(c.name, categoryName) && c.type === categoryType) ||
      null;
    let createdCategoryId: string | null = null;
    if (!cat) {
      cat = await prisma.category.create({
        data: {
          userId,
          name: categoryName,
          type: categoryType,
          defaultNature: 'VARIABLE',
          color: categoryType === 'INCOME' ? DEFAULT_INCOME_COLOR : DEFAULT_EXPENSE_COLOR,
          icon: pickCategoryIcon(undefined, categoryName),
        },
      });
      createdCategoryId = cat.id;
    }

    const updated = await prisma.transaction.updateMany({
      where: { userId, id: { in: txIds }, type: cat.type },
      data: { categoryId: cat.id },
    });

    // Aprendizado: mesma memória usada pela conciliação de extratos e pela edição manual.
    const memory: Array<{ pattern: string; created: boolean; previousCategoryId: string | null }> = [];
    if (p.rememberForFuture !== false && updated.count > 0) {
      const rows = await prisma.transaction.findMany({
        where: { userId, id: { in: txIds } },
        select: { description: true, rawBankDescription: true, nature: true, counterparty: true },
      });
      const patterns = new Map<string, (typeof rows)[number]>();
      for (const r of rows) {
        const key = buildMemoryPatternKey(r.rawBankDescription || r.description);
        if (key.length >= 4 && !patterns.has(key)) patterns.set(key, r);
      }
      for (const [pattern, r] of Array.from(patterns.entries()).slice(0, 50)) {
        const prev = await prisma.reconciliationMemoryRule.findUnique({
          where: { userId_normalizedPattern: { userId, normalizedPattern: pattern } },
          select: { categoryId: true },
        });
        await prisma.reconciliationMemoryRule.upsert({
          where: { userId_normalizedPattern: { userId, normalizedPattern: pattern } },
          create: {
            userId, normalizedPattern: pattern, merchantKeyword: (r.counterparty || '').toUpperCase().slice(0, 40),
            targetType: cat.type, nature: r.nature, categoryId: cat.id, confirmCount: 1, lastConfirmedAt: new Date(),
          },
          update: { categoryId: cat.id, targetType: cat.type, confirmCount: { increment: 1 }, lastConfirmedAt: new Date() },
        });
        memory.push({ pattern, created: !prev, previousCategoryId: prev?.categoryId ?? null });
      }
    }

    const verifiedCount = await prisma.transaction.count({ where: { userId, id: { in: txIds }, categoryId: cat.id } });
    const verified = updated.count > 0 && verifiedCount === updated.count;
    return {
      ok: updated.count > 0,
      verified,
      summary: `${updated.count} lançamento(s) classificado(s) em "${cat.name}"${createdCategoryId ? ' (categoria criada)' : ''}${memory.length ? `; ${memory.length} padrão(ões) memorizado(s) para as próximas importações` : ''}.`,
      afterState: { categoryId: cat.id, createdCategoryId, updatedCount: updated.count, memory },
      verificationDetail: { categoryId: cat.id, updatedCount: updated.count, verifiedCount },
    };
  },

  async rollback(userId, beforeState, afterState) {
    const prev = (beforeState as { previous?: Array<{ id: string; categoryId: string | null }> } | null)?.previous;
    if (!prev?.length) return { ok: false, summary: 'Estado anterior dos lançamentos indisponível.' };
    const after = afterState as {
      createdCategoryId?: string | null;
      memory?: Array<{ pattern: string; created: boolean; previousCategoryId: string | null }>;
    } | null;
    await prisma.$transaction([
      ...prev.map((item) =>
        prisma.transaction.updateMany({
          where: { id: item.id, userId },
          data: { categoryId: item.categoryId },
        })
      ),
      ...(after?.memory || []).map((m) =>
        m.created
          ? prisma.reconciliationMemoryRule.deleteMany({ where: { userId, normalizedPattern: m.pattern } })
          : prisma.reconciliationMemoryRule.updateMany({ where: { userId, normalizedPattern: m.pattern }, data: { categoryId: m.previousCategoryId } })
      ),
    ]);
    // Remove a categoria criada por esta operação, se ninguém mais a usa.
    if (after?.createdCategoryId) {
      const id = after.createdCategoryId;
      const [txs, rules, budgets] = await Promise.all([
        prisma.transaction.count({ where: { userId, categoryId: id } }),
        prisma.recurrenceRule.count({ where: { userId, categoryId: id } }),
        prisma.budget.count({ where: { userId, categoryId: id } }),
      ]);
      if (txs + rules + budgets === 0) await prisma.category.deleteMany({ where: { id: after.createdCategoryId, userId } });
    }
    return { ok: true, summary: `Categoria anterior restaurada em ${prev.length} lançamento(s).` };
  },
};

/* ───────────── delete_category ───────────── */
export const deleteCategoryExecutor: AgentToolExecutor = {
  async preparePreview(userId, rawArgs) {
    const parsed = deleteCategoryToolSchema.parse(rawArgs);
    const categories = await prisma.category.findMany({ where: { userId, ...(parsed.type ? { type: parsed.type } : {}) } });
    const cat = resolveByName(categories, parsed.categoryName, 'categoria');
    const [txIds, ruleIds, budgets, memoryIds] = await Promise.all([
      prisma.transaction.findMany({ where: { userId, categoryId: cat.id }, select: { id: true } }),
      prisma.recurrenceRule.findMany({ where: { userId, categoryId: cat.id }, select: { id: true } }),
      prisma.budget.findMany({ where: { userId, categoryId: cat.id } }),
      prisma.reconciliationMemoryRule.findMany({ where: { userId, categoryId: cat.id }, select: { id: true } }),
    ]);
    const typeLabel = cat.type === 'INCOME' ? 'ganho' : 'gasto';
    return {
      title: `Excluir Categoria: ${cat.name}`,
      summary: `Remover a categoria de ${typeLabel} "${cat.name}". ${txIds.length} lançamento(s) e ${ruleIds.length} regra(s) fixa(s) ficarão sem categoria${budgets.length ? ` e ${budgets.length} limite(s) de gasto serão removidos` : ''}.`,
      beforePreview: [
        { label: 'Categoria', value: `${cat.name} (${typeLabel})` },
        { label: 'Em uso', value: `${txIds.length} lançamento(s), ${ruleIds.length} regra(s), ${budgets.length} limite(s)` },
      ],
      afterPreview: [{ label: 'Resultado', value: 'Categoria excluída; itens ficam sem categoria' }],
      beforeState: {
        category: { name: cat.name, type: cat.type, defaultNature: cat.defaultNature, color: cat.color, icon: cat.icon },
        transactionIds: txIds.map((t) => t.id),
        ruleIds: ruleIds.map((r) => r.id),
        memoryRuleIds: memoryIds.map((m) => m.id),
        budgets: budgets.map((b) => ({ month: b.month, year: b.year, maxAmountInCents: b.maxAmountInCents })),
      },
      normalizedParams: { categoryId: cat.id },
      postConfirmVisualSteps: [
        { id: 'dc1', action: 'SWITCH_TAB', tab: 'goals', targetId: 'nav.tab.goals', caption: 'Abrindo Categorias' },
        { id: 'dc2', action: 'SCROLL_TO', targetId: 'goals.section.categories', caption: `Removendo "${cat.name}"`, pauseMs: 400 },
      ],
      reversible: true,
    };
  },
  async executeAndVerify(userId, params) {
    const id = String(params.categoryId || '');
    // A memória de conciliação não tem FK: limpa a referência para não apontar para uma categoria inexistente.
    await prisma.$transaction([
      prisma.reconciliationMemoryRule.updateMany({ where: { userId, categoryId: id }, data: { categoryId: null } }),
      prisma.category.deleteMany({ where: { id, userId } }),
    ]);
    const gone = !(await prisma.category.findFirst({ where: { id, userId } }));
    return { ok: gone, verified: gone, summary: gone ? 'Categoria excluída e ausência confirmada.' : 'Falha ao confirmar exclusão.', afterState: { deletedId: id } };
  },
  async rollback(userId, beforeState) {
    const b = beforeState as {
      category?: { name: string; type: string; defaultNature: string; color: string; icon: string };
      transactionIds?: string[]; ruleIds?: string[]; memoryRuleIds?: string[];
      budgets?: Array<{ month: number; year: number; maxAmountInCents: number }>;
    } | null;
    if (!b?.category) return { ok: false, summary: 'Não foi possível restaurar a categoria.' };
    const restored = await prisma.category.create({ data: { userId, ...b.category } });
    await prisma.$transaction([
      prisma.transaction.updateMany({ where: { userId, id: { in: b.transactionIds || [] }, categoryId: null }, data: { categoryId: restored.id } }),
      prisma.recurrenceRule.updateMany({ where: { userId, id: { in: b.ruleIds || [] }, categoryId: null }, data: { categoryId: restored.id } }),
      prisma.reconciliationMemoryRule.updateMany({ where: { userId, id: { in: b.memoryRuleIds || [] }, categoryId: null }, data: { categoryId: restored.id } }),
      ...(b.budgets || []).map((bg) =>
        prisma.budget.create({ data: { userId, categoryId: restored.id, month: bg.month, year: bg.year, maxAmountInCents: bg.maxAmountInCents } })
      ),
    ]);
    return { ok: true, summary: `Categoria "${b.category.name}" restaurada e religada aos itens.` };
  },
};
