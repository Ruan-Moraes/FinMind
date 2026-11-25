import { describe, it, expect } from 'vitest';
import { smartParseStatementLocally } from '@/features/ai-copilot/providers/local-statement-parser';
import {
  extractPeriodFromFileName,
  isNonEffectiveBalanceLine,
  detectFinancialInstitution,
  detectStatementFormat,
} from '@/features/reconciliation/parsers/statement-detectors';
import {
  buildSubscriptionStatementPrompt,
  buildSubscriptionStatusPrompt,
} from '@/features/ai-copilot/providers/copilot-types-and-prompts';
import {
  stripInlinePdfHeaderFooterNoise,
  isPdfNoiseOrHeaderLine,
  stitchMultiLineStatementRows,
} from '@/features/reconciliation/parsers/pdf-text-stitcher';

describe('Parser Local de Extratos em Texto Livre e Utilitários de PDF/Detecção', () => {
  it('smartParseStatementLocally extrai receitas, despesas, assinaturas e ignora cabeçalhos', () => {
    const rawText = [
      'Saldo anterior R$ 1.200,00',
      '05/11/2026 TED RECEBIDA EMPRESA SALARIO +6.500,00',
      '08/11/2026 PIX ENVIADO SUPERMERCADO EXTRA -320,45',
      '10/11/2026 DEBITO AUTOMATICO NETFLIX.COM -55,90',
      '12/11/2026 COMPRA CARTAO UBER *TRIP -28,50',
      'Saldo disponível R$ 7.295,15',
    ].join('\n');

    const categories = [
      { id: 'c-sal', name: 'Salário & Remuneração', type: 'INCOME', defaultNature: 'STATIC' },
      { id: 'c-mkt', name: 'Supermercado', type: 'EXPENSE', defaultNature: 'VARIABLE' },
      { id: 'c-sub', name: 'Assinaturas & Serviços Digitais', type: 'EXPENSE', defaultNature: 'STATIC' },
      { id: 'c-trp', name: 'Transporte & Mobilidade', type: 'EXPENSE', defaultNature: 'VARIABLE' },
    ];

    const items = smartParseStatementLocally(rawText, categories);
    expect(items.length).toBeGreaterThanOrEqual(4);

    const salary = items.find((i) => i.type === 'INCOME');
    expect(salary?.amountInCents).toBe(650000);
    expect(salary?.categoryId).toBe('c-sal');

    const netflix = items.find((i) => i.description.toLowerCase().includes('netflix'));
    expect(netflix?.amountInCents).toBe(5590);
    expect(netflix?.nature).toBe('STATIC');

    const uber = items.find((i) => i.description.toLowerCase().includes('uber'));
    expect(uber?.amountInCents).toBe(2850);
  });

  it('detecta períodos em nomes de arquivo, linhas de saldo não efetivas e limpa ruído de PDF', () => {
    expect(extractPeriodFromFileName('extrato-2026-11.pdf').fallbackYear).toBe(2026);
    expect(extractPeriodFromFileName('extrato-01-03-2026-a-31-03-2026.csv').fallbackYear).toBe(2026);
    expect(extractPeriodFromFileName('sem-data.txt').periodStart).toBeNull();

    expect(isNonEffectiveBalanceLine('SALDO ANTERIOR')).toBe(true);
    expect(isNonEffectiveBalanceLine('SALDO DO DIA')).toBe(true);
    expect(isNonEffectiveBalanceLine('PIX ENVIADO MERCADO')).toBe(false);

    expect(isPdfNoiseOrHeaderLine('Página 1 de 3')).toBe(true);
    expect(isPdfNoiseOrHeaderLine('DETALHE DOS MOVIMENTOS')).toBe(true);
    expect(isPdfNoiseOrHeaderLine('10/11/2026 PIX ENVIADO PADARIA -25,00')).toBe(false);

    const cleaned = stripInlinePdfHeaderFooterNoise(
      'Data Descrição Valor Saldo 10/11/2026 Compra Padaria -25,00 Encontre nossos canais de consulta'
    );
    expect(cleaned).toContain('Compra Padaria');
    expect(cleaned).not.toContain('Encontre nossos canais');

    const stitched = stitchMultiLineStatementRows([
      '10/11/2026',
      'Transferência Pix recebida',
      'R$ 450,00',
      '11/11/2026 Pagamento Boleto Energia -180,00',
    ]);
    expect(stitched.length).toBeGreaterThanOrEqual(2);
    expect(stitched[0]).toContain('450,00');

    // Cobertura de detecção multi-banco e formatos
    expect(detectFinancialInstitution('itau.csv', 'BANCO ITAU UNIBANCO')).toContain('Itaú');
    expect(detectFinancialInstitution('bradesco.csv', 'BANCO BRADESCO S.A.')).toContain('Bradesco');
    expect(detectFinancialInstitution('santander.csv', 'SANTANDER BRASIL')).toContain('Santander');
    expect(detectFinancialInstitution('inter.csv', 'BANCO INTER S.A.')).toContain('Inter');
    expect(detectFinancialInstitution('bb.csv', 'BANCO DO BRASIL')).toContain('Banco do Brasil');
    expect(detectFinancialInstitution('caixa.csv', 'CAIXA ECONOMICA FEDERAL')).toContain('Caixa');
    expect(detectFinancialInstitution('c6.csv', 'BANCO C6 S.A.')).toContain('C6');
    expect(detectFinancialInstitution('btg.csv', 'BTG PACTUAL')).toContain('BTG');
    expect(detectFinancialInstitution('picpay.csv', 'PICPAY SERVICOS')).toContain('PicPay');
    expect(detectFinancialInstitution('generico.txt', 'EXTRATO SIMPLES')).toBeTruthy();

    expect(detectStatementFormat('dados.txt', '<OFX><BANKMSGSRSV1>')).toBe('OFX');
    expect(detectStatementFormat('dados.txt', 'Data;Descricao;Valor\n10/11/2026;Cafe;-10,00')).toBe('CSV');
    expect(detectStatementFormat('dados.txt', 'Texto livre simples')).toBe('TXT');
  });

  it('gera prompts estruturados para assinatura de extrato e diagnóstico', () => {
    const stmtPrompt = buildSubscriptionStatementPrompt(
      '10/11/2026 Pix Padaria -20,00',
      [
        { id: 'c1', name: 'Alimentação', type: 'EXPENSE', defaultNature: 'VARIABLE' },
        { id: 'c2', name: 'Moradia', type: 'EXPENSE', defaultNature: 'STATIC' },
      ]
    );
    expect(stmtPrompt).toContain('Alimentação');

    const statusPrompt = buildSubscriptionStatusPrompt({
      consolidatedBalanceInCents: 500000,
      staticIncomeInCents: 600000,
      staticExpenseInCents: 200000,
      freeIncomeInCents: 400000,
      monthIncomeInCents: 600000,
      monthExpenseInCents: 300000,
      championCategoryName: 'Moradia',
      championCategoryAmountInCents: 200000,
      momDiffInCents: 15000,
      momVariationPercent: 5,
    });
    expect(statusPrompt).toContain('Moradia');
  });
});
