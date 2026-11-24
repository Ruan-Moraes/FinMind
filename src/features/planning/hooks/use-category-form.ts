'use client';

import * as React from 'react';
import { resolveCategoryIconId } from '@/shared/ui/entity-icons';
import { createCategoryAction, updateCategoryAction } from '@/features/planning/actions/recurrence-categories.actions';
import type { WorkbenchProps } from '@/features/dashboard/types/workbench-types';

export function useCategoryForm(params: {
  isOpen: boolean;
  editingCategory: WorkbenchProps['categories'][number] | null;
  presetType?: 'INCOME' | 'EXPENSE';
  onClose: () => void;
}) {
  const { isOpen, editingCategory, presetType, onClose } = params;
  const [catName, setCatName] = React.useState('');
  const [catType, setCatType] = React.useState<'EXPENSE' | 'INCOME'>('EXPENSE');
  const [catNature, setCatNature] = React.useState<'STATIC' | 'VARIABLE'>('VARIABLE');
  const [catColor, setCatColor] = React.useState('#6366f1');
  const [catIcon, setCatIcon] = React.useState('Tag');
  const [catIconManuallyPicked, setCatIconManuallyPicked] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!isOpen) return;
    if (editingCategory) {
      setCatName(editingCategory.name);
      setCatType((editingCategory.type as 'INCOME' | 'EXPENSE') || 'EXPENSE');
      setCatNature((editingCategory.defaultNature as 'STATIC' | 'VARIABLE') || 'VARIABLE');
      setCatColor(editingCategory.color || '#6366f1');
      setCatIcon(resolveCategoryIconId(editingCategory.icon, editingCategory.name));
      setCatIconManuallyPicked(true);
    } else {
      const targetType = presetType || 'EXPENSE';
      setCatName('');
      setCatType(targetType);
      setCatNature('VARIABLE');
      setCatColor(targetType === 'INCOME' ? '#10b981' : '#6366f1');
      setCatIcon(targetType === 'INCOME' ? 'Briefcase' : 'Tag');
      setCatIconManuallyPicked(false);
    }
  }, [isOpen, editingCategory, presetType]);

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = {
        name: catName,
        type: catType,
        defaultNature: catNature,
        color: catColor,
        icon: catIcon,
      };
      const res = editingCategory
        ? await updateCategoryAction({ id: editingCategory.id, ...payload })
        : await createCategoryAction(payload);
      if (res.ok) onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    editingCategoryId: editingCategory?.id || null,
    catName, setCatName, catType, setCatType, catNature, setCatNature,
    catColor, setCatColor, catIcon, setCatIcon,
    catIconManuallyPicked, setCatIconManuallyPicked,
    isSubmitting, handleSaveCategory,
  };
}
