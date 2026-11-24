'use server';

import { requireAuthenticatedUser } from '@/features/auth';
import {
  getAiModelDescriptor,
  resolveDynamicModelRoute,
} from '@/features/ai-copilot/models';
import { resolveActiveUserAiSelection } from '@/features/ai-copilot/services/ai-credentials-service';
import { callProviderApiText } from '@/features/ai-copilot/providers/provider-http-client';
import {
  checkPreservedFinancialValues,
  type VoiceRefinementMode,
} from '@/features/ai-voice/domain/voice-refinement-types';

const MODE_INSTRUCTIONS: Record<Exclude<VoiceRefinementMode, 'original'>, string> = {
  improve:
    'Reescreva a solicitação com mais clareza, objetividade e boa organização em português (pt-BR), sem alterar o pedido.',
  summarize:
    'Resuma a solicitação de forma concisa em português (pt-BR), mantendo TODOS os números, valores, datas, nomes e objetivos essenciais.',
  remove_fillers:
    'Remova apenas vícios de linguagem, hesitações, repetições e expressões desnecessárias (ex.: "tipo", "assim", "né", "ãh", "então", "meio que"), mantendo exatamente o sentido original.',
  fix_transcript:
    'Corrija erros gramaticais, de pontuação e de reconhecimento de voz (incluindo termos financeiros e valores em reais), mantendo a estrutura e a intenção originais.',
  structure:
    'Organize esta solicitação extensa ou composta em tópicos curtos e claros em português (pt-BR) para facilitar a execução pelo assistente financeiro.',
};

export async function refineVoiceTranscriptAction(params: {
  originalText: string;
  mode: Exclude<VoiceRefinementMode, 'original'>;
}): Promise<
  | {
      ok: true;
      refinedText: string;
      modelUsed: string;
      warning?: string;
    }
  | { ok: false; error: string }
> {
  const user = await requireAuthenticatedUser();
  const cleanOriginal = params.originalText.trim();
  if (!cleanOriginal) {
    return { ok: false, error: 'Não há texto transcrito para aprimorar.' };
  }

  const activeAi = await resolveActiveUserAiSelection(user.id);
  if (!activeAi.hasKey) {
    return {
      ok: false,
      error:
        'Para aprimorar a transcrição com IA, configure sua chave de API na Central de IA. Você pode enviar ou editar o texto original livremente.',
    };
  }
  if (!activeAi.modelId) {
    return {
      ok: false,
      error: 'Selecione um modelo de IA no Header ou na aba Copiloto IA para aprimorar a transcrição.',
    };
  }

  const descriptor = getAiModelDescriptor(activeAi.modelId, activeAi.provider);
  const routeConfig = resolveDynamicModelRoute(
    descriptor.id,
    activeAi.bundle.rawDecryptedKeys,
    activeAi.provider
  );

  const systemInstruction = [
    'Você é um editor fiel de transcrições de voz para o assistente financeiro FinMind.',
    MODE_INSTRUCTIONS[params.mode],
    'REGRAS INVIOLÁVEIS:',
    '1) Preserve RIGOROSAMENTE a intenção original do usuário.',
    '2) Preserve TODOS os valores monetários, números, percentuais, datas, prazos, nomes de contas/categorias/metas e restrições.',
    '3) NUNCA invente informações, não adicione novas ações nem responda à pergunta — apenas devolva o texto da solicitação pronto para envio.',
    '4) Retorne APENAS o texto final aprimorado, sem aspas externas, sem prefixos nem comentários.',
  ].join('\n');

  try {
    const raw = await callProviderApiText({
      routeConfig,
      systemInstruction,
      userPrompt: `Texto transcrito pelo usuário:\n${cleanOriginal}`,
      maxTokens: 700,
    });

    const refinedText = raw.trim().replace(/^["']|["']$/g, '').trim();
    if (!refinedText) {
      return { ok: false, error: 'O modelo retornou uma resposta vazia. Mantendo o texto original.' };
    }

    const check = checkPreservedFinancialValues(cleanOriginal, refinedText);
    return {
      ok: true,
      refinedText,
      modelUsed: descriptor.displayName,
      warning: check.preserved
        ? undefined
        : `Confira os números no texto aprimorado (detectada diferença em: ${check.missingTokens.join(', ')}). Você pode restaurar o original com 1 clique.`,
    };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? `Falha ao aprimorar com ${descriptor.displayName}: ${err.message}`
          : 'Erro ao consultar a IA para aprimorar a transcrição.',
    };
  }
}
