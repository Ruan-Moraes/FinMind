'use client';

import * as React from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  HelpCircle,
  Link2,
  CheckCircle2,
  ArrowLeftRight,
  Layers,
  Plus,
} from 'lucide-react';
import { Badge } from '@/shared/ui/badge';
import type { ReconciledStatementItem } from '@/features/reconciliation/engine';

export {
  type ReviewFilterTab,
  type QueuedFileItem,
  getCurrentSelectLinkValue,
  applyReconciliationLinkSelection,
  computeDerivedReconciliationStats,
} from '@/features/reconciliation/engine/reconciliation-ui-state';

export const getConfidenceBadge = (
  level: ReconciledStatementItem['confidenceLevel'],
  score: number
) => {
  if (level === 'HIGH') {
    return (
      <Badge variant="income" className="gap-1">
        <ShieldCheck className="h-3 w-3" /> Alta ({score}%)
      </Badge>
    );
  }
  if (level === 'MEDIUM') {
    return (
      <Badge variant="warning" className="gap-1">
        <AlertTriangle className="h-3 w-3" /> Média ({score}%)
      </Badge>
    );
  }
  return (
    <Badge variant="expense" className="gap-1">
      <HelpCircle className="h-3 w-3" /> Baixa ({score}%)
    </Badge>
  );
};

export const getDecisionBadge = (item: ReconciledStatementItem) => {
  switch (item.decisionType) {
    case 'RECONCILE_RULE':
      return (
        <Badge variant="transfer" className="gap-1">
          <Link2 className="h-3 w-3" /> Conciliação Fixa / Recorrente
        </Badge>
      );
    case 'RECONCILE_TRANSACTION':
      return (
        <Badge variant="transfer" className="gap-1">
          <Link2 className="h-3 w-3" /> Conciliação Lançamento Previsto
        </Badge>
      );
    case 'PAY_CREDIT_CARD_INVOICE':
      return (
        <Badge variant="static" className="gap-1">
          <CheckCircle2 className="h-3 w-3" /> Quitação de Fatura
        </Badge>
      );
    case 'RECORD_SELF_TRANSFER':
      return (
        <Badge variant="neutral" className="gap-1">
          <ArrowLeftRight className="h-3 w-3" /> Transferência Própria
        </Badge>
      );
    case 'SKIP_DUPLICATE':
      return (
        <Badge variant="neutral" className="gap-1 opacity-75">
          <Layers className="h-3 w-3" /> Duplicada (Ignorada)
        </Badge>
      );
    case 'NEEDS_MANUAL_REVIEW':
      return (
        <Badge variant="warning" className="gap-1">
          <AlertTriangle className="h-3 w-3" /> Revisão Manual
        </Badge>
      );
    default:
      return (
        <Badge variant={item.type === 'INCOME' ? 'income' : 'expense'} className="gap-1">
          <Plus className="h-3 w-3" /> Novo Lançamento
        </Badge>
      );
  }
};
