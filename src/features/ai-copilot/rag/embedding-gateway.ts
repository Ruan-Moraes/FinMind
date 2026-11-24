import { isAuthenticApiKey } from "@/features/ai-copilot/models";
import { logWarn } from "@/shared/lib/logger";
import { computeDeterministicFinancialEmbedding } from "@/features/ai-copilot/rag/rag-math-and-security";

/**
 * Gera embeddings para uma lista de textos utilizando OpenAI (`text-embedding-3-small`)
 * ou Google Gemini (`text-embedding-004`) quando uma chave de API real estiver configurada,
 * ou fallback transparente para o vetorizador semântico-financeiro local (`financial-semantic-v1`).
 */
export async function generateEmbeddingsBatch(
  texts: string[],
  userKeys?: {
    openaiApiKey?: string | null;
    geminiApiKey?: string | null;
  }
): Promise<{ vectors: number[][]; model: string }> {
  if (texts.length === 0) {
    return { vectors: [], model: 'none' };
  }

  const openaiKey = isAuthenticApiKey(userKeys?.openaiApiKey)
    ? userKeys!.openaiApiKey!.trim()
    : isAuthenticApiKey(process.env.OPENAI_API_KEY)
    ? process.env.OPENAI_API_KEY!.trim()
    : '';

  if (openaiKey) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      const res = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openaiKey}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: texts,
        }),
      });
      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.data) && data.data.length === texts.length) {
          const vectors = data.data.map((d: { embedding: number[] }) => d.embedding);
          return { vectors, model: 'text-embedding-3-small' };
        }
      }
    } catch (err) {
      logWarn('RAG:Embedding', 'Fallback OpenAI embeddings para Gemini/local', { error: err });
    }
  }

  const geminiKey = isAuthenticApiKey(userKeys?.geminiApiKey)
    ? userKeys!.geminiApiKey!.trim()
    : isAuthenticApiKey(process.env.GEMINI_API_KEY)
    ? process.env.GEMINI_API_KEY!.trim()
    : '';

  if (geminiKey) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      const url = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:batchEmbedContents?key=${encodeURIComponent(
        geminiKey
      )}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          requests: texts.map((t) => ({
            model: 'models/text-embedding-004',
            content: { parts: [{ text: t }] },
          })),
        }),
      });
      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.embeddings) && data.embeddings.length === texts.length) {
          const vectors = data.embeddings.map((e: { values: number[] }) => e.values);
          return { vectors, model: 'text-embedding-004' };
        }
      }
    } catch (err) {
      logWarn('RAG:Embedding', 'Fallback Gemini embeddings para vetorizador local', { error: err });
    }
  }

  return {
    vectors: texts.map((t) => computeDeterministicFinancialEmbedding(t)),
    model: 'financial-semantic-v1',
  };
}

