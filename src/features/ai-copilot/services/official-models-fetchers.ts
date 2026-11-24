import {
  type AiProviderId,
  type DiscoveredAiModel,
  type IntegrationDiagnosticCode,
} from '@/features/ai-copilot/domain/ai-provider-types';
import { classifyProviderError } from '@/features/ai-copilot/models/sanity-check-validator';

export interface OfficialModelsDiscoveryResult {
  ok: boolean;
  provider: AiProviderId;
  models: DiscoveredAiModel[];
  fetchedAt: string;
  fromCache: boolean;
  httpStatus?: number;
  diagnosticCode?: IntegrationDiagnosticCode;
  error?: string | null;
}

const MAX_PAGES = 10;

async function fetchJsonWithTimeout(
  url: string,
  headers: Record<string, string>,
  timeoutMs = 10000
): Promise<{ ok: boolean; status: number; data: Record<string, unknown>; errorText: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method: 'GET', headers, cache: 'no-store', signal: controller.signal });
    const text = await res.text();
    let data: Record<string, unknown> = {};
    try { data = JSON.parse(text) as Record<string, unknown>; } catch { data = {}; }
    const errObj = data.error as { message?: string } | undefined;
    const errorText = errObj?.message || res.statusText || `HTTP ${res.status}`;
    return { ok: res.ok, status: res.status, data, errorText };
  } finally {
    clearTimeout(timer);
  }
}

