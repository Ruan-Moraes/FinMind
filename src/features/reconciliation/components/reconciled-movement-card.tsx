'use client';
import * as React from 'react';
import { Building2 } from 'lucide-react';
import { Input, Select } from '@/shared/ui/input';
import { Badge } from '@/shared/ui/badge';
import { formatCentsToBRL } from '@/shared/lib/currency';
import type { ReconciledStatementItem } from '@/features/reconciliation/engine';
import { getConfidenceBadge, getCurrentSelectLinkValue, getDecisionBadge } from '@/features/reconciliation/components/reconciliation-ui-helpers';

export function ReconciledMovementCard(props: {
  item: ReconciledStatementItem;
  hideValues: boolean;
  categories: Array<{ id: string; name: string }>;
  recurrenceRules: Array<{ id: string; description: string; amountInCents: number }>;
  existingTransactions: Array<{ id: string; description: string; amountInCents: number; date: string; status: string }>;
  handleUpdateReviewItem: (itemId: string, patch: Partial<ReconciledStatementItem>) => void;
  handleChangeReconciliationLink: (itemId: string, val: string) => void;
}) {
  const {
    item, hideValues, categories, recurrenceRules, existingTransactions,
    handleUpdateReviewItem, handleChangeReconciliationLink,
  } = props;
  const isDup = item.decisionType === 'SKIP_DUPLICATE';
  return (
                <div
                  key={item.itemId}
                  className={`rounded-2xl border p-4 transition-all space-y-3 ${
                    !item.selectedForImport
                      ? 'border-slate-200/70 dark:border-zinc-800/60 bg-slate-100/50 dark:bg-zinc-950/40 opacity-65'
                      : item.requiresUserAttention || item.confidenceLevel === 'LOW'
                      ? 'border-amber-300 dark:border-amber-800/80 bg-white dark:bg-zinc-950 shadow-sm'
                      : 'border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-sm'
                  }`}
                >
                  {/* Topo do Card: Checkbox, Descrição Bancária Original, Arquivo, Badges de Decisão e Confiança, Valor */}
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <input
                        type="checkbox"
                        checked={item.selectedForImport}
                        disabled={isDup}
                        onChange={(e) =>
                          handleUpdateReviewItem(item.itemId, {
                            selectedForImport: e.target.checked,
                          })
                        }
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />

                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-bold text-slate-900 dark:text-zinc-100 bg-slate-100 dark:bg-zinc-900 px-2 py-0.5 rounded-md">
                            {item.originalDescription}
                          </span>
                          {getDecisionBadge(item)}
                          {getConfidenceBadge(item.confidenceLevel, item.confidenceScore)}
                          {item.matchPrecision === 'PARTIAL_PAYMENT' && (
                            <Badge variant="warning">Pagamento Parcial</Badge>
                          )}
                          {item.matchPrecision === 'VALUE_VARIATION' && (
                            <Badge variant="warning">Variação de Valor</Badge>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-zinc-400">
                          <span className="inline-flex items-center gap-1">
                            <Building2 className="h-3 w-3" /> {item.bankName} ({item.fileName})
                          </span>
                          <span>•</span>
                          <span>
                            Ação identificada:{' '}
                            <strong className="text-slate-700 dark:text-zinc-200">
                              {item.financialActionLabel}
                            </strong>
                          </span>
                          {item.counterparty && (
                            <>
                              <span>•</span>
                              <span>
                                Origem/Destinatário: <strong>{item.counterparty}</strong>
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between lg:justify-end gap-3 shrink-0 tabular-nums">
                      <div
                        className={`text-base font-bold ${
                          item.type === 'INCOME'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : item.type === 'TRANSFER'
                            ? 'text-indigo-600 dark:text-indigo-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {item.type === 'INCOME' ? '+' : item.type === 'TRANSFER' ? '⇄ ' : '-'}
                        {formatCentsToBRL(item.amountInCents, hideValues)}
                      </div>
                    </div>
                  </div>

                  {/* Explicação Transparente do Motivo da IA (Seção 8.3) */}
                  <div className="rounded-xl bg-slate-50 dark:bg-zinc-900/80 border border-slate-200/70 dark:border-zinc-800/80 px-3 py-2 text-xs text-slate-600 dark:text-zinc-300 flex items-start justify-between gap-2">
                    <div>
                      <span className="font-semibold text-slate-800 dark:text-zinc-200">
                        Motivo da decisão:{' '}
                      </span>
                      <span>{item.reasonSummary}</span>
                    </div>
                  </div>

                  {/* Controles Editáveis de Classificação e Conciliação (Seção 8.4) */}
                  {!isDup && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5 pt-1">
                      {/* 1. Data */}
                      <div>
                        <label className="block text-[10px] font-semibold uppercase text-slate-400 mb-1">
                          Data
                        </label>
                        <Input
                          type="date"
                          value={item.date}
                          onChange={(e) =>
                            handleUpdateReviewItem(item.itemId, { date: e.target.value })
                          }
                          className="h-8 text-xs px-2"
                        />
                      </div>

                      {/* 2. Descrição Final */}
                      <div className="lg:col-span-2">
                        <label className="block text-[10px] font-semibold uppercase text-slate-400 mb-1">
                          Descrição Normalizada no Sistema
                        </label>
                        <Input
                          value={item.normalizedDescription}
                          onChange={(e) =>
                            handleUpdateReviewItem(item.itemId, {
                              normalizedDescription: e.target.value,
                            })
                          }
                          className="h-8 text-xs px-2.5"
                        />
                      </div>

                      {/* 3. Vínculo de Conciliação (Associar a lançamento existente ou Criar Novo) */}
                      <div className="lg:col-span-2">
                        <label className="block text-[10px] font-semibold uppercase text-slate-400 mb-1">
                          Conciliação / Lançamento Correspondente
                        </label>
                        <Select
                          value={getCurrentSelectLinkValue(item)}
                          onChange={(e) =>
                            handleChangeReconciliationLink(item.itemId, e.target.value)
                          }
                          className="h-8 text-xs px-2"
                        >
                          <option value="NEW_ENTRY">
                            + Criar como Novo Lançamento ({item.type === 'INCOME' ? 'Receita' : 'Despesa'})
                          </option>
                          <option value="SELF_TRANSFER">
                            ⇄ Transferência entre Contas Próprias
                          </option>
                          <option value="DISCARD">✕ Descartar esta movimentação</option>
                          {recurrenceRules.length > 0 && (
                            <optgroup label="Conciliar com Lançamento Fixo / Recorrente">
                              {recurrenceRules.map((r) => (
                                <option key={r.id} value={`RULE:${r.id}`}>
                                  Fixo: {r.description} — {formatCentsToBRL(r.amountInCents)}
                                </option>
                              ))}
                            </optgroup>
                          )}
                          {existingTransactions.length > 0 && (
                            <optgroup label="Conciliar com Lançamento do Período">
                              {existingTransactions.slice(0, 30).map((t) => (
                                <option key={t.id} value={`TX:${t.id}`}>
                                  {t.status === 'PENDING' ? '[Previsto] ' : ''}
                                  {t.description} — {formatCentsToBRL(t.amountInCents)} (
                                  {t.date.slice(0, 10).split('-').reverse().join('/')})
                                </option>
                              ))}
                            </optgroup>
                          )}
                        </Select>
                      </div>

                      {/* 4. Categoria e Natureza */}
                      <div className="grid grid-cols-2 gap-1.5">
                        <div>
                          <label className="block text-[10px] font-semibold uppercase text-slate-400 mb-1">
                            Categoria
                          </label>
                          <Select
                            value={item.categoryId}
                            onChange={(e) =>
                              handleUpdateReviewItem(item.itemId, {
                                categoryId: e.target.value,
                              })
                            }
                            className="h-8 text-xs px-1.5"
                          >
                            <option value="">Sem Categoria</option>
                            {categories.map((cat) => (
                              <option key={cat.id} value={cat.id}>
                                {cat.name}
                              </option>
                            ))}
                          </Select>
                        </div>

                        <div>
                          <label className="block text-[10px] font-semibold uppercase text-slate-400 mb-1">
                            Natureza
                          </label>
                          <Select
                            value={item.nature}
                            onChange={(e) =>
                              handleUpdateReviewItem(item.itemId, {
                                nature: e.target.value as 'STATIC' | 'VARIABLE',
                              })
                            }
                            className="h-8 text-xs px-1.5"
                          >
                            <option value="VARIABLE">Variável</option>
                            <option value="STATIC">Fixo</option>
                          </Select>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
  );
}