import { prisma } from '@/shared/lib/prisma';
import { getMonthDateRange } from '@/features/analytics/domain/fiscal-calendar';

export interface ExportTransactionRow {
  date: Date | string;
  description: string;
  type: string;
  nature: string;
  categoryName: string | null;
  accountName: string | null;
  creditCardName: string | null;
  amountInCents: number;
  status: string;
  installmentNumber: number | null;
  totalInstallments: number | null;
  tags: string | null;
}

const FORMULA_INJECTION_PREFIX = /^[=+@\t\r]/;

/**
 * Escapa célula CSV (RFC 4180) com delimitador ';' e proteção contra Formula Injection.
 */
export function escapeCsvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  let str = String(value);
  if (FORMULA_INJECTION_PREFIX.test(str)) {
    str = `'${str}`;
  }
  if (/[;"\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function formatDatePtBr(input: Date | string): string {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return '';
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = d.getUTCFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function formatCentsPtBrPlain(cents: number, type: string): string {
  const signed = type === 'EXPENSE' ? -Math.abs(cents) : Math.abs(cents);
  return (signed / 100).toFixed(2).replace('.', ',');
}

/**
 * Serializa lançamentos em CSV UTF-8 com BOM (compatível com Excel/Numbers em pt-BR).
 */
export function buildTransactionsCsv(rows: ExportTransactionRow[]): string {
  const header = [
    'Data',
    'Descrição',
    'Tipo',
    'Natureza',
    'Categoria',
    'Conta',
    'Cartão',
    'Valor (BRL)',
    'Status',
    'Parcela',
    'Tags',
  ].join(';');

  const lines = rows.map((row) => {
    const installmentLabel =
      row.installmentNumber && row.totalInstallments
        ? `${row.installmentNumber}/${row.totalInstallments}`
        : '';

    return [
      escapeCsvCell(formatDatePtBr(row.date)),
      escapeCsvCell(row.description),
      escapeCsvCell(row.type),
      escapeCsvCell(row.nature),
      escapeCsvCell(row.categoryName || 'Sem Categoria'),
      escapeCsvCell(row.accountName || ''),
      escapeCsvCell(row.creditCardName || ''),
      escapeCsvCell(formatCentsPtBrPlain(row.amountInCents, row.type)),
      escapeCsvCell(row.status),
      escapeCsvCell(installmentLabel),
      escapeCsvCell(row.tags || ''),
    ].join(';');
  });

  return `\uFEFF${[header, ...lines].join('\r\n')}\r\n`;
}

export async function buildUserTransactionsCsv(
  userId: string,
  options?: { month?: number; year?: number }
): Promise<{ csv: string; filename: string; count: number }> {
  const settings = await prisma.userSettings.findUnique({
    where: { userId },
    select: { fiscalMonthStartDay: true },
  });

  const hasPeriod =
    options?.month &&
    options?.year &&
    options.month >= 1 &&
    options.month <= 12 &&
    options.year >= 2000 &&
    options.year <= 2100;

  const dateFilter = hasPeriod
    ? (() => {
        const range = getMonthDateRange(
          options.month!,
          options.year!,
          settings?.fiscalMonthStartDay ?? 1
        );
        return { gte: range.start, lte: range.end };
      })()
    : undefined;

  const transactions = await prisma.transaction.findMany({
    where: {
      userId,
      ...(dateFilter ? { date: dateFilter } : {}),
    },
    include: {
      category: { select: { name: true } },
      sourceAccount: { select: { name: true } },
      creditCard: { select: { name: true } },
      installmentGroup: { select: { totalInstallments: true } },
    },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
  });

  const rows: ExportTransactionRow[] = transactions.map((tx) => ({
    date: tx.date,
    description: tx.description,
    type: tx.type,
    nature: tx.nature,
    categoryName: tx.category?.name ?? null,
    accountName: tx.sourceAccount?.name ?? null,
    creditCardName: tx.creditCard?.name ?? null,
    amountInCents: tx.amountInCents,
    status: tx.status,
    installmentNumber: tx.installmentNumber,
    totalInstallments: tx.installmentGroup?.totalInstallments ?? null,
    tags: tx.tags,
  }));

  const periodTag = hasPeriod
    ? `${options.year}-${String(options.month).padStart(2, '0')}`
    : new Date().toISOString().slice(0, 10);

  return {
    csv: buildTransactionsCsv(rows),
    filename: `finmind-extrato-${periodTag}.csv`,
    count: rows.length,
  };
}

export async function buildUserFinancialBackup(userId: string) {
  const [
    user,
    settings,
    accounts,
    creditCards,
    categories,
    transactions,
    installmentGroups,
    recurrenceRules,
    budgets,
    portfolioGoals,
  ] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, createdAt: true },
    }),
    prisma.userSettings.findUnique({
      where: { userId },
      select: {
        theme: true,
        density: true,
        hideValuesByDefault: true,
        fiscalMonthStartDay: true,
        defaultAccountId: true,
        aiProvider: true,
        aiConnectionMode: true,
        openaiModel: true,
        geminiModel: true,
        claudeModel: true,
      },
    }),
    prisma.account.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
    prisma.creditCard.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
    prisma.category.findMany({ where: { userId }, orderBy: { name: 'asc' } }),
    prisma.transaction.findMany({ where: { userId }, orderBy: { date: 'desc' } }),
    prisma.installmentGroup.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
    prisma.recurrenceRule.findMany({ where: { userId }, orderBy: { dayOfMonth: 'asc' } }),
    prisma.budget.findMany({ where: { userId }, orderBy: [{ year: 'desc' }, { month: 'desc' }] }),
    prisma.portfolioGoal.findMany({
      where: { userId },
      orderBy: [{ targetYear: 'asc' }, { targetMonth: 'asc' }],
    }),
  ]);

  const dateTag = new Date().toISOString().slice(0, 10);

  return {
    filename: `finmind-backup-${dateTag}.json`,
    payload: {
      schemaVersion: '1.0',
      exportedAt: new Date().toISOString(),
      user,
      settings,
      summary: {
        accounts: accounts.length,
        creditCards: creditCards.length,
        categories: categories.length,
        transactions: transactions.length,
        installmentGroups: installmentGroups.length,
        recurrenceRules: recurrenceRules.length,
        budgets: budgets.length,
        portfolioGoals: portfolioGoals.length,
      },
      data: {
        accounts,
        creditCards,
        categories,
        transactions,
        installmentGroups,
        recurrenceRules,
        budgets,
        portfolioGoals,
      },
    },
  };
}
