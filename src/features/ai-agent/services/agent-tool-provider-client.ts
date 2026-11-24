import {
  getAiModelDescriptor,
  resolveDynamicModelRoute,
  type AiProviderId,
} from '@/features/ai-copilot/models';
import {
  adaptOpenAiBodyForUnsupportedParam,
  AI_PROVIDER_ADAPTERS,
} from '@/features/ai-copilot/providers/provider-adapters';
import {
  buildOpenAiResponsesToolBody,
  buildToolRequestBody,
  parseOpenAiResponsesToolOutput,
  parseProviderToolResponse,
  shouldUseOpenAiResponsesApi,
} from '@/features/ai-agent/services/agent-provider-wire-format';

export interface ProviderToolDeclaration {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ProviderToolCallResult {
  id?: string;
  name: string;
  args: Record<string, unknown>;
}

export type AgentConversationMessage =
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string; toolCalls?: ProviderToolCallResult[] }
  | { role: 'tool'; toolCallId: string; toolName: string; content: string };

export interface AgentProviderResponse {
  text: string;
  toolCalls: ProviderToolCallResult[];
}

export async function callAgentProviderWithTools(params: {
  provider: AiProviderId;
  apiKey?: string | null;
  modelId: string;
  systemInstruction: string;
  messages: AgentConversationMessage[];
  tools: ProviderToolDeclaration[];
}): Promise<AgentProviderResponse> {
  const { provider, apiKey, modelId, systemInstruction, messages, tools } = params;
  const descriptor = getAiModelDescriptor(modelId, provider);
  const adapter = AI_PROVIDER_ADAPTERS[provider];
  const route = resolveDynamicModelRoute(descriptor.id, { [adapter.dbKeyField]: apiKey }, provider);

  if (!route.hasExternalApiKey) {
    throw new Error(`Chave de API (${descriptor.envVarName}) não configurada para ${descriptor.providerGroupLabel}.`);
  }

  let useResponsesApi =
    provider === 'OPENAI' && shouldUseOpenAiResponsesApi(descriptor.upstreamApiModel);
  let endpointUrl = useResponsesApi
    ? 'https://api.openai.com/v1/responses'
    : route.endpointUrl;
  let body = useResponsesApi
    ? buildOpenAiResponsesToolBody({
        upstreamModel: descriptor.upstreamApiModel,
        systemInstruction,
        messages,
        tools,
      })
    : buildToolRequestBody({
        provider,
        upstreamModel: descriptor.upstreamApiModel,
        systemInstruction,
        messages,
        tools,
      });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const res = await fetch(endpointUrl, {
        method: 'POST',
        headers: route.headers,
        signal: controller.signal,
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = (await res.json()) as Record<string, unknown>;
        return useResponsesApi
          ? parseOpenAiResponsesToolOutput(data)
          : parseProviderToolResponse(provider, data);
      }
      const errBody = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      const detail = errBody?.error?.message || res.statusText;
      if (attempt === 0 && res.status === 400 && provider === 'OPENAI') {
        if (!useResponsesApi && detail.toLowerCase().includes('/v1/responses')) {
          useResponsesApi = true;
          endpointUrl = 'https://api.openai.com/v1/responses';
          body = buildOpenAiResponsesToolBody({
            upstreamModel: descriptor.upstreamApiModel,
            systemInstruction,
            messages,
            tools,
          });
          continue;
        }
        const adapted = adaptOpenAiBodyForUnsupportedParam(body, detail);
        if (adapted) {
          body = adapted;
          continue;
        }
      }
      throw new Error(`${adapter.displayGroupLabel} API HTTP ${res.status}: ${detail}`);
    }
    throw new Error(`${adapter.displayGroupLabel} API: falha inesperada ao processar requisição.`);
  } finally {
    clearTimeout(timeout);
  }
}
