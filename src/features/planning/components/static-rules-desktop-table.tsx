'use client';

import * as React from 'react';
import { CalendarClock } from 'lucide-react';
import { useWorkbench } from '@/features/dashboard/context/workbench-context';
import { Badge } from '@/shared/ui/badge';
import { formatCentsToBRL } from '@/shared/lib/currency';
import { CategoryIconBadge } from '@/shared/ui/entity-icons';
import { deleteRecurrenceRuleAction } from '@/features/planning/actions/recurrence-categories.actions';
import { StaticRuleMonthAmountCell } from '@/features/planning/components/static-rule-month-amount-cell';
import { StaticRuleStatusCell } from '@/features/planning/components/static-rule-status-cell';
import { StaticRuleRowMenu } from '@/features/planning/components/static-rule-row-menu';
import { resolveRecurrenceRuleDueDate } from '@/features/planning/domain/business-days';
import {
  getNextMonthLabelPt, getRuleEffectiveAmountForMonth, hasRuleMonthOverride,
  isRuleSkippedInMonth, resolveMonthlyRuleExecutionStatus,
} from '@/features/planning/domain/recurrence-month-skip';

const normalizeText = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

interface StaticRulesDesktopTableProps {
  togglingId: string | null;
  onToggleSkip: (ruleId: string, ruleDescription: string) => Promise<void>;
}

