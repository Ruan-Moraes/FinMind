import type { SerializedAiReport, SerializedImportBatch } from '@/features/ai-copilot/components/ai-financial-hub';
import type {
  SerializedBalanceTargetCheck,
  SerializedValueForecastItem,
} from '@/features/planning/domain/value-forecast-calculator';
import type { HolidayRecord } from '@/features/planning/domain/business-days';
import type { SsoSessionPayload } from '@/features/auth/sso';
import type { AiProviderId, AiConnectionMode } from '@/features/ai-copilot/providers';
import type {
  AccountWithBalance,
  CreditCardWithSummary,
  PortfolioGoalProgress,
  StaticBaselineSummary,
  MonthSummaryData,
  MoMComparisonReport,
} from '@/features/analytics';

export interface SerializedTransaction {
  id: string;
  type: string;
  nature: string;
  amountInCents: number;
  date: string;
  description: string;
  status: string;
  tags: string;
  sourceAccountId: string | null;
  sourceAccountName: string | null;
  destinationAccountId: string | null;
  destinationAccountName: string | null;
  creditCardId: string | null;
  creditCardName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  categoryIcon?: string | null;
  installmentGroupId: string | null;
  installmentNumber: number | null;
  totalInstallments: number | null;
  importBatchId?: string | null;
  rawBankDescription?: string | null;
  financialAction?: string | null;
  counterparty?: string | null;
  paymentMethod?: string | null;
  purpose?: string | null;
  aiConfidenceScore?: number | null;
  aiConfidenceLevel?: string | null;
  isAiClassified?: boolean;
  isUserConfirmed?: boolean;
  attachments: Array<{
    id: string;
    fileName: string;
    mimeType: string;
    sizeInBytes: number;
    fileDataUrl: string;
  }>;
}

export interface WorkbenchProps {
  user: {
    id: string;
    name: string;
    email: string;
  };
  settings: {
    theme: string;
    density: string;
    hideValuesByDefault: boolean;
    fiscalMonthStartDay: number;
    defaultAccountId: string | null;
    holidayState?: string | null;
    holidayCity?: string | null;
    aiProvider: AiProviderId;
    aiConnectionMode: AiConnectionMode;
    openaiApiKey: string;
    geminiApiKey: string;
    claudeApiKey: string;
    openaiModel: string;
    geminiModel: string;
    claudeModel: string;
  };
  ssoState: {
    authenticated: boolean;
    session: SsoSessionPayload | null;
  };
  activeHeaderModelId: string;
  aiReports: SerializedAiReport[];
  selectedMonth: number;
  selectedYear: number;
  compareMonthA: number;
  compareYearA: number;
  compareMonthB: number;
  compareYearB: number;
  accounts: AccountWithBalance[];
  creditCards: CreditCardWithSummary[];
  categories: Array<{
    id: string;
    name: string;
    type: string;
    defaultNature: string;
    color: string;
    icon?: string;
  }>;
  portfolioGoals: PortfolioGoalProgress[];
  staticBaseline: StaticBaselineSummary;
  monthSummary: MonthSummaryData;
  momComparison: MoMComparisonReport;
  sixMonthsHistory: Array<{
    label: string;
    month: number;
    year: number;
    receitas: number;
    despesas: number;
    estaticos: number;
    variaveis: number;
    saldo: number;
  }>;
  budgets: Array<{
    id: string;
    categoryId: string;
    categoryName: string;
    categoryColor: string;
    categoryIcon?: string;
    maxAmountInCents: number;
    spentInCents: number;
    percent: number;
  }>;
  recurrenceRules: Array<{
    id: string;
    description: string;
    type: string;
    nature: string;
    amountInCents: number;
    dayOfMonth: number;
    dayType?: string;
    includeSaturday?: boolean;
    skippedMonths?: string[];
    monthlyOverrides?: Record<string, number>;
    categoryId: string | null;
    categoryName: string | null;
    categoryColor?: string | null;
    categoryIcon?: string | null;
    accountId: string | null;
    accountName: string | null;
  }>;
  transactions: SerializedTransaction[];
  importBatches?: SerializedImportBatch[];
  valueForecastItems?: SerializedValueForecastItem[];
  balanceTargetChecks?: SerializedBalanceTargetCheck[];
  holidays?: HolidayRecord[];
}


export type ActiveTab =
  | 'overview'
  | 'ai'
  | 'comparison'
  | 'goals'
  | 'forecast'
  | 'accounts'
  | 'transactions';
