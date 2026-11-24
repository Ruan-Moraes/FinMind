import * as XLSX from 'xlsx';
import type { ExistingRuleCandidate } from '@/features/reconciliation/engine';
export function buildRealBinaryMercadoPagoPdfBase64() {
  const streamLines = [
    'BT',
    '/F1 12 Tf',
    '1 0 0 1 50 780 Tm (MERCADO PAGO - EXTRATO DE CONTA) Tj',
    '1 0 0 1 50 760 Tm (Saldo inicial: R$ 1.000,00   Entradas: R$ 3.500,00   Saidas: R$ -1.590,00   Saldo final: R$ 2.910,00) Tj',
    '1 0 0 1 50 740 Tm (DETALHE DOS MOVIMENTOS) Tj',
    '1 0 0 1 50 720 Tm (Data) Tj 1 0 0 1 120 720 Tm (Descricao) Tj 1 0 0 1 320 720 Tm (ID da operacao) Tj 1 0 0 1 420 720 Tm (Valor) Tj 1 0 0 1 500 720 Tm (Saldo) Tj',
    // Movimentação 1: Descrição em 2 linhas centralizada verticalmente + Valor "R$ -1.200,00" + Saldo "R$ 4.200,00"
    '1 0 0 1 120 696 Tm (Transferencia Pix enviada) Tj',
    '1 0 0 1 50 690 Tm (10-09-2026) Tj 1 0 0 1 320 690 Tm (86419283741) Tj 1 0 0 1 420 690 Tm (R$ -1.200,00) Tj 1 0 0 1 500 690 Tm (R$ 4.200,00) Tj',
    '1 0 0 1 120 684 Tm (Imobiliaria Abc) Tj',
    // Movimentação 2: Claro Net R$ -120,00 com coluna Saldo R$ 4.080,00
    '1 0 0 1 50 660 Tm (12-09-2026) Tj 1 0 0 1 120 660 Tm (Pagamento Claro Net) Tj 1 0 0 1 320 660 Tm (86419283742) Tj 1 0 0 1 420 660 Tm (R$ -120,00) Tj 1 0 0 1 500 660 Tm (R$ 4.080,00) Tj',
    // Movimentação 3: Smart Fit R$ -120,00 com coluna Saldo R$ 3.960,00
    '1 0 0 1 50 635 Tm (12-09-2026) Tj 1 0 0 1 120 635 Tm (Debito Smart Fit) Tj 1 0 0 1 320 635 Tm (86419283743) Tj 1 0 0 1 420 635 Tm (R$ -120,00) Tj 1 0 0 1 500 635 Tm (R$ 3.960,00) Tj',
    // Movimentação 4: Recebimento Salário R$ 3.500,00 com coluna Saldo R$ 7.460,00
    '1 0 0 1 50 610 Tm (05-09-2026) Tj 1 0 0 1 120 610 Tm (Transferencia Pix recebida Empresa Xyz) Tj 1 0 0 1 320 610 Tm (86419283744) Tj 1 0 0 1 420 610 Tm (R$ 3.500,00) Tj 1 0 0 1 500 610 Tm (R$ 7.460,00) Tj',
    'ET',
  ].join('\n');
  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n',
    `4 0 obj\n<< /Length ${Buffer.byteLength(streamLines, 'latin1')} >>\nstream\n${streamLines}\nendstream\nendobj\n`,
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, 'latin1'));
    pdf += obj;
  }
  const xrefOffset = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, 'latin1').toString('base64');
}
export function buildSyntheticInterXlsxBase64(): string {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ['Data', 'Descrição', 'ID da operação', 'Valor', 'Saldo'],
    ['15/09/2026', 'COMPRA SUPERMERCADO EXTRA', '991827361', 'R$ -250,00', 'R$ 7.210,00'],
  ]);
  XLSX.utils.book_append_sheet(wb, ws, 'Extrato');
  return XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
}
export const TEST_CATEGORIES = [
    { id: 'cat-moradia', name: 'Moradia & Aluguel', type: 'EXPENSE', defaultNature: 'STATIC' },
    { id: 'cat-internet', name: 'Internet & Assinaturas', type: 'EXPENSE', defaultNature: 'STATIC' },
    { id: 'cat-saude', name: 'Academia & Saúde', type: 'EXPENSE', defaultNature: 'STATIC' },
    { id: 'cat-mercado', name: 'Supermercado & Alimentação', type: 'EXPENSE', defaultNature: 'VARIABLE' },
    { id: 'cat-salario', name: 'Salário & Trabalho', type: 'INCOME', defaultNature: 'STATIC' },
    { id: 'cat-extra', name: 'Renda Extra', type: 'INCOME', defaultNature: 'VARIABLE' },
  ];
