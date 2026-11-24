export interface PlannedInstallmentParcel {
  installmentNumber: number;
  totalInstallments: number;
  amountInCents: number;
  date: Date;
  invoiceMonth: number;
  invoiceYear: number;
  description: string;
}

/**
 * Resolve o período de fatura (mês/ano) de uma compra no cartão de crédito com base no dia de fechamento (RN-01).
 * Compras feitas no dia de fechamento ou após caem na fatura do mês seguinte.
 */
export function resolveCreditCardInvoicePeriod(
  txDate: Date,
  closingDay: number
): { month: number; year: number } {
  const safeClosingDay = Math.min(31, Math.max(1, Math.trunc(closingDay) || 25));
  const purchaseDay = txDate.getDate();
  let baseMonth = txDate.getMonth() + 1;
  let baseYear = txDate.getFullYear();

  if (purchaseDay >= safeClosingDay) {
    baseMonth += 1;
    if (baseMonth > 12) {
      baseMonth = 1;
      baseYear += 1;
    }
  }

  return { month: baseMonth, year: baseYear };
}

/**
 * Gera o plano determinístico de parcelas no cartão de crédito (RN-01),
 * alocando eventuais centavos residuais na primeira parcela.
 */
export function buildInstallmentPlan(params: {
  totalAmountInCents: number;
  totalInstallments: number;
  txDate: Date;
  closingDay: number;
  description: string;
}): PlannedInstallmentParcel[] {
  const totalInstallments = Math.max(1, Math.min(48, Math.trunc(params.totalInstallments || 1)));
  const totalAmountInCents = Math.max(0, Math.trunc(params.totalAmountInCents));
  const baseParcelAmount = Math.floor(totalAmountInCents / totalInstallments);
  const remainderCents = totalAmountInCents - baseParcelAmount * totalInstallments;
  const cleanDesc = params.description.trim();

  const { month: baseMonth, year: baseYear } = resolveCreditCardInvoicePeriod(
    params.txDate,
    params.closingDay
  );

  const parcels: PlannedInstallmentParcel[] = [];
  for (let i = 0; i < totalInstallments; i++) {
    let targetMonth = baseMonth + i;
    let targetYear = baseYear;
    while (targetMonth > 12) {
      targetMonth -= 12;
      targetYear += 1;
    }

    const parcelAmount = i === 0 ? baseParcelAmount + remainderCents : baseParcelAmount;
    const parcelDate =
      i === 0
        ? params.txDate
        : new Date(
            targetYear,
            targetMonth - 1,
            Math.min(28, params.txDate.getDate()),
            12,
            0,
            0
          );

    const desc =
      totalInstallments > 1 ? `${cleanDesc} (${i + 1}/${totalInstallments})` : cleanDesc;

    parcels.push({
      installmentNumber: i + 1,
      totalInstallments,
      amountInCents: parcelAmount,
      date: parcelDate,
      invoiceMonth: targetMonth,
      invoiceYear: targetYear,
      description: desc,
    });
  }

  return parcels;
}

/**
 * Calcula a variação líquida de saldo de uma conta a partir de suas transações liquidadas,
 * e retorna o saldo inicial recalibrado caso um saldo atual alvo seja informado.
 */
export function computeNetAccountMovementsInCents(
  accountId: string,
  transactions: Array<{
    type: string;
    amountInCents: number;
    sourceAccountId: string | null;
    destinationAccountId: string | null;
  }>
): number {
  let netMovementsInCents = 0;
  for (const tx of transactions) {
    if (tx.type === 'INCOME' && tx.sourceAccountId === accountId) {
      netMovementsInCents += tx.amountInCents;
    } else if (tx.type === 'EXPENSE' && tx.sourceAccountId === accountId) {
      netMovementsInCents -= tx.amountInCents;
    } else if (tx.type === 'TRANSFER') {
      if (tx.sourceAccountId === accountId) netMovementsInCents -= tx.amountInCents;
      if (tx.destinationAccountId === accountId) netMovementsInCents += tx.amountInCents;
    }
  }
  return netMovementsInCents;
}

export function recalibrateInitialBalanceInCents(params: {
  desiredCurrentBalanceInCents: number;
  netMovementsInCents: number;
}): number {
  return params.desiredCurrentBalanceInCents - params.netMovementsInCents;
}
