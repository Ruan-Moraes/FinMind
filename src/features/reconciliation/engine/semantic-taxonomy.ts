import { FinancialPurpose, StatementMovementKind } from '@/features/reconciliation/engine/reconciliation-types';
export interface SemanticRuleSpec {
  purpose: FinancialPurpose;
  purposeLabel: string;
  inflowActionCode: string;
  inflowActionLabel: string;
  outflowActionCode: string;
  outflowActionLabel: string;
  defaultMovementKindOutflow: StatementMovementKind;
  defaultNature: 'STATIC' | 'VARIABLE';
  isRecurringLikely: boolean;
  recurrenceHint: string | null;
  categoryKeywords: RegExp;
  patterns: RegExp[];
}
export const SEMANTIC_TAXONOMY: SemanticRuleSpec[] = [
  {
    purpose: 'CREDIT_CARD_BILL', purposeLabel: 'Fatura de Cartão de Crédito',
    inflowActionCode: 'CREDIT_CARD_BILL_REFUND', inflowActionLabel: 'Estorno em fatura de cartão',
    outflowActionCode: 'CREDIT_CARD_BILL_PAYMENT', outflowActionLabel: 'Pagamento de fatura de cartão',
    defaultMovementKindOutflow: 'CREDIT_CARD_PAYMENT', defaultNature: 'VARIABLE',
    isRecurringLikely: true, recurrenceHint: 'Mensal',
    categoryKeywords: /cart[aã]o|fatura/i, patterns: [
      /\b(pag(?:amento|to)?\s+(?:de\s+)?fatura|fatura\s+cart[aã]o|fatura\s+nubank|fatura\s+ita[uú]|fatura\s+bradesco|fatura\s+santander|fatura\s+inter|fatura\s+c6|pgto\s+fatura|debito\s+aut\s+fatura)\b/i,
    ], },
  {
    purpose: 'SELF_TRANSFER', purposeLabel: 'Transferência entre Contas Próprias',
    inflowActionCode: 'SELF_ACCOUNT_TRANSFER_IN',
    inflowActionLabel: 'Transferência entre contas próprias (Entrada)',
    outflowActionCode: 'SELF_ACCOUNT_TRANSFER_OUT',
    outflowActionLabel: 'Transferência entre contas próprias (Saída)',
    defaultMovementKindOutflow: 'SELF_TRANSFER', defaultNature: 'VARIABLE',
    isRecurringLikely: false, recurrenceHint: null,
    categoryKeywords: /transfer[eê]ncia|conta/i, patterns: [
      /\b(mesma\s+titularidade|entre\s+contas\s+pr[oó]prias|conta\s+pr[oó]pria|transf(?:erencia)?\s+pr[oó]pria|aplica[cç][aã]o\s+rdb|resgate\s+rdb|aplica[cç][aã]o\s+cdb|resgate\s+cdb|guardar\s+dinheiro|caixinha\s+nubank)\b/i,
    ], },
  {
    purpose: 'REFUND_REVERSAL', purposeLabel: 'Estorno ou Reembolso',
    inflowActionCode: 'REFUND_RECEIPT', inflowActionLabel: 'Recebimento de reembolso / estorno',
    outflowActionCode: 'REVERSAL_DEBIT', outflowActionLabel: 'Estorno de crédito',
    defaultMovementKindOutflow: 'REFUND', defaultNature: 'VARIABLE',
    isRecurringLikely: false, recurrenceHint: null,
    categoryKeywords: /reembolso|estorno|outros/i,
    patterns: [/\b(estorno|reembolso|devolu[cç][aã]o|cashback|cancelamento\s+compra)\b/i], },
  {
    purpose: 'HOUSING_RENT', purposeLabel: 'Aluguel e Locação Residencial',
    inflowActionCode: 'RENT_INCOME', inflowActionLabel: 'Recebimento de aluguel',
    outflowActionCode: 'RENT_PAYMENT', outflowActionLabel: 'Pagamento de aluguel',
    defaultMovementKindOutflow: 'OBLIGATION_PAYMENT', defaultNature: 'STATIC',
    isRecurringLikely: true, recurrenceHint: 'Mensal',
    categoryKeywords: /moradia|aluguel|casa|habita[cç][aã]o|fixa/i, patterns: [
      /\b(aluguel|imobili[aá]ria|imob\b|loca[cç][aã]o\s+im[oó]vel|quinto\s*andar|quintoandar| administradora\s+de\s+im[oó]veis|alug\s+resid)\b/i,
    ], },
  {
    purpose: 'HOUSING_CONDO', purposeLabel: 'Condomínio e Taxas Residenciais',
    inflowActionCode: 'CONDO_REFUND', inflowActionLabel: 'Reembolso de condomínio',
    outflowActionCode: 'CONDO_PAYMENT', outflowActionLabel: 'Pagamento de condomínio / IPTU',
    defaultMovementKindOutflow: 'OBLIGATION_PAYMENT', defaultNature: 'STATIC',
    isRecurringLikely: true, recurrenceHint: 'Mensal',
    categoryKeywords: /moradia|condom[ií]nio|aluguel|fixa/i,
    patterns: [/\b(condom[ií]nio|cond\s+edif|administradora\s+cond|iptu|taxa\s+condominial)\b/i], },
  {
    purpose: 'INTERNET_TELECOM', purposeLabel: 'Internet e Telecomunicações',
    inflowActionCode: 'TELECOM_REFUND', inflowActionLabel: 'Estorno de operadora de internet/telefone',
    outflowActionCode: 'INTERNET_BILL_PAYMENT',
    outflowActionLabel: 'Pagamento de serviço de internet/telecom',
    defaultMovementKindOutflow: 'OBLIGATION_PAYMENT', defaultNature: 'STATIC',
    isRecurringLikely: true, recurrenceHint: 'Mensal',
    categoryKeywords: /internet|assinatura|contas|moradia|fixa|telefone/i, patterns: [
      /\b(internet|claro\b|claro\s+net|claro\s+s\.?a|net\s+servi[cç]os|vivo\s+fibra|telefonica\s+vivo|vivo\s+s\.?a|tim\s+s\.?a|tim\s+fibra|oi\s+fibra|algar\s+telecom|brisanet|desktop\s+internet|banda\s+larga|fibra\s+optica|fatura\s+internet)\b/i,
    ], },
  {
    purpose: 'GYM_FITNESS', purposeLabel: 'Academia e Atividade Física',
    inflowActionCode: 'GYM_REFUND', inflowActionLabel: 'Estorno de academia',
    outflowActionCode: 'GYM_PAYMENT', outflowActionLabel: 'Pagamento de academia',
    defaultMovementKindOutflow: 'OBLIGATION_PAYMENT', defaultNature: 'STATIC',
    isRecurringLikely: true, recurrenceHint: 'Mensal',
    categoryKeywords: /academia|sa[uú]de|esporte|bem-estar|assinatura|fixa/i, patterns: [
      /\b(academia|smart\s*fit|smartfit|bluefit|bodytech|bio\s*ritmo|selfit|gympass|wellhub|totalpass|crossfit|pilates|personal\s+trainer)\b/i,
    ], },
  {
    purpose: 'SALARY_COMPENSATION', purposeLabel: 'Salário e Remuneração do Trabalho',
    inflowActionCode: 'SALARY_RECEIPT', inflowActionLabel: 'Recebimento de salário',
    outflowActionCode: 'PAYROLL_DEDUCTION', outflowActionLabel: 'Desconto em folha',
    defaultMovementKindOutflow: 'EXPENSE', defaultNature: 'STATIC',
    isRecurringLikely: true, recurrenceHint: 'Mensal',
    categoryKeywords: /sal[aá]rio|trabalho|renda|remunera[cç][aã]o|fixo/i, patterns: [
      /\b(sal[aá]rio|folha\s+de\s+pag(?:amento|to)|folha\s+pagto|cr[eé]dito\s+sal[aá]rio|pr[oó]-?labore|adiantamento\s+salarial|13o?\s+sal[aá]rio|remunera[cç][aã]o|vencimentos|empresa\s+[a-z0-9]+)\b/i,
      /\b(?:ted\s+recebida|doc\s+recebido|pix\s+recebido|transf(?:erencia)?\s+(?:pix\s+)?recebida|credito\s+em\s+conta)\s+(?:empresa|cia|companhia|grupo|tech|industria|comercio|holding|corp)\b/i,
    ], },
  {
    purpose: 'GROCERY_SUPERMARKET', purposeLabel: 'Supermercado e Alimentação Doméstica',
    inflowActionCode: 'GROCERY_REFUND', inflowActionLabel: 'Estorno de supermercado',
    outflowActionCode: 'GROCERY_PURCHASE', outflowActionLabel: 'Compra em supermercado',
    defaultMovementKindOutflow: 'EXPENSE', defaultNature: 'VARIABLE',
    isRecurringLikely: false, recurrenceHint: null,
    categoryKeywords: /alimenta[cç][aã]o|supermercado|mercado|comida/i, patterns: [
      /\b(supermercado|mercado|atacad[aã]o|assai|carrefour|p[aã]o\s+de\s+a[cç][uú]car|extra\s+hiper|oba\s+hortifruti|hortifruti|a[cç]ougue|mercearia|zaffari|angeloni|condor|muffato|guanabara|mundial|zona\s+sul|super\s+nosso|savegnago)\b/i,
    ], },
  {
    purpose: 'FOOD_DINING', purposeLabel: 'Restaurante, Padaria e Delivery',
    inflowActionCode: 'DINING_REFUND', inflowActionLabel: 'Estorno de delivery / restaurante',
    outflowActionCode: 'RESTAURANT_PURCHASE', outflowActionLabel: 'Compra em restaurante / delivery',
    defaultMovementKindOutflow: 'EXPENSE', defaultNature: 'VARIABLE',
    isRecurringLikely: false, recurrenceHint: null,
    categoryKeywords: /alimenta[cç][aã]o|restaurante|lazer|comida/i, patterns: [
      /\b(restaurante|i\s*food|ifood|99\s*food|rappi|ze\s+delivery|padaria|panificadora|lanchonete|hamburgueria|pizzaria|cafeteria|starbucks|mcdonalds|bk\b|burger\s+king|outback)\b/i,
    ], },
  {
    purpose: 'SUBSCRIPTION_STREAMING', purposeLabel: 'Assinatura de Streaming e Software',
    inflowActionCode: 'SUBSCRIPTION_REFUND', inflowActionLabel: 'Estorno de assinatura',
    outflowActionCode: 'SUBSCRIPTION_PAYMENT', outflowActionLabel: 'Pagamento de assinatura',
    defaultMovementKindOutflow: 'OBLIGATION_PAYMENT', defaultNature: 'STATIC',
    isRecurringLikely: true, recurrenceHint: 'Mensal',
    categoryKeywords: /assinatura|streaming|lazer|fixa/i, patterns: [
      /\b(assinatura|netflix|spotify|amazon\s+prime|prime\s+video|disney\s*plus|hbo\s*max|max\.com|apple\.com\/bill|icloud|google\s+one|google\s+cloud|google\s+brasil|youtube\s+premium|chatgpt|openai|claude\.ai|github|adobe)\b/i,
    ], },
  {
    purpose: 'UTILITIES_ENERGY_WATER', purposeLabel: 'Energia Elétrica, Água e Gás',
    inflowActionCode: 'UTILITY_REFUND', inflowActionLabel: 'Estorno de concessionária',
    outflowActionCode: 'UTILITY_BILL_PAYMENT',
    outflowActionLabel: 'Pagamento de conta de consumo (luz/água/gás)',
    defaultMovementKindOutflow: 'OBLIGATION_PAYMENT', defaultNature: 'STATIC',
    isRecurringLikely: true, recurrenceHint: 'Mensal',
    categoryKeywords: /moradia|contas|luz|energia|[aá]gua|fixa/i, patterns: [
      /\b(energia\s+el[eé]trica|conta\s+de\s+luz|enel|cpfl|light|cemig|copel|celesc|neoenergia|equatorial|sabesp|copasa|cedae|sanepar|comgas|naturgy|[aá]gua\s+e\s+esgoto)\b/i,
    ], },
  {
    purpose: 'FINANCING_LOAN', purposeLabel: 'Financiamento, Empréstimo ou Consórcio',
    inflowActionCode: 'LOAN_CREDIT', inflowActionLabel: 'Crédito de empréstimo',
    outflowActionCode: 'FINANCING_PAYMENT', outflowActionLabel: 'Pagamento de financiamento / empréstimo',
    defaultMovementKindOutflow: 'OBLIGATION_PAYMENT', defaultNature: 'STATIC',
    isRecurringLikely: true, recurrenceHint: 'Mensal',
    categoryKeywords: /financiamento|empr[eé]stimo|moradia|carro|fixa/i, patterns: [
      /\b(financiamento|parcela\s+financ|cons[oó]rcio|empr[eé]stimo|prestacao\s+habitacional|amortiza[cç][aã]o)\b/i,
    ], },
  {
    purpose: 'BANK_FEE', purposeLabel: 'Tarifa Bancária e Encargos',
    inflowActionCode: 'FEE_REFUND', inflowActionLabel: 'Estorno de tarifa bancária',
    outflowActionCode: 'BANK_FEE_CHARGE', outflowActionLabel: 'Cobrança de tarifa bancária',
    defaultMovementKindOutflow: 'EXPENSE', defaultNature: 'VARIABLE',
    isRecurringLikely: false, recurrenceHint: null,
    categoryKeywords: /tarifa|imposto|banco|taxas|outros/i, patterns: [
      /\b(tarifa\s+banc[aá]ria|tar\s+pacote|cesta\s+de\s+relacionamento|anuidade|iof\b|juros\s+cheque\s+especial|encargos\s+limite|taxa\s+manuten[cç][aã]o)\b/i,
    ], },
  {
    purpose: 'TRANSPORT_MOBILITY', purposeLabel: 'Transporte, Mobilidade e Combustível',
    inflowActionCode: 'TRANSPORT_REFUND', inflowActionLabel: 'Estorno de transporte',
    outflowActionCode: 'TRANSPORT_PURCHASE', outflowActionLabel: 'Despesa de transporte / combustível',
    defaultMovementKindOutflow: 'EXPENSE', defaultNature: 'VARIABLE',
    isRecurringLikely: false, recurrenceHint: null,
    categoryKeywords: /transporte|combust[ií]vel|carro|uber|mobilidade/i, patterns: [
      /\b(uber\b|99app|99\s*pop|posto\b|combust[ií]vel|gasolina|etanol|ipiranga|shell\b|petrobras|sem\s+parar|veloe|conectcar|ped[aá]gio|estacionamento|pe[cç]a|oficina|pneu)\b/i,
    ], },
  {
    purpose: 'HEALTH_MEDICAL', purposeLabel: 'Saúde, Farmácia e Plano Médico',
    inflowActionCode: 'HEALTH_REIMBURSEMENT', inflowActionLabel: 'Reembolso médico',
    outflowActionCode: 'HEALTH_PAYMENT', outflowActionLabel: 'Despesa de saúde / farmácia',
    defaultMovementKindOutflow: 'EXPENSE', defaultNature: 'VARIABLE',
    isRecurringLikely: false, recurrenceHint: null,
    categoryKeywords: /sa[uú]de|farm[aá]cia|m[eé]dico/i, patterns: [
      /\b(farm[aá]cia|drogaria|droga\s+raia|drogasil|pague\s+menos|panvel|unimed|amil|bradesco\s+sa[uú]de|sulam[eé]rica\s+sa[uú]de|hapvida|consulta\s+m[eé]dica|laborat[oó]rio|hospital|dentista)\b/i,
    ], },
  {
    purpose: 'FREELANCE_REVENUE', purposeLabel: 'Prestação de Serviço / Receita Extra',
    inflowActionCode: 'FREELANCE_INCOME', inflowActionLabel: 'Recebimento de serviço / projeto',
    outflowActionCode: 'SERVICE_PAYMENT', outflowActionLabel: 'Pagamento de serviço prestado',
    defaultMovementKindOutflow: 'EXPENSE', defaultNature: 'VARIABLE',
    isRecurringLikely: false, recurrenceHint: null,
    categoryKeywords: /extra|freela|projeto|servi[cç]o|renda/i,
    patterns: [/\b(freela|freelance|consultoria|honor[aá]rios|nota\s+fiscal\s+servi[cç]o|projeto)\b/i], },
  {
    purpose: 'EDUCATION', purposeLabel: 'Educação, Cursos e Faculdade',
    inflowActionCode: 'EDUCATION_SCHOLARSHIP', inflowActionLabel: 'Bolsa / Reembolso educacional',
    outflowActionCode: 'EDUCATION_TUITION_PAYMENT',
    outflowActionLabel: 'Pagamento de mensalidade / curso educacional',
    defaultMovementKindOutflow: 'OBLIGATION_PAYMENT', defaultNature: 'STATIC',
    isRecurringLikely: true, recurrenceHint: 'Mensal',
    categoryKeywords: /educa[cç][aã]o|faculdade|curso|estudo|escola|assinatura|fixa/i, patterns: [
      /\b(uninter|faculdade|universidade|escola|col[eé]gio|mensalidade\s+escolar|alura|rocketseat|udemy|coursera|puc\b|est[aá]cio|anhanguera|fgv|insper)\b/i,
    ], },
  {
    purpose: 'INVESTMENT_YIELD', purposeLabel: 'Rendimentos e Proventos Financeiros',
    inflowActionCode: 'INVESTMENT_YIELD_RECEIPT',
    inflowActionLabel: 'Rendimento automático de conta / investimento',
    outflowActionCode: 'INVESTMENT_TAX_WITHHOLDING',
    outflowActionLabel: 'Retenção de IR / IOF sobre rendimento', defaultMovementKindOutflow: 'EXPENSE',
    defaultNature: 'VARIABLE', isRecurringLikely: true,
    recurrenceHint: 'Recorrente', categoryKeywords: /rendimento|investimento|dividendo|provento|renda/i,
    patterns: [
      /\b(rendimentos?|dividendo|jcp\b|juros\s+sobre\s+capital|remunera[cç][aã]o\s+autom[aá]tica|proventos)\b/i,
    ], },
];
