import { describe, it, expect } from 'vitest';
import {
  detectStatementFormat,
  detectFinancialInstitution,
  parseDeterministicDate,
  parseDeterministicMonetaryAmount,
  parseStatementFile,
} from '@/features/reconciliation/parsers';
import { runIntelligentReconciliationPipeline } from '@/features/reconciliation/engine';
import {
  buildRealBinaryMercadoPagoPdfBase64,
  buildSyntheticInterXlsxBase64,
  MP_SEPT_LINES,
  MP_OCT_LINES,
  MP_NOV_LINES,
  TEST_CATEGORIES,
  TEST_RECURRENCE_RULES,
} from '../helpers/statement-fixtures';

describe('Camada 3 — Parsers Determinísticos de Extratos (CSV, OFX, XLSX, PDF e Mercado Pago)', () => {
  it('detecta formatos, bancos, datas e valores monetários brasileiros com precisão', () => {
    expect(detectStatementFormat('fatura.ofx', '<OFX>')).toBe('OFX');
    expect(detectStatementFormat('extrato.pdf', '%PDF-1.4')).toBe('PDF');
    expect(detectStatementFormat('planilha.xlsx', 'PK\x03\x04')).toBe('XLSX');
    expect(detectFinancialInstitution('Extrato_de_conta_2026-09-01_2026-09-30.pdf', '')).toBe('Mercado Pago');
    expect(detectFinancialInstitution('nubank.csv', 'Nu Pagamentos')).toBe('Nubank');

    expect(parseDeterministicDate('10/11/2026')).toBe('2026-11-10');
    expect(parseDeterministicDate('202611120000')).toBe('2026-11-12');
    expect(parseDeterministicDate('14 de set de 2026')).toBe('2026-09-14');

    const negAmt = parseDeterministicMonetaryAmount('R$ -1.200,00');
    expect(negAmt?.amountInCents).toBe(120000);
    expect(negAmt?.direction).toBe('OUTFLOW');
  });

  it('extrai e concilia PDF binário real do Mercado Pago e planilha XLSX binária do Banco Inter', async () => {
    const mpPdfBase64 = buildRealBinaryMercadoPagoPdfBase64();
    const xlsxBase64 = buildSyntheticInterXlsxBase64();

    const mpPlan = await runIntelligentReconciliationPipeline({
      files: [
        {
          fileId: 'f-mp-pdf',
          fileName: 'Extrato_de_conta_2026-09-01_2026-09-30.pdf',
          content: mpPdfBase64,
          isBase64: true,
        },
        {
          fileId: 'f-inter-xlsx',
          fileName: 'extrato-inter-2026-09.xlsx',
          content: xlsxBase64,
          isBase64: true,
        },
      ],
      categories: TEST_CATEGORIES,
      recurrenceRules: TEST_RECURRENCE_RULES,
      existingTransactions: [],
    });

    expect(mpPlan.files[0].status).toBe('PROCESSED');
    expect(mpPlan.files[0].bankName).toBe('Mercado Pago');
    expect(mpPlan.files[0].extractedCount).toBe(4);
    expect(mpPlan.files[1].status).toBe('PROCESSED');
    expect(mpPlan.files[1].extractedCount).toBe(1);

    const mpAluguel = mpPlan.items.find((i) => i.matchedRuleId === 'rule-aluguel');
    expect(mpAluguel?.amountInCents).toBe(120000);
    expect(mpAluguel?.direction).toBe('OUTFLOW');
  });

  it('Cenário 21: valida consistência matemática das 90 movimentações dos 3 extratos Mercado Pago (Saldo Final R$ 6.979,47)', async () => {
    const mp3FilesPlan = await runIntelligentReconciliationPipeline({
      files: [
        { fileId: 'mp-2026-09', fileName: 'Extrato_de_conta_2026-09-01_2026-09-30.pdf', content: MP_SEPT_LINES },
        { fileId: 'mp-2026-10', fileName: 'Extrato_de_conta_2026-10-01_2026-10-31.pdf', content: MP_OCT_LINES },
        { fileId: 'mp-2026-11', fileName: 'Extrato_de_conta_2026-11-01_2026-11-06.pdf', content: MP_NOV_LINES },
      ],
      categories: TEST_CATEGORIES,
      recurrenceRules: [],
      existingTransactions: [],
    });

    expect(mp3FilesPlan.files[0].extractedCount).toBe(40);
    expect(mp3FilesPlan.files[0].openingBalanceInCents).toBe(345184);
    expect(mp3FilesPlan.files[0].closingBalanceInCents).toBe(444579);

    expect(mp3FilesPlan.files[1].extractedCount).toBe(38);
    expect(mp3FilesPlan.files[1].closingBalanceInCents).toBe(520826);

    expect(mp3FilesPlan.files[2].extractedCount).toBe(12);
    expect(mp3FilesPlan.files[2].closingBalanceInCents).toBe(697947);
    expect(mp3FilesPlan.items).toHaveLength(90);

    const totalInflows = mp3FilesPlan.items
      .filter((i) => i.direction === 'INFLOW')
      .reduce((acc, i) => acc + i.amountInCents, 0);
    const totalOutflows = mp3FilesPlan.items
      .filter((i) => i.direction === 'OUTFLOW')
      .reduce((acc, i) => acc + i.amountInCents, 0);

    expect(totalInflows).toBe(1037147);
    expect(totalOutflows).toBe(684384);
    expect((mp3FilesPlan.files[0].openingBalanceInCents ?? 0) + totalInflows - totalOutflows).toBe(697947);
  });

  it('isola arquivos vazios ou acima do limite sem lançar exceções não tratadas', async () => {
    const emptyRes = await parseStatementFile({ fileId: 'e1', fileName: 'vazio.csv', content: '   ' });
    expect(emptyRes.status).toBe('ERROR');
  });
});
