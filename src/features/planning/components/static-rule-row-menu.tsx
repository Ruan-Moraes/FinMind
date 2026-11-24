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

const ITEM_CLASS =
  'w-full text-left flex items-center gap-3 px-2 py-2 rounded-xl text-slate-800 dark:text-zinc-100 hover:bg-slate-100/90 dark:hover:bg-zinc-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40';

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
  const [pos, setPos] = React.useState<{
    top: number;
    left: number;
    openAbove: boolean;
    maxHeight: number;
  } | null>(null);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);

  const currentMonthLabel = `${MONTH_NAMES_PT[selectedMonth - 1]}/${selectedYear}`;

  React.useEffect(() => {
    if (isToggling) setOpen(false);
  }, [isToggling]);

  const updatePosition = React.useCallback(() => {
    const btn = buttonRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const menuWidth = 264;
    const menuHeight = 292;
    const margin = 8;
    const spaceBelow = window.innerHeight - rect.bottom - margin;
    const spaceAbove = rect.top - margin;
    const openAbove = spaceBelow < menuHeight && spaceAbove > spaceBelow;

    const left = Math.max(
      margin,
      Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - margin)
    );
    const top = openAbove ? rect.top - 6 : rect.bottom + 6;
    const maxHeight = Math.max(120, Math.min(320, openAbove ? spaceAbove - 6 : spaceBelow - 6));
    setPos({ top, left, openAbove, maxHeight });
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
              width: 264,
              maxHeight: pos.maxHeight,
              transform: pos.openAbove ? 'translateY(-100%)' : undefined,
            }}
            className="z-[150] rounded-2xl border border-slate-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-xl shadow-slate-900/10 dark:shadow-black/40 p-2 text-left overflow-y-auto space-y-0.5"
          >
            <div className="px-2 pt-1 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
              Apenas em {currentMonthLabel}
            </div>

            {!isSkipped && (
              <button type="button" role="menuitem" onClick={() => runAndClose(onAdjustMonthAmount)} className={ITEM_CLASS}>
                <span className="h-7 w-7 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-medium leading-tight">Ajustar valor neste mês</span>
                  <span className="block text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5 leading-tight">Não altera os próximos meses</span>
                </span>
              </button>
            )}

            <button type="button" role="menuitem" onClick={() => runAndClose(onToggleSkip)} className={ITEM_CLASS}>
              <span className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${isSkipped ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'}`}>
                {isSkipped ? <RotateCcw className="h-3.5 w-3.5" /> : <CalendarOff className="h-3.5 w-3.5" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-medium leading-tight">{isSkipped ? 'Reativar neste mês' : 'Pular neste mês'}</span>
                <span className="block text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5 leading-tight">{isSkipped ? 'Volta a contar no orçamento' : `Volta em ${nextMonthLabel}`}</span>
              </span>
            </button>

            <div className="!my-1.5 border-t border-slate-100 dark:border-zinc-800/80" />

            <div className="px-2 pt-1 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
              Regra mensal fixa
            </div>

            <button type="button" role="menuitem" onClick={() => runAndClose(onEditRule)} className={ITEM_CLASS}>
              <span className="h-7 w-7 rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 flex items-center justify-center shrink-0">
                <Pencil className="h-3.5 w-3.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-medium leading-tight">Editar regra fixa</span>
                <span className="block text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5 leading-tight">Altera todos os meses</span>
              </span>
            </button>

            <button
              type="button"
              role="menuitem"
              onClick={() => runAndClose(onDeleteRule)}
              className="w-full text-left flex items-center gap-3 px-2 py-2 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40"
            >
              <span className="h-7 w-7 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <Trash2 className="h-3.5 w-3.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-medium leading-tight">Excluir regra</span>
                <span className="block text-[11px] text-rose-500/80 dark:text-rose-400/75 mt-0.5 leading-tight">Remove de todos os meses</span>
              </span>
            </button>
          </div>,
          document.body
        )}
    </>
  );
}
