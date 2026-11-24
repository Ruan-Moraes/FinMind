'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import {
  CalendarOff,
  Loader2,
  MoreHorizontal,
  Pencil,
  RotateCcw,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
import { MONTH_NAMES_PT } from '@/shared/lib/currency';

interface StaticRuleRowMenuProps {
  ruleDescription: string;
  isSkipped: boolean;
  isToggling: boolean;
  selectedMonth: number;
  selectedYear: number;
  nextMonthLabel: string;
  onAdjustMonthAmount: () => void;
  onToggleSkip: () => void;
  onEditRule: () => void;
  onDeleteRule: () => void;
}

export function StaticRuleRowMenu({
  ruleDescription,
  isSkipped,
  isToggling,
  selectedMonth,
  selectedYear,
  nextMonthLabel,
  onAdjustMonthAmount,
  onToggleSkip,
  onEditRule,
  onDeleteRule,
}: StaticRuleRowMenuProps) {
  const [open, setOpen] = React.useState(false);
  const [pos, setPos] = React.useState<{ top: number; left: number; openAbove: boolean } | null>(
    null
  );
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);

  const currentMonthLabel = `${MONTH_NAMES_PT[selectedMonth - 1]}/${selectedYear}`;

  const updatePosition = React.useCallback(() => {
    const btn = buttonRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const menuWidth = 248;
    const menuHeight = 250;
    const margin = 8;
    const openAbove =
      window.innerHeight - rect.bottom < menuHeight + margin && rect.top > menuHeight + margin;

    const left = Math.max(
      margin,
      Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - margin)
    );
    const top = openAbove ? rect.top - 6 : rect.bottom + 6;
    setPos({ top, left, openAbove });
  }, []);

  React.useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    const onResizeOrScroll = () => updatePosition();
    window.addEventListener('resize', onResizeOrScroll);
    window.addEventListener('scroll', onResizeOrScroll, true);
    return () => {
      window.removeEventListener('resize', onResizeOrScroll);
      window.removeEventListener('scroll', onResizeOrScroll, true);
    };
  }, [open, updatePosition]);

  React.useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const runAndClose = (fn: () => void) => {
    setOpen(false);
    fn();
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        disabled={isToggling}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Ações para ${ruleDescription}`}
        title="Mais ações"
        onClick={() => setOpen((prev) => !prev)}
        className={`h-8 w-8 inline-flex items-center justify-center rounded-lg transition-colors ${
          open
            ? 'bg-slate-100 dark:bg-zinc-800 text-slate-900 dark:text-zinc-100'
            : 'text-slate-400 hover:text-slate-800 dark:hover:text-zinc-100 hover:bg-slate-100 dark:hover:bg-zinc-800/80'
        }`}
      >
        {isToggling ? (
          <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
        ) : (
          <MoreHorizontal className="h-4 w-4" />
        )}
      </button>

      {open &&
        pos &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label={`Menu de ações de ${ruleDescription}`}
            style={{
              position: 'fixed',
              top: pos.top,
              left: pos.left,
              width: 248,
              transform: pos.openAbove ? 'translateY(-100%)' : undefined,
            }}
            className="z-[150] rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-2xl p-1.5 text-left"
          >
            <div className="px-2.5 pt-1.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
              Apenas em {currentMonthLabel}
            </div>

            {!isSkipped && (
              <button
                type="button"
                role="menuitem"
                onClick={() => runAndClose(onAdjustMonthAmount)}
                className="w-full flex items-start gap-2.5 px-2.5 py-2 rounded-lg text-xs text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-900 transition-colors"
              >
                <SlidersHorizontal className="h-3.5 w-3.5 mt-0.5 text-indigo-500 shrink-0" />
                <span className="min-w-0">
                  <span className="block font-medium">Ajustar valor neste mês</span>
                  <span className="block text-[11px] text-slate-400 dark:text-zinc-500">
                    Não altera os próximos meses
                  </span>
                </span>
              </button>
            )}

            <button
              type="button"
              role="menuitem"
              onClick={() => runAndClose(onToggleSkip)}
              className="w-full flex items-start gap-2.5 px-2.5 py-2 rounded-lg text-xs text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-900 transition-colors"
            >
              {isSkipped ? (
                <RotateCcw className="h-3.5 w-3.5 mt-0.5 text-emerald-500 shrink-0" />
              ) : (
                <CalendarOff className="h-3.5 w-3.5 mt-0.5 text-amber-500 shrink-0" />
              )}
              <span className="min-w-0">
                <span className="block font-medium">
                  {isSkipped ? 'Reativar neste mês' : 'Pular neste mês'}
                </span>
                <span className="block text-[11px] text-slate-400 dark:text-zinc-500">
                  {isSkipped ? 'Volta a contar no orçamento' : `Volta em ${nextMonthLabel}`}
                </span>
              </span>
            </button>

            <div className="my-1.5 border-t border-slate-100 dark:border-zinc-800/80" />

            <div className="px-2.5 pt-0.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
              Regra mensal fixa
            </div>

            <button
              type="button"
              role="menuitem"
              onClick={() => runAndClose(onEditRule)}
              className="w-full flex items-start gap-2.5 px-2.5 py-2 rounded-lg text-xs text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-900 transition-colors"
            >
              <Pencil className="h-3.5 w-3.5 mt-0.5 text-slate-400 shrink-0" />
              <span className="min-w-0">
                <span className="block font-medium">Editar regra fixa</span>
                <span className="block text-[11px] text-slate-400 dark:text-zinc-500">
                  Altera todos os meses
                </span>
              </span>
            </button>

            <button
              type="button"
              role="menuitem"
              onClick={() => runAndClose(onDeleteRule)}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5 shrink-0" />
              <span>Excluir regra</span>
            </button>
          </div>,
          document.body
        )}
    </>
  );
}
