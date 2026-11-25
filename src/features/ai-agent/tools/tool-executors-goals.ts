import { z } from 'zod';
import { prisma } from '@/shared/lib/prisma';
import { resolveByName } from '@/features/ai-agent/tools/entity-resolvers';
import { formatCentsToBRL, MONTH_NAMES_PT } from '@/shared/lib/currency';
import {
  deleteGoalToolSchema,
  upsertGoalToolSchema,
} from '@/features/ai-agent/tools/tool-catalog';
import type { AgentToolExecutor } from '@/features/ai-agent/tools/tool-executor-types';

const brlToCents = (val: number) => Math.round(val * 100);

const resolvedGoalSchema = z.object({
  goalId: z.string().optional(),
  title: z.string().trim().min(1),
  targetAmountBRL: z.coerce.number().positive(),
  targetMonth: z.coerce.number().int().min(1).max(12),
  targetYear: z.coerce.number().int().min(2000).max(2100),
  notes: z.string().optional(),
});
const formatBrlInput = (cents: number) => (cents / 100).toFixed(2).replace('.', ',');

export const upsertPortfolioGoalExecutor: AgentToolExecutor = {
  async preparePreview(userId, rawArgs) {
    const parsed = upsertGoalToolSchema.parse(rawArgs);

    let existing = parsed.goalId
      ? await prisma.portfolioGoal.findFirst({ where: { id: parsed.goalId, userId } })
      : null;
    if (parsed.goalId && !existing) throw new Error('Não encontrei a meta informada para alterar.');

    if (!existing && parsed.matchTitle?.trim()) {
      const goals = await prisma.portfolioGoal.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
      const found = resolveByName(goals.map((g) => ({ ...g, name: g.title })), parsed.matchTitle, 'meta');
      existing = goals.find((g) => g.id === found.id) || null;
    }

    if (!existing) {
      const missing = [
        !parsed.title && 'title',
        parsed.targetAmountBRL === undefined && 'targetAmountBRL',
        parsed.targetMonth === undefined && 'targetMonth',
        parsed.targetYear === undefined && 'targetYear',
      ].filter(Boolean);
      if (missing.length > 0) throw new Error(`Para criar a meta, faltam: ${missing.join(', ')}. Para alterar uma meta existente, informe matchTitle.`);
    }

    // Na edição, campos omitidos mantêm o valor atual.
    const targetCents = parsed.targetAmountBRL !== undefined ? brlToCents(parsed.targetAmountBRL) : existing!.targetAmountInCents;
    const effectiveTitle = parsed.title || existing!.title;
    const targetMonth = parsed.targetMonth ?? existing!.targetMonth;
    const targetYear = parsed.targetYear ?? existing!.targetYear;
    const monthLabel = `${MONTH_NAMES_PT[targetMonth - 1]}/${targetYear}`;
    const isUpdate = Boolean(existing);

    return {
      title: isUpdate ? `Alterar Meta: ${existing!.title}` : `Criar Meta: ${effectiveTitle}`,
      summary: isUpdate
        ? `Atualizar a meta "${existing!.title}": ${effectiveTitle !== existing!.title ? `título "${effectiveTitle}", ` : ''}alvo ${formatCentsToBRL(targetCents)} até ${monthLabel}.`
        : `Cadastrar nova Meta de Carteira "${effectiveTitle}" de ${formatCentsToBRL(targetCents)} para ${monthLabel}.`,
      beforePreview: existing
        ? [
            { label: 'Título', value: existing.title },
            { label: 'Valor Alvo', value: formatCentsToBRL(existing.targetAmountInCents) },
            { label: 'Prazo', value: `${MONTH_NAMES_PT[existing.targetMonth - 1]}/${existing.targetYear}` },
          ]
        : [{ label: 'Estado atual', value: 'Nova meta a cadastrar' }],
      afterPreview: [
        { label: 'Título', value: effectiveTitle },
        { label: 'Valor Alvo', value: formatCentsToBRL(targetCents) },
        { label: 'Prazo', value: monthLabel },
      ],
      beforeState: existing
        ? {
            action: 'UPDATE',
            id: existing.id,
            title: existing.title,
            targetAmountInCents: existing.targetAmountInCents,
            targetMonth: existing.targetMonth,
            targetYear: existing.targetYear,
            notes: existing.notes,
          }
        : { action: 'CREATE' },
      normalizedParams: {
        goalId: existing?.id,
        title: effectiveTitle,
        targetAmountBRL: targetCents / 100,
        targetMonth,
        targetYear,
        notes: parsed.notes ?? existing?.notes ?? undefined,
      },
      postConfirmVisualSteps: [
        { id: 's1', action: 'SWITCH_TAB', tab: 'goals', targetId: 'nav.tab.goals', caption: 'Navegando para Meta de Carteira' },
        { id: 's2', action: 'OPEN_MODAL', modalType: 'GOAL', targetId: 'goals.btn.create', caption: isUpdate ? 'Abrindo formulário da meta' : 'Abrindo nova Meta de Carteira' },
        {
          id: 's3',
          action: 'FILL_FIELD',
          targetId: 'modal.goal.input.title',
          fieldValue: effectiveTitle,
          caption: `Preenchendo "${effectiveTitle}"`,
          tooltipTitle: isUpdate ? 'Atualizando Meta' : 'Nova Meta de Carteira',
          tooltipBody: `Preenchendo o título "${effectiveTitle}" e o alvo de ${formatCentsToBRL(targetCents)} para ${monthLabel}.`,
          tone: 'indigo',
        },
        { id: 's4', action: 'FILL_FIELD', targetId: 'modal.goal.input.targetAmount', fieldValue: formatBrlInput(targetCents), caption: `Definindo valor ${formatCentsToBRL(targetCents)}` },
        { id: 's5', action: 'HIGHLIGHT', targetId: 'modal.goal.btn.submit', caption: 'Salvando e validando no banco', tone: 'emerald', pauseMs: 320 },
        { id: 's6', action: 'CLOSE_MODAL', caption: 'Atualizando painel de metas' },
      ],
      reversible: true,
    };
  },

  async executeAndVerify(userId, params) {
    const parsed = resolvedGoalSchema.parse(params);
    const targetCents = brlToCents(parsed.targetAmountBRL);
    let savedId: string;

    if (parsed.goalId) {
      const existing = await prisma.portfolioGoal.findFirst({ where: { id: parsed.goalId, userId } });
      if (!existing) return { ok: false, verified: false, summary: 'Meta não encontrada.', error: 'Meta não encontrada.' };
      const updated = await prisma.portfolioGoal.update({
        where: { id: existing.id },
        data: {
          title: parsed.title,
          targetAmountInCents: targetCents,
          targetMonth: parsed.targetMonth,
          targetYear: parsed.targetYear,
          notes: parsed.notes ?? existing.notes,
        },
      });
      savedId = updated.id;
    } else {
      const created = await prisma.portfolioGoal.create({
        data: {
          userId,
          title: parsed.title,
          targetAmountInCents: targetCents,
          targetMonth: parsed.targetMonth,
          targetYear: parsed.targetYear,
          notes: parsed.notes || null,
        },
      });
      savedId = created.id;
    }

    const verifiedRow = await prisma.portfolioGoal.findFirst({ where: { id: savedId, userId } });
    const verified = Boolean(verifiedRow && verifiedRow.targetAmountInCents === targetCents);

    return {
      ok: verified,
      verified,
      summary: verified
        ? `Meta "${verifiedRow!.title}" salva e verificada no banco com valor alvo de ${formatCentsToBRL(targetCents)}.`
        : 'Não foi possível confirmar a persistência da meta.',
      afterState: verifiedRow,
      verificationDetail: { checkedEntityId: savedId, targetAmountInCents: verifiedRow?.targetAmountInCents },
    };
  },

  async rollback(userId, beforeState, afterState) {
    const before = beforeState as {
      action?: string; id?: string; title?: string;
      targetAmountInCents?: number; targetMonth?: number; targetYear?: number; notes?: string | null;
    } | null;
    const after = afterState as { id?: string } | null;

    if (before?.action === 'CREATE' && after?.id) {
      await prisma.portfolioGoal.deleteMany({ where: { id: after.id, userId } });
      return { ok: true, summary: 'Meta recém-criada removida (ação desfeita).' };
    }
    if (before?.action === 'UPDATE' && before.id) {
      await prisma.portfolioGoal.updateMany({
        where: { id: before.id, userId },
        data: {
          title: before.title,
          targetAmountInCents: before.targetAmountInCents,
          targetMonth: before.targetMonth,
          targetYear: before.targetYear,
          notes: before.notes ?? null,
        },
      });
      return { ok: true, summary: `Meta "${before.title}" restaurada para ${formatCentsToBRL(before.targetAmountInCents || 0)}.` };
    }
    return { ok: false, summary: 'Estado anterior indisponível para reversão.' };
  },
};

