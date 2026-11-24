import { type ExtractedStatementItem, extractJsonFromAiResponse } from "@/features/ai-copilot/providers/copilot-types-and-prompts";

/**
 * Extrator Determinístico Local de Texto/JSON de Extrato.
 * Não força categorias incorretas quando nenhuma categoria do usuário corresponde ao item.
 */
export function smartParseStatementLocally(
  rawText: string,
  categories: Array<{ id: string; name: string; type: string; defaultNature: string }>
): ExtractedStatementItem[] {
  const parsedJson = extractJsonFromAiResponse<{
    items?: Array<{
      description?: string;
      amountInCents?: number;
      date?: string;
      type?: 'INCOME' | 'EXPENSE';
      nature?: 'STATIC' | 'VARIABLE';
      categoryId?: string;
      tags?: string;
    }>;
  }>(rawText);

  if (parsedJson?.items && Array.isArray(parsedJson.items)) {
    return parsedJson.items
      .filter((it) => it && Number(it.amountInCents) > 0)
      .map((it, idx) => {
        const matchedCat = categories.find((c) => c.id === it.categoryId);
        return {
          tempId: `ai-json-${idx}-${Date.now()}`,
          description: String(it.description || 'Lançamento Extraído').trim(),
          amountInCents: Math.abs(Math.round(Number(it.amountInCents))),
          date:
            it.date && /^\d{4}-\d{2}-\d{2}$/.test(it.date)
              ? it.date
              : new Date().toISOString().slice(0, 10),
          type: it.type === 'INCOME' ? 'INCOME' : 'EXPENSE',
          nature:
            it.nature === 'STATIC' || it.nature === 'VARIABLE'
              ? it.nature
              : (matchedCat?.defaultNature as 'STATIC' | 'VARIABLE') || 'VARIABLE',
          categoryId: matchedCat?.id || '',
          categoryName: matchedCat?.name || 'Sem Categoria',
          tags: String(it.tags || 'extrato'),
        };
      });
  }

  const todayIso = new Date().toISOString().slice(0, 10);
  const currentYear = new Date().getFullYear();

  const rawLines = rawText
    .replace(/\r\n/g, '\n')
    .split(/\n|(?=\b(?:gastei|recebi|paguei|comprei|ganhei|sal[aá]rio|aluguel)\b)/i)
    .map((l) => l.trim())
    .filter((l) => l.length > 2);

  const items: ExtractedStatementItem[] = [];

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    if (
      /^(data|date|descri[cç][aã]o|valor|amount|hist[oó]rico|identificador)/i.test(line) &&
      !/\d/.test(line)
    ) {
      continue;
    }

    let itemDate = todayIso;
    let lineWithoutDate = line;

    const isoMatch = line.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
    const brFullMatch = line.match(/\b(\d{2})\/(\d{2})\/(\d{4})\b/);
    const brShortMatch = line.match(/\b(\d{2})\/(\d{2})\b/);

    if (isoMatch) {
      itemDate = `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
      lineWithoutDate = line.replace(isoMatch[0], ' ');
    } else if (brFullMatch) {
      itemDate = `${brFullMatch[3]}-${brFullMatch[2]}-${brFullMatch[1]}`;
      lineWithoutDate = line.replace(brFullMatch[0], ' ');
    } else if (brShortMatch) {
      itemDate = `${currentYear}-${brShortMatch[2]}-${brShortMatch[1]}`;
      lineWithoutDate = line.replace(brShortMatch[0], ' ');
    }

    const moneyRegex =
      /([+-]?\s*(?:R\$\s*)?\d{1,3}(?:\.\d{3})*,\d{2}|[+-]?\s*(?:R\$\s*)?\d+\.\d{2}|[+-]?\s*(?:R\$\s*)?\d+(?:,\d{1,2})?)/gi;
    const matches = Array.from(lineWithoutDate.matchAll(moneyRegex));
    if (matches.length === 0) continue;

    const chosenMatch = matches[matches.length - 1][0];
    const isNegativeSign = chosenMatch.includes('-');
    const isPositiveSign = chosenMatch.includes('+');

    const cleanedNumber = chosenMatch.replace(/[R$\s+-]/g, '');
    let amountFloat = 0;
    if (cleanedNumber.includes(',')) {
      amountFloat = parseFloat(cleanedNumber.replace(/\./g, '').replace(',', '.'));
    } else {
      amountFloat = parseFloat(cleanedNumber);
    }

    if (Number.isNaN(amountFloat) || amountFloat <= 0) continue;
    const amountInCents = Math.round(amountFloat * 100);

    let desc = lineWithoutDate
      .replace(chosenMatch, ' ')
      .replace(/[;|]+/g, ' ')
      .replace(/^[,.\s-]+|[,.\s-]+$/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim();

    const lowerLine = line.toLowerCase();
    desc = desc
      .replace(/^(gastei|paguei|comprei|recebi|ganhei|entrou|saiu)\s+(no|na|de|em|com|por)?\s*/i, '')
      .trim();

    if (!desc) {
      desc = 'Lançamento Extraído';
    } else {
      desc = desc.charAt(0).toUpperCase() + desc.slice(1);
    }

    const incomeKeywords =
      /\b(recebi|ganhei|sal[aá]rio|pr[oó]-?labore|freela|freelance|rendimento|dividendo|pix recebido|transfer[eê]ncia recebida|dep[oó]sito|reembolso|entrada|venda)\b/i;
    const expenseKeywords =
      /\b(gastei|paguei|comprei|mercado|supermercado|comida|restaurante|ifood|aluguel|condom[ií]nio|luz|energia|internet|pe[cç]a|oficina|pneu|combust[ií]vel|gasolina|uber|farm[aá]cia|compra|boleto|pix enviado|d[eé]bito)\b/i;

    let type: 'INCOME' | 'EXPENSE' = 'EXPENSE';
    if (incomeKeywords.test(lowerLine) && !/pix enviado|pagamento/i.test(lowerLine)) {
      type = 'INCOME';
    } else if (expenseKeywords.test(lowerLine) || isNegativeSign) {
      type = 'EXPENSE';
    } else if (isPositiveSign) {
      type = 'INCOME';
    }

    let matchedCat: { id: string; name: string; type: string; defaultNature: string } | undefined;
    let nature: 'STATIC' | 'VARIABLE' = 'VARIABLE';
    let tags = 'extrato';

    const findCatByKeyword = (regex: RegExp) =>
      categories.find(
        (c) =>
          c.type === type &&
          regex.test(
            c.name
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .toLowerCase()
          )
      );

    if (type === 'INCOME') {
      if (/sal[aá]rio|pr[oó]-?labore|fixo|mensal/i.test(lowerLine)) {
        matchedCat = findCatByKeyword(/salario|fixo|trabalho|remuneracao/);
        nature = 'STATIC';
        tags = 'salario,estatico';
      } else if (/rendimento|dividendo|investimento|cdb|rdb/i.test(lowerLine)) {
        matchedCat = findCatByKeyword(/rendimento|investimento/);
        nature = 'VARIABLE';
        tags = 'rendimentos';
      } else {
        matchedCat = findCatByKeyword(/extra|projeto|freela|outras|receita/);
        nature = 'VARIABLE';
        tags = 'renda';
      }
    } else {
      if (/aluguel|condom[ií]nio|moradia|financiamento|iptu/i.test(lowerLine)) {
        matchedCat = findCatByKeyword(/moradia|aluguel|fixa/);
        nature = 'STATIC';
        tags = 'moradia,estatico';
      } else if (/internet|fibra|luz|energia|[aá]gua|assinatura|netflix|spotify/i.test(lowerLine)) {
        matchedCat = findCatByKeyword(/assinatura|internet|fixa|moradia|servicos/);
        nature = 'STATIC';
        tags = 'contas,estatico';
      } else if (/pe[cç]a|pneu|oficina|mec[aâ]nico|manuten[cç][aã]o|embreagem|freio|óleo/i.test(lowerLine)) {
        matchedCat = findCatByKeyword(/peca|manuten|transporte|carro/);
        nature = 'VARIABLE';
        tags = 'pecas,manutencao';
      } else if (/mercado|supermercado|atacad[aã]o|a[cç]ougue|feira/i.test(lowerLine)) {
        matchedCat = findCatByKeyword(/supermercado|mercado|alimenta/);
        nature = 'VARIABLE';
        tags = 'supermercado';
      } else if (/comida|i-?food|restaurante|lanche|padaria|delivery/i.test(lowerLine)) {
        matchedCat = findCatByKeyword(/alimenta|delivery|restaurante|comida/);
        nature = 'VARIABLE';
        tags = 'alimentacao';
      } else if (/uber|99|combust[ií]vel|gasolina|etanol|posto|estacionamento|ped[aá]gio/i.test(lowerLine)) {
        matchedCat = findCatByKeyword(/transporte|mobilidade|combust|carro/);
        nature = 'VARIABLE';
        tags = 'transporte';
      } else if (/academia|smart\s*fit|farm[aá]cia|drogaria|m[eé]dico|sa[uú]de/i.test(lowerLine)) {
        matchedCat = findCatByKeyword(/saude|academia|farmacia/);
        nature = /academia|smart\s*fit/i.test(lowerLine) ? 'STATIC' : 'VARIABLE';
        tags = 'saude';
      } else if (/lazer|cinema|jogo|viagem|bar|festa|passeio/i.test(lowerLine)) {
        matchedCat = findCatByKeyword(/lazer|compras|restaurante/);
        nature = 'VARIABLE';
        tags = 'lazer';
      }
    }

    if (matchedCat && !nature) {
      nature = (matchedCat.defaultNature as 'STATIC' | 'VARIABLE') || 'VARIABLE';
    }

    items.push({
      tempId: `local-${i}-${Date.now()}`,
      description: desc,
      amountInCents,
      date: itemDate,
      type,
      nature,
      categoryId: matchedCat?.id || '',
      categoryName: matchedCat?.name || 'Sem Categoria',
      tags,
    });
  }

  return items;
}

