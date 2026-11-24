import { type ReconciledStatementItem } from '@/features/reconciliation/engine';

export interface ConfirmImportBatchPayload {
  targetType: 'ACCOUNT' | 'CREDIT_CARD';
  sourceAccountId?: string;
  destinationAccountId?: string;
  creditCardId?: string;
  calibrateBalanceFromStatement?: boolean;
  files: Array<{
    fileId: string;
    fileName: string;
    fileFormat: string;
    bankName: string;
    periodStart: string | null;
    periodEnd: string | null;
    fileHash: string;
    extractedCount: number;
    status: 'PROCESSED' | 'ERROR';
    openingBalanceInCents?: number | null;
    closingBalanceInCents?: number | null;
  }>;
  items: ReconciledStatementItem[];
}


export interface BatchRollbackSnapshot {
  createdAccountId?: string | null;
  updatedAccountBalances?: Array<{
    id: string;
    previousInitialBalanceInCents: number;
  }>;
  updatedTransactions: Array<{
    id: string;
    previousStatus: string;
    previousAmountInCents: number;
    previousDate: string;
    previousDescription: string;
    previousCategoryId: string | null;
    previousSourceAccountId: string | null;
    previousImportBatchId: string | null;
    previousImportFileId: string | null;
    previousExternalHash: string | null;
    previousRawBankDescription: string | null;
    previousFinancialAction: string | null;
  }>;
  updatedInvoices: Array<{
    id: string;
    previousStatus: string;
    previousPaidAmountInCents: number;
    previousPaidAt: string | null;
  }>;
}

