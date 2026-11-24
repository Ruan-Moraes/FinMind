'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { Check, Search, X } from 'lucide-react';
import type { ParsedSelectOption } from '@/shared/ui/searchable-select';

interface MenuPosition {
  left: number;
  width: number;
  top?: number;
  bottom?: number;
  listMaxHeight: number;
}

export function SearchableSelectMenu(props: {
  anchorEl: HTMLElement | null;
  menuRef: React.RefObject<HTMLDivElement | null>;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  listboxId: string;
  query: string;
  onQueryChange: (val: string) => void;
  options: ParsedSelectOption[];
  currentValue: string;
  highlightedIndex: number;
  onHighlight: (idx: number) => void;
  onSelect: (opt: ParsedSelectOption) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}) {
  const {
    anchorEl, menuRef, searchInputRef, listboxId, query, onQueryChange,
    options, currentValue, highlightedIndex, onHighlight, onSelect, onKeyDown,
  } = props;

  const [pos, setPos] = React.useState<MenuPosition | null>(null);

  React.useLayoutEffect(() => {
    if (!anchorEl) return;

    const updatePosition = () => {
      const rect = anchorEl.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const margin = 10;
      const searchHeaderH = 54;
      const width = Math.min(Math.max(rect.width, 200), vw - margin * 2);
      const left = Math.max(margin, Math.min(rect.left, vw - width - margin));
      const spaceBelow = vh - rect.bottom - margin;
      const spaceAbove = rect.top - margin;
      const openUpward = spaceBelow < 240 && spaceAbove > spaceBelow;
      const available = openUpward ? spaceAbove : spaceBelow;
      const listMaxHeight = Math.max(120, Math.min(280, available - searchHeaderH));

      setPos(
        openUpward
          ? { left, width, bottom: vh - rect.top + 6, listMaxHeight }
          : { left, width, top: rect.bottom + 6, listMaxHeight }
      );
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [anchorEl]);

  if (typeof document === 'undefined' || !pos) return null;

  let lastGroup: string | undefined;

  return createPortal(
    <div
      ref={menuRef}
      onKeyDown={onKeyDown}
      onMouseDown={(e) => e.stopPropagation()}
      style={{
        position: 'fixed',
        left: pos.left,
        width: pos.width,
        top: pos.top,
        bottom: pos.bottom,
      }}
      className="z-[150] rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 shadow-2xl ring-1 ring-black/10 dark:ring-white/10 overflow-hidden"
    >
      <div className="p-2 border-b border-slate-100 dark:border-zinc-800">
        <div className="relative flex items-center">
          <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Pesquisar..."
            className="w-full h-8 pl-8 pr-7 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 text-xs text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500"
          />
          {query && (
            <button
              type="button"
              onClick={() => onQueryChange('')}
              className="absolute right-2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200"
              aria-label="Limpar busca"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <div
        id={listboxId}
        role="listbox"
        style={{ maxHeight: pos.listMaxHeight }}
        className="overflow-y-auto p-1.5 space-y-1"
      >
        {options.length === 0 ? (
          <div className="py-4 px-3 text-center text-xs text-slate-400">
            Nenhuma opção encontrada.
          </div>
        ) : (
          options.map((opt, idx) => {
            const showGroup = opt.group && opt.group !== lastGroup;
            lastGroup = opt.group;
            const isSelected = opt.value === currentValue;
            const isHighlighted = idx === highlightedIndex;

            return (
              <React.Fragment key={`${opt.group || ''}:${opt.value}:${idx}`}>
                {showGroup && (
                  <div className="px-2.5 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                    {opt.group}
                  </div>
                )}
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  disabled={opt.disabled}
                  onMouseEnter={() => onHighlight(idx)}
                  onClick={() => onSelect(opt)}
                  className={`w-full flex items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-xs text-left transition-colors ${
                    opt.disabled
                      ? 'opacity-40 cursor-not-allowed'
                      : isSelected
                      ? 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 font-semibold'
                      : isHighlighted
                      ? 'bg-slate-100 dark:bg-zinc-800/80 text-slate-900 dark:text-zinc-100'
                      : 'text-slate-700 dark:text-zinc-300'
                  }`}
                >
                  <span className="truncate">{opt.label}</span>
                  {isSelected && <Check className="h-3.5 w-3.5 text-indigo-500 shrink-0" />}
                </button>
              </React.Fragment>
            );
          })
        )}
      </div>
    </div>,
    document.body
  );
}
