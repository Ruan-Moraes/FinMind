import { prisma } from '@/shared/lib/prisma';
import {
  AccountWithBalance,
  CreditCardWithSummary,
  PortfolioGoalProgress,
} from '@/features/analytics/domain/finance-types';
import {
  computeCurrentNetWorthAndPace,
  computeSingleGoalProjection,
} from '@/features/planning/domain/goal-calculator';
import { resolveEffectiveRulesForMonth } from '@/features/planning/domain/recurrence-month-skip';

/**
 * RN-04: Saldo Atual = Saldo Inicial + Receitas Efetivadas - Despesas Efetivadas +/- Transferências
 */
export async function getAccountsWithBalances(userId: string): Promise<AccountWithBalance[]> {
  const [accounts, transactions] = await Promise.all([
    prisma.account.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.transaction.findMany({
      where: {
        userId,
        status: 'COMPLETED',
        creditCardId: null,
      },
      select: {
        type: true,
        amountInCents: true,
        sourceAccountId: true,
        destinationAccountId: true,
      },
    }),
  ]);

  return accounts.map((acc) => {
    let balance = acc.initialBalanceInCents;

    for (const tx of transactions) {
      if (tx.type === 'INCOME' && tx.sourceAccountId === acc.id) {
        balance += tx.amountInCents;
      } else if (tx.type === 'EXPENSE' && tx.sourceAccountId === acc.id) {
        balance -= tx.amountInCents;
      } else if (tx.type === 'TRANSFER') {
        if (tx.sourceAccountId === acc.id) {
          balance -= tx.amountInCents;
        }
        if (tx.destinationAccountId === acc.id) {
          balance += tx.amountInCents;
        }
      }
    }

    return {
      id: acc.id,
      name: acc.name,
      type: acc.type,
      initialBalanceInCents: acc.initialBalanceInCents,
      currentBalanceInCents: balance,
      color: acc.color,
      isArchived: acc.isArchived,
    };
  });
}

/**
 * RF-03 & RF-04: Resumo de cartões de crédito, faturas abertas e limite disponível.
 */
export async function getCreditCardsWithSummary(
  userId: string,
  month: number,
  year: number
): Promise<CreditCardWithSummary[]> {
  const cards = await prisma.creditCard.findMany({
    where: { userId },
    include: {
      invoices: {
        include: {
          transactions: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  return cards.map((card) => {
    let usedLimitInCents = 0;
    let currentInvoiceInCents = 0;
    let currentInvoiceStatus = 'OPEN';
    let currentInvoiceId: string | undefined;

    for (const inv of card.invoices) {
      const invSum = inv.transactions.reduce((acc, t) => acc + t.amountInCents, 0);
      if (inv.status !== 'PAID') {
        usedLimitInCents += invSum;
      }
      if (inv.month === month && inv.year === year) {
        currentInvoiceInCents = invSum;
        currentInvoiceStatus = inv.status;
        currentInvoiceId = inv.id;
      }
    }

    return {
      id: card.id,
      name: card.name,
      brand: card.brand,
      limitInCents: card.limitInCents,
      usedLimitInCents,
      availableLimitInCents: Math.max(0, card.limitInCents - usedLimitInCents),
      closingDay: card.closingDay,
      dueDay: card.dueDay,
      color: card.color,
      currentInvoiceInCents,
      currentInvoiceStatus,
      currentInvoiceId,
    };
  });
}

/**
 * RF-20, RF-21 & RN-06: Progresso das Metas de Carteira / Patrimônio + Previsão no Ritmo Atual.
 */
export async function getPortfolioGoalsProgress(
  userId: string,
  accounts: AccountWithBalance[],
  cards: CreditCardWithSummary[],
  refMonth?: number,
  refYear?: number
): Promise<PortfolioGoalProgress[]> {
  const [goals, allTransactions, staticRules] = await Promise.all([
    prisma.portfolioGoal.findMany({
      where: { userId },
      orderBy: [{ targetYear: 'asc' }, { targetMonth: 'asc' }],
    }),
    prisma.transaction.findMany({
      where: { userId, status: 'COMPLETED' },
      select: {
        type: true,
        amountInCents: true,
        date: true,
      },
    }),
    prisma.recurrenceRule.findMany({
      where: { userId, isActive: true, nature: 'STATIC' },
    }),
  ]);

  const now = new Date();
  const effectiveMonth = refMonth || now.getMonth() + 1;
  const effectiveYear = refYear || now.getFullYear();
  const activeRulesForMonth = resolveEffectiveRulesForMonth(staticRules, effectiveYear, effectiveMonth);

  const { currentNetWorthInCents, currentMonthlyPaceInCents, currentMonth, currentYear } =
    computeCurrentNetWorthAndPace({
      accounts,
      cards,
      completedTransactions: allTransactions,
      staticRules: activeRulesForMonth,
    });

  return goals.map((goal) =>
    computeSingleGoalProjection({
      goal,
      currentNetWorthInCents,
      currentMonthlyPaceInCents,
      currentMonth,
      currentYear,
    })
  );
}
