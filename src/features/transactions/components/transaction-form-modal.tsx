'use client';
import * as React from 'react';
import { useWorkbench } from '@/features/dashboard/context/workbench-context';
import { Wallet, CreditCard as CreditCardIcon, TrendingUp, TrendingDown, ArrowLeftRight, CheckCircle2, Clock } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Modal } from '@/shared/ui/modal';
import { FormField, Input, Select } from '@/shared/ui/input';
import { TransactionCategoryPicker } from '@/features/transactions/components/transaction-category-picker';
import { useTransactionForm } from '@/features/transactions/hooks/use-transaction-form';

export function TransactionFormModal() {
  const { props, wb } = useWorkbench();
  const { creditCards, categories } = props;
  const { activeModal, closeModal, activeAccounts, handleOpenCreateCategoryModal, handleOpenEditCategoryModal } = wb;
  const isTxModalOpen = activeModal?.type === 'TX';
  const editingTx = activeModal?.type === 'TX' ? activeModal.editing || null : null;
  const preset = activeModal?.type === 'TX' ? activeModal.preset : undefined;
  const {
    editingTxId, txType, setTxType, txNature, setTxNature, txPaymentTarget, setTxPaymentTarget,
    txAmount, setTxAmount, txDesc, setTxDesc, txDate, setTxDate, txStatus, setTxStatus,
    txSourceAccount, setTxSourceAccount, txDestAccount, setTxDestAccount,
    txCardId, setTxCardId, txCategoryId, txInstallments, setTxInstallments, txTags, setTxTags,
    formError, isSubmitting, handleSelectCategory, handleAttachmentFile, handleCreateTransaction,
  } = useTransactionForm({ isOpen: isTxModalOpen, editingTx, preset, props, onClose: closeModal });
  return (
      <Modal isOpen={isTxModalOpen}
        onClose={closeModal} title={editingTxId ? 'Editar Lançamento Financeiro' : 'Novo Lançamento Financeiro'}
        subtitle={
          editingTxId
            ? 'Altere o valor, data, descrição, categoria, natureza (estático/variável) ou conta deste lançamento'
            : 'Registre receitas, despesas estáticas/variáveis, compras parceladas ou transferências'
        }
        footer={
          <>
            <Button variant="secondary" onClick={closeModal}>
              Cancelar
            </Button>
            <Button data-agent-id="modal.tx.btn.submit" variant="primary" type="submit" form="form-new-tx" isLoading={isSubmitting}>
              {editingTxId ? 'Salvar Alterações' : 'Salvar Lançamento'}
            </Button>
          </>
        }
      >
        <form id="form-new-tx" onSubmit={handleCreateTransaction} className="space-y-4">
          {formError && (
            <div className="rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 p-3 text-xs font-medium text-rose-600 dark:text-rose-300">
              {formError}
            </div>
          )}
          {/* Seletor de Tipo com Ícones */}
          <div className="grid grid-cols-3 gap-2 p-1 rounded-xl bg-slate-100 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800">
            {[
              { id: 'EXPENSE', label: 'Despesa', icon: TrendingDown, colorClass: 'text-rose-500' },
              { id: 'INCOME', label: 'Receita', icon: TrendingUp, colorClass: 'text-emerald-500' },
              { id: 'TRANSFER', label: 'Transferência', icon: ArrowLeftRight, colorClass: 'text-indigo-500' },
            ].map((t) => { const TypeIcon = t.icon;
              return (
                <button key={t.id}
                  type="button" onClick={() => setTxType(t.id as 'EXPENSE' | 'INCOME' | 'TRANSFER')}
                  className={`h-9 rounded-lg text-xs font-semibold transition-all inline-flex items-center justify-center gap-1.5 ${
                    txType === t.id
                      ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-50 shadow-sm'
                      : 'text-slate-500 dark:text-zinc-400'
                  }`}
                >
                  <TypeIcon className={`h-3.5 w-3.5 shrink-0 ${txType === t.id ? t.colorClass : ''}`} />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Valor do Lançamento" htmlFor="tx-amount" hint="Ex: 150,00">
              <Input
                id="tx-amount"
                data-agent-id="modal.tx.input.amount"
                tabular
                prefixText="R$"
                placeholder="0,00" value={txAmount}
                onChange={(e) => setTxAmount(e.target.value)}
                required
              />
            </FormField>
            <FormField label="Data do Lançamento" htmlFor="tx-date">
              <Input
                id="tx-date"
                data-agent-id="modal.tx.input.date"
                type="date"
                tabular value={txDate}
                onChange={(e) => setTxDate(e.target.value)}
                required
              />
            </FormField>
          </div>
          <FormField label="Descrição" htmlFor="tx-desc">
            <Input
              id="tx-desc"
              data-agent-id="modal.tx.input.description"
              placeholder="Ex: Supermercado, Kit Peças, Aluguel, Salário..." value={txDesc}
              onChange={(e) => setTxDesc(e.target.value)}
              required
            />
          </FormField>
          {txType !== 'TRANSFER' && (
            <TransactionCategoryPicker
              categories={categories}
              txType={txType}
              txNature={txNature}
              setTxNature={setTxNature}
              txCategoryId={txCategoryId}
              handleSelectCategory={handleSelectCategory}
              handleOpenCreateCategoryModal={handleOpenCreateCategoryModal}
              handleOpenEditCategoryModal={handleOpenEditCategoryModal}
            />
          )}
          {txType === 'EXPENSE' && (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button" onClick={() => setTxPaymentTarget('ACCOUNT')}
                className={`h-10 rounded-xl border text-xs font-medium inline-flex items-center justify-center gap-1.5 ${
                  txPaymentTarget === 'ACCOUNT'
                    ? 'border-indigo-500 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300'
                    : 'border-slate-200 dark:border-zinc-800 text-slate-500'
                }`}
              >
                <Wallet className="h-3.5 w-3.5 shrink-0" />
                <span>Débito em Conta / Dinheiro</span>
              </button>
              <button
                type="button" onClick={() => setTxPaymentTarget('CREDIT_CARD')}
                className={`h-10 rounded-xl border text-xs font-medium inline-flex items-center justify-center gap-1.5 ${
                  txPaymentTarget === 'CREDIT_CARD'
                    ? 'border-indigo-500 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300'
                    : 'border-slate-200 dark:border-zinc-800 text-slate-500'
                }`}
              >
                <CreditCardIcon className="h-3.5 w-3.5 shrink-0" />
                <span>Cartão de Crédito</span>
              </button>
            </div>
          )}
          {txType === 'EXPENSE' && txPaymentTarget === 'CREDIT_CARD' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Cartão de Crédito" htmlFor="tx-card">
                <Select
                  id="tx-card" value={txCardId}
                  onChange={(e) => setTxCardId(e.target.value)}
                >
                  {creditCards.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} (Fecha dia {c.closingDay})
                    </option>
                  ))}
                </Select>
              </FormField>
              {!editingTxId && (
                <FormField label="Parcelamento" htmlFor="tx-installments" hint="Divisão automática">
                  <Select
                    id="tx-installments" value={txInstallments}
                    onChange={(e) => setTxInstallments(Number(e.target.value))}
                  >
                    {[1, 2, 3, 4, 5, 6, 8, 10, 12, 18, 24].map((n) => (
                      <option key={n} value={n}>
                        {n === 1 ? '1x à vista na fatura' : `${n}x sem juros`}
                      </option>
                    ))}
                  </Select>
                </FormField>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label={txType === 'TRANSFER' ? 'Conta de Origem' : 'Conta Bancária / Carteira'}
              >
                <Select value={txSourceAccount}
                  onChange={(e) => setTxSourceAccount(e.target.value)}
                >
                  {activeAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </Select>
              </FormField>
              {txType === 'TRANSFER' ? (
                <FormField label="Conta de Destino">
                  <Select value={txDestAccount}
                    onChange={(e) => setTxDestAccount(e.target.value)}
                  >
                    {activeAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </Select>
                </FormField>
              ) : (
                <div className="space-y-1.5">
                  <label className="text-[13px] font-medium text-slate-700 dark:text-zinc-300 block">
                    Status do Lançamento
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button" onClick={() => setTxStatus('COMPLETED')}
                      className={`h-10 px-2.5 rounded-xl border text-xs font-medium inline-flex items-center justify-center gap-1.5 transition-all ${
                        txStatus === 'COMPLETED'
                          ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
                          : 'border-slate-200 dark:border-zinc-800 text-slate-500'
                      }`}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                      <span>Efetivado</span>
                    </button>
                    <button
                      type="button" onClick={() => setTxStatus('PENDING')}
                      className={`h-10 px-2.5 rounded-xl border text-xs font-medium inline-flex items-center justify-center gap-1.5 transition-all ${
                        txStatus === 'PENDING'
                          ? 'border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-300'
                          : 'border-slate-200 dark:border-zinc-800 text-slate-500'
                      }`}
                    >
                      <Clock className="h-3.5 w-3.5 shrink-0" />
                      <span>Pendente</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Tags (separadas por vírgula)" hint="Ex: comida,pecas">
              <Input
                placeholder="mercado, carro, fixo" value={txTags}
                onChange={(e) => setTxTags(e.target.value)}
              />
            </FormField>
            {!editingTxId && (
              <FormField label="Comprovante / Recibo (Imagem ou PDF)">
                <input
                  type="file"
                  accept="image/*,application/pdf" onChange={handleAttachmentFile}
                  className="block w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-medium file:bg-slate-100 dark:file:bg-zinc-800 file:text-slate-700 dark:file:text-zinc-200 hover:file:bg-slate-200"
                />
              </FormField>
            )}
          </div>
        </form>
      </Modal>
  );
}