import type { AgentToolExecutor } from '@/features/ai-agent/tools/tool-executor-types';

export interface BatchMutationItemParam {
  toolName: string;
  title: string;
  summary: string;
  params: Record<string, unknown>;
  beforeState: unknown;
}

interface BatchItemResult {
  toolName: string;
  title: string;
  ok: boolean;
  summary: string;
  beforeState: unknown;
  afterState: unknown;
}

export function createBatchMutationsExecutor(
  resolveExecutor: (toolName: string) => AgentToolExecutor | null
): AgentToolExecutor {
  return {
    async preparePreview() {
      throw new Error('batch_mutations é montado exclusivamente pelo agregador de plano em lote.');
    },

    async executeAndVerify(userId, rawParams) {
      const items = Array.isArray(rawParams.items)
        ? (rawParams.items as BatchMutationItemParam[])
        : [];
      if (items.length === 0) {
        return {
          ok: false,
          verified: false,
          summary: 'Lote vazio: nenhuma ação para executar.',
          error: 'Lote vazio.',
        };
      }

      const results: BatchItemResult[] = [];
      for (const item of items) {
        const sub = resolveExecutor(item.toolName);
        if (!sub || item.toolName === 'batch_mutations') {
          results.push({
            toolName: item.toolName,
            title: item.title,
            ok: false,
            summary: `Executor indisponível para "${item.toolName}".`,
            beforeState: item.beforeState,
            afterState: null,
          });
          continue;
        }
        try {
          const res = await sub.executeAndVerify(userId, item.params);
          results.push({
            toolName: item.toolName,
            title: item.title,
            ok: Boolean(res.ok && res.verified),
            summary: res.summary,
            beforeState: item.beforeState,
            afterState: res.afterState ?? null,
          });
        } catch (err) {
          results.push({
            toolName: item.toolName,
            title: item.title,
            ok: false,
            summary: err instanceof Error ? err.message : 'Falha na etapa do lote.',
            beforeState: item.beforeState,
            afterState: null,
          });
        }
      }

      const okCount = results.filter((r) => r.ok).length;
      const failedCount = results.length - okCount;
      const highlights = results
        .slice(0, 5)
        .map((r) => `${r.ok ? '✓' : '✗'} ${r.title}`)
        .join(' • ');
      const extra = results.length > 5 ? ` (+${results.length - 5} itens)` : '';

      return {
        ok: okCount > 0,
        verified: okCount > 0 && failedCount === 0,
        summary:
          failedCount === 0
            ? `Lote concluído: ${okCount}/${results.length} ações salvas e verificadas no banco (${highlights}${extra}).`
            : `Lote parcial: ${okCount}/${results.length} concluídas, ${failedCount} com falha (${highlights}${extra}).`,
        afterState: { results },
        verificationDetail: { total: results.length, succeeded: okCount, failed: failedCount },
      };
    },

    async rollback(userId, _beforeState, afterState) {
      const results = (afterState as { results?: BatchItemResult[] } | null)?.results || [];
      const succeeded = results.filter((r) => r.ok).reverse();
      if (succeeded.length === 0) {
        return { ok: false, summary: 'Nenhuma etapa concluída encontrada para desfazer.' };
      }

      let reverted = 0;
      for (const item of succeeded) {
        const sub = resolveExecutor(item.toolName);
        if (!sub?.rollback) continue;
        try {
          const res = await sub.rollback(userId, item.beforeState, item.afterState);
          if (res.ok) reverted += 1;
        } catch {
          // Continua revertendo os demais itens do lote
        }
      }

      return {
        ok: reverted > 0,
        summary: `Lote desfeito: ${reverted}/${succeeded.length} alteração(ões) revertida(s) no banco.`,
      };
    },
  };
}
