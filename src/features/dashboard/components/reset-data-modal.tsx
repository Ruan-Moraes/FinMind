'use client';

import * as React from 'react';
import { useWorkbench } from '@/features/dashboard/context/workbench-context';
import { CheckCircle2, RotateCcw, AlertTriangle } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Modal } from '@/shared/ui/modal';
import { FormField, Input } from '@/shared/ui/input';
import { useResetForm } from '@/features/dashboard/hooks/use-settings-reset-forms';

export function ResetDataModal() {
  const { props, wb } = useWorkbench();
  const { user } = props;
  const { activeModal, closeModal } = wb;
  const isResetModalOpen = activeModal?.type === 'RESET';
  const {
    resetScope,
    setResetScope,
    resetStep,
    setResetStep,
    resetFullNameInput,
    setResetFullNameInput,
    resetError,
    setResetError,
    isResetting,
    handleAdvanceToResetStep2,
    handleConfirmResetAll,
  } = useResetForm({
    isOpen: isResetModalOpen,
    userName: user.name,
    onClose: closeModal,
  });

  return (
    <Modal
      isOpen={isResetModalOpen}
      onClose={() => {
        if (!isResetting) closeModal();
      }}
      maxWidth="lg"
      title="Limpar Dados Financeiros — Dupla Confirmação"
      subtitle={
        resetStep === 1
          ? 'Etapa 1 de 2: Confirmação de identidade por nome completo'
          : 'Etapa 2 de 2: Confirmação definitiva de exclusão'
      }
      footer={
        resetStep === 1 ? (
          <div className="w-full flex items-center justify-end gap-3">
            <Button variant="secondary" onClick={closeModal}>
              Cancelar
            </Button>
            <Button variant="destructive" type="submit" form="form-reset-step-1">
              Avançar para 2ª Confirmação →
            </Button>
          </div>
        ) : (
          <div className="w-full flex items-center justify-between gap-3">
            <Button
              variant="secondary"
              onClick={() => setResetStep(1)}
              disabled={isResetting}
            >
              ← Voltar
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmResetAll}
              isLoading={isResetting}
            >
              <RotateCcw className="h-4 w-4 shrink-0" />
              <span>
                {resetScope === 'VALUES_ONLY'
                  ? 'Confirmar Limpeza de Valores'
                  : 'Confirmar Reset Definitivo'}
              </span>
            </Button>
          </div>
        )
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-100 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-xs font-semibold">
          <div
            className={`h-8 rounded-lg flex items-center justify-center gap-1.5 whitespace-nowrap ${
              resetStep === 1
                ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-50 shadow-sm'
                : 'text-emerald-600 dark:text-emerald-400'
            }`}
          >
            <span>1. Nome Completo</span>
            {resetStep === 2 && <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />}
          </div>
          <div
            className={`h-8 rounded-lg flex items-center justify-center gap-1.5 whitespace-nowrap ${
              resetStep === 2
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-slate-400 dark:text-zinc-500'
            }`}
          >
            <span>2. Confirmação Final</span>
          </div>
        </div>
        {resetError && (
          <div className="rounded-xl border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/60 p-3 text-xs font-medium text-rose-700 dark:text-rose-300">
            {resetError}
          </div>
        )}
        {resetStep === 1 ? (
          <form id="form-reset-step-1" onSubmit={handleAdvanceToResetStep2} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setResetScope('VALUES_ONLY')}
                className={`rounded-xl border p-3 text-left transition-all space-y-1 ${
                  resetScope === 'VALUES_ONLY'
                    ? 'border-indigo-500 bg-indigo-500/10 ring-1 ring-indigo-500'
                    : 'border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-950/60'
                }`}
              >
                <div className="text-xs font-semibold text-slate-900 dark:text-zinc-100">
                  Zerar apenas valores e lançamentos
                </div>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-snug">
                  Apaga lançamentos, faturas e zera saldos, mas <strong>mantém categorias, metas, orçamentos, contas, cartões e regras fixas</strong>.
                </p>
              </button>
              <button
                type="button"
                onClick={() => setResetScope('ALL')}
                className={`rounded-xl border p-3 text-left transition-all space-y-1 ${
                  resetScope === 'ALL'
                    ? 'border-rose-500 bg-rose-500/10 ring-1 ring-rose-500'
                    : 'border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-950/60'
                }`}
              >
                <div className="text-xs font-semibold text-rose-700 dark:text-rose-300">
                  Resetar tudo (do zero)
                </div>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-snug">
                  Remove todos os lançamentos, contas, cartões, metas, regras fixas e categorias personalizadas.
                </p>
              </button>
            </div>
            <div className="rounded-xl border border-amber-300/80 dark:border-amber-800/80 bg-amber-50/70 dark:bg-amber-950/30 p-3 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <span>
                {resetScope === 'VALUES_ONLY'
                  ? 'Suas categorias, metas de carteira, orçamentos, contas, cartões e regras fixas serão preservados; apenas os valores e lançamentos serão zerados.'
                  : 'Esta ação apagará permanentemente todos os seus dados financeiros e restaurará apenas as categorias padrão.'}
              </span>
            </div>
            <FormField
              label="Para liberar o botão final, digite seu nome completo abaixo:"
              hint="Obrigatório"
            >
              <div className="space-y-2">
                <div className="rounded-lg bg-slate-100 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 px-3 py-2 text-xs font-mono select-all text-slate-800 dark:text-zinc-200">
                  {user.name}
                </div>
                <Input
                  placeholder={`Digite: ${user.name}`}
                  value={resetFullNameInput}
                  onChange={(e) => {
                    setResetFullNameInput(e.target.value);
                    if (resetError) setResetError(null);
                  }}
                  autoFocus
                  required
                />
              </div>
            </FormField>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl border border-rose-300 dark:border-rose-800/90 bg-rose-50/80 dark:bg-rose-950/40 p-5 text-center space-y-3">
              <div className="h-12 w-12 rounded-2xl bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
                <RotateCcw className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-semibold text-rose-950 dark:text-rose-100">
                  Identidade confirmada: {user.name}
                </h4>
                <p className="text-xs text-rose-800 dark:text-rose-300 max-w-md mx-auto">
                  {resetScope === 'VALUES_ONLY'
                    ? 'Modo selecionado: Zerar apenas valores e lançamentos. Suas categorias, metas, orçamentos, contas, cartões e regras fixas serão mantidos.'
                    : 'Modo selecionado: Resetar tudo. Todos os registros atuais serão permanentemente zerados.'}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