function classifyOpenAiModel(raw: {
  id: string;
  created?: number;
  owned_by?: string;
  shutdown_date?: string | null;
}): DiscoveredAiModel {
  const id = raw.id.trim();
  const lower = id.toLowerCase();
  const isAudio = /(whisper|tts|transcribe|audio|realtime)/i.test(lower);
  const isImageOrVideo = /(dall-e|image|sora|video)/i.test(lower);
  const isEmbedding = /(embedding)/i.test(lower);
  const isModeration = /(moderation|omni-moderation)/i.test(lower);
  const isLegacyInstruct = /(davinci|babbage|curie|ada|instruct)/i.test(lower);
  const isChatCapable = !isAudio && !isImageOrVideo && !isEmbedding && !isModeration && !isLegacyInstruct;

  const incompatibilityReason = isEmbedding
    ? 'Modelo exclusivo de embeddings (não responde chat).'
    : isAudio
    ? 'Modelo de áudio/transcrição (não responde chat textual).'
    : isImageOrVideo
    ? 'Modelo de geração de imagem/vídeo.'
    : isModeration
    ? 'Modelo de moderação de conteúdo.'
    : isLegacyInstruct
    ? 'Modelo legado de completions (incompatível com Chat/Tools).'
    : null;

  const displayName = id
    .split('-')
    .map((p) => (p.toLowerCase() === 'gpt' ? 'GPT' : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(' ');

  return {
    id,
    displayName,
    provider: 'OPENAI',
    description: `OpenAI (${raw.owned_by || 'openai'}) • ${id}`,
    createdAt: raw.created ? new Date(raw.created * 1000).toISOString() : null,
    ownedBy: raw.owned_by || null,
    shutdownDate: raw.shutdown_date || null,
    capabilities: {
      chat: isChatCapable,
      tools: isChatCapable,
      jsonMode: isChatCapable,
      embeddings: isEmbedding,
      audioTranscription: /whisper|transcribe/i.test(lower),
      vision: isChatCapable && /(gpt-4o|gpt-4\.1|gpt-5|o3|o4)/i.test(lower),
    },
    compatibleWithApp: isChatCapable,
    incompatibilityReason,
    isDeprecated: Boolean(raw.shutdown_date),
  };
}

export async function fetchOpenAiOfficialModels(apiKey: string): Promise<OfficialModelsDiscoveryResult> {
  const fetchedAt = new Date().toISOString();
  const res = await fetchJsonWithTimeout('https://api.openai.com/v1/models', {
    Authorization: `Bearer ${apiKey}`,
    Accept: 'application/json',
  });
  if (!res.ok) {
    return {
      ok: false, provider: 'OPENAI', models: [], fetchedAt, fromCache: false,
      httpStatus: res.status, diagnosticCode: classifyProviderError(res.status, res.errorText),
      error: `OpenAI HTTP ${res.status}: ${res.errorText}`,
    };
  }
  const rawList = (Array.isArray(res.data.data) ? res.data.data : []) as Array<{
    id?: string; created?: number; owned_by?: string; shutdown_date?: string | null;
  }>;
  const seen = new Set<string>();
  const models: DiscoveredAiModel[] = [];
  for (const item of rawList) {
    const id = String(item.id || '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    models.push(classifyOpenAiModel({ id, created: item.created, owned_by: item.owned_by, shutdown_date: item.shutdown_date }));
  }
  models.sort((a, b) =>
    a.compatibleWithApp !== b.compatibleWithApp ? (a.compatibleWithApp ? -1 : 1) : (b.createdAt || '').localeCompare(a.createdAt || '')
  );
  return { ok: true, provider: 'OPENAI', models, fetchedAt, fromCache: false, httpStatus: 200, diagnosticCode: 'VALID', error: null };
}

export async function fetchAnthropicOfficialModels(apiKey: string): Promise<OfficialModelsDiscoveryResult> {
  const fetchedAt = new Date().toISOString();
  const models: DiscoveredAiModel[] = [];
  const seen = new Set<string>();
  let afterId: string | null = null;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const qs = new URLSearchParams({ limit: '100' });
    if (afterId) qs.set('after_id', afterId);
    const res = await fetchJsonWithTimeout(`https://api.anthropic.com/v1/models?${qs.toString()}`, {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      Accept: 'application/json',
    });
    if (!res.ok) {
      return {
        ok: false, provider: 'CLAUDE', models: [], fetchedAt, fromCache: false,
        httpStatus: res.status, diagnosticCode: classifyProviderError(res.status, res.errorText),
        error: `Anthropic HTTP ${res.status}: ${res.errorText}`,
      };
    }
    const rawList = (Array.isArray(res.data.data) ? res.data.data : []) as Array<{
      id?: string; display_name?: string; created_at?: string;
    }>;
    for (const item of rawList) {
      const id = String(item.id || '').trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      models.push({
        id,
        displayName: item.display_name?.trim() || id,
        provider: 'CLAUDE',
        description: `Anthropic • ${item.display_name?.trim() || id}`,
        createdAt: item.created_at || null,
        maxContextTokens: 200000,
        capabilities: { chat: true, tools: true, jsonMode: false, embeddings: false, audioTranscription: false, vision: true },
        compatibleWithApp: true,
        incompatibilityReason: null,
        isDeprecated: false,
      });
    }
    const hasMore = Boolean(res.data.has_more);
    const lastId = typeof res.data.last_id === 'string' ? res.data.last_id : null;
    if (!hasMore || !lastId || lastId === afterId) break;
    afterId = lastId;
  }

  return { ok: true, provider: 'CLAUDE', models, fetchedAt, fromCache: false, httpStatus: 200, diagnosticCode: 'VALID', error: null };
}

export async function fetchGeminiOfficialModels(apiKey: string): Promise<OfficialModelsDiscoveryResult> {
  const fetchedAt = new Date().toISOString();
  const models: DiscoveredAiModel[] = [];
  const seen = new Set<string>();
  let pageToken: string | null = null;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const qs = new URLSearchParams({ pageSize: '100' });
    if (pageToken) qs.set('pageToken', pageToken);
    const res = await fetchJsonWithTimeout(
      `https://generativelanguage.googleapis.com/v1beta/models?${qs.toString()}`,
      { 'x-goog-api-key': apiKey, Accept: 'application/json' }
    );
    if (!res.ok) {
      return {
        ok: false, provider: 'GEMINI', models: [], fetchedAt, fromCache: false,
        httpStatus: res.status, diagnosticCode: classifyProviderError(res.status, res.errorText),
        error: `Google Gemini HTTP ${res.status}: ${res.errorText}`,
      };
    }
    const rawList = (Array.isArray(res.data.models) ? res.data.models : []) as Array<{
      name?: string; displayName?: string; description?: string;
      inputTokenLimit?: number; supportedGenerationMethods?: string[];
    }>;
    for (const item of rawList) {
      const id = String(item.name || '').replace(/^models\//i, '').trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const methods = Array.isArray(item.supportedGenerationMethods) ? item.supportedGenerationMethods : [];
      const supportsChat = methods.includes('generateContent');
      const supportsEmbed = methods.includes('embedContent');
      const isMediaOnly = /(imagen|veo|tts|aqa|robotics|computer-use)/i.test(id);
      const compatible = supportsChat && !isMediaOnly;
      const incompatibilityReason = !supportsChat
        ? supportsEmbed
          ? 'Modelo de embeddings (não suporta generateContent).'
          : 'Modelo não suporta generateContent para chat.'
        : isMediaOnly
        ? 'Modelo especializado de mídia/agente sem suporte ao chat financeiro.'
        : null;
      models.push({
        id,
        displayName: item.displayName?.trim() || id,
        provider: 'GEMINI',
        description: item.description?.trim() || `Google Gemini • ${id}`,
        maxContextTokens: item.inputTokenLimit || null,
        capabilities: {
          chat: compatible, tools: compatible, jsonMode: compatible,
          embeddings: supportsEmbed, audioTranscription: compatible && /gemini/i.test(id), vision: compatible,
        },
        compatibleWithApp: compatible,
        incompatibilityReason,
        isDeprecated: /deprecated|legacy/i.test(item.description || ''),
      });
    }
    const nextToken = typeof res.data.nextPageToken === 'string' ? res.data.nextPageToken : null;
    if (!nextToken || nextToken === pageToken) break;
    pageToken = nextToken;
  }

  models.sort((a, b) => (a.compatibleWithApp !== b.compatibleWithApp ? (a.compatibleWithApp ? -1 : 1) : b.id.localeCompare(a.id)));
  return { ok: true, provider: 'GEMINI', models, fetchedAt, fromCache: false, httpStatus: 200, diagnosticCode: 'VALID', error: null };
}
