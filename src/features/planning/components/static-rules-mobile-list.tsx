'use client';

import * as React from 'react';
import { useWorkbench } from '@/features/dashboard/context/workbench-context';
import { Badge } from '@/shared/ui/badge';
import { CategoryIconBadge } from '@/shared/ui/entity-icons';
import { deleteRecurrenceRuleAction } from '@/features/planning/actions/recurrence-categories.actions';
import { StaticRuleMonthAmountCell } from '@/features/planning/components/static-rule-month-amount-cell';
import { StaticRuleRowMenu } from '@/features/planning/components/static-rule-row-menu';
import { resolveRecurrenceRuleDueDate } from '@/features/planning/domain/business-days';
import {
  getNextMonthLabelPt,
  getRuleEffectiveAmountForMonth,
  hasRuleMonthOverride,
  isRuleSkippedInMonth,
} from '@/features/planning/domain/recurrence-month-skip';

interface StaticRulesMobileListProps {
  togglingId: string | null;
  onToggleSkip: (ruleId: string, ruleDescription: string) => Promise<void>;
}

export function StaticRulesMobileList({
  togglingId,
  onToggleSkip,
}: StaticRulesMobileListProps) {
  const { props, wb } = useWorkbench();
  const { recurrenceRules, transactions, selectedMonth, selectedYear, holidays = [] } = props;
  const { router, hideValues, setPendingDelete, handleOpenEditStaticRuleModal } = wb;
  const [editingAmountId, setEditingAmountId] = React.useState<string | null>(null);
  const nextMonthLabel = getNextMonthLabelPt(selectedYear, selectedMonth);

  return (
    <div className="md:hidden space-y-2.5 tabular-nums">
      {recurrenceRules.length === 0 &&
      transactions.filter((t) => t.nature === 'STATIC').length === 0 ? (
        <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 text-center text-xs text-slate-400">
          Nenhum ganho ou custo estático cadastrado.
        </div>
      ) : (
        recurrenceRules.map((rule) => {
          const skipped = isRuleSkippedInMonth(rule, selectedYear, selectedMonth);
          const effectiveAmount = getRuleEffectiveAmountForMonth(
            rule,
            selectedYear,
            selectedMonth
          );
          const hasOverride = hasRuleMonthOverride(rule, selectedYear, selectedMonth);
          const due = resolveRecurrenceRuleDueDate({
            dayOfMonth: rule.dayOfMonth,
            dayType: rule.dayType,
            includeSaturday: rule.includeSaturday,
            year: selectedYear,
            month: selectedMonth,
            holidays,
          });
          return (
            <div
              key={`mob-rule-${rule.id}`}
              className={`rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-3.5 space-y-2 ${
                skipped ? 'opacity-65' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <CategoryIconBadge
                    icon={rule.categoryIcon}
                    name={rule.categoryName || rule.description}
                    color={rule.categoryColor || (rule.type === 'INCOME' ? '#10b981' : '#f43f5e')}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <div
                      className={`font-medium text-sm truncate ${
                        skipped ? 'line-through text-slate-400' : ''
                      }`}
                    >
                      {rule.description}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                      {due.isBusinessDay ? `${due.label} (${due.resolution.formattedDate})` : due.label}{' '}
                      • {[rule.categoryName, rule.creditCardName ? `Cartão ${rule.creditCardName}` : rule.accountName].filter(Boolean).join(' • ') || 'Padrão'}
                    </div>
                  </div>
                </div>
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
                      title:
                        rule.type === 'INCOME'
                          ? 'Excluir Ganho Estático'
                          : 'Excluir Custo Estático',
                      entityName: rule.description,
                      description: 'Tem certeza que deseja remover esta regra mensal fixa?',
                      confirmLabel: 'Sim, Excluir Regra',
                      onConfirm: () => deleteRecurrenceRuleAction(rule.id),
                    })
                  }
                />
              </div>
              <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-100 dark:border-zinc-900">
                <div>
                  {skipped ? (
                    <Badge variant="warning">Não conta • volta em {nextMonthLabel}</Badge>
                  ) : (
                    <span className="text-[11px] text-slate-400 dark:text-zinc-500">
                      Toque no valor para ajustar no mês
                    </span>
                  )}
                </div>
                <StaticRuleMonthAmountCell
                  ruleId={rule.id}
                  ruleType={rule.type}
                  baseAmountInCents={rule.amountInCents}
                  effectiveAmountInCents={effectiveAmount}
                  hasOverride={hasOverride}
                  isSkipped={skipped}
                  selectedMonth={selectedMonth}
                  selectedYear={selectedYear}
                  hideValues={hideValues}
                  onSaved={() => router.refresh()}
                  isEditing={editingAmountId === rule.id}
                  onStartEdit={() => setEditingAmountId(rule.id)}
                  onStopEdit={() => setEditingAmountId(null)}
                />
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
