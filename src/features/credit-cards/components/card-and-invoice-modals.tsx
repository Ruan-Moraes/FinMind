'use client';

import * as React from 'react';
import { useWorkbench } from '@/features/dashboard/context/workbench-context';

import { CreditCard as CreditCardIcon } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Modal } from '@/shared/ui/modal';
import { FormField, Input, Select } from '@/shared/ui/input';

import { formatCentsToBRL } from '@/shared/lib/currency';
import { COLOR_SWATCH_OPTIONS } from '@/shared/ui/entity-icons';


import { useCardAndInvoiceForm } from '@/features/credit-cards/hooks/use-card-invoice-form';

export function CardAndInvoiceModals() {
  const { props, wb } = useWorkbench();
  const { hideValues, activeAccounts, activeModal, closeModal } = wb;
  const isCardModalOpen = activeModal?.type === 'CARD';
  const editingCard = activeModal?.type === 'CARD' ? activeModal.editing || null : null;
  const isPayInvoiceModalOpen = activeModal?.type === 'PAY_INVOICE' ? activeModal.card : null;
  const {
    editingCardId, cardName, setCardName, cardBrand, setCardBrand, cardLimit, setCardLimit,
    cardClosing, setCardClosing, cardDue, setCardDue, cardColor, setCardColor,
    payAccountSource, setPayAccountSource, isSubmitting, handleSaveCard, handlePayInvoice,
  } = useCardAndInvoiceForm({
    isCardOpen: isCardModalOpen,
    editingCard,
    payingCard: isPayInvoiceModalOpen,
    defaultAccountId: activeAccounts[0]?.id || '',
    selectedMonth: props.selectedMonth,
    selectedYear: props.selectedYear,
    onClose: closeModal,
  });
  return (
    <>
      <Modal
        isOpen={isCardModalOpen}
        onClose={closeModal}
        title={editingCardId ? 'Editar Cartão de Crédito' : 'Novo Cartão de Crédito'}
        subtitle="Configure limite, dia de fechamento, dia de vencimento da fatura e cor"
        footer={
          <>
            <Button variant="secondary" onClick={closeModal}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" form="form-card" isLoading={isSubmitting}>
              {editingCardId ? 'Salvar Alterações' : 'Salvar Cartão'}
            </Button>
          </>
        }
      >
        <form id="form-card" onSubmit={handleSaveCard} className="space-y-4">
          <FormField label="Nome do Cartão">
            <Input
              placeholder="Ex: Nubank, XP Visa Infinite..."
              value={cardName}
              onChange={(e) => setCardName(e.target.value)}
              required
            />
          </FormField>

          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-slate-700 dark:text-zinc-300 block">
              Bandeira do Cartão
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {['Mastercard', 'Visa', 'Elo', 'Amex'].map((brand) => {
                const active = cardBrand === brand;
                return (
                  <button
                    key={brand}
                    type="button"
                    onClick={() => setCardBrand(brand)}
                    className={`h-10 px-3 rounded-xl border text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-all ${
                      active
                        ? 'border-indigo-500 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 ring-1 ring-indigo-500/30'
                        : 'border-slate-200 dark:border-zinc-800 text-slate-500 hover:border-slate-300'
                    }`}
                  >
                    <CreditCardIcon className="h-3.5 w-3.5 shrink-0" />
                    <span>{brand}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="sm:col-span-2">
              <FormField label="Limite Total (R$)">
                <Input
                  tabular
                  prefixText="R$"
                  value={cardLimit}
                  onChange={(e) => setCardLimit(e.target.value)}
                  required
                />
              </FormField>
            </div>

            <FormField label="Dia Fechamento">
              <Input
                type="number"
                min={1}
                max={31}
                tabular
                value={cardClosing}
                onChange={(e) => setCardClosing(Number(e.target.value))}
                required
              />
            </FormField>

            <FormField label="Dia Vencimento">
              <Input
                type="number"
                min={1}
                max={31}
                tabular
                value={cardDue}
                onChange={(e) => setCardDue(Number(e.target.value))}
                required
              />
            </FormField>
          </div>

          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-slate-700 dark:text-zinc-300 block">
              Cor do Cartão
            </label>
            <div className="flex flex-wrap items-center gap-2">
              {COLOR_SWATCH_OPTIONS.map((swatch) => (
                <button
                  key={swatch}
                  type="button"
                  onClick={() => setCardColor(swatch)}
                  className={`h-7 w-7 rounded-full border transition-transform ${
                    cardColor.toLowerCase() === swatch.toLowerCase()
                      ? 'scale-110 ring-2 ring-offset-2 ring-indigo-500 dark:ring-offset-zinc-900'
                      : 'opacity-80 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: swatch }}
                  title={swatch}
                />
              ))}
              <input
                type="color"
                value={cardColor}
                onChange={(e) => setCardColor(e.target.value)}
                className="h-8 w-10 rounded-lg border border-slate-200 dark:border-zinc-800 bg-transparent p-0.5 cursor-pointer"
                title="Escolher cor personalizada"
              />
            </div>
          </div>
        </form>
      </Modal>
      <Modal
        isOpen={Boolean(isPayInvoiceModalOpen)}
        onClose={closeModal}
        title={`Pagar Fatura - ${isPayInvoiceModalOpen?.name || ''}`}
        subtitle="O valor será debitado da conta bancária selecionada e o limite do cartão será restabelecido"
        footer={
          <>
            <Button variant="secondary" onClick={closeModal}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              type="submit"
              form="form-pay-invoice"
              isLoading={isSubmitting}
            >
              Confirmar Pagamento
            </Button>
          </>
        }
      >
        <form id="form-pay-invoice" onSubmit={handlePayInvoice} className="space-y-4">
          <div className="rounded-xl bg-slate-50 dark:bg-zinc-950 p-4 border border-slate-200 dark:border-zinc-800 tabular-nums">
            <span className="text-xs text-slate-400">Valor Total da Fatura</span>
            <div className="text-2xl font-semibold text-rose-600 dark:text-rose-400 mt-0.5">
              {formatCentsToBRL(isPayInvoiceModalOpen?.currentInvoiceInCents || 0, hideValues)}
            </div>
          </div>

          <FormField label="Debitar de qual Conta Bancária?">
            <Select
              value={payAccountSource}
              onChange={(e) => setPayAccountSource(e.target.value)}
            >
              {activeAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({formatCentsToBRL(a.currentBalanceInCents, hideValues)})
                </option>
              ))}
            </Select>
          </FormField>
        </form>
      </Modal>
    </>
  );
}