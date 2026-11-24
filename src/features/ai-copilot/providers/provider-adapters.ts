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

const isOpenAiReasoningModel = (upstreamModel: string) =>
  upstreamModel.startsWith('o1') || upstreamModel.startsWith('o3');

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
    const reasoning = isOpenAiReasoningModel(model.upstreamApiModel);
    const body: Record<string, unknown> = {
      model: model.upstreamApiModel,
      messages: [
        { role: reasoning ? 'developer' : 'system', content: systemInstruction },
        { role: 'user', content: userPrompt },
      ],
    };
    if (reasoning) {
      body.max_completion_tokens = maxTokens;
    } else {
      body.temperature = 0.2;
      body.max_tokens = maxTokens;
    }
    return body;
  },
  buildJsonRequestBody({ model, prompt }) {
    const reasoning = isOpenAiReasoningModel(model.upstreamApiModel);
    const body: Record<string, unknown> = {
      model: model.upstreamApiModel,
      messages: [
        {
          role: reasoning ? 'developer' : 'system',
          content: 'Você é um analista financeiro preciso. Responda exclusivamente em JSON válido.',
        },
        { role: 'user', content: prompt },
      ],
    };
    if (!reasoning) {
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
    const dynamicEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model.upstreamApiModel
    )}:generateContent`;
    const endpointUrl = hasExternalApiKey
      ? `${dynamicEndpoint}?key=${encodeURIComponent(effectiveApiKey)}`
      : dynamicEndpoint;
    return { endpointUrl, headers: { ...baseHeaders } };
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
