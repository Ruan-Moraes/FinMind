import { describe, it, expect, afterAll } from 'vitest';
import { prisma } from '@/shared/lib/prisma';
import { syncSystemKnowledgeBase } from '@/features/ai-agent/knowledge/system-kb-sync';
import { retrieveSystemKnowledge } from '@/features/ai-agent/knowledge/system-kb-retriever';
import { upsertPortfolioGoalExecutor } from '@/features/ai-agent/tools/tool-executors-goals';
import {
  createAgentAuditLog,
  generateIdempotencyKey,
  generateRunId,
  updateAuditLogStatus,
} from '@/features/ai-agent/services/agent-audit-service';

describe('Integração: RAG Documental do Sistema & Execução Autônoma com Verificação e Rollback', () => {
  const createdUserIds: string[] = [];

  afterAll(async () => {
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
  });

  it('sincroniza docs/knowledge incrementalmente e recupera seções relevantes via busca híbrida', async () => {
    const first = await syncSystemKnowledgeBase();
    expect(first.totalDocs).toBeGreaterThanOrEqual(10);
    expect(first.totalChunks).toBeGreaterThanOrEqual(20);

    // Segunda sincronização sem alterações não deve re-embedar nenhum chunk
    const second = await syncSystemKnowledgeBase();
    expect(second.embeddedChunks).toBe(0);

    const resGoals = await retrieveSystemKnowledge({
      query: 'como cadastrar meta de carteira e custos estaticos com dia util',
      activeTab: 'goals',
      topK: 4,
    });
    expect(resGoals.chunks.length).toBeGreaterThan(0);
    expect(resGoals.chunks.some((c) => c.docId === 'goals-and-static-rules')).toBe(true);

    const resHolidays = await retrieveSystemKnowledge({
      query: 'onde configuro estado cidade e calendario de feriados',
      topK: 4,
    });
    expect(resHolidays.chunks.some((c) => c.docId === 'settings-holidays-and-backup')).toBe(true);
  });

  it('prepara preview Antes->Depois, executa e verifica meta no banco, audita e desfaz via rollback', async () => {
    const user = await prisma.user.create({
      data: {
        email: `agent-int-${Date.now()}@finmind.test`,
        name: 'Agent Integration Test',
        passwordHash: 'hash',
      },
    });
    createdUserIds.push(user.id);

    const preview = await upsertPortfolioGoalExecutor.preparePreview(user.id, {
      title: 'Meta Reserva Teste',
      targetAmountBRL: 3500,
      targetMonth: 12,
      targetYear: 2026,
    });
    expect(preview.afterPreview.some((p) => p.value.includes('3.500,00'))).toBe(true);

    const runId = generateRunId();
    const audit = await createAgentAuditLog({
      userId: user.id,
      runId,
      idempotencyKey: generateIdempotencyKey(runId, 'upsert_portfolio_goal'),
      modality: 'AUTONOMOUS',
      toolName: 'upsert_portfolio_goal',
      riskLevel: 'L2',
      status: 'AWAITING_CONFIRMATION',
      rawParams: preview.normalizedParams,
      beforeState: preview.beforeState,
    });

    const execRes = await upsertPortfolioGoalExecutor.executeAndVerify(user.id, preview.normalizedParams);
    expect(execRes.ok).toBe(true);
    expect(execRes.verified).toBe(true);

    await updateAuditLogStatus(user.id, audit.id, {
      status: 'SUCCEEDED',
      afterState: execRes.afterState,
      verificationResult: execRes.verificationDetail,
    });

    const persistedGoals = await prisma.portfolioGoal.findMany({ where: { userId: user.id } });
    expect(persistedGoals).toHaveLength(1);
    expect(persistedGoals[0].targetAmountInCents).toBe(350000);

    // Rollback (Desfazer) deve remover a meta recém-criada
    const undoRes = await upsertPortfolioGoalExecutor.rollback!(user.id, preview.beforeState, execRes.afterState);
    expect(undoRes.ok).toBe(true);

    const afterUndo = await prisma.portfolioGoal.findMany({ where: { userId: user.id } });
    expect(afterUndo).toHaveLength(0);
  });
});