export function StaticRulesDesktopTable({ togglingId, onToggleSkip }: StaticRulesDesktopTableProps) {
  const { props, wb } = useWorkbench();
  const { recurrenceRules, transactions, selectedMonth, selectedYear, holidays = [] } = props;
  const { router, hideValues, setPendingDelete, handleOpenEditStaticRuleModal } = wb;
  const [editingAmountId, setEditingAmountId] = React.useState<string | null>(null);

  const staticTxs = transactions.filter((t) => t.nature === 'STATIC' && t.status !== 'PENDING');
  const nextMonthLabel = getNextMonthLabelPt(selectedYear, selectedMonth);

  const activeRules = recurrenceRules.filter((r) => !isRuleSkippedInMonth(r, selectedYear, selectedMonth));
  const activeStaticRules = activeRules.filter((r) => r.nature === 'STATIC');
  const skippedCount = recurrenceRules.length - activeRules.length;
  const rulesIncomeTotal = activeStaticRules
    .filter((r) => r.type === 'INCOME')
    .reduce((acc, r) => acc + getRuleEffectiveAmountForMonth(r, selectedYear, selectedMonth), 0);
  const rulesExpenseTotal = activeStaticRules
    .filter((r) => r.type === 'EXPENSE')
    .reduce((acc, r) => acc + getRuleEffectiveAmountForMonth(r, selectedYear, selectedMonth), 0);

  const hasMatchingTxInMonth = (rule: (typeof recurrenceRules)[number], effectiveAmount: number) => {
    const ruleNorm = normalizeText(rule.description);
    return staticTxs.some((tx) => {
      if (tx.type !== rule.type) return false;
      if ('recurrenceRuleId' in tx && tx.recurrenceRuleId === rule.id) return true;
      const txNorm = normalizeText(tx.description);
      return (
        txNorm === ruleNorm || txNorm.includes(ruleNorm) || ruleNorm.includes(txNorm) ||
        tx.amountInCents === effectiveAmount || tx.amountInCents === rule.amountInCents
      );
    });
  };

  return (
    <div data-agent-id="goals.table.staticRules" className="hidden md:block rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-slate-100 dark:border-zinc-800/80">
        <div className="flex items-center gap-2.5 text-xs font-semibold text-slate-900 dark:text-zinc-100">
          <CalendarClock className="h-4 w-4 text-indigo-500 shrink-0" />
          <span>Regras Fixas Mensais</span>
          <Badge variant="neutral">{recurrenceRules.length}</Badge>
          {skippedCount > 0 && (
            <Badge variant="warning">
              {skippedCount} {skippedCount === 1 ? 'pulado' : 'pulados'}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs tabular-nums">
          {rulesIncomeTotal > 0 && (
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
              +{formatCentsToBRL(rulesIncomeTotal, hideValues)}
            </span>
          )}
          {rulesExpenseTotal > 0 && (
            <span className="text-rose-600 dark:text-rose-400 font-semibold">
              −{formatCentsToBRL(rulesExpenseTotal, hideValues)}
            </span>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left border-collapse">
          <colgroup>
            <col className="w-[38%]" />
            <col className="w-[18%]" />
            <col className="w-[22%]" />
            <col className="w-[16%]" />
            <col className="w-[6%]" />
          </colgroup>
          <thead className="text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:text-zinc-500 bg-slate-50/50 dark:bg-zinc-900/35 border-b border-slate-100 dark:border-zinc-800/80">
            <tr>
              <th className="py-2.5 px-5 align-middle text-left">Item</th>
              <th className="py-2.5 px-4 align-middle text-left whitespace-nowrap">Vencimento</th>
              <th className="py-2.5 px-4 align-middle text-left whitespace-nowrap">Status no Mês</th>
              <th className="py-2.5 px-4 align-middle text-right whitespace-nowrap">Valor no Mês</th>
              <th className="py-2.5 px-4 align-middle text-center whitespace-nowrap">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/70 tabular-nums">
            {recurrenceRules.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-10 text-center text-xs text-slate-400 dark:text-zinc-500">
                  Nenhuma regra fixa mensal cadastrada. Clique em &ldquo;Novo Ganho Estático&rdquo;
                  ou &ldquo;Novo Custo Estático&rdquo; acima.
                </td>
              </tr>
            ) : (
              recurrenceRules.map((rule) => {
                const skipped = isRuleSkippedInMonth(rule, selectedYear, selectedMonth);
                const effectiveAmount = getRuleEffectiveAmountForMonth(rule, selectedYear, selectedMonth);
                const hasOverride = hasRuleMonthOverride(rule, selectedYear, selectedMonth);
                const due = resolveRecurrenceRuleDueDate({
                  dayOfMonth: rule.dayOfMonth, dayType: rule.dayType,
                  includeSaturday: rule.includeSaturday, year: selectedYear, month: selectedMonth, holidays,
                });
                const dueDay = due.isBusinessDay
                  ? due.resolution.day
                  : Math.min(rule.dayOfMonth, new Date(selectedYear, selectedMonth, 0).getDate());
                const execStatus = resolveMonthlyRuleExecutionStatus({
                  isSkipped: skipped,
                  hasMatchingTx: !skipped && hasMatchingTxInMonth(rule, effectiveAmount),
                  dueYear: selectedYear, dueMonth: selectedMonth, dueDay,
                });
                const shortDueDate = `${String(dueDay).padStart(2, '0')}/${String(selectedMonth).padStart(2, '0')}`;
                const subtitle = [
                  rule.categoryName,
                  rule.creditCardName ? `Cartão ${rule.creditCardName}` : rule.accountName,
                ]
                  .filter(Boolean)
                  .join(' • ');

                return (
                  <tr
                    key={`rule-${rule.id}`}
                    className={`transition-colors ${
                      skipped
                        ? 'opacity-60 bg-slate-50/40 dark:bg-zinc-900/30'
                        : 'hover:bg-slate-50/70 dark:hover:bg-zinc-900/45'
                    }`}
                  >
                    <td className="py-3.5 px-5 align-middle">
                      <div className="flex items-center gap-3 min-w-0">
                        <CategoryIconBadge
                          icon={rule.categoryIcon}
                          name={rule.categoryName || rule.description}
                          color={rule.categoryColor || (rule.type === 'INCOME' ? '#10b981' : '#f43f5e')}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <div
                            className={`font-medium leading-snug truncate ${
                              skipped ? 'line-through text-slate-400 dark:text-zinc-500' : 'text-slate-900 dark:text-zinc-100'
                            }`}
                          >
                            {rule.description}
                          </div>
                          {subtitle && (
                            <div className="text-xs text-slate-400 dark:text-zinc-500 truncate mt-0.5">
                              {subtitle}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 align-middle whitespace-nowrap">
                      <div className="text-xs font-medium text-slate-700 dark:text-zinc-200">{due.label}</div>
                      {due.isBusinessDay && (
                        <div className="text-[11px] text-indigo-600 dark:text-indigo-400 mt-0.5">
                          Cai em {due.resolution.formattedDate} ({due.resolution.weekdayShort})
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 align-middle whitespace-nowrap">
                      <StaticRuleStatusCell
                        execStatus={execStatus}
                        shortDueDate={shortDueDate}
                        nextMonthLabel={nextMonthLabel}
                      />
                    </td>
                    <td className="py-3.5 px-4 align-middle text-right whitespace-nowrap">
                      <StaticRuleMonthAmountCell
                        ruleId={rule.id} ruleType={rule.type} baseAmountInCents={rule.amountInCents}
                        effectiveAmountInCents={effectiveAmount} hasOverride={hasOverride} isSkipped={skipped}
                        selectedMonth={selectedMonth} selectedYear={selectedYear}
                        hideValues={hideValues} onSaved={() => router.refresh()} align="right"
                        isEditing={editingAmountId === rule.id}
                        onStartEdit={() => setEditingAmountId(rule.id)}
                        onStopEdit={() => setEditingAmountId(null)}
                      />
                    </td>
                    <td className="py-3.5 px-4 align-middle text-center whitespace-nowrap">
                      <StaticRuleRowMenu
                        ruleDescription={rule.description}
                        isSkipped={skipped}
                        isToggling={togglingId === rule.id}
                        selectedMonth={selectedMonth}
                        selectedYear={selectedYear}
                        nextMonthLabel={nextMonthLabel}
                        onAdjustMonthAmount={() => setEditingAmountId(rule.id)}
                        onToggleSkip={() => void onToggleSkip(rule.id, rule.description)}
                        onEditRule={() => handleOpenEditStaticRuleModal(rule)}
                        onDeleteRule={() =>
                          setPendingDelete({
                            title: rule.type === 'INCOME' ? 'Excluir Ganho Estático' : 'Excluir Custo Estático',
                            entityName: rule.description,
                            description: 'Tem certeza que deseja remover esta regra mensal fixa? Ela deixará de compor sua linha de base estática.',
                            confirmLabel: 'Sim, Excluir Regra',
                            onConfirm: () => deleteRecurrenceRuleAction(rule.id),
                          })
                        }
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
