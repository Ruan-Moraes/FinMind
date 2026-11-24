'use client';

import * as React from 'react';
import { formatCentsToInput } from '@/shared/lib/currency';
import type { PortfolioGoalProgress } from '@/features/analytics';
import { upsertPortfolioGoalAction, upsertBudgetAction } from '@/features/planning/actions/goals-budgets.actions';

export function useGoalAndBudgetForm(params: {
  isGoalOpen: boolean;
  editingGoal: PortfolioGoalProgress | null;
  isBudgetOpen: boolean;
  defaultExpenseCatId: string;
  selectedMonth: number;
  selectedYear: number;
  onClose: () => void;
}) {
  const { isGoalOpen, editingGoal, isBudgetOpen, defaultExpenseCatId, selectedMonth, selectedYear, onClose } = params;
  const [goalTitle, setGoalTitle] = React.useState('');
  const [goalAmount, setGoalAmount] = React.useState('7000,00');
  const [goalMonth, setGoalMonth] = React.useState(12);
  const [goalYear, setGoalYear] = React.useState(selectedYear);
  const [goalNotes, setGoalNotes] = React.useState('');
  const [budgetCatId, setBudgetCatId] = React.useState(defaultExpenseCatId);
  const [budgetMax, setBudgetMax] = React.useState('800,00');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!isGoalOpen) return;
    if (editingGoal) {
      setGoalTitle(editingGoal.title);
      setGoalAmount(formatCentsToInput(editingGoal.targetAmountInCents));
      setGoalMonth(editingGoal.targetMonth);
      setGoalYear(editingGoal.targetYear);
      setGoalNotes(editingGoal.notes || '');
    } else {
      setGoalTitle('');
      setGoalAmount('7000,00');
      setGoalMonth(12);
      setGoalYear(selectedYear);
      setGoalNotes('');
    }
  }, [isGoalOpen, editingGoal, selectedYear]);

  React.useEffect(() => {
    if (isBudgetOpen && defaultExpenseCatId) {
      setBudgetCatId(defaultExpenseCatId);
      setBudgetMax('800,00');
    }
  }, [isBudgetOpen, defaultExpenseCatId]);

  const handleSavePortfolioGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await upsertPortfolioGoalAction({
        id: editingGoal?.id,
        title: goalTitle, targetAmountRaw: goalAmount,
        targetMonth: goalMonth, targetYear: goalYear, notes: goalNotes,
      });
      if (res.ok) onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await upsertBudgetAction({
        categoryId: budgetCatId, month: selectedMonth, year: selectedYear, maxAmountRaw: budgetMax,
      });
      if (res.ok) onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    editingGoalId: editingGoal?.id || null,
    goalTitle, setGoalTitle, goalAmount, setGoalAmount, goalMonth, setGoalMonth,
    goalYear, setGoalYear, goalNotes, setGoalNotes,
    budgetCatId, setBudgetCatId, budgetMax, setBudgetMax,
    isSubmitting, handleSavePortfolioGoal, handleSaveBudget,
  };
}
