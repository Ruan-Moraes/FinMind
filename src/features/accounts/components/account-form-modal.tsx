'use client';

import * as React from 'react';
import { useWorkbench } from '@/features/dashboard/context/workbench-context';

import { Wallet, RotateCcw } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Modal } from '@/shared/ui/modal';
import { FormField, Input } from '@/shared/ui/input';

import { COLOR_SWATCH_OPTIONS, PiggyBank, Banknote, Landmark } from '@/shared/ui/entity-icons';


import { useAccountForm } from '@/features/accounts/hooks/use-account-form';

export function AccountFormModal() {
  const { wb } = useWorkbench();
  const isAccountModalOpen = wb.activeModal?.type === 'ACCOUNT';
  const editingAccount = wb.activeModal?.type === 'ACCOUNT' ? wb.activeModal.editing || null : null;
  const {
    editingAccountId, accName, setAccName, accType, setAccType, accInitial, setAccInitial,
    accTargetCurrent, setAccTargetCurrent, accBalanceEditMode, setAccBalanceEditMode,
    accColor, setAccColor, isSubmitting, handleSaveAccount,
  } = useAccountForm({
    isOpen: isAccountModalOpen,
    editingAccount,
    onClose: wb.closeModal,
  });
  return (
      <Modal
        isOpen={isAccountModalOpen}
        onClose={wb.closeModal}
        title={editingAccountId ? 'Editar Conta Bancária & Saldo' : 'Nova Conta ou Carteira'}
        subtitle={
          editingAccountId
            ? 'Altere o nome, tipo, cor ou manipule diretamente o saldo atual da sua conta'
            : 'Cadastre uma conta corrente, reserva ou dinheiro em mãos'
        }
        footer={
          <>
            <Button variant="secondary" onClick={wb.closeModal}>
              Cancelar
            </Button>
            <Button data-agent-id="modal.account.btn.submit" variant="primary" type="submit" form="form-account" isLoading={isSubmitting}>
              {editingAccountId ? 'Salvar Alterações da Conta' : 'Criar Conta'}
            </Button>
          </>
        }
      >
        <form id="form-account" onSubmit={handleSaveAccount} className="space-y-4">
          <FormField label="Nome da Conta">
            <Input
              data-agent-id="modal.account.input.name"
              placeholder="Ex: Itaú, Nubank, Carteira Física..."
              value={accName}
              onChange={(e) => setAccName(e.target.value)}
              required
            />
          </FormField>

          {/* Seletor Visual de Tipo de Conta com Ícones */}
          <div data-agent-id="modal.account.section.type" className="space-y-1.5">
            <label className="text-[13px] font-medium text-slate-700 dark:text-zinc-300 block">
              Tipo de Conta / Carteira
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {[
                { id: 'CHECKING', label: 'Conta Corrente', sub: 'Banco / Pix', icon: Landmark },
                { id: 'SAVINGS', label: 'Reserva', sub: 'Poupança / CDI', icon: PiggyBank },
                { id: 'CASH', label: 'Dinheiro Físico', sub: 'Em Mãos', icon: Banknote },
              ].map((item) => {
                const AccIcon = item.icon;
                const active = accType === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setAccType(item.id as 'CHECKING' | 'SAVINGS' | 'CASH')}
                    className={`rounded-xl border p-3 text-left transition-all flex flex-col gap-1.5 ${
                      active
                        ? 'border-indigo-500 bg-indigo-500/10 ring-1 ring-indigo-500/40 text-slate-900 dark:text-zinc-50'
                        : 'border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-950 text-slate-600 dark:text-zinc-400 hover:border-slate-300'
                    }`}
                  >
                    <AccIcon
                      className={`h-4 w-4 ${
                        active ? 'text-indigo-500' : 'text-slate-400 dark:text-zinc-500'
                      }`}
                    />
                    <div>
                      <div className="text-xs font-semibold leading-tight">{item.label}</div>
                      <div className="text-[10px] text-slate-400 dark:text-zinc-500">
                        {item.sub}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Paleta Rápida de Cores da Conta */}
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-slate-700 dark:text-zinc-300 block">
              Cor de Identificação
            </label>
            <div className="flex flex-wrap items-center gap-2">
              {COLOR_SWATCH_OPTIONS.map((swatch) => (
                <button
                  key={swatch}
                  type="button"
                  onClick={() => setAccColor(swatch)}
                  className={`h-7 w-7 rounded-full border transition-transform ${
                    accColor.toLowerCase() === swatch.toLowerCase()
                      ? 'scale-110 ring-2 ring-offset-2 ring-indigo-500 dark:ring-offset-zinc-900'
                      : 'opacity-80 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: swatch }}
                  title={swatch}
                />
              ))}
              <input
                type="color"
                value={accColor}
                onChange={(e) => setAccColor(e.target.value)}
                className="h-8 w-10 rounded-lg border border-slate-200 dark:border-zinc-800 bg-transparent p-0.5 cursor-pointer"
                title="Escolher cor personalizada"
              />
            </div>
          </div>

          {editingAccountId ? (
            <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-950 p-4 space-y-3">
              <div className="grid grid-cols-2 gap-2 p-1 rounded-lg bg-slate-200/70 dark:bg-zinc-900 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setAccBalanceEditMode('CURRENT')}
                  className={`h-8 rounded-md transition-all inline-flex items-center justify-center gap-1.5 ${
                    accBalanceEditMode === 'CURRENT'
                      ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 shadow-sm'
                      : 'text-slate-500 dark:text-zinc-400'
                  }`}
                >
                  <Wallet className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  <span>Definir Saldo Atual Direto</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAccBalanceEditMode('INITIAL')}
                  className={`h-8 rounded-md transition-all inline-flex items-center justify-center gap-1.5 ${
                    accBalanceEditMode === 'INITIAL'
                      ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 shadow-sm'
                      : 'text-slate-500 dark:text-zinc-400'
                  }`}
                >
                  <RotateCcw className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                  <span>Editar Saldo Inicial</span>
                </button>
              </div>

              {accBalanceEditMode === 'CURRENT' ? (
                <FormField
                  label="Saldo Consolidado Atual Desejado (R$)"
                  hint="Ajuste imediato"
                >
                  <Input
                    tabular
                    prefixText="R$"
                    value={accTargetCurrent}
                    onChange={(e) => setAccTargetCurrent(e.target.value)}
                    required
                  />
                </FormField>
              ) : (
                <FormField label="Saldo Inicial Base da Conta (R$)">
                  <Input
                    tabular
                    prefixText="R$"
                    value={accInitial}
                    onChange={(e) => setAccInitial(e.target.value)}
                    required
                  />
                </FormField>
              )}
            </div>
          ) : (
            <FormField label="Saldo Inicial (R$)">
              <Input
                data-agent-id="modal.account.input.initialBalance"
                tabular
                prefixText="R$"
                value={accInitial}
                onChange={(e) => setAccInitial(e.target.value)}
                required
              />
            </FormField>
          )}
        </form>
      </Modal>
  );
}