'use client';
import * as React from 'react';
import { useWorkbench } from '@/features/dashboard/context/workbench-context';
import { TrendingUp, TrendingDown, ArrowLeftRight, Lock } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Modal } from '@/shared/ui/modal';
import { FormField, Input } from '@/shared/ui/input';
import { Badge } from '@/shared/ui/badge';
import { CATEGORY_ICON_OPTIONS, COLOR_SWATCH_OPTIONS, CategoryIconBadge, resolveCategoryIconId } from '@/shared/ui/entity-icons';
import { useCategoryForm } from '@/features/planning/hooks/use-category-form';

export function CategoryFormModal() {
  const { wb } = useWorkbench();
  const isCategoryModalOpen = wb.activeModal?.type === 'CATEGORY';
  const editingCategory = wb.activeModal?.type === 'CATEGORY' ? wb.activeModal.editing || null : null;
  const presetType = wb.activeModal?.type === 'CATEGORY' ? wb.activeModal.presetType : undefined;
  const {
    editingCategoryId, catName, setCatName, catType, setCatType, catNature, setCatNature,
    catColor, setCatColor, catIcon, setCatIcon, catIconManuallyPicked, setCatIconManuallyPicked,
    isSubmitting, handleSaveCategory,
  } = useCategoryForm({
    isOpen: isCategoryModalOpen,
    editingCategory,
    presetType,
    onClose: wb.closeModal,
  });
  return (
      <Modal
        isOpen={isCategoryModalOpen}
        onClose={wb.closeModal}
        maxWidth="lg"
        title={editingCategoryId ? 'Editar Categoria' : 'Nova Categoria'}
        subtitle={
          editingCategoryId
            ? 'Altere o nome, ícone visual, tipo (despesa/receita), natureza padrão (fixo/variável) ou cor da categoria'
            : 'Crie categorias personalizadas com ícones e cores para facilitar sua organização'
        }
        footer={
          <>
            <Button variant="secondary" onClick={wb.closeModal}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" form="form-category" isLoading={isSubmitting}>
              {editingCategoryId ? 'Salvar Alterações' : 'Criar Categoria'}
            </Button>
          </>
        }
      >
        <form id="form-category" onSubmit={handleSaveCategory} className="space-y-4">
          {/* Preview em Tempo Real do Card da Categoria */}
          <div className="rounded-2xl border border-slate-200/90 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-950/80 p-3.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <CategoryIconBadge
                icon={catIcon}
                name={catName || 'Categoria'}
                color={catColor}
                size="lg"
                showDot
              />
              <div className="min-w-0 space-y-1">
                <div className="text-sm font-semibold text-slate-900 dark:text-zinc-100 truncate">
                  {catName.trim() || 'Pré-visualização da Categoria'}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge
                    variant={catType === 'INCOME' ? 'income' : 'expense'}
                    className="gap-1 px-2 py-0.5"
                  >
                    {catType === 'INCOME' ? (
                      <TrendingUp className="h-3 w-3 shrink-0" />
                    ) : (
                      <TrendingDown className="h-3 w-3 shrink-0" />
                    )}
                    <span>{catType === 'INCOME' ? 'Receita' : 'Despesa'}</span>
                  </Badge>
                  <Badge
                    variant={catNature === 'STATIC' ? 'static' : 'variable'}
                    className="gap-1 px-2 py-0.5"
                  >
                    {catNature === 'STATIC' ? (
                      <Lock className="h-3 w-3 shrink-0" />
                    ) : (
                      <ArrowLeftRight className="h-3 w-3 shrink-0" />
                    )}
                    <span>{catNature === 'STATIC' ? 'Fixo / Estático' : 'Variável'}</span>
                  </Badge>
                </div>
              </div>
            </div>
            <span className="text-[11px] font-medium text-slate-400 dark:text-zinc-500 shrink-0 hidden sm:inline">
              Preview ao vivo
            </span>
          </div>
          <FormField label="Nome da Categoria">
            <Input
              placeholder="Ex: AI, Alimentação, Peças Automotivas, Salário..."
              value={catName}
              onChange={(e) => {
                const nextName = e.target.value;
                setCatName(nextName);
                if (!catIconManuallyPicked) {
                  setCatIcon(resolveCategoryIconId('Tag', nextName));
                }
              }}
              required
            />
          </FormField>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-slate-700 dark:text-zinc-300 block">
                Tipo da Categoria
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setCatType('EXPENSE')}
                  className={`h-10 px-3 rounded-xl border text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-all ${
                    catType === 'EXPENSE'
                      ? 'border-rose-500 bg-rose-500/10 text-rose-600 dark:text-rose-300'
                      : 'border-slate-200 dark:border-zinc-800 text-slate-500'
                  }`}
                >
                  <TrendingDown className="h-3.5 w-3.5 shrink-0" />
                  <span>Despesa</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCatType('INCOME')}
                  className={`h-10 px-3 rounded-xl border text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-all ${
                    catType === 'INCOME'
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
                      : 'border-slate-200 dark:border-zinc-800 text-slate-500'
                  }`}
                >
                  <TrendingUp className="h-3.5 w-3.5 shrink-0" />
                  <span>Receita</span>
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-slate-700 dark:text-zinc-300 block">
                Natureza Padrão
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setCatNature('VARIABLE')}
                  className={`h-10 px-3 rounded-xl border text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-all ${
                    catNature === 'VARIABLE'
                      ? 'border-indigo-500 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300'
                      : 'border-slate-200 dark:border-zinc-800 text-slate-500'
                  }`}
                >
                  <ArrowLeftRight className="h-3.5 w-3.5 shrink-0" />
                  <span>Variável</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCatNature('STATIC')}
                  className={`h-10 px-3 rounded-xl border text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-all ${
                    catNature === 'STATIC'
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
          {/* Seletor Visual de Ícones da Categoria */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[13px] font-medium text-slate-700 dark:text-zinc-300">
                Ícone da Categoria
              </label>
              <span className="text-[11px] text-slate-400 dark:text-zinc-500">
                Clique para escolher o ícone ideal
              </span>
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-48 overflow-y-auto p-1">
              {CATEGORY_ICON_OPTIONS.map((item) => {
                const IconComp = item.icon;
                const active = catIcon === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setCatIcon(item.id);
                      setCatIconManuallyPicked(true);
                    }}
                    className={`rounded-xl border p-2 flex flex-col items-center justify-center gap-1 text-center transition-all ${
                      active
                        ? 'border-indigo-500 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 ring-1 ring-indigo-500/40'
                        : 'border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-950 text-slate-600 dark:text-zinc-400 hover:border-slate-300 dark:hover:border-zinc-700'
                    }`}
                  >
                    <IconComp
                      className="h-4 w-4 shrink-0"
                      style={active ? { color: catColor } : undefined}
                    />
                    <span className="text-[10px] font-medium leading-tight truncate w-full">
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          {/* Seletor Rápido de Cores */}
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-slate-700 dark:text-zinc-300 block">
              Cor da Categoria
            </label>
            <div className="flex flex-wrap items-center gap-2">
              {COLOR_SWATCH_OPTIONS.map((swatch) => (
                <button
                  key={swatch}
                  type="button"
                  onClick={() => setCatColor(swatch)}
                  className={`h-7 w-7 rounded-full border transition-transform ${
                    catColor.toLowerCase() === swatch.toLowerCase()
                      ? 'scale-110 ring-2 ring-offset-2 ring-indigo-500 dark:ring-offset-zinc-900'
                      : 'opacity-80 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: swatch }}
                  title={swatch}
                />
              ))}
              <input
                type="color"
                value={catColor}
                onChange={(e) => setCatColor(e.target.value)}
                className="h-8 w-10 rounded-lg border border-slate-200 dark:border-zinc-800 bg-transparent p-0.5 cursor-pointer"
                title="Cor personalizada"
              />
            </div>
          </div>
        </form>
      </Modal>
  );
}