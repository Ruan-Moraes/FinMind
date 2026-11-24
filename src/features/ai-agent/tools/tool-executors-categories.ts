import { prisma } from '@/shared/lib/prisma';
import {
  categorizeTransactionsToolSchema,
  upsertCategoryToolSchema,
} from '@/features/ai-agent/tools/tool-catalog-mutations';
import type { AgentToolExecutor } from '@/features/ai-agent/tools/tool-executor-types';

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

function buildMonthRange(month?: number, year?: number): { gte: Date; lte: Date } | undefined {
  if (!month || !year) return undefined;
  return {
    gte: new Date(Date.UTC(year, month - 1, 1, 0, 0, 0)),
    lte: new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)),
  };
}

export const upsertCategoryExecutor: AgentToolExecutor = {
  async preparePreview(userId, rawArgs) {
    const parsed = upsertCategoryToolSchema.parse(rawArgs);
    const categories = await prisma.category.findMany({ where: { userId } });
    const existing = categories.find((c) => c.name.toLowerCase() === parsed.name.toLowerCase()) || null;
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
      categories.find((c) => c.name.toLowerCase() === name.toLowerCase()) ||
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
    const dateRange = buildMonthRange(parsed.month, parsed.year);
    const candidates = await prisma.transaction.findMany({
      where: {
        userId,
        ...(parsed.transactionIds?.length ? { id: { in: parsed.transactionIds } } : {}),
        ...(dateRange ? { date: dateRange } : {}),
        ...(parsed.onlyUncategorized ? { categoryId: null } : {}),
      },
      select: { id: true, description: true, categoryId: true },
      take: 200,
    });

    const needle = parsed.descriptionContains?.toLowerCase() || '';
    const matched = needle
      ? candidates.filter((t) => t.description.toLowerCase().includes(needle))
      : candidates;

    if (matched.length === 0) {
      throw new Error(`Nenhum lançamento encontrado para classificar como "${parsed.categoryName}".`);
    }

    return {
      title: `Classificar ${matched.length} lançamento(s) em "${parsed.categoryName}"`,
      summary: `Associar ${matched.length} lançamento(s)${needle ? ` contendo "${parsed.descriptionContains}"` : ''} à categoria "${parsed.categoryName}".`,
      beforePreview: [{ label: 'Lançamentos encontrados', value: `${matched.length} registro(s)` }],
      afterPreview: [
        { label: 'Categoria destino', value: parsed.categoryName },
        { label: 'Exemplos', value: matched.slice(0, 3).map((m) => m.description).join(', ') },
      ],
      beforeState: { previous: matched.map((m) => ({ id: m.id, categoryId: m.categoryId })) },
      normalizedParams: {
        categoryName: parsed.categoryName,
        categoryType: parsed.categoryType,
        transactionIds: matched.map((m) => m.id),
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
    let cat = categories.find((c) => c.name.toLowerCase() === categoryName.toLowerCase()) || null;
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
    }

    const updated = await prisma.transaction.updateMany({
      where: { userId, id: { in: txIds } },
      data: { categoryId: cat.id },
    });

    return {
      ok: updated.count > 0,
      verified: updated.count > 0,
      summary: `${updated.count} lançamento(s) classificado(s) em "${cat.name}".`,
      afterState: { categoryId: cat.id, updatedCount: updated.count },
      verificationDetail: { categoryId: cat.id, updatedCount: updated.count },
    };
  },

  async rollback(userId, beforeState) {
    const prev = (beforeState as { previous?: Array<{ id: string; categoryId: string | null }> } | null)?.previous;
    if (!prev?.length) return { ok: false, summary: 'Estado anterior dos lançamentos indisponível.' };
    await prisma.$transaction(
      prev.map((item) =>
        prisma.transaction.updateMany({
          where: { id: item.id, userId },
          data: { categoryId: item.categoryId },
        })
      )
    );
    return { ok: true, summary: `Categoria anterior restaurada em ${prev.length} lançamento(s).` };
  },
};
