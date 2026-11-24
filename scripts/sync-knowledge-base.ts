import { loadKnowledgeDocumentsFromDisk, syncSystemKnowledgeBase } from '@/features/ai-agent/knowledge/system-kb-sync';
import { TOOL_RISK_POLICY } from '@/features/ai-agent/domain/agent-risk-policy';
import { isKnownAgentTargetId } from '@/features/ai-agent/domain/agent-target-registry';

async function main() {
  const mode = process.argv.includes('--validate-only') ? 'validate' : 'sync';
  const docs = await loadKnowledgeDocumentsFromDisk();

  if (docs.length === 0) {
    console.error('Nenhum documento encontrado em docs/knowledge/.');
    process.exit(1);
  }

  const errors: string[] = [];
  for (const doc of docs) {
    for (const tool of doc.frontmatter.relatedTools) {
      if (!Object.prototype.hasOwnProperty.call(TOOL_RISK_POLICY, tool)) {
        errors.push(`[${doc.filePath}] relatedTool desconhecida: "${tool}"`);
      }
    }
    const targetMatches = doc.chunks.flatMap((c) => {
      const m = c.contentText.match(/`([a-z]+\.[a-zA-Z0-9._-]+)`/g) || [];
      return m.map((s) => s.slice(1, -1));
    });
    for (const target of targetMatches) {
      if (
        (target.startsWith('nav.') ||
          target.startsWith('header.') ||
          target.startsWith('goals.') ||
          target.startsWith('forecast.') ||
          target.startsWith('accounts.') ||
          target.startsWith('transactions.') ||
          target.startsWith('ai.') ||
          target.startsWith('modal.') ||
          target.startsWith('agent.')) &&
        !isKnownAgentTargetId(target)
      ) {
        errors.push(`[${doc.filePath}] data-agent-id não registrado: "${target}"`);
      }
    }
  }

  if (errors.length > 0) {
    console.error('Erros de consistência na Base de Conhecimento:\n' + errors.join('\n'));
    process.exit(1);
  }

  console.log(
    `[KB] Validados ${docs.length} documentos (${docs.reduce((a, d) => a + d.chunks.length, 0)} seções semânticas) com 0 inconsistências.`
  );

  if (mode === 'sync') {
    const res = await syncSystemKnowledgeBase();
    console.log(
      `[KB] Sincronização concluída: ${res.totalDocs} docs, ${res.totalChunks} chunks (${res.embeddedChunks} novos/atualizados, ${res.removedDocs} removidos, modelo=${res.embeddingModel}).`
    );
  }
}

main().catch((err) => {
  console.error('[KB] Falha:', err);
  process.exit(1);
});
