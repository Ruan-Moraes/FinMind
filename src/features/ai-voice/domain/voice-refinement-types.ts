export type VoiceRefinementMode =
  | 'original'
  | 'improve'
  | 'summarize'
  | 'remove_fillers'
  | 'fix_transcript'
  | 'structure';

export interface VoiceRefinementOption {
  id: VoiceRefinementMode;
  label: string;
  description: string;
}

export const VOICE_REFINEMENT_OPTIONS: VoiceRefinementOption[] = [
  {
    id: 'original',
    label: 'Usar texto original',
    description: 'Mantém exatamente a transcrição capturada',
  },
  {
    id: 'improve',
    label: 'Melhorar com IA',
    description: 'Mais clareza, organização e precisão mantendo a intenção',
  },
  {
    id: 'summarize',
    label: 'Resumir',
    description: 'Reduz o texto preservando valores, datas e pedidos',
  },
  {
    id: 'remove_fillers',
    label: 'Remover vícios de linguagem',
    description: 'Remove hesitações, repetições e "tipo/né/é..."',
  },
  {
    id: 'fix_transcript',
    label: 'Corrigir transcrição',
    description: 'Corrige gramática, pontuação e termos financeiros',
  },
  {
    id: 'structure',
    label: 'Estruturar solicitação',
    description: 'Organiza pedidos extensos ou compostos em etapas claras',
  },
];

function extractNumericTokens(text: string): string[] {
  const matches = text.match(/\d+(?:[.,]\d+)*/g) || [];
  return Array.from(new Set(matches.map((m) => m.replace(/^0+(?=\d)/, ''))));
}

/**
 * Verifica se todos os números relevantes do texto original (valores R$, datas, prazos)
 * foram preservados no texto aprimorado pela IA.
 */
export function checkPreservedFinancialValues(
  originalText: string,
  refinedText: string
): { preserved: boolean; missingTokens: string[] } {
  const origTokens = extractNumericTokens(originalText);
  if (origTokens.length === 0) return { preserved: true, missingTokens: [] };

  const refinedNormalized = refinedText.replace(/\./g, '').replace(/,/g, '.');
  const missingTokens = origTokens.filter((token) => {
    const plain = token.replace(/\./g, '').replace(/,/g, '.');
    return !refinedText.includes(token) && !refinedNormalized.includes(plain);
  });

  return { preserved: missingTokens.length === 0, missingTokens };
}