export const deletePortfolioGoalExecutor: AgentToolExecutor = {
  async preparePreview(userId, rawArgs) {
    const parsed = deleteGoalToolSchema.parse(rawArgs);
    const goals = await prisma.portfolioGoal.findMany({ where: { userId } });
    const byId = parsed.goalId ? goals.find((g) => g.id === parsed.goalId) : undefined;
    const match = byId ?? goals.find((g) => g.id === resolveByName(goals.map((x) => ({ ...x, name: x.title })), parsed.matchTitle, 'meta').id);
    if (!match) throw new Error(`Não encontrei nenhuma meta correspondente a "${parsed.matchTitle}".`);
    return {
      title: `Excluir Meta: ${match.title}`,
      summary: `Remover permanentemente a meta "${match.title}" (${formatCentsToBRL(match.targetAmountInCents)}).`,
      beforePreview: [{ label: 'Meta', value: match.title }, { label: 'Valor Alvo', value: formatCentsToBRL(match.targetAmountInCents) }],
      afterPreview: [{ label: 'Resultado', value: 'Meta excluída da carteira' }],
      beforeState: match,
      normalizedParams: { goalId: match.id, matchTitle: match.title },
      postConfirmVisualSteps: [
        { id: 's1', action: 'SWITCH_TAB', tab: 'goals', targetId: 'nav.tab.goals', caption: 'Abrindo Metas de Carteira' },
        { id: 's2', action: 'HIGHLIGHT', targetId: 'goals.section.goals', caption: `Removendo meta "${match.title}"`, pauseMs: 300 },
      ],
      reversible: true,
    };
  },
  async executeAndVerify(userId, params) {
    const goalId = String(params.goalId || '');
    await prisma.portfolioGoal.deleteMany({ where: { id: goalId, userId } });
    const verified = !(await prisma.portfolioGoal.findFirst({ where: { id: goalId, userId } }));
    return { ok: verified, verified, summary: verified ? 'Meta excluída e ausência confirmada no banco.' : 'Falha ao confirmar exclusão.', afterState: { deletedId: goalId } };
  },
  async rollback(userId, beforeState) {
    const prev = beforeState as { title?: string; targetAmountInCents?: number; targetMonth?: number; targetYear?: number; notes?: string | null } | null;
    if (!prev?.title) return { ok: false, summary: 'Não foi possível restaurar a meta.' };
    await prisma.portfolioGoal.create({
      data: { userId, title: prev.title, targetAmountInCents: prev.targetAmountInCents || 100, targetMonth: prev.targetMonth || 12, targetYear: prev.targetYear || new Date().getFullYear(), notes: prev.notes ?? null },
    });
    return { ok: true, summary: `Meta "${prev.title}" restaurada com sucesso.` };
  },
};