export const TEST_RECURRENCE_RULES: ExistingRuleCandidate[] = [
    {
      id: 'rule-aluguel',
      description: 'Aluguel',
      type: 'EXPENSE' as const,
      nature: 'STATIC' as const,
      amountInCents: 120000, // R$ 1.200,00
      dayOfMonth: 10,
      frequency: 'MONTHLY',
      categoryId: 'cat-moradia',
      categoryName: 'Moradia & Aluguel',
      accountId: 'acc-1',
    },
    {
      id: 'rule-internet',
      description: 'Internet',
      type: 'EXPENSE' as const,
      nature: 'STATIC' as const,
      amountInCents: 12000, // R$ 120,00
      dayOfMonth: 12,
      frequency: 'MONTHLY',
      categoryId: 'cat-internet',
      categoryName: 'Internet & Assinaturas',
      accountId: 'acc-1',
    },
    {
      id: 'rule-academia',
      description: 'Academia',
      type: 'EXPENSE' as const,
      nature: 'STATIC' as const,
      amountInCents: 12000, // R$ 120,00 (mesmo valor de Internet, finalidade diferente!)
      dayOfMonth: 12,
      frequency: 'MONTHLY',
      categoryId: 'cat-saude',
      categoryName: 'Academia & Saúde',
      accountId: 'acc-1',
    },
    {
      id: 'rule-salario',
      description: 'Salário',
      type: 'INCOME' as const,
      nature: 'STATIC' as const,
      amountInCents: 350000, // R$ 3.500,00
      dayOfMonth: 5,
      frequency: 'MONTHLY',
      categoryId: 'cat-salario',
      categoryName: 'Salário & Trabalho',
      accountId: 'acc-1',
    },
  ];
