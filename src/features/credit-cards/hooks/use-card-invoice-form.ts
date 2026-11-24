'use client';

import * as React from 'react';
import { formatCentsToInput } from '@/shared/lib/currency';
import type { CreditCardWithSummary } from '@/features/analytics';
import { createCreditCardAction, updateCreditCardAction, payCreditCardInvoiceAction } from '@/features/credit-cards/actions/credit-cards.actions';

export function useCardAndInvoiceForm(params: {
  isCardOpen: boolean;
  editingCard: CreditCardWithSummary | null;
  payingCard: CreditCardWithSummary | null;
  defaultAccountId: string;
  selectedMonth: number;
  selectedYear: number;
  onClose: () => void;
}) {
  const { isCardOpen, editingCard, payingCard, defaultAccountId, selectedMonth, selectedYear, onClose } = params;
  const [cardName, setCardName] = React.useState('');
  const [cardBrand, setCardBrand] = React.useState('Mastercard');
  const [cardLimit, setCardLimit] = React.useState('5000,00');
  const [cardClosing, setCardClosing] = React.useState(25);
  const [cardDue, setCardDue] = React.useState(5);
  const [cardColor, setCardColor] = React.useState('#6366f1');
  const [payAccountSource, setPayAccountSource] = React.useState(defaultAccountId);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!isCardOpen) return;
    if (editingCard) {
      setCardName(editingCard.name);
      setCardBrand(editingCard.brand || 'Mastercard');
      setCardLimit(formatCentsToInput(editingCard.limitInCents));
      setCardClosing(editingCard.closingDay);
      setCardDue(editingCard.dueDay);
      setCardColor(editingCard.color || '#6366f1');
    } else {
      setCardName('');
      setCardBrand('Mastercard');
      setCardLimit('5000,00');
      setCardClosing(25);
      setCardDue(5);
      setCardColor('#6366f1');
    }
  }, [isCardOpen, editingCard]);

  React.useEffect(() => {
    if (payingCard && defaultAccountId) setPayAccountSource(defaultAccountId);
  }, [payingCard, defaultAccountId]);

  const handleSaveCard = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = {
        name: cardName, brand: cardBrand, limitRaw: cardLimit,
        closingDay: cardClosing, dueDay: cardDue, color: cardColor,
      };
      const res = editingCard
        ? await updateCreditCardAction({ id: editingCard.id, ...payload })
        : await createCreditCardAction(payload);
      if (res.ok) onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePayInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingCard || !payAccountSource) return;
    setIsSubmitting(true);
    try {
      const res = await payCreditCardInvoiceAction({
        creditCardId: payingCard.id,
        month: selectedMonth,
        year: selectedYear,
        sourceAccountId: payAccountSource,
      });
      if (res.ok) onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    editingCardId: editingCard?.id || null,
    cardName, setCardName, cardBrand, setCardBrand, cardLimit, setCardLimit,
    cardClosing, setCardClosing, cardDue, setCardDue, cardColor, setCardColor,
    payAccountSource, setPayAccountSource, isSubmitting, handleSaveCard, handlePayInvoice,
  };
}
