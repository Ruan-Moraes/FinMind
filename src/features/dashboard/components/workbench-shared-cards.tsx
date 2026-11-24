'use client';
import * as React from 'react';
import { TrendingUp, TrendingDown, Lock, ArrowLeftRight, Pencil, Trash2, Clock } from 'lucide-react';
import { Badge } from '@/shared/ui/badge';
import { CategoryIconBadge } from '@/shared/ui/entity-icons';
import { formatCentsToBRL, MONTH_NAMES_PT } from '@/shared/lib/currency';
import type { PortfolioGoalProgress } from '@/features/analytics';

/**
 * Card de Categoria Padronizado com Ícone Dinâmico, Badges com Ícones e Ações Rápidas
 */
export function CategoryCardItem({
  cat,
  onEdit,
  onDelete,
}: {
  cat: {
    id: string;
    name: string;
    type: string;
    defaultNature: string;
    color: string;
    icon?: string;
  };
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="group relative rounded-2xl border border-slate-200/90 dark:border-zinc-800/90 bg-white dark:bg-zinc-950 p-4 flex items-center justify-between gap-3.5 shadow-sm hover:border-indigo-500/40 dark:hover:border-indigo-500/40 hover:shadow-md transition-all">
      <div className="flex items-center gap-3.5 min-w-0">
        <CategoryIconBadge
          icon={cat.icon}
          name={cat.name}
          color={cat.color}
          size="lg"
          showDot
        />
        <div className="min-w-0 space-y-1.5">
          <div className="font-semibold text-sm text-slate-900 dark:text-zinc-100 truncate leading-tight">
            {cat.name}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge
              variant={cat.type === 'INCOME' ? 'income' : 'expense'}
              className="gap-1 px-2 py-0.5"
            >
              {cat.type === 'INCOME' ? (
                <TrendingUp className="h-3 w-3 shrink-0" />
              ) : (
                <TrendingDown className="h-3 w-3 shrink-0" />
              )}
              <span>{cat.type === 'INCOME' ? 'Receita' : 'Despesa'}</span>
            </Badge>
            <Badge
              variant={cat.defaultNature === 'STATIC' ? 'static' : 'variable'}
              className="gap-1 px-2 py-0.5"
            >
              {cat.defaultNature === 'STATIC' ? (
                <Lock className="h-3 w-3 shrink-0" />
              ) : (
                <ArrowLeftRight className="h-3 w-3 shrink-0" />
              )}
              <span>{cat.defaultNature === 'STATIC' ? 'Fixo / Estático' : 'Variável'}</span>
            </Badge>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={onEdit}
          className="h-8 w-8 rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-slate-50/80 dark:bg-zinc-900/80 text-slate-500 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-300 dark:hover:border-indigo-800 hover:bg-indigo-50/70 dark:hover:bg-indigo-950/40 flex items-center justify-center transition-colors"
          title="Editar categoria"
          aria-label={`Editar categoria ${cat.name}`}
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="h-8 w-8 rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-slate-50/80 dark:bg-zinc-900/80 text-slate-500 dark:text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-300 dark:hover:border-rose-800 hover:bg-rose-50/70 dark:hover:bg-rose-950/40 flex items-center justify-center transition-colors"
          title="Excluir categoria"
          aria-label={`Excluir categoria ${cat.name}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

/**
 * Componente de Previsão da Meta ("Do jeito que estou indo, quanto tempo vai demorar e se consigo alcançar no prazo")
 */
export function GoalForecastBanner({
  goal,
  hideValues,
}: {
  goal: PortfolioGoalProgress;
  hideValues: boolean;
}) {
  const statusConfig = {
    ACHIEVED: {
      badgeVariant: 'income' as const,
      badgeLabel: 'Conseguida!',
      headline: 'Você já alcançou esta meta no seu saldo atual!',
      boxClass:
        'border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/50 dark:bg-emerald-950/30',
    },
    AHEAD: {
      badgeVariant: 'income' as const,
      badgeLabel: 'Sim, alcança antes do prazo',
      headline: `Do jeito que você está indo, você consegue alcançar a meta em ${
        goal.estimatedMonthsToReach
      } ${goal.estimatedMonthsToReach === 1 ? 'mês' : 'meses'} (${
        goal.estimatedCompletionMonth ? MONTH_NAMES_PT[goal.estimatedCompletionMonth - 1] : ''
      }/${goal.estimatedCompletionYear}) — antes do prazo!`,
      boxClass:
        'border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/50 dark:bg-emerald-950/30',
    },
    ON_TRACK: {
      badgeVariant: 'income' as const,
      badgeLabel: 'Sim, alcança no prazo',
      headline: `Do jeito que você está indo, você consegue alcançar a meta dentro do prazo (${
        goal.estimatedMonthsToReach
      } ${goal.estimatedMonthsToReach === 1 ? 'mês' : 'meses'} — ${
        goal.estimatedCompletionMonth ? MONTH_NAMES_PT[goal.estimatedCompletionMonth - 1] : ''
      }/${goal.estimatedCompletionYear}).`,
      boxClass:
        'border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/50 dark:bg-emerald-950/30',
    },
    BEHIND: {
      badgeVariant: 'warning' as const,
      badgeLabel: 'Não alcança até o prazo',
      headline: `Do jeito que você está indo, vai demorar ${goal.estimatedMonthsToReach} ${
        goal.estimatedMonthsToReach === 1 ? 'mês' : 'meses'
      } (chegando só em ${
        goal.estimatedCompletionMonth ? MONTH_NAMES_PT[goal.estimatedCompletionMonth - 1] : ''
      }/${goal.estimatedCompletionYear}, após ${MONTH_NAMES_PT[goal.targetMonth - 1]}/${
        goal.targetYear
      }).`,
      boxClass:
        'border-amber-200 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/30',
    },
    STALLED: {
      badgeVariant: 'expense' as const,
      badgeLabel: 'Não alcança no ritmo atual',
      headline:
        'Do jeito que você está indo (sobra mensal zero ou negativa), você não conseguirá alcançar a meta sem reduzir gastos ou elevar receitas.',
      boxClass:
        'border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/30',
    },
  }[goal.paceStatus];

  return (
    <div className={`rounded-xl border p-4 space-y-3 ${statusConfig.boxClass}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-slate-600 dark:text-zinc-300 shrink-0" />
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-zinc-200">
            Previsão no Ritmo Atual
          </span>
        </div>
        <Badge variant={statusConfig.badgeVariant}>{statusConfig.badgeLabel}</Badge>
      </div>

      <p className="text-xs font-medium text-slate-800 dark:text-zinc-200 leading-relaxed">
        {statusConfig.headline}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 text-xs tabular-nums">
        <div className="rounded-lg bg-white/80 dark:bg-zinc-950/80 border border-slate-200/70 dark:border-zinc-800 p-2.5">
          <span className="text-slate-400 block text-[11px]">Seu Ritmo Atual</span>
          <strong
            className={`text-sm ${
              goal.currentMonthlyPaceInCents > 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {goal.currentMonthlyPaceInCents > 0 ? '+' : ''}
            {formatCentsToBRL(goal.currentMonthlyPaceInCents, hideValues)}/mês
          </strong>
        </div>

        <div className="rounded-lg bg-white/80 dark:bg-zinc-950/80 border border-slate-200/70 dark:border-zinc-800 p-2.5">
          <span className="text-slate-400 block text-[11px]">Tempo p/ Alcançar</span>
          <strong className="text-sm text-slate-900 dark:text-zinc-100">
            {goal.isAchieved
              ? 'Já alcançada (0 meses)'
              : goal.estimatedMonthsToReach !== null
              ? `${goal.estimatedMonthsToReach} ${
                  goal.estimatedMonthsToReach === 1 ? 'mês' : 'meses'
                }`
              : 'Indeterminado'}
          </strong>
        </div>

        <div className="rounded-lg bg-white/80 dark:bg-zinc-950/80 border border-slate-200/70 dark:border-zinc-800 p-2.5">
          <span className="text-slate-400 block text-[11px]">
            Necessário p/ {MONTH_NAMES_PT[goal.targetMonth - 1].slice(0, 3)}/{goal.targetYear}
          </span>
          <strong className="text-sm text-indigo-600 dark:text-indigo-400">
            {goal.isAchieved
              ? 'R$ 0,00/mês'
              : `${formatCentsToBRL(
                  goal.recommendedMonthlyContributionInCents,
                  hideValues
                )}/mês`}
          </strong>
        </div>
      </div>

      {!goal.isAchieved && goal.monthlyPaceGapInCents > 0 && (
        <div className="text-[11px] font-medium text-amber-700 dark:text-amber-300 tabular-nums">
          Para conseguir bater a meta dentro do prazo ({MONTH_NAMES_PT[goal.targetMonth - 1]}/
          {goal.targetYear}), economize mais{' '}
          <strong>+{formatCentsToBRL(goal.monthlyPaceGapInCents, hideValues)}/mês</strong>.
        </div>
      )}
    </div>
  );
}