export const MP_SEPT_LINES = [
    'MERCADO PAGO INSTITUICAO DE PAGAMENTO LTDA',
    'EXTRATO DE CONTA',
    'Saldo inicial: R$ 3.451,84   Entradas: R$ 2.878,51   Saídas: R$ -1.884,56   Saldo final: R$ 4.445,79',
    'DETALHE DOS MOVIMENTOS',
    'Data Descrição ID da operação Valor Saldo',
    '01-09-2026 Rendimentos 10000000001 R$ 1,51 R$ 3.453,35',
    '02-09-2026 Rendimentos 10000000002 R$ 1,51 R$ 3.454,86',
    '03-09-2026 Rendimentos 10000000003 R$ 1,52 R$ 3.456,38',
    '04-09-2026 Rendimentos 10000000004 R$ 1,52 R$ 3.457,90',
    '04-09-2026 Pix recebido RUAN MORAES SANTOS BARBOSA 10000000005 R$ 1.875,00 R$ 5.332,90',
    'Pagamento com QR Pix',
    '05-09-2026 10000000006 R$ -20,49 R$ 5.312,41',
    'IFOOD COM AGENCIA DE RESTAURANTES ONLINE S A',
    '05-09-2026 Pix recebido ANDREA DOS SANTOS 10000000007 R$ 80,00 R$ 5.392,41',
    '07-09-2026 Pix enviado Ruan Moraes Santos Barbosa 10000000008 R$ -110,00 R$ 5.282,41',
    'Pagamento com QR Pix',
    '07-09-2026 10000000009 R$ -150,00 R$ 5.132,41',
    'GOOGLE CLOUD BRASIL COMPUTACAO E SERVICOS DE DADOS LTDA. Data Data Descrição Descrição ID da operação ID da operação Valor Valor Saldo Saldo',
    '08-09-2026 Rendimentos 10000000010 R$ 2,30 R$ 5.134,71',
    '08-09-2026 Pix enviado Ariana de Souza Oliveira 10000000011 R$ -31,95 R$ 5.102,76',
    '09-09-2026 Rendimentos 10000000012 R$ 2,20 R$ 5.104,96',
    '10-09-2026 Rendimentos 10000000013 R$ 2,21 R$ 5.107,17',
    '11-09-2026 Rendimentos 10000000014 R$ 2,21 R$ 5.109,38',
    '12-09-2026 Pix enviado Cleidson Jesiel Andrade 10000000015 R$ -50,00 R$ 5.059,38',
    '12-09-2026 Pagamento com QR Pix TELEFONICA BRASIL S.A. 10000000016 R$ -88,83 R$ 4.970,55',
    'Pagamento com QR Pix',
    '12-09-2026 10000000017 R$ -5,99 R$ 4.964,56',
    'PAGSEGURO TECNOLOGIA LTDA',
    '14-09-2026 Rendimentos 10000000018 R$ 2,21 R$ 4.966,77',
    '14-09-2026 Pagamento com QR Pix UNINTER EDUCACIONAL S A 10000000019 R$ -412,33 R$ 4.554,44',
    '15-09-2026 Rendimentos 10000000020 R$ 1,98 R$ 4.556,42',
    '16-09-2026 Rendimentos 10000000021 R$ 1,98 R$ 4.558,40',
    '17-09-2026 Rendimentos 10000000022 R$ 1,98 R$ 4.560,38',
    '17-09-2026 Pagamento GOOGLE BRASIL PAGAMENTOS LTDA 10000000023 R$ -95,99 R$ 4.464,39',
    '18-09-2026 Rendimentos 10000000024 R$ 1,90 R$ 4.466,29',
    '18-09-2026 Pix enviado Gustavo Mendes de Souza 10000000025 R$ -80,00 R$ 4.386,29',
    '20-09-2026 Pix recebido ANDREA DOS SANTOS 10000000026 R$ 210,00 R$ 4.596,29',
    '21-09-2026 Rendimentos 10000000027 R$ 1,89 R$ 4.598,18',
    'Pagamento com QR Pix',
    '21-09-2026 10000000028 R$ -24,92 R$ 4.573,26',
    'IFOOD.COM AGENCIA DE RESTAURANTES ONLINE S.A',
    '22-09-2026 Rendimentos 10000000029 R$ 1,96 R$ 4.575,22',
    '23-09-2026 Rendimentos 10000000030 R$ 1,96 R$ 4.577,18',
    '24-09-2026 Rendimentos 10000000031 R$ 1,95 R$ 4.579,13',
    '25-09-2026 Rendimentos 10000000032 R$ 1,96 R$ 4.581,09',
    '25-09-2026 Pagamento com Pix 99 FOOD LTDA 10000000033 R$ -27,99 R$ 4.553,10',
    '26-09-2026 Pix recebido Matheus Moraes Santos Barbosa 10000000034 R$ 30,00 R$ 4.583,10',
    'Pagamento com Pix IFOOD',
    '26-09-2026 10000000035 R$ -116,07 R$ 4.467,03',
    'COM AGENCIA DE RESTAURANTES ONLINE S.A',
    '28-09-2026 Rendimentos 10000000036 R$ 1,96 R$ 4.468,99',
    '28-09-2026 Pix recebido ANDREA DOS SANTOS 10000000037 R$ 643,00 R$ 5.111,99',
    '28-09-2026 Pix enviado Ruan Moraes Santos Barbosa 10000000038 R$ -670,00 R$ 4.441,99',
    '29-09-2026 Rendimentos 10000000039 R$ 1,89 R$ 4.443,88',
    '30-09-2026 Rendimentos 10000000040 R$ 1,91 R$ 4.445,79',
    'o nosso SAC, ligue para 0800 637 7246. Você precisará de um código de atendimento para nos contatar.',
  ].join('\n');
  export const MP_OCT_LINES = [
    'MERCADO PAGO INSTITUICAO DE PAGAMENTO LTDA',
    'EXTRATO DE CONTA',
    'Saldo inicial: R$ 4.445,79   Entradas: R$ 4.805,75   Saídas: R$ -4.043,28   Saldo final: R$ 5.208,26',
    'DETALHE DOS MOVIMENTOS',
    'Data Descrição ID da operação Valor Saldo',
    '01-10-2026 Rendimentos 10000000041 R$ 1,90 R$ 4.447,69',
    '02-10-2026 Rendimentos 10000000042 R$ 1,91 R$ 4.449,60',
    '04-10-2026 Pix enviado Cleidson Jesiel Andrade 10000000043 R$ -50,00 R$ 4.399,60',
    '05-10-2026 Rendimentos 10000000044 R$ 2,59 R$ 4.402,19',
    '06-10-2026 Rendimentos 10000000045 R$ 1,89 R$ 4.404,08',
    '06-10-2026 Pix recebido RUAN MORAES SANTOS BARBOSA 10000000046 R$ 1.875,00 R$ 6.279,08',
    '06-10-2026 Pagamento com Pix UNINTER EDUCACIONAL SA 10000000047 R$ -383,54 R$ 5.895,54',
    '06-10-2026 Pagamento com Pix NU PAGAMENTOS SA 10000000048 R$ -85,40 R$ 5.810,14',
    'Pagamento com Pix',
    '06-10-2026 10000000049 R$ -210,40 R$ 5.599,74',
    'COMPANHIA DE SANEAMENTO DE MINAS GERAIS COPASA MG',
    '07-10-2026 Rendimentos 10000000050 R$ 2,38 R$ 5.602,12',
    '08-10-2026 Rendimentos 10000000051 R$ 2,39 R$ 5.604,51',
    '09-10-2026 Rendimentos 10000000052 R$ 2,38 R$ 5.606,89',
    '09-10-2026 Pix enviado Ariana de Souza Oliveira 10000000053 R$ -43,30 R$ 5.563,59',
    '13-10-2026 Rendimentos 10000000054 R$ 2,37 R$ 5.565,96',
    '14-10-2026 Rendimentos 10000000055 R$ 2,37 R$ 5.568,33',
    '15-10-2026 Rendimentos 10000000056 R$ 2,38 R$ 5.570,71',
    '16-10-2026 Rendimentos 10000000057 R$ 2,37 R$ 5.573,08',
    '17-10-2026 Pagamento GOOGLE BRASIL PAGAMENTOS LTDA. 10000000058 R$ -95,99 R$ 5.477,09',
    'Pagamento com Pix IFOOD',
    '17-10-2026 10000000059 R$ -48,16 R$ 5.428,93',
    'COM AGENCIA DE RESTAURANTES ONLINE S.A',
    '17-10-2026 Pix recebido ANDREA DOS SANTOS 10000000060 R$ 48,00 R$ 5.476,93',
    '19-10-2026 Rendimentos 10000000061 R$ 2,37 R$ 5.479,30',
    '20-10-2026 Rendimentos 10000000062 R$ 2,34 R$ 5.481,64',
    '21-10-2026 Rendimentos 10000000063 R$ 2,34 R$ 5.483,98',
    '22-10-2026 Rendimentos 10000000064 R$ 2,34 R$ 5.486,32',
    '23-10-2026 Rendimentos 10000000065 R$ 2,34 R$ 5.488,66',
    '26-10-2026 Rendimentos 10000000066 R$ 2,35 R$ 5.491,01',
    '27-10-2026 Rendimentos 10000000067 R$ 2,33 R$ 5.493,34',
    '27-10-2026 Pagamento Padaria gpf 10000000068 R$ -3,49 R$ 5.489,85',
    '27-10-2026 Pix enviado Ruan Moraes Santos Barbosa 10000000069 R$ -780,00 R$ 4.709,85',
    '27-10-2026 Pix enviado Ruan Moraes Santos Barbosa 10000000070 R$ -5,00 R$ 4.704,85',
    '27-10-2026 Pagamento de fatura Cartão de crédito 10000000071 R$ -531,43 R$ 4.173,42',
    '28-10-2026 Rendimentos 10000000072 R$ 1,81 R$ 4.175,23',
    '29-10-2026 Rendimentos 10000000073 R$ 1,79 R$ 4.177,02',
    '30-10-2026 Rendimentos 10000000074 R$ 1,81 R$ 4.178,83',
    '30-10-2026 Pix recebido RUAN MORAES SANTOS BARBOSA 10000000075 R$ 2.836,00 R$ 7.014,83',
    'Pagamento com Pix MIRANTE',
    '31-10-2026 10000000076 R$ -397,91 R$ 6.616,92',
    'INDUSTRIA E COMERCIO LTDA',
    'Pagamento com Pix',
    '31-10-2026 10000000077 R$ -1.056,79 R$ 5.560,13',
    'MAGALUPAY INSTITUICAO DE PAGAMENTO S.A',
    '31-10-2026 Pagamento 10000000078 R$ -351,87 R$ 5.208,26',
    'o nosso SAC, ligue para 0800 637 7246. Você precisará de um código de atendimento para nos contatar.',
  ].join('\n');
  export const MP_NOV_LINES = [
    'MERCADO PAGO INSTITUICAO DE PAGAMENTO LTDA',
    'EXTRATO DE CONTA',
    'Saldo inicial: R$ 5.208,26   Entradas: R$ 2.687,21   Saídas: R$ -916,00   Saldo final: R$ 6.979,47',
    'DETALHE DOS MOVIMENTOS',
    'Data Descrição ID da operação Valor Saldo',
    '01-11-2026 Pagamento com Pix LIVEPIX LTDA 10000000079 R$ -23,99 R$ 5.184,27',
    '01-11-2026 Pix recebido Ruan Moraes Santos Barbosa 10000000080 R$ 8,00 R$ 5.192,27',
    '03-11-2026 Rendimentos 10000000081 R$ 3,31 R$ 5.195,58',
    '04-11-2026 Rendimentos 10000000082 R$ 2,21 R$ 5.197,79',
    '05-11-2026 Rendimentos 10000000083 R$ 3,00 R$ 5.200,79',
    '05-11-2026 Pix recebido ANDREA DOS SANTOS 10000000084 R$ 599,52 R$ 5.800,31',
    '05-11-2026 Pagamento de fatura Cartão de crédito 10000000085 R$ -286,05 R$ 5.514,26',
    '05-11-2026 Pix enviado Ruan Moraes Santos Barbosa 10000000086 R$ -194,00 R$ 5.320,26',
    '06-11-2026 Rendimentos 10000000087 R$ 2,29 R$ 5.322,55',
    '06-11-2026 Pix recebido RUAN MORAES SANTOS BARBOSA 10000000088 R$ 2.068,88 R$ 7.391,43',
    '06-11-2026 Pagamento com Pix UNINTER EDUCACIONAL SA 10000000089 R$ -383,54 R$ 7.007,89',
    'Pagamento com Pix IFOOD',
    '06-11-2026 10000000090 R$ -28,42 R$ 6.979,47',
    'COM AGENCIA DE RESTAURANTES ONLINE S.A. o nosso SAC, ligue para 0800 637 7246. Você precisará de um código de atendimento para nos contatar.',
  ].join('\n');