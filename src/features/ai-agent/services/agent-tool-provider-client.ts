import {
  getAiModelDescriptor,
  resolveDynamicModelRoute,
  type AiProviderId,
} from '@/features/ai-copilot/models';
import { AI_PROVIDER_ADAPTERS } from '@/features/ai-copilot/providers/provider-adapters';

export interface ProviderToolDeclaration {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ProviderToolCallResult {
  name: string;
  args: Record<string, unknown>;
}

export interface AgentProviderResponse {
  text: string;
  toolCalls: ProviderToolCallResult[];
}

function buildToolRequestBody(params: {
  provider: AiProviderId;
  upstreamModel: string;
  systemInstruction: string;
  userPrompt: string;
  tools: ProviderToolDeclaration[];
}): Record<string, unknown> {
  const { provider, upstreamModel, systemInstruction, userPrompt, tools } = params;

  if (provider === 'OPENAI') {
    const isReasoning = upstreamModel.startsWith('o1') || upstreamModel.startsWith('o3');
    const body: Record<string, unknown> = {
      model: upstreamModel,
      messages: [
        { role: isReasoning ? 'developer' : 'system', content: systemInstruction },
        { role: 'user', content: userPrompt },
      ],
      tools: tools.map((t) => ({
        type: 'function',
        function: { name: t.name, description: t.description, parameters: t.parameters },
      })),
      tool_choice: 'auto',
    };
    if (!isReasoning) body.temperature = 0.15;
    return body;
  }

  if (provider === 'GEMINI') {
    return {
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      tools: [{ functionDeclarations: tools }],
      generationConfig: { temperature: 0.15 },
    };
  }

  // CLAUDE (Anthropic Messages API)
  return {
    model: upstreamModel,
    max_tokens: 2048,
    temperature: 0.15,
    system: systemInstruction,
    messages: [{ role: 'user', content: userPrompt }],
    tools: tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters,
    })),
  };
}

function parseProviderToolResponse(
  provider: AiProviderId,
  data: Record<string, unknown>
): AgentProviderResponse {
  const toolCalls: ProviderToolCallResult[] = [];
  let text = '';

  if (provider === 'OPENAI') {
    const choices = data.choices as
      | Array<{
          message?: {
            content?: string | null;
            tool_calls?: Array<{ function?: { name?: string; arguments?: string } }>;
          };
        }>
      | undefined;
    const msg = choices?.[0]?.message;
    text = String(msg?.content || '').trim();
    for (const tc of msg?.tool_calls || []) {
      if (!tc.function?.name) continue;
      let parsedArgs: Record<string, unknown> = {};
      try {
        parsedArgs = JSON.parse(tc.function.arguments || '{}');
      } catch {
        parsedArgs = {};
      }
      toolCalls.push({ name: tc.function.name, args: parsedArgs });
    }
    return { text, toolCalls };
  }

  if (provider === 'GEMINI') {
    const candidates = data.candidates as
      | Array<{
          content?: {
            parts?: Array<{
              text?: string;
              functionCall?: { name?: string; args?: Record<string, unknown> };
            }>;
          };
        }>
      | undefined;
    const parts = candidates?.[0]?.content?.parts || [];
    const textParts: string[] = [];
    for (const p of parts) {
      if (p.text) textParts.push(p.text);
      if (p.functionCall?.name) {
        toolCalls.push({
          name: p.functionCall.name,
          args: p.functionCall.args || {},
        });
      }
    }
    return { text: textParts.join('\n').trim(), toolCalls };
  }

  // CLAUDE
  const blocks = (data.content as Array<{
    type?: string;
    text?: string;
    name?: string;
    input?: Record<string, unknown>;
  }>) || [];
  const textBlocks: string[] = [];
  for (const b of blocks) {
    if (b.type === 'text' && b.text) textBlocks.push(b.text);
    if (b.type === 'tool_use' && b.name) {
      toolCalls.push({ name: b.name, args: b.input || {} });
    }
  }
  return { text: textBlocks.join('\n').trim(), toolCalls };
}

export async function callAgentProviderWithTools(params: {
  provider: AiProviderId;
  apiKey?: string | null;
  modelId: string;
  systemInstruction: string;
  userPrompt: string;
  tools: ProviderToolDeclaration[];
}): Promise<AgentProviderResponse> {
  const { provider, apiKey, modelId, systemInstruction, userPrompt, tools } = params;
  const descriptor = getAiModelDescriptor(modelId);
  const adapter = AI_PROVIDER_ADAPTERS[provider];
  const route = resolveDynamicModelRoute(descriptor.id, { [adapter.dbKeyField]: apiKey });

  if (!route.hasExternalApiKey) {
    throw new Error(`Chave de API (${descriptor.envVarName}) não configurada para ${descriptor.providerGroupLabel}.`);
  }

  const body = buildToolRequestBody({
    provider,
    upstreamModel: descriptor.upstreamApiModel,
    systemInstruction,
    userPrompt,
    tools,
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 28000);
  try {
    const res = await fetch(route.endpointUrl, {
      method: 'POST',
      headers: route.headers,
      signal: controller.signal,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errBody = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      throw new Error(
        `${adapter.displayGroupLabel} API HTTP ${res.status}: ${errBody?.error?.message || res.statusText}`
      );
    }
    const data = (await res.json()) as Record<string, unknown>;
    return parseProviderToolResponse(provider, data);
  } finally {
    clearTimeout(timeout);
  }
}
