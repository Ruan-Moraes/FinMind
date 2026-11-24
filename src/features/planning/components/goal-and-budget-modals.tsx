'use client';

import * as React from 'react';
import { useWorkbench } from '@/features/dashboard/context/workbench-context';

import { TrendingUp, Home, Car, Plane, ShieldCheck } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Modal } from '@/shared/ui/modal';
import { FormField, Input, Select } from '@/shared/ui/input';

import { MONTH_NAMES_PT } from '@/shared/lib/currency';
import { CategoryIconBadge } from '@/shared/ui/entity-icons';


import { useGoalAndBudgetForm } from '@/features/planning/hooks/use-goal-budget-form';

export function GoalAndBudgetModals() {
  const { props, wb } = useWorkbench();
  const { selectedMonth, selectedYear, categories } = props;
  const { activeModal, closeModal } = wb;
  const isGoalModalOpen = activeModal?.type === 'GOAL';
  const editingGoal = activeModal?.type === 'GOAL' ? activeModal.editing || null : null;
  const isBudgetModalOpen = activeModal?.type === 'BUDGET';
  const defaultExpenseCatId = categories.find((c) => c.type === 'EXPENSE')?.id || '';
  const {
    editingGoalId, goalTitle, setGoalTitle, goalAmount, setGoalAmount, goalMonth, setGoalMonth,
    goalYear, setGoalYear, goalNotes, setGoalNotes, budgetCatId, setBudgetCatId,
    budgetMax, setBudgetMax, isSubmitting, handleSavePortfolioGoal, handleSaveBudget,
  } = useGoalAndBudgetForm({
    isGoalOpen: isGoalModalOpen,
    editingGoal,
    isBudgetOpen: isBudgetModalOpen,
    defaultExpenseCatId,
    selectedMonth,
    selectedYear,
    onClose: closeModal,
  });
  return (
    <>
      <Modal
        isOpen={isGoalModalOpen}
        onClose={closeModal}
        title={editingGoalId ? 'Editar Meta de Carteira' : 'Definir Meta de Carteira'}
        subtitle="Estabeleça quanto você quer ter de saldo acumulado em um mês específico"
        footer={
          <>
            <Button variant="secondary" onClick={closeModal}>
              Cancelar
            </Button>
            <Button
              data-agent-id="modal.goal.btn.submit"
              variant="primary"
              type="submit"
              form="form-portfolio-goal"
              isLoading={isSubmitting}
            >
              {editingGoalId ? 'Salvar Alterações' : 'Salvar Meta'}
            </Button>
          </>
        }
      >
        <form id="form-portfolio-goal" onSubmit={handleSavePortfolioGoal} className="space-y-4">
          <div className="space-y-1.5">
            <span className="text-[12px] font-medium text-slate-500 dark:text-zinc-400 block">
              Sugestões Rápidas de Meta (Clique para preencher)
            </span>
            <div className="flex flex-wrap gap-1.5">
              {[
                { label: 'Reserva de Emergência', icon: ShieldCheck },
                { label: 'Meta de Patrimônio na Carteira', icon: TrendingUp },
                { label: 'Troca / Manutenção de Veículo', icon: Car },
                { label: 'Imóvel & Moradia', icon: Home },
                { label: 'Viagem Planejada', icon: Plane },
              ].map((preset) => {
                const PresetIcon = preset.icon;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setGoalTitle(preset.label)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-medium transition-all ${
                      goalTitle === preset.label
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                        : 'border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 text-slate-600 dark:text-zinc-400 hover:border-slate-300'
                    }`}
                  >
                    <PresetIcon className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                    <span>{preset.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <FormField label="Título da Meta">
            <Input
              data-agent-id="modal.goal.input.title"
              placeholder="Ex: Meta de R$ 7.000 na Carteira"
              value={goalTitle}
              onChange={(e) => setGoalTitle(e.target.value)}
              required
            />
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormField label="Valor Alvo">
              <Input
                data-agent-id="modal.goal.input.targetAmount"
                tabular
                prefixText="R$"
                placeholder="7000,00"
                value={goalAmount}
                onChange={(e) => setGoalAmount(e.target.value)}
                required
              />
            </FormField>

            <FormField label="Mês Alvo">
              <Select
                value={goalMonth}
                onChange={(e) => setGoalMonth(Number(e.target.value))}
              >
                {MONTH_NAMES_PT.map((m, idx) => (
                  <option key={m} value={idx + 1}>
                    {m}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label="Ano Alvo">
              <Select value={goalYear} onChange={(e) => setGoalYear(Number(e.target.value))}>
                {[selectedYear, selectedYear + 1, selectedYear + 2].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>

          <FormField label="Observações (Opcional)">
            <Input
              placeholder="Ex: Reserva de segurança intocável"
              value={goalNotes}
              onChange={(e) => setGoalNotes(e.target.value)}
            />
          </FormField>
        </form>
      </Modal>
      <Modal
        isOpen={isBudgetModalOpen}
        onClose={closeModal}
        title="Definir ou Editar Limite por Categoria"
        subtitle="Receba alertas visuais quando seus gastos se aproximarem do teto"
        footer={
          <>
            <Button variant="secondary" onClick={closeModal}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" form="form-budget" isLoading={isSubmitting}>
              Salvar Limite
            </Button>
          </>
        }
      >
        <form id="form-budget" onSubmit={handleSaveBudget} className="space-y-4">
          <div className="space-y-2">
            <label className="text-[13px] font-medium text-slate-700 dark:text-zinc-300 block">
              Selecione a Categoria de Despesa
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
              {categories
                .filter((c) => c.type === 'EXPENSE')
                .map((c) => {
                  const selected = budgetCatId === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setBudgetCatId(c.id)}
                      className={`p-2.5 rounded-xl border text-left flex items-center gap-2.5 transition-all ${
                        selected
                          ? 'border-indigo-500 bg-indigo-500/10 ring-1 ring-indigo-500/40'
                          : 'border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-950 hover:border-slate-300'
                      }`}
                    >
                      <CategoryIconBadge
                        icon={c.icon}
                        name={c.name}
                        color={c.color}
                        size="sm"
                      />
                      <span className="text-xs font-semibold truncate">{c.name}</span>
                    </button>
                  );
                })}
            </div>
          </div>

          <FormField label="Teto Máximo no Mês (R$)">
            <Input
              tabular
              prefixText="R$"
              value={budgetMax}
              onChange={(e) => setBudgetMax(e.target.value)}
              required
            />
          </FormField>
        </form>
      </Modal>
    </>
  );
}