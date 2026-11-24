import {
  AI_MODELS_CATALOG,
  buildDynamicGeminiDescriptor,
  type AiModelDescriptor,
  type IntegrationDiagnosticCode,
} from '@/features/ai-copilot/models/models-catalog';
import { classifyProviderError } from '@/features/ai-copilot/models/sanity-check-validator';
import { isAuthenticApiKey } from '@/features/ai-copilot/models/model-route-resolver';

interface GoogleModelApiEntry {
  name?: string;
  displayName?: string;
  description?: string;
  inputTokenLimit?: number;
  supportedGenerationMethods?: string[];
}

export interface LiveGeminiModelsResult {
  ok: boolean;
  source: 'LIVE_GOOGLE_API' | 'FALLBACK_CATALOG';
  models: AiModelDescriptor[];
  diagnosticCode?: IntegrationDiagnosticCode;
  httpStatus?: number;
  error?: string | null;
}

const EXCLUDED_GEMINI_PATTERNS = [
  'embedding',
  'aqa',
  'imagen',
  'veo',
  'tts',
  'image-generation',
  'native-audio',
  'robotics',
  'computer-use',
  'bisheng',
];

function scoreGeminiModelPriority(id: string): number {
  let score = 0;
  const ver = id.match(/gemini-(\d+)(?:\.(\d+))?/i);
  if (ver) {
    score += Number(ver[1]) * 100 + Number(ver[2] || 0) * 10;
  }
  if (id.includes('flash') && !id.includes('lite')) score += 25;
  if (id.includes('pro')) score += 20;
  if (id.includes('lite')) score += 10;
  if (id.includes('exp') || id.includes('preview')) score -= 8;
  if (/\d{3}$/.test(id) || /-\d{2}-\d{2}$/.test(id)) score -= 12;
  return score;
}

export function getFallbackGeminiModels(): AiModelDescriptor[] {
  return AI_MODELS_CATALOG.filter((m) => m.provider === 'GEMINI');
}

/**
 * Consulta o endpoint oficial do Google Gemini (`GET /v1beta/models`) para descobrir
 * dinamicamente todos os modelos de geração de texto liberados para a chave informada.
 */
export async function fetchLiveGeminiModels(
  apiKey?: string | null
): Promise<LiveGeminiModelsResult> {
  const fallback = getFallbackGeminiModels();
  if (!isAuthenticApiKey(apiKey)) {
    return {
      ok: false,
      source: 'FALLBACK_CATALOG',
      models: fallback,
      diagnosticCode: 'MISSING_CREDENTIALS',
      error: 'Informe uma chave de API do Google Gemini para listar os modelos liberados.',
    };
  }

  const trimmedKey = String(apiKey).trim();
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(trimmedKey)}&pageSize=100`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    const rawText = await response.text();
    let parsed: { models?: GoogleModelApiEntry[]; error?: { message?: string } } = {};
    try {
      parsed = JSON.parse(rawText);
    } catch {
      parsed = {};
    }

    if (!response.ok) {
      const errMsg = parsed.error?.message || `Google retornou HTTP ${response.status}.`;
      return {
        ok: false,
        source: 'FALLBACK_CATALOG',
        models: fallback,
        httpStatus: response.status,
        diagnosticCode: classifyProviderError(response.status, errMsg),
        error: errMsg,
      };
    }

    const rawModels = Array.isArray(parsed.models) ? parsed.models : [];
    const seen = new Set<string>();
    const liveModels: AiModelDescriptor[] = [];

    for (const entry of rawModels) {
      const rawName = String(entry.name || '').trim();
      const methods = Array.isArray(entry.supportedGenerationMethods)
        ? entry.supportedGenerationMethods
        : [];
      if (!methods.includes('generateContent')) continue;
      if (!rawName.toLowerCase().startsWith('models/gemini-')) continue;

      const cleanId = rawName.replace(/^models\//i, '').toLowerCase();
      if (EXCLUDED_GEMINI_PATTERNS.some((pat) => cleanId.includes(pat))) continue;
      if (seen.has(cleanId)) continue;
      seen.add(cleanId);

      liveModels.push(
        buildDynamicGeminiDescriptor(cleanId, {
          displayName: entry.displayName,
          description: entry.description,
          maxContextTokens: entry.inputTokenLimit,
        })
      );
    }

    liveModels.sort(
      (a, b) => scoreGeminiModelPriority(b.id) - scoreGeminiModelPriority(a.id)
    );

    if (liveModels.length === 0) {
      return {
        ok: true,
        source: 'FALLBACK_CATALOG',
        models: fallback,
        error: null,
      };
    }

    return {
      ok: true,
      source: 'LIVE_GOOGLE_API',
      models: liveModels,
      httpStatus: 200,
      error: null,
    };
  } catch (err) {
    return {
      ok: false,
      source: 'FALLBACK_CATALOG',
      models: fallback,
      diagnosticCode: 'NETWORK_ERROR',
      error:
        err instanceof Error
          ? `Falha ao consultar modelos do Google Gemini: ${err.message}`
          : 'Falha de rede ao consultar modelos do Google Gemini.',
    };
  }
}
