'use client';
import * as React from 'react';
import { useWorkbench } from '@/features/dashboard/context/workbench-context';
import { TrendingUp, TrendingDown, ArrowLeftRight, Lock, Sparkles, Pencil, Briefcase, Home, Wifi, Zap, CreditCard } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Modal } from '@/shared/ui/modal';
import { FormField, Input, Select } from '@/shared/ui/input';
import { useStaticRuleForm } from '@/features/planning/hooks/use-static-rule-form';
import { StaticRuleDueDateField } from '@/features/planning/components/static-rule-due-date-field';

export function StaticRuleFormModal() {
  const { props, wb } = useWorkbench();
  const { categories, creditCards, selectedMonth, selectedYear, holidays = [] } = props;
  const { activeModal, closeModal, handleOpenCreateCategoryModal, handleOpenEditCategoryModal, activeAccounts } = wb;
  const isStaticRuleModalOpen = activeModal?.type === 'STATIC_RULE';
  const editingRule = activeModal?.type === 'STATIC_RULE' ? activeModal.editing || null : null;
  const presetType = activeModal?.type === 'STATIC_RULE' ? activeModal.presetType : undefined;
  const {
    editingRuleId, ruleDesc, setRuleDesc, ruleType, setRuleType, ruleNature, setRuleNature,
    ruleAmount, setRuleAmount, ruleDay, setRuleDay,
    ruleDayType, setRuleDayType, ruleIncludeSaturday, setRuleIncludeSaturday,
    ruleCatId, setRuleCatId, ruleAccId, setRuleAccId, ruleCardId, setRuleCardId, isSubmitting, handleSaveStaticRule,
  } = useStaticRuleForm({
    isOpen: isStaticRuleModalOpen,
    editingRule,
    presetType,
    defaultCategoryId: categories.find((c) => c.type === (presetType || 'EXPENSE'))?.id || '',
    defaultAccountId: activeAccounts[0]?.id || '',
    onClose: closeModal,
  });
  return (
      <Modal
        isOpen={isStaticRuleModalOpen}
        onClose={closeModal}
        title={
          editingRuleId
            ? 'Editar Custo ou Ganho Estático'
            : 'Novo Custo ou Ganho Estático'
        }
        subtitle="Cadastre ou edite ganhos fixos garantidos e despesas fixas do seu orçamento"
        footer={
          <>
            <Button variant="secondary" onClick={closeModal}>Cancelar</Button>
            <Button variant="primary" type="submit" form="form-static-rule" isLoading={isSubmitting} data-agent-id="modal.staticRule.btn.submit">
              {editingRuleId ? 'Salvar Alterações' : 'Salvar Regra Fixa'}
            </Button>
          </>
        }
      >
        <form id="form-static-rule" onSubmit={handleSaveStaticRule} className="space-y-4">
          {/* Atalhos Rápidos com Ícones */}
          <div className="space-y-1.5">
            <span className="text-[12px] font-medium text-slate-500 dark:text-zinc-400 block">
              Modelos Rápidos (Clique para preencher)
            </span>
            <div className="flex flex-wrap gap-1.5">
              {[
                { label: 'Salário Fixo Mensal', type: 'INCOME' as const, icon: Briefcase },
                { label: 'Fatura do Cartão', type: 'EXPENSE' as const, icon: CreditCard },
                { label: 'Aluguel / Condomínio', type: 'EXPENSE' as const, icon: Home },
                { label: 'Assinatura IA (ChatGPT/Claude)', type: 'EXPENSE' as const, icon: Sparkles },
                { label: 'Internet Fibra', type: 'EXPENSE' as const, icon: Wifi },
                { label: 'Energia Elétrica', type: 'EXPENSE' as const, icon: Zap },
              ].map((item) => {
                const ItemIcon = item.icon;
                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => {
                      setRuleDesc(item.label);
                      setRuleType(item.type);
                    }}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-medium transition-all ${
                      ruleDesc === item.label
                        ? 'border-indigo-500 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300'
                        : 'border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 text-slate-600 dark:text-zinc-400 hover:border-slate-300'
                    }`}
                  >
                    <ItemIcon
                      className={`h-3.5 w-3.5 shrink-0 ${
                        item.type === 'INCOME' ? 'text-emerald-500' : 'text-rose-500'
                      }`}
                    />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <FormField label="Descrição">
            <Input
              data-agent-id="modal.staticRule.input.description"
              placeholder="Ex: Salário Fixo, Aluguel, Financiamento, Internet..."
              value={ruleDesc}
              onChange={(e) => setRuleDesc(e.target.value)}
              required
            />
          </FormField>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-slate-700 dark:text-zinc-300 block">
                Tipo do Compromisso
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRuleType('EXPENSE')}
                  className={`h-10 px-2.5 rounded-xl border text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-all ${
                    ruleType === 'EXPENSE'
                      ? 'border-rose-500 bg-rose-500/10 text-rose-600 dark:text-rose-300'
                      : 'border-slate-200 dark:border-zinc-800 text-slate-500'
                  }`}
                >
                  <TrendingDown className="h-3.5 w-3.5 shrink-0" />
                  <span>Custo Estático</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRuleType('INCOME')}
                  className={`h-10 px-2.5 rounded-xl border text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-all ${
                    ruleType === 'INCOME'
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
                      : 'border-slate-200 dark:border-zinc-800 text-slate-500'
                  }`}
                >
                  <TrendingUp className="h-3.5 w-3.5 shrink-0" />
                  <span>Ganho Estático</span>
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-slate-700 dark:text-zinc-300 block">
                Natureza
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRuleNature('STATIC')}
                  className={`h-10 px-2.5 rounded-xl border text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-all ${
                    ruleNature === 'STATIC'
                      ? 'border-indigo-500 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300'
                      : 'border-slate-200 dark:border-zinc-800 text-slate-500'
                  }`}
                >
                  <Lock className="h-3.5 w-3.5 shrink-0" />
                  <span>Fixo / Inflexível</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRuleNature('VARIABLE')}
                  className={`h-10 px-2.5 rounded-xl border text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-all ${
                    ruleNature === 'VARIABLE'
                      ? 'border-indigo-500 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300'
                      : 'border-slate-200 dark:border-zinc-800 text-slate-500'
                  }`}
                >
                  <ArrowLeftRight className="h-3.5 w-3.5 shrink-0" />
                  <span>Variável</span>
                </button>
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <FormField label="Valor Mensal (R$)">
              <Input
                data-agent-id="modal.staticRule.input.amount"
                tabular
                prefixText="R$"
                placeholder="1500,00"
                value={ruleAmount}
                onChange={(e) => setRuleAmount(e.target.value)}
                required
              />
            </FormField>
            <div data-agent-id="modal.staticRule.section.dueDate">
              <StaticRuleDueDateField
                ruleDay={ruleDay}
                setRuleDay={setRuleDay}
                ruleDayType={ruleDayType}
                setRuleDayType={setRuleDayType}
                ruleIncludeSaturday={ruleIncludeSaturday}
                setRuleIncludeSaturday={setRuleIncludeSaturday}
                selectedMonth={selectedMonth}
                selectedYear={selectedYear}
                holidays={holidays}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label className="text-[13px] font-medium text-slate-700 dark:text-zinc-300">
                  Categoria
                </label>
                <div className="flex items-center gap-2 text-[11px]">
                  {ruleCatId && (
                    <button
                      type="button"
                      onClick={() => {
                        const cat = categories.find((c) => c.id === ruleCatId);
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
                    onClick={() => handleOpenCreateCategoryModal(ruleType)}
                    className="text-emerald-600 dark:text-emerald-400 hover:underline font-medium"
                  >
                    + Nova
                  </button>
                </div>
              </div>
              <Select value={ruleCatId} onChange={(e) => setRuleCatId(e.target.value)}>
                {categories.map((c) => (<option key={c.id} value={c.id}>{c.name} ({c.type === 'INCOME' ? 'Ganho' : 'Gasto'})</option>))}
              </Select>
            </div>
            <FormField label="Conta Vinculada">
              <Select value={ruleAccId} onChange={(e) => setRuleAccId(e.target.value)}>
                {activeAccounts.map((a) => (<option key={a.id} value={a.id}>{a.name}</option>))}
              </Select>
            </FormField>
          </div>
          {ruleType === 'EXPENSE' && creditCards.length > 0 && (
            <FormField label="Cartão de Crédito Vinculado (Opcional)" hint="Reflete no limite disponível">
              <Select
                value={ruleCardId}
                onChange={(e) => {
                  const id = e.target.value;
                  setRuleCardId(id);
                  const found = creditCards.find((c) => c.id === id);
                  if (found && !editingRuleId && ruleDayType === 'CALENDAR_DAY') setRuleDay(found.dueDay);
                }}
              >
                <option value="">Nenhum (Débito / Conta Bancária)</option>
                {creditCards.map((c) => (<option key={c.id} value={c.id}>{c.name} ({c.brand}) • Vence dia {c.dueDay}</option>))}
              </Select>
            </FormField>
          )}
        </form>
      </Modal>
  );
}