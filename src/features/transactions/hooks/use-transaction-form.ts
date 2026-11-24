'use client';

import * as React from 'react';
import { formatCentsToInput } from '@/shared/lib/currency';
import { createTransactionAction } from '@/features/transactions/actions/transactions-create.actions';
import { updateTransactionAction } from '@/features/transactions/actions/transactions-manage.actions';
import type {
  SerializedTransaction,
  WorkbenchProps,
} from '@/features/dashboard/types/workbench-types';

interface TransactionFormValues {
  type: 'EXPENSE' | 'INCOME' | 'TRANSFER';
  nature: 'STATIC' | 'VARIABLE';
  paymentTarget: 'ACCOUNT' | 'CREDIT_CARD';
  amount: string;
  desc: string;
  date: string;
  status: 'COMPLETED' | 'PENDING';
  sourceAccount: string;
  destAccount: string;
  cardId: string;
  categoryId: string;
  installments: number;
  tags: string;
}

interface AttachmentDraft {
  fileName: string;
  mimeType: string;
  sizeInBytes: number;
  fileDataUrl: string;
}

function buildInitialFormValues(
  props: WorkbenchProps,
  editingTx: SerializedTransaction | null,
  preset?: { type?: 'EXPENSE' | 'INCOME' | 'TRANSFER'; nature?: 'STATIC' | 'VARIABLE' }
): TransactionFormValues {
  const { settings, accounts, creditCards, categories } = props;
  const defaultSource = settings.defaultAccountId || accounts[0]?.id || '';
  const defaultDest = accounts[1]?.id || accounts[0]?.id || '';

  if (editingTx) {
    return {
      type: (editingTx.type as TransactionFormValues['type']) || 'EXPENSE',
      nature: (editingTx.nature as TransactionFormValues['nature']) || 'VARIABLE',
      paymentTarget: editingTx.creditCardId ? 'CREDIT_CARD' : 'ACCOUNT',
      amount: formatCentsToInput(editingTx.amountInCents),
      desc: editingTx.description,
      date: editingTx.date.slice(0, 10),
      status: (editingTx.status as TransactionFormValues['status']) || 'COMPLETED',
      sourceAccount: editingTx.sourceAccountId || defaultSource,
      destAccount: editingTx.destinationAccountId || defaultDest,
      cardId: editingTx.creditCardId || creditCards[0]?.id || '',
      categoryId: editingTx.categoryId || categories[0]?.id || '',
      installments: editingTx.totalInstallments || 1,
      tags: editingTx.tags || '',
    };
  }

  const targetType = preset?.type || 'EXPENSE';
  const matchingCat =
    categories.find((c) => (targetType === 'INCOME' ? c.type === 'INCOME' : c.type === 'EXPENSE')) ||
    categories[0];

  return {
    type: targetType,
    nature: preset?.nature || (matchingCat?.defaultNature as 'STATIC' | 'VARIABLE') || 'VARIABLE',
    paymentTarget: 'ACCOUNT',
    amount: '',
    desc: '',
    date: new Date().toISOString().slice(0, 10),
    status: 'COMPLETED',
    sourceAccount: defaultSource,
    destAccount: defaultDest,
    cardId: creditCards[0]?.id || '',
    categoryId: matchingCat?.id || '',
    installments: 1,
    tags: '',
  };
}

export function useTransactionForm(params: {
  isOpen: boolean;
  editingTx: SerializedTransaction | null;
  preset?: { type?: 'EXPENSE' | 'INCOME' | 'TRANSFER'; nature?: 'STATIC' | 'VARIABLE' };
  props: WorkbenchProps;
  onClose: () => void;
}) {
  const { isOpen, editingTx, preset, props, onClose } = params;
  const { categories } = props;

  const [form, setForm] = React.useState<TransactionFormValues>(() =>
    buildInitialFormValues(props, editingTx, preset)
  );
  const [txAttachment, setTxAttachment] = React.useState<AttachmentDraft | null>(null);
  const [formError, setFormError] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const patchForm = React.useCallback(
    <K extends keyof TransactionFormValues>(key: K, value: TransactionFormValues[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  React.useEffect(() => {
    if (!isOpen) return;
    setFormError('');
    setTxAttachment(null);
    setForm(buildInitialFormValues(props, editingTx, preset));
  }, [isOpen, editingTx, preset, props]);

  const handleSelectCategory = (id: string) => {
    const found = categories.find((c) => c.id === id);
    setForm((prev) => ({
      ...prev,
      categoryId: id,
      ...(found ? { nature: found.defaultNature as 'STATIC' | 'VARIABLE' } : {}),
    }));
  };

  const handleAttachmentFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setTxAttachment(null);
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setFormError('O arquivo deve ter no máximo 4MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setTxAttachment({
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        sizeInBytes: file.size,
        fileDataUrl: String(reader.result || ''),
      });
    };
    reader.readAsDataURL(file);
  };

  const handleCreateTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setIsSubmitting(true);
    try {
      const common = {
        type: form.type,
        nature: form.nature,
        amountRaw: form.amount,
        date: form.date,
        description: form.desc,
        status: form.status,
        paymentTarget: form.paymentTarget,
        sourceAccountId: form.sourceAccount || undefined,
        destinationAccountId: form.destAccount || undefined,
        creditCardId: form.cardId || undefined,
        categoryId: form.categoryId || undefined,
        tags: form.tags,
      };
      const res = editingTx
        ? await updateTransactionAction({ id: editingTx.id, ...common })
        : await createTransactionAction({
            ...common,
            installments: form.installments,
            attachment: txAttachment,
          });
      if (!res.ok) setFormError(res.error || 'Erro ao salvar lançamento.');
      else onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    editingTxId: editingTx?.id || null,
    txType: form.type,
    setTxType: (v: TransactionFormValues['type']) => patchForm('type', v),
    txNature: form.nature,
    setTxNature: (v: TransactionFormValues['nature']) => patchForm('nature', v),
    txPaymentTarget: form.paymentTarget,
    setTxPaymentTarget: (v: TransactionFormValues['paymentTarget']) => patchForm('paymentTarget', v),
    txAmount: form.amount,
    setTxAmount: (v: string) => patchForm('amount', v),
    txDesc: form.desc,
    setTxDesc: (v: string) => patchForm('desc', v),
    txDate: form.date,
    setTxDate: (v: string) => patchForm('date', v),
    txStatus: form.status,
    setTxStatus: (v: TransactionFormValues['status']) => patchForm('status', v),
    txSourceAccount: form.sourceAccount,
    setTxSourceAccount: (v: string) => patchForm('sourceAccount', v),
    txDestAccount: form.destAccount,
    setTxDestAccount: (v: string) => patchForm('destAccount', v),
    txCardId: form.cardId,
    setTxCardId: (v: string) => patchForm('cardId', v),
    txCategoryId: form.categoryId,
    setTxCategoryId: (v: string) => patchForm('categoryId', v),
    txInstallments: form.installments,
    setTxInstallments: (v: number) => patchForm('installments', v),
    txTags: form.tags,
    setTxTags: (v: string) => patchForm('tags', v),
    formError,
    isSubmitting,
    handleSelectCategory,
    handleAttachmentFile,
    handleCreateTransaction,
  };
}
