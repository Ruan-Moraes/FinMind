'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type {
  AccountWithBalance,
  CreditCardWithSummary,
  PortfolioGoalProgress,
} from '@/features/analytics';
import type { ActiveTab, SerializedTransaction, WorkbenchProps } from '@/features/dashboard/types/workbench-types';

export type ActiveWorkbenchModal =
  | {
      type: 'TX';
      editing?: SerializedTransaction | null;
      preset?: { type?: 'EXPENSE' | 'INCOME' | 'TRANSFER'; nature?: 'STATIC' | 'VARIABLE' };
    }
  | { type: 'ACCOUNT'; editing?: AccountWithBalance | null }
  | { type: 'CARD'; editing?: CreditCardWithSummary | null }
  | { type: 'PAY_INVOICE'; card: CreditCardWithSummary }
  | { type: 'GOAL'; editing?: PortfolioGoalProgress | null }
  | { type: 'BUDGET'; categoryId?: string; maxAmountInCents?: number }
  | {
      type: 'STATIC_RULE';
      editing?: WorkbenchProps['recurrenceRules'][number] | null;
      presetType?: 'INCOME' | 'EXPENSE';
    }
  | {
      type: 'CATEGORY';
      editing?: WorkbenchProps['categories'][number] | null;
      presetType?: 'INCOME' | 'EXPENSE';
    }
  | { type: 'SETTINGS' }
  | { type: 'RESET' }
  | null;

export interface PendingDeleteState {
  title: string;
  entityName: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => Promise<unknown> | void;
}

export interface PreviewAttachmentState {
  fileName: string;
  mimeType: string;
  fileDataUrl: string;
}

/**
 * Estado global enxuto do Workbench (apenas navegação, preferências, modal ativo e filtros).
 * Os estados internos de cada formulário vivem isolados dentro de seus respectivos modais (SRP/ISP).
 */
export function useWorkbenchState(props: WorkbenchProps) {
  const { settings } = props;
  const router = useRouter();
  const searchParams = useSearchParams();

  const [activeTab, setActiveTab] = React.useState<ActiveTab>('overview');
  const [hideValues, setHideValues] = React.useState<boolean>(settings.hideValuesByDefault);
  const [theme, setTheme] = React.useState<'LIGHT' | 'DARK' | 'SYSTEM'>(
    (settings.theme as 'LIGHT' | 'DARK' | 'SYSTEM') || 'DARK'
  );
  const [density, setDensity] = React.useState<'COMFORTABLE' | 'COMPACT'>(
    (settings.density as 'COMFORTABLE' | 'COMPACT') || 'COMFORTABLE'
  );

  React.useEffect(() => {
    setHideValues(settings.hideValuesByDefault);
  }, [settings.hideValuesByDefault]);

  React.useEffect(() => {
    setTheme((settings.theme as 'LIGHT' | 'DARK' | 'SYSTEM') || 'DARK');
  }, [settings.theme]);

  React.useEffect(() => {
    setDensity((settings.density as 'COMFORTABLE' | 'COMPACT') || 'COMFORTABLE');
  }, [settings.density]);

  const [activeModal, setActiveModal] = React.useState<ActiveWorkbenchModal>(null);
  const [previewAttachment, setPreviewAttachment] = React.useState<PreviewAttachmentState | null>(
    null
  );
  const [pendingDelete, setPendingDelete] = React.useState<PendingDeleteState | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const [searchQuery, setSearchQuery] = React.useState('');
  const [filterType, setFilterType] = React.useState<string>('ALL');
  const [filterNature, setFilterNature] = React.useState<string>('ALL');
  const [filterCategoryId, setFilterCategoryId] = React.useState<string>('ALL');

  React.useEffect(() => {
    const root = document.documentElement;
    if (theme === 'DARK') {
      root.classList.add('dark');
    } else if (theme === 'LIGHT') {
      root.classList.remove('dark');
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.toggle('dark', prefersDark);
    }
  }, [theme]);

  const handleConfirmPendingDelete = async () => {
    if (!pendingDelete) return;
    setIsDeleting(true);
    try {
      await pendingDelete.onConfirm();
      setPendingDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  return {
    router,
    searchParams,
    activeTab, setActiveTab,
    hideValues, setHideValues,
    theme, setTheme,
    density, setDensity,
    activeModal, setActiveModal,
    closeModal: () => setActiveModal(null),
    previewAttachment, setPreviewAttachment,
    pendingDelete, setPendingDelete,
    isDeleting, handleConfirmPendingDelete,
    searchQuery, setSearchQuery,
    filterType, setFilterType,
    filterNature, setFilterNature,
    filterCategoryId, setFilterCategoryId,
  };
}
