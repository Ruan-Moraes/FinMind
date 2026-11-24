'use client';

import * as React from 'react';

import { ArrowLeftRight, Plus, Lock, Pencil, Tag } from 'lucide-react';

import { FormField, Select } from '@/shared/ui/input';

import { CategoryIconBadge } from '@/shared/ui/entity-icons';

import type { WorkbenchProps } from '@/features/dashboard/types/workbench-types';

export function TransactionCategoryPicker(params: {
  categories: WorkbenchProps['categories'];
  txType: 'EXPENSE' | 'INCOME' | 'TRANSFER';
  txNature: 'STATIC' | 'VARIABLE';
  setTxNature: (n: 'STATIC' | 'VARIABLE') => void;
  txCategoryId: string;
  handleSelectCategory: (id: string) => void;
  handleOpenCreateCategoryModal: (preset?: 'INCOME' | 'EXPENSE') => void;
  handleOpenEditCategoryModal: (cat: WorkbenchProps['categories'][number]) => void;
}) {
  const {
    categories, txType, txNature, setTxNature, txCategoryId,
    handleSelectCategory, handleOpenCreateCategoryModal, handleOpenEditCategoryModal,
  } = params;
  const filteredCategoriesForModal = categories.filter((c) =>
    txType === 'INCOME' ? c.type === 'INCOME' : c.type === 'EXPENSE'
  );
  return (
            <div className="space-y-3">
              {/* Seletor Visual Rápido de Categorias com Ícones */}
              {filteredCategoriesForModal.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-[13px] font-medium text-slate-700 dark:text-zinc-300 inline-flex items-center gap-1.5">
                      <Tag className="h-3.5 w-3.5 text-indigo-500" />
                      <span>Categoria (Seleção Rápida com Ícone)</span>
                    </label>
                    <div className="flex items-center gap-2 text-[11px]">
                      {txCategoryId && (
                        <button
                          type="button"
                          onClick={() => {
                            const cat = categories.find((c) => c.id === txCategoryId);
                            if (cat) handleOpenEditCategoryModal(cat);
                          }}
                          className="text-indigo-500 hover:underline font-medium inline-flex items-center gap-0.5"
                        >
                          <Pencil className="h-2.5 w-2.5" />
                          Editar
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          handleOpenCreateCategoryModal(txType === 'INCOME' ? 'INCOME' : 'EXPENSE')
                        }
                        className="text-emerald-600 dark:text-emerald-400 hover:underline font-medium inline-flex items-center gap-0.5"
                      >
                        <Plus className="h-3 w-3" />
                        Nova
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                    {filteredCategoriesForModal.map((c) => {
                      const isSelected = txCategoryId === c.id;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => handleSelectCategory(c.id)}
                          className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl border text-xs font-medium whitespace-nowrap shrink-0 transition-all ${
                            isSelected
                              ? 'border-indigo-500 bg-indigo-500/10 text-slate-900 dark:text-zinc-100 ring-1 ring-indigo-500/40'
                              : 'border-slate-200 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-950 text-slate-600 dark:text-zinc-400 hover:border-slate-300 dark:hover:border-zinc-700'
                          }`}
                        >
                          <CategoryIconBadge
                            icon={c.icon}
                            name={c.name}
                            color={c.color}
                            size="sm"
                          />
                          <span>{c.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Categoria Selecionada" htmlFor="tx-cat">
                  <Select
                    id="tx-cat"
                    value={txCategoryId}
                    onChange={(e) => handleSelectCategory(e.target.value)}
                  >
                    {filteredCategoriesForModal.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                </FormField>

                <div className="space-y-1.5">
                  <label className="text-[13px] font-medium text-slate-700 dark:text-zinc-300 block">
                    Natureza Financeira
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setTxNature('VARIABLE')}
                      className={`h-10 px-2.5 rounded-xl border text-xs font-medium inline-flex items-center justify-center gap-1.5 transition-all ${
                        txNature === 'VARIABLE'
                          ? 'border-indigo-500 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300'
                          : 'border-slate-200 dark:border-zinc-800 text-slate-500'
                      }`}
                    >
                      <ArrowLeftRight className="h-3.5 w-3.5 shrink-0" />
                      <span>Variável</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setTxNature('STATIC')}
                      className={`h-10 px-2.5 rounded-xl border text-xs font-medium inline-flex items-center justify-center gap-1.5 transition-all ${
                        txNature === 'STATIC'
                          ? 'border-indigo-500 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300'
                          : 'border-slate-200 dark:border-zinc-800 text-slate-500'
                      }`}
                    >
                      <Lock className="h-3.5 w-3.5 shrink-0" />
                      <span>Fixo / Estático</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
  );
}