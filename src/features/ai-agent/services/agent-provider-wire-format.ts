import type { AiProviderId } from '@/features/ai-copilot/models';
import { isOpenAiReasoningOrNextGenModel } from '@/features/ai-copilot/providers/provider-adapters';
import type {
  AgentConversationMessage,
  AgentProviderResponse,
  ProviderToolCallResult,
  ProviderToolDeclaration,
} from '@/features/ai-agent/services/agent-tool-provider-client';

function buildOpenAiMessages(
  isReasoning: boolean,
  systemInstruction: string,
  messages: AgentConversationMessage[]
): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [
    { role: isReasoning ? 'developer' : 'system', content: systemInstruction },
  ];
  for (const m of messages) {
    if (m.role === 'user') {
      out.push({ role: 'user', content: m.content });
    } else if (m.role === 'assistant') {
      if (m.toolCalls && m.toolCalls.length > 0) {
        out.push({
          role: 'assistant',
          content: m.content || null,
          tool_calls: m.toolCalls.map((tc, idx) => ({
            id: tc.id || `call_${idx}`,
            type: 'function',
            function: { name: tc.name, arguments: JSON.stringify(tc.args || {}) },
          })),
        });
      } else {
        out.push({ role: 'assistant', content: m.content });
      }
    } else if (m.role === 'tool') {
      out.push({ role: 'tool', tool_call_id: m.toolCallId, content: m.content });
    }
  }
  return out;
}

function buildGeminiContents(messages: AgentConversationMessage[]): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [];
  for (const m of messages) {
    if (m.role === 'user') {
      out.push({ role: 'user', parts: [{ text: m.content }] });
    } else if (m.role === 'assistant') {
      const parts: Array<Record<string, unknown>> = [];
      if (m.content) parts.push({ text: m.content });
      for (const tc of m.toolCalls || []) {
        parts.push({ functionCall: { name: tc.name, args: tc.args || {} } });
      }
      if (parts.length > 0) out.push({ role: 'model', parts });
    } else if (m.role === 'tool') {
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(m.content) as Record<string, unknown>;
      } catch {
        parsed = { result: m.content };
      }
      out.push({
        role: 'user',
        parts: [{ functionResponse: { name: m.toolName, response: { result: parsed } } }],
      });
    }
  }
  return out;
}

function buildClaudeMessages(messages: AgentConversationMessage[]): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [];
  for (const m of messages) {
    if (m.role === 'user') {
      out.push({ role: 'user', content: m.content });
    } else if (m.role === 'assistant') {
      const blocks: Array<Record<string, unknown>> = [];
      if (m.content) blocks.push({ type: 'text', text: m.content });
      for (const tc of m.toolCalls || []) {
        blocks.push({ type: 'tool_use', id: tc.id || `toolu_${tc.name}`, name: tc.name, input: tc.args || {} });
      }
      if (blocks.length > 0) out.push({ role: 'assistant', content: blocks });
    } else if (m.role === 'tool') {
      out.push({
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: m.toolCallId, content: m.content }],
      });
    }
  }
  return out;
}

export function shouldUseOpenAiResponsesApi(upstreamModel: string): boolean {
  return /^(gpt-[5-9]|gpt-\d{2}|o[3-9])/i.test(upstreamModel.trim());
}

export function buildOpenAiResponsesToolBody(params: {
  upstreamModel: string;
  systemInstruction: string;
  messages: AgentConversationMessage[];
  tools: ProviderToolDeclaration[];
}): Record<string, unknown> {
  const { upstreamModel, systemInstruction, messages, tools } = params;
  const input: Array<Record<string, unknown>> = [];
  for (const m of messages) {
    if (m.role === 'user') {
      input.push({ role: 'user', content: m.content });
    } else if (m.role === 'assistant') {
      if (m.content) input.push({ role: 'assistant', content: m.content });
      for (const [idx, tc] of (m.toolCalls || []).entries()) {
        input.push({
          type: 'function_call',
          call_id: tc.id || `call_${idx}`,
          name: tc.name,
          arguments: JSON.stringify(tc.args || {}),
        });
      }
    } else if (m.role === 'tool') {
      input.push({ type: 'function_call_output', call_id: m.toolCallId, output: m.content });
    }
  }
  return {
    model: upstreamModel,
    instructions: systemInstruction,
    input,
    tools: tools.map((t) => ({ type: 'function', name: t.name, description: t.description, parameters: t.parameters })),
    tool_choice: 'auto',
  };
}

