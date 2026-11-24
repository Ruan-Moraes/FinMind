'use client';

import * as React from 'react';
import { formatCentsToInput } from '@/shared/lib/currency';
import { createRecurrenceRuleAction, updateRecurrenceRuleAction } from '@/features/planning/actions/recurrence-categories.actions';
import type { WorkbenchProps } from '@/features/dashboard/types/workbench-types';

export function useStaticRuleForm(params: {
  isOpen: boolean;
  editingRule: WorkbenchProps['recurrenceRules'][number] | null;
  presetType?: 'INCOME' | 'EXPENSE';
  defaultCategoryId: string;
  defaultAccountId: string;
  onClose: () => void;
}) {
  const { isOpen, editingRule, presetType, defaultCategoryId, defaultAccountId, onClose } = params;
  const [ruleDesc, setRuleDesc] = React.useState('');
  const [ruleType, setRuleType] = React.useState<'EXPENSE' | 'INCOME'>('EXPENSE');
  const [ruleNature, setRuleNature] = React.useState<'STATIC' | 'VARIABLE'>('STATIC');
  const [ruleAmount, setRuleAmount] = React.useState('');
  const [ruleDay, setRuleDay] = React.useState(5);
  const [ruleDayType, setRuleDayType] = React.useState<'CALENDAR_DAY' | 'BUSINESS_DAY'>('CALENDAR_DAY');
  const [ruleIncludeSaturday, setRuleIncludeSaturday] = React.useState(false);
  const [ruleCatId, setRuleCatId] = React.useState(defaultCategoryId);
  const [ruleAccId, setRuleAccId] = React.useState(defaultAccountId);
  const [ruleCardId, setRuleCardId] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!isOpen) return;
    if (editingRule) {
      setRuleDesc(editingRule.description);
      setRuleType((editingRule.type as 'INCOME' | 'EXPENSE') || 'EXPENSE');
      setRuleNature((editingRule.nature as 'STATIC' | 'VARIABLE') || 'STATIC');
      setRuleAmount(formatCentsToInput(editingRule.amountInCents));
      setRuleDay(editingRule.dayOfMonth);
      setRuleDayType(editingRule.dayType === 'BUSINESS_DAY' ? 'BUSINESS_DAY' : 'CALENDAR_DAY');
      setRuleIncludeSaturday(Boolean(editingRule.includeSaturday));
      setRuleCatId(editingRule.categoryId || '');
      setRuleAccId(editingRule.accountId || defaultAccountId);
      setRuleCardId(editingRule.creditCardId || '');
    } else {
      setRuleDesc('');
      setRuleType(presetType || 'EXPENSE');
      setRuleNature('STATIC');
      setRuleAmount('');
      setRuleDay(5);
      setRuleDayType('CALENDAR_DAY');
      setRuleIncludeSaturday(false);
      setRuleCatId(defaultCategoryId);
      setRuleAccId(defaultAccountId);
      setRuleCardId('');
    }
  }, [isOpen, editingRule, presetType, defaultCategoryId, defaultAccountId]);

  const handleSaveStaticRule = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = {
        description: ruleDesc, type: ruleType, nature: ruleNature,
        amountRaw: ruleAmount, dayOfMonth: ruleDay,
        dayType: ruleDayType, includeSaturday: ruleIncludeSaturday,
        categoryId: ruleCatId || undefined, accountId: ruleAccId || undefined,
        creditCardId: ruleType === 'EXPENSE' ? ruleCardId || undefined : undefined,
      };
      const res = editingRule
        ? await updateRecurrenceRuleAction({ id: editingRule.id, ...payload })
        : await createRecurrenceRuleAction(payload);
      if (res.ok) onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    editingRuleId: editingRule?.id || null,
    ruleDesc, setRuleDesc, ruleType, setRuleType, ruleNature, setRuleNature,
    ruleAmount, setRuleAmount, ruleDay, setRuleDay,
    ruleDayType, setRuleDayType, ruleIncludeSaturday, setRuleIncludeSaturday,
    ruleCatId, setRuleCatId, ruleAccId, setRuleAccId, ruleCardId, setRuleCardId,
    isSubmitting, handleSaveStaticRule,
  };
}
