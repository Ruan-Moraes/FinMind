import { prisma } from '@/shared/lib/prisma';
import { formatCentsToBRL, MONTH_NAMES_PT } from '@/shared/lib/currency';
import {
  deleteGoalToolSchema,
  upsertGoalToolSchema,
} from '@/features/ai-agent/tools/tool-catalog';
import type { AgentToolExecutor } from '@/features/ai-agent/tools/tool-executor-types';

const brlToCents = (val: number) => Math.round(val * 100);
const formatBrlInput = (cents: number) => (cents / 100).toFixed(2).replace('.', ',');

export const upsertPortfolioGoalExecutor: AgentToolExecutor = {
  async preparePreview(userId, rawArgs) {
    const parsed = upsertGoalToolSchema.parse(rawArgs);
    const targetCents = brlToCents(parsed.targetAmountBRL);

    let existing = parsed.goalId
      ? await prisma.portfolioGoal.findFirst({ where: { id: parsed.goalId, userId } })
      : null;

    if (!existing && parsed.matchTitle !== undefined) {
      const goals = await prisma.portfolioGoal.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
      const needle = parsed.matchTitle.toLowerCase();
      existing = needle ? goals.find((g) => g.title.toLowerCase().includes(needle)) || goals[0] || null : goals[0] || null;
    }

    const isUpdate = Boolean(existing);
    const effectiveTitle = isUpdate && parsed.title === 'Meta Financeira' ? existing!.title : parsed.title;
    const monthLabel = `${MONTH_NAMES_PT[parsed.targetMonth - 1]}/${parsed.targetYear}`;

    return {
      title: isUpdate ? `Alterar Meta: ${existing!.title}` : `Criar Meta: ${effectiveTitle}`,
      summary: isUpdate
        ? `Atualizar o valor alvo da meta "${existing!.title}" para ${formatCentsToBRL(targetCents)} (${monthLabel}).`
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
        targetAmountBRL: parsed.targetAmountBRL,
        targetMonth: parsed.targetMonth,
        targetYear: parsed.targetYear,
        notes: parsed.notes ?? existing?.notes ?? undefined,
      },
      postConfirmVisualSteps: [
        { id: 's1', action: 'SWITCH_TAB', tab: 'goals', targetId: 'nav.tab.goals', caption: 'Navegando para Meta de Carteira' },
        { id: 's2', action: 'OPEN_MODAL', modalType: 'GOAL', targetId: 'goals.btn.create', caption: isUpdate ? 'Abrindo formulário da meta' : 'Abrindo nova Meta de Carteira' },
        { id: 's3', action: 'FILL_FIELD', targetId: 'modal.goal.input.title', fieldValue: effectiveTitle, caption: `Preenchendo "${effectiveTitle}"` },
        { id: 's4', action: 'FILL_FIELD', targetId: 'modal.goal.input.targetAmount', fieldValue: formatBrlInput(targetCents), caption: `Definindo valor ${formatCentsToBRL(targetCents)}` },
        { id: 's5', action: 'HIGHLIGHT', targetId: 'modal.goal.btn.submit', caption: 'Salvando e validando no banco', pauseMs: 300 },
        { id: 's6', action: 'CLOSE_MODAL', caption: 'Atualizando painel de metas' },
      ],
      reversible: true,
    };
  },

  async executeAndVerify(userId, params) {
    const parsed = upsertGoalToolSchema.parse(params);
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
    const match = parsed.goalId
      ? goals.find((g) => g.id === parsed.goalId)
      : goals.find((g) => g.title.toLowerCase().includes(parsed.matchTitle.toLowerCase()));
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
