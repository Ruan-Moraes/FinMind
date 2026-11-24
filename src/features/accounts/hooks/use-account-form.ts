'use client';

import * as React from 'react';
import { formatCentsToInput } from '@/shared/lib/currency';
import type { AccountWithBalance } from '@/features/analytics';
import { createAccountAction, updateAccountAction } from '@/features/accounts/actions/accounts.actions';

export function useAccountForm(params: {
  isOpen: boolean;
  editingAccount: AccountWithBalance | null;
  onClose: () => void;
}) {
  const { isOpen, editingAccount, onClose } = params;
  const [accName, setAccName] = React.useState('');
  const [accType, setAccType] = React.useState<'CHECKING' | 'SAVINGS' | 'CASH'>('CHECKING');
  const [accInitial, setAccInitial] = React.useState('0,00');
  const [accTargetCurrent, setAccTargetCurrent] = React.useState('0,00');
  const [accBalanceEditMode, setAccBalanceEditMode] = React.useState<'CURRENT' | 'INITIAL'>('CURRENT');
  const [accColor, setAccColor] = React.useState('#10b981');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!isOpen) return;
    if (editingAccount) {
      setAccName(editingAccount.name);
      setAccType((editingAccount.type as 'CHECKING' | 'SAVINGS' | 'CASH') || 'CHECKING');
      setAccInitial(formatCentsToInput(editingAccount.initialBalanceInCents));
      setAccTargetCurrent(formatCentsToInput(editingAccount.currentBalanceInCents));
      setAccBalanceEditMode('CURRENT');
      setAccColor(editingAccount.color || '#10b981');
    } else {
      setAccName('');
      setAccType('CHECKING');
      setAccInitial('0,00');
      setAccTargetCurrent('0,00');
      setAccBalanceEditMode('CURRENT');
      setAccColor('#10b981');
    }
  }, [isOpen, editingAccount]);

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = editingAccount
        ? await updateAccountAction({
            id: editingAccount.id,
            name: accName,
            type: accType,
            initialBalanceRaw: accBalanceEditMode === 'INITIAL' ? accInitial : undefined,
            targetCurrentBalanceRaw: accBalanceEditMode === 'CURRENT' ? accTargetCurrent : undefined,
            color: accColor,
          })
        : await createAccountAction({
            name: accName,
            type: accType,
            initialBalanceRaw: accInitial,
            color: accColor,
          });
      if (res.ok) onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    editingAccountId: editingAccount?.id || null,
    accName, setAccName, accType, setAccType, accInitial, setAccInitial,
    accTargetCurrent, setAccTargetCurrent, accBalanceEditMode, setAccBalanceEditMode,
    accColor, setAccColor, isSubmitting, handleSaveAccount,
  };
}