export function parseOpenAiResponsesToolOutput(data: Record<string, unknown>): AgentProviderResponse {
  const toolCalls: ProviderToolCallResult[] = [];
  const textParts: string[] = [];
  const output = (data.output as Array<Record<string, unknown>>) || [];
  for (const [idx, item] of output.entries()) {
    if (item.type === 'function_call' && typeof item.name === 'string') {
      let args: Record<string, unknown> = {};
      try { args = JSON.parse(String(item.arguments || '{}')); } catch { args = {}; }
      toolCalls.push({ id: typeof item.call_id === 'string' ? item.call_id : `call_${idx}`, name: item.name, args });
    } else if (item.type === 'message' && Array.isArray(item.content)) {
      for (const b of item.content as Array<{ type?: string; text?: string }>) {
        if ((b.type === 'output_text' || b.type === 'text') && b.text) textParts.push(b.text);
      }
    }
  }
  const fallbackText = typeof data.output_text === 'string' ? data.output_text : '';
  return { text: (textParts.join('\n').trim() || fallbackText).trim(), toolCalls };
}

export function buildToolRequestBody(params: {
  provider: AiProviderId;
  upstreamModel: string;
  systemInstruction: string;
  messages: AgentConversationMessage[];
  tools: ProviderToolDeclaration[];
}): Record<string, unknown> {
  const { provider, upstreamModel, systemInstruction, messages, tools } = params;

  if (provider === 'OPENAI') {
    const isModern = isOpenAiReasoningOrNextGenModel(upstreamModel);
    const isNextGenGpt = /^gpt-[5-9]|^gpt-\d{2}/i.test(upstreamModel.trim());
    const body: Record<string, unknown> = {
      model: upstreamModel,
      messages: buildOpenAiMessages(isModern, systemInstruction, messages),
      tools: tools.map((t) => ({
        type: 'function',
        function: { name: t.name, description: t.description, parameters: t.parameters },
      })),
      tool_choice: 'auto',
    };
    if (!isModern) body.temperature = 0.15;
    if (isNextGenGpt && tools.length > 0) body.reasoning_effort = 'none';
    return body;
  }

  if (provider === 'GEMINI') {
    return {
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents: buildGeminiContents(messages),
      tools: [{ functionDeclarations: tools }],
      generationConfig: { temperature: 0.15 },
    };
  }

  return {
    model: upstreamModel,
    max_tokens: 2400,
    temperature: 0.15,
    system: systemInstruction,
    messages: buildClaudeMessages(messages),
    tools: tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters,
    })),
  };
}

export function parseProviderToolResponse(
  provider: AiProviderId,
  data: Record<string, unknown>
): AgentProviderResponse {
  const toolCalls: ProviderToolCallResult[] = [];
  if (provider === 'OPENAI') {
    const choices = data.choices as
      | Array<{ message?: { content?: string | null; tool_calls?: Array<{ id?: string; function?: { name?: string; arguments?: string } }> } }>
      | undefined;
    const msg = choices?.[0]?.message;
    for (const [idx, tc] of (msg?.tool_calls || []).entries()) {
      if (!tc.function?.name) continue;
      let args: Record<string, unknown> = {};
      try { args = JSON.parse(tc.function.arguments || '{}'); } catch { args = {}; }
      toolCalls.push({ id: tc.id || `call_${idx}`, name: tc.function.name, args });
    }
    return { text: String(msg?.content || '').trim(), toolCalls };
  }

  if (provider === 'GEMINI') {
    const candidates = data.candidates as
      | Array<{ content?: { parts?: Array<{ text?: string; functionCall?: { name?: string; args?: Record<string, unknown> } }> } }>
      | undefined;
    const parts = candidates?.[0]?.content?.parts || [];
    const textParts: string[] = [];
    parts.forEach((p, idx) => {
      if (p.text) textParts.push(p.text);
      if (p.functionCall?.name) {
        toolCalls.push({ id: `gem_${idx}_${p.functionCall.name}`, name: p.functionCall.name, args: p.functionCall.args || {} });
      }
    });
    return { text: textParts.join('\n').trim(), toolCalls };
  }

  const blocks = (data.content as Array<{ type?: string; id?: string; text?: string; name?: string; input?: Record<string, unknown> }>) || [];
  const textBlocks: string[] = [];
  for (const b of blocks) {
    if (b.type === 'text' && b.text) textBlocks.push(b.text);
    if (b.type === 'tool_use' && b.name) {
      toolCalls.push({ id: b.id || `toolu_${b.name}`, name: b.name, args: b.input || {} });
    }
  }
  return { text: textBlocks.join('\n').trim(), toolCalls };
}
