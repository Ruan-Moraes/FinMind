import { type AiModelDescriptor, type AiProviderId } from '@/features/ai-copilot/models/models-catalog';

export interface AiProviderAdapter {
  readonly id: AiProviderId;
  readonly envVarName: string;
  readonly dbKeyField: 'openaiApiKey' | 'geminiApiKey' | 'claudeApiKey';
  readonly dbModelField: 'openaiModel' | 'geminiModel' | 'claudeModel';
  readonly displayGroupLabel: string;
  buildEndpointAndHeaders(params: {
    model: AiModelDescriptor;
    effectiveApiKey: string;
    hasExternalApiKey: boolean;
    baseHeaders: Record<string, string>;
  }): { endpointUrl: string; headers: Record<string, string> };
  buildTextRequestBody(params: {
    model: AiModelDescriptor;
    systemInstruction: string;
    userPrompt: string;
    maxTokens: number;
  }): Record<string, unknown>;
  buildJsonRequestBody(params: {
    model: AiModelDescriptor;
    prompt: string;
  }): Record<string, unknown>;
  extractTextFromResponse(data: Record<string, unknown>): string;
}

export const isOpenAiReasoningOrNextGenModel = (upstreamModel: string) =>
  /^(o\d|gpt-[5-9]|gpt-\d{2})/i.test(upstreamModel.trim());

/**
 * Ajusta o payload da OpenAI caso um modelo futuro/específico rejeite algum parâmetro opcional
 * (ex.: `temperature`, `max_tokens`, `response_format` ou role `developer`).
 */
export function adaptOpenAiBodyForUnsupportedParam(
  body: Record<string, unknown>,
  errorMessage: string
): Record<string, unknown> | null {
  const lower = errorMessage.toLowerCase();
  if (!lower.includes('unsupported') && !lower.includes('not supported')) return null;

  const next: Record<string, unknown> = { ...body };
  let changed = false;

  if (lower.includes('reasoning_effort')) {
    if (lower.includes('none') && next.reasoning_effort !== 'none') {
      next.reasoning_effort = 'none';
      changed = true;
    } else if ('reasoning_effort' in next) {
      delete next.reasoning_effort;
      changed = true;
    }
  }
  if (lower.includes('max_tokens') && 'max_tokens' in next) {
    next.max_completion_tokens = next.max_tokens;
    delete next.max_tokens;
    changed = true;
  }
  if (lower.includes('temperature') && 'temperature' in next) {
    delete next.temperature;
    changed = true;
  }
  if (lower.includes('response_format') && 'response_format' in next) {
    delete next.response_format;
    changed = true;
  }
  if (lower.includes('developer') && Array.isArray(next.messages)) {
    next.messages = next.messages.map((m) =>
      m && typeof m === 'object' && (m as { role?: string }).role === 'developer'
        ? { ...(m as Record<string, unknown>), role: 'system' }
        : m
    );
    changed = true;
  }

  return changed ? next : null;
}

const openaiAdapter: AiProviderAdapter = {
  id: 'OPENAI',
  envVarName: 'OPENAI_API_KEY',
  dbKeyField: 'openaiApiKey',
  dbModelField: 'openaiModel',
  displayGroupLabel: 'OpenAI',
  buildEndpointAndHeaders({ model, effectiveApiKey, hasExternalApiKey, baseHeaders }) {
    const headers = { ...baseHeaders };
    if (hasExternalApiKey) {
      headers['Authorization'] = `Bearer ${effectiveApiKey}`;
    }
    return { endpointUrl: model.endpointUrl, headers };
  },
  buildTextRequestBody({ model, systemInstruction, userPrompt, maxTokens }) {
    const modern = isOpenAiReasoningOrNextGenModel(model.upstreamApiModel);
    const body: Record<string, unknown> = {
      model: model.upstreamApiModel,
      messages: [
        { role: modern ? 'developer' : 'system', content: systemInstruction },
        { role: 'user', content: userPrompt },
      ],
      max_completion_tokens: maxTokens,
    };
    if (!modern) {
      body.temperature = 0.2;
    }
    return body;
  },
  buildJsonRequestBody({ model, prompt }) {
    const modern = isOpenAiReasoningOrNextGenModel(model.upstreamApiModel);
    const body: Record<string, unknown> = {
      model: model.upstreamApiModel,
      messages: [
        {
          role: modern ? 'developer' : 'system',
          content: 'Você é um analista financeiro preciso. Responda exclusivamente em JSON válido.',
        },
        { role: 'user', content: prompt },
      ],
    };
    if (!modern) {
      body.temperature = 0.1;
      body.response_format = { type: 'json_object' };
    }
    return body;
  },
  extractTextFromResponse(data) {
    const choices = data.choices as Array<{ message?: { content?: string } }> | undefined;
    return String(choices?.[0]?.message?.content || '').trim();
  },
};

const geminiAdapter: AiProviderAdapter = {
  id: 'GEMINI',
  envVarName: 'GEMINI_API_KEY',
  dbKeyField: 'geminiApiKey',
  dbModelField: 'geminiModel',
  displayGroupLabel: 'Google Gemini',
  buildEndpointAndHeaders({ model, effectiveApiKey, hasExternalApiKey, baseHeaders }) {
    const endpointUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model.upstreamApiModel
    )}:generateContent`;
    const headers: Record<string, string> = { ...baseHeaders };
    if (hasExternalApiKey) {
      headers['x-goog-api-key'] = effectiveApiKey;
    }
    return { endpointUrl, headers };
  },
  buildTextRequestBody({ systemInstruction, userPrompt, maxTokens }) {
    return {
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents: [{ parts: [{ text: userPrompt }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: maxTokens },
    };
  },
  buildJsonRequestBody({ prompt }) {
    return {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
    };
  },
  extractTextFromResponse(data) {
    const candidates = data.candidates as
      | Array<{ content?: { parts?: Array<{ text?: string }> } }>
      | undefined;
    return String(candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
  },
};

const claudeAdapter: AiProviderAdapter = {
  id: 'CLAUDE',
  envVarName: 'ANTHROPIC_API_KEY',
  dbKeyField: 'claudeApiKey',
  dbModelField: 'claudeModel',
  displayGroupLabel: 'Anthropic Claude',
  buildEndpointAndHeaders({ model, effectiveApiKey, hasExternalApiKey, baseHeaders }) {
    const headers: Record<string, string> = {
      ...baseHeaders,
      'anthropic-version': '2023-06-01',
    };
    if (hasExternalApiKey) {
      headers['x-api-key'] = effectiveApiKey;
    }
    return { endpointUrl: model.endpointUrl, headers };
  },
  buildTextRequestBody({ model, systemInstruction, userPrompt, maxTokens }) {
    return {
      model: model.upstreamApiModel,
      max_tokens: maxTokens,
      temperature: 0.2,
      system: systemInstruction,
      messages: [{ role: 'user', content: userPrompt }],
    };
  },
  buildJsonRequestBody({ model, prompt }) {
    return {
      model: model.upstreamApiModel,
      max_tokens: 4096,
      temperature: 0.1,
      system: 'Você é um analista financeiro preciso. Responda exclusivamente em JSON válido.',
      messages: [{ role: 'user', content: prompt }],
    };
  },
  extractTextFromResponse(data) {
    const content = data.content as Array<{ text?: string }> | undefined;
    return String(content?.[0]?.text || '').trim();
  },
};

export const AI_PROVIDER_ADAPTERS: Record<AiProviderId, AiProviderAdapter> = {
  OPENAI: openaiAdapter,
  GEMINI: geminiAdapter,
  CLAUDE: claudeAdapter,
};
