import { describe, it, expect } from 'vitest';
import {
  resolveCreditCardInvoicePeriod,
  buildInstallmentPlan,
  computeNetAccountMovementsInCents,
  recalibrateInitialBalanceInCents,
} from '@/features/credit-cards/domain/installment-builder';
import {
  computeDeterministicHash,
  detectStatementFormat,
  detectFinancialInstitution,
} from '@/features/reconciliation/parsers/statement-detectors';
import {
  parseDeterministicDate,
  parseDeterministicMonetaryAmount,
  parseSignedMoneyTokenToCents,
} from '@/features/reconciliation/parsers/statement-value-normalizers';

describe('Parcelamento em Cartão de Crédito, Ciclo de Fatura e Recalibração de Saldo', () => {
  it('resolveCreditCardInvoicePeriod aloca compras antes do fechamento no próprio mês e no/após fechamento no mês seguinte (incluindo virada Dez -> Jan)', () => {
    const beforeClose = new Date(2026, 2, 10, 12, 0, 0); // 10/03/2026
    expect(resolveCreditCardInvoicePeriod(beforeClose, 25)).toEqual({
      month: 3,
      year: 2026,
    });

    const onClose = new Date(2026, 2, 25, 12, 0, 0); // 25/03/2026
    expect(resolveCreditCardInvoicePeriod(onClose, 25)).toEqual({
      month: 4,
      year: 2026,
    });

    const decemberAfterClose = new Date(2026, 11, 28, 12, 0, 0); // 28/12/2026
    expect(resolveCreditCardInvoicePeriod(decemberAfterClose, 20)).toEqual({
      month: 1,
      year: 2027,
    });
  });

  it('buildInstallmentPlan divide centavos residuais na 1ª parcela e avança faturas mês a mês', () => {
    const txDate = new Date(2026, 10, 26, 12, 0, 0); // 26/11/2026, closingDay = 25 -> 1ª fatura em 12/2026
    const parcels = buildInstallmentPlan({
      totalAmountInCents: 10000,
      totalInstallments: 3,
      txDate,
      closingDay: 25,
      description: 'Notebook Dell',
    });

    expect(parcels).toHaveLength(3);
    expect(parcels[0].amountInCents).toBe(3334);
    expect(parcels[1].amountInCents).toBe(3333);
    expect(parcels[2].amountInCents).toBe(3333);
    expect(parcels.reduce((acc, p) => acc + p.amountInCents, 0)).toBe(10000);

    expect(parcels[0].description).toBe('Notebook Dell (1/3)');
    expect(parcels[0].invoiceMonth).toBe(12);
    expect(parcels[0].invoiceYear).toBe(2026);

    expect(parcels[1].description).toBe('Notebook Dell (2/3)');
    expect(parcels[1].invoiceMonth).toBe(1);
    expect(parcels[1].invoiceYear).toBe(2027);

    expect(parcels[2].description).toBe('Notebook Dell (3/3)');
    expect(parcels[2].invoiceMonth).toBe(2);
    expect(parcels[2].invoiceYear).toBe(2027);
  });

  it('computeNetAccountMovementsInCents e recalibrateInitialBalanceInCents calculam ajuste exato de saldo consolidado', () => {
    const accountId = 'acc-main';
    const net = computeNetAccountMovementsInCents(accountId, [
      {
        type: 'INCOME',
        amountInCents: 500000,
        sourceAccountId: accountId,
        destinationAccountId: null,
      },
      {
        type: 'EXPENSE',
        amountInCents: 120000,
        sourceAccountId: accountId,
        destinationAccountId: null,
      },
      {
        type: 'TRANSFER',
        amountInCents: 80000,
        sourceAccountId: accountId,
        destinationAccountId: 'acc-savings',
      },
      {
        type: 'TRANSFER',
        amountInCents: 30000,
        sourceAccountId: 'acc-savings',
        destinationAccountId: accountId,
      },
    ]);

    expect(net).toBe(330000);

    const newInitial = recalibrateInitialBalanceInCents({
      desiredCurrentBalanceInCents: 500000,
      netMovementsInCents: net,
    });
    expect(newInitial).toBe(170000);
  });

  it('normalizadores de datas, moedas, formatos e hashes determinísticos funcionam em casos de borda', () => {
    expect(parseDeterministicDate('05/03/2026')).toBe('2026-03-05');
    expect(parseDeterministicDate('2026-03-05')).toBe('2026-03-05');
    expect(parseDeterministicDate('20260305120000[-3:BRT]')).toBe('2026-03-05');
    expect(parseDeterministicDate('15 mar 2026')).toBe('2026-03-15');

    expect(parseDeterministicMonetaryAmount('R$ -1.450,75')).toEqual({
      amountInCents: 145075,
      direction: 'OUTFLOW',
      hasExplicitSign: true,
    });
    expect(parseDeterministicMonetaryAmount('250,00 D')).toEqual({
      amountInCents: 25000,
      direction: 'OUTFLOW',
      hasExplicitSign: true,
    });
    expect(parseSignedMoneyTokenToCents('-R$ 89,90')).toBe(-8990);

    expect(detectStatementFormat('fatura.ofx', '')).toBe('OFX');
    expect(detectStatementFormat('planilha.xlsx', '')).toBe('XLSX');
    expect(detectStatementFormat('extrato.pdf', '')).toBe('PDF');
    expect(detectFinancialInstitution('mercadopago.pdf', 'MERCADO PAGO IP LTDA')).toBe(
      'Mercado Pago'
    );
    expect(detectFinancialInstitution('nubank.csv', 'NU PAGAMENTOS S.A.')).toBe('Nubank');

    const h1 = computeDeterministicHash('2026-03-05|4590|UBER');
    const h2 = computeDeterministicHash('2026-03-05|4590|UBER');
    expect(h1).toBe(h2);
  });
});
