import type { RetrievedSystemKnowledgeChunk } from '@/features/ai-agent/knowledge/system-kb-retriever';

function normalize(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Detecta mensagens puramente conversacionais (saudações, testes rápidos, agradecimentos, ajuda)
 * para responder de forma natural e objetiva — sem disparar relatórios financeiros nem gráficos.
 */
export function detectConversationalReply(message: string): string | null {
  const norm = normalize(message).replace(/[!?.,;:]+$/g, '').trim();
  if (!norm) return null;

  if (/^(teste|testando|test|ping|alo|alou|oi+|ola+|eae|e ai|fala|salve|hey|hello|hi)$/.test(norm)) {
    return (
      'Estou por aqui e pronto para ajudar! Você pode me pedir para:\n' +
      '- **Ensinar ou abrir uma tela** (ex.: *"Como configuro os feriados?"*)\n' +
      '- **Tirar uma foto anotada da tela** (ex.: *"Tire uma foto da tela de metas"*)\n' +
      '- **Executar alterações com confirmação** (ex.: *"Altere minha meta para R$ 3.000"*)\n' +
      '- **Analisar seus dados financeiros** (ex.: *"Quanto gastei este mês?"* ou *"Mostre o gráfico por categoria"*)'
    );
  }

  if (/^(bom dia|boa tarde|boa noite|tudo bem|td bem|como vai|como voce esta)/.test(norm) && norm.length <= 42) {
    return 'Olá! Tudo certo por aqui. Como posso ajudar você no FinMind hoje?';
  }

  if (/^(obrigad[oa]|valeu|vlw|brigado|show|perfeito|beleza|blz|ok|okay|certo|entendi|top)$/.test(norm)) {
    return 'Por nada! Se precisar de mais alguma ação, guia ou análise, é só chamar.';
  }

  if (/\b(ajuda|help|o que voce faz|o que voce pode fazer|quais comandos|como voce funciona|quem e voce)\b/.test(norm)) {
    return (
      'Sou o **Agente Interativo do FinMind**. Posso atuar em 4 frentes:\n' +
      '1. **Operar a interface** (navegar, aplicar filtros, criar/editar metas, lançamentos ou preferências com sua confirmação).\n' +
      '2. **Orientar passo a passo** demonstrando na tela sem salvar nada.\n' +
      '3. **Capturar fotos anotadas** da interface real com marcações numeradas.\n' +
      '4. **Analisar suas finanças** (saldos, gastos por categoria, metas e gráficos quando você pedir).'
    );
  }

  return null;
}

/**
 * Identifica se a mensagem realmente pede análise ou consulta sobre os dados financeiros
 * do usuário (saldos, receitas, despesas, categorias, faturas, metas, gráficos, previsões).
 */
export function isFinancialAnalyticsQuery(message: string): boolean {
  const norm = normalize(message);
  return /\b(saldo|patrimonio|gast[a-z]*|despes[a-z]*|receit[a-z]*|ganh[a-z]*|categori[a-z]*|extrato|fatur[a-z]*|carta[oa]|cartoes|conta[s]?|meta[s]?|orcament[a-z]*|margem|economi[a-z]*|sobr[a-z]*|ritmo|evoluc[a-z]*|grafic[a-z]*|compar[a-z]*|relatori[a-z]*|diagnostic[a-z]*|quanto|total|balanco|resumo|panorama|analis[a-z]*|previs[a-z]*|dinheiro|caixa|renda|valor[a-z]*|custo[s]?|divida[s]?|parcela[s]?|pix|ifood|uber|mercado|salario|aluguel|mes|meses|ano)\b/.test(
    norm
  );
}

/**
 * Resposta limpa quando não houve ferramenta acionada nem pergunta financeira:
 * responde usando a base de conhecimento do sistema (se relevante) ou pede esclarecimento,
 * sem exibir gráficos nem saldos não solicitados.
 */
export function buildNonFinancialFallbackReply(
  systemChunks: RetrievedSystemKnowledgeChunk[]
): string {
  const best = systemChunks[0];
  if (best && best.score >= 0.42) {
    const cleanExcerpt = best.contentText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'))
      .slice(0, 4)
      .join('\n');
    return `Encontrei esta orientação em **${best.sectionPath}**:\n\n${cleanExcerpt}\n\nSe quiser, posso abrir essa tela para você ou tirar uma foto anotada mostrando exatamente onde clicar.`;
  }

  return (
    'Não identifiquei exatamente o que você gostaria que eu fizesse nessa mensagem. ' +
    'Você pode me pedir para:\n' +
    '- **Mostrar ou ensinar uma funcionalidade** (ex.: *"Como configuro os feriados?"*)\n' +
    '- **Capturar uma foto da tela** (ex.: *"Tire uma foto da tela atual"*)\n' +
    '- **Fazer uma alteração** (ex.: *"Altere minha meta para R$ 2.500"*)\n' +
    '- **Consultar suas finanças** (ex.: *"Quanto gastei em Novembro?"*)'
  );
}
