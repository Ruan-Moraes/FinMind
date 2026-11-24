'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Sparkles, X } from 'lucide-react';

export interface AiCoachmarkTooltipProps {
  targetRect: DOMRect;
  title: string;
  body: string;
  tone?: 'indigo' | 'emerald' | 'amber';
  placement?: 'auto' | 'top' | 'bottom' | 'left' | 'right';
  stepNumber?: number;
  totalSteps?: number;
  interactive?: boolean;
  canPrev?: boolean;
  canNext?: boolean;
  onPrev?: () => void;
  onNext?: () => void;
  onDismiss?: () => void;
}

const CARD_WIDTH = 340;
const EST_HEIGHT = 175;
const GAP = 14;
const VIEWPORT_PAD = 12;

function computePopoverPosition(
  rect: DOMRect,
  preferred: 'auto' | 'top' | 'bottom' | 'left' | 'right' = 'auto'
): { top: number; left: number; side: 'top' | 'bottom' | 'left' | 'right'; arrowOffset: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.min(CARD_WIDTH, vw - VIEWPORT_PAD * 2);

  const spaceBelow = vh - rect.bottom - VIEWPORT_PAD;
  const spaceAbove = rect.top - VIEWPORT_PAD;
  const spaceRight = vw - rect.right - VIEWPORT_PAD;
  const spaceLeft = rect.left - VIEWPORT_PAD;

  let side: 'top' | 'bottom' | 'left' | 'right';
  if (preferred !== 'auto') {
    side = preferred;
  } else if (spaceBelow >= EST_HEIGHT + GAP) {
    side = 'bottom';
  } else if (spaceAbove >= EST_HEIGHT + GAP) {
    side = 'top';
  } else if (spaceRight >= width + GAP) {
    side = 'right';
  } else if (spaceLeft >= width + GAP) {
    side = 'left';
  } else {
    side = spaceBelow >= spaceAbove ? 'bottom' : 'top';
  }

  let top = 0;
  let left = 0;
  let arrowOffset = width / 2;

  if (side === 'bottom' || side === 'top') {
    const centerX = rect.left + rect.width / 2;
    left = Math.max(VIEWPORT_PAD, Math.min(vw - width - VIEWPORT_PAD, centerX - width / 2));
    arrowOffset = Math.max(20, Math.min(width - 20, centerX - left));
    top =
      side === 'bottom'
        ? Math.min(vh - EST_HEIGHT - VIEWPORT_PAD, rect.bottom + GAP)
        : Math.max(VIEWPORT_PAD, rect.top - EST_HEIGHT - GAP);
  } else {
    const centerY = rect.top + rect.height / 2;
    top = Math.max(VIEWPORT_PAD, Math.min(vh - EST_HEIGHT - VIEWPORT_PAD, centerY - EST_HEIGHT / 2));
    arrowOffset = Math.max(20, Math.min(EST_HEIGHT - 20, centerY - top));
    left =
      side === 'right'
        ? Math.min(vw - width - VIEWPORT_PAD, rect.right + GAP)
        : Math.max(VIEWPORT_PAD, rect.left - width - GAP);
  }

  return { top, left, side, arrowOffset };
}

export function AiCoachmarkTooltip({
  targetRect,
  title,
  body,
  tone = 'indigo',
  placement = 'auto',
  stepNumber,
  totalSteps,
  interactive = false,
  canPrev = false,
  canNext = false,
  onPrev,
  onNext,
  onDismiss,
}: AiCoachmarkTooltipProps) {
  const pos = computePopoverPosition(targetRect, placement);
  const width = Math.min(CARD_WIDTH, window.innerWidth - VIEWPORT_PAD * 2);

  const accent =
    tone === 'emerald'
      ? {
          border: 'border-emerald-300 dark:border-emerald-500/50',
          badge: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30',
          icon: 'bg-emerald-600 text-white',
          btn: 'bg-emerald-600 hover:bg-emerald-500 text-white',
        }
      : tone === 'amber'
      ? {
          border: 'border-amber-300 dark:border-amber-500/50',
          badge: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30',
          icon: 'bg-amber-600 text-white',
          btn: 'bg-amber-600 hover:bg-amber-500 text-white',
        }
      : {
          border: 'border-indigo-300 dark:border-indigo-500/55',
          badge: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-500/15 dark:text-indigo-300 dark:border-indigo-500/30',
          icon: 'bg-indigo-600 text-white',
          btn: 'bg-indigo-600 hover:bg-indigo-500 text-white',
        };

  return createPortal(
    <div
      data-agent-coachmark="true"
      data-agent-capture-ignore="true"
      role="status"
      aria-live="polite"
      style={{ position: 'fixed', top: pos.top, left: pos.left, width }}
      className={`z-[122] pointer-events-auto rounded-2xl border ${accent.border} bg-white/95 dark:bg-zinc-950/95 text-slate-900 dark:text-zinc-50 shadow-2xl shadow-slate-900/15 dark:shadow-black/50 backdrop-blur-xl p-4 space-y-2.5 transition-all duration-200 animate-in fade-in zoom-in-95`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`h-6 w-6 rounded-lg flex items-center justify-center shrink-0 ${accent.icon}`}>
            <Sparkles className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0">
            {stepNumber && totalSteps && totalSteps > 1 && (
              <span
                className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide mb-0.5 ${accent.badge}`}
              >
                Passo {stepNumber} de {totalSteps}
              </span>
            )}
            <h4 className="text-xs sm:text-[13px] font-semibold text-slate-900 dark:text-white leading-snug">
              {title}
            </h4>
          </div>
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Fechar orientação visual"
            className="h-6 w-6 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-zinc-800 transition-colors shrink-0"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <p className="text-xs text-slate-600 dark:text-zinc-300 leading-relaxed">{body}</p>

      {interactive && (
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/80 dark:border-zinc-800/90">
          <div className="flex items-center gap-1.5">
            {canPrev && onPrev && (
              <button
                type="button"
                onClick={onPrev}
                className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-[11px] font-medium text-slate-700 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:text-zinc-200 transition-colors"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                <span>Anterior</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {canNext && onNext ? (
              <>
                {onDismiss && (
                  <button
                    type="button"
                    onClick={onDismiss}
                    className="h-7 px-2.5 rounded-lg text-[11px] font-medium text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors"
                  >
                    Fechar
                  </button>
                )}
                <button
                  type="button"
                  onClick={onNext}
                  className={`inline-flex items-center gap-1 h-7 px-3 rounded-lg text-[11px] font-semibold transition-colors ${accent.btn}`}
                >
                  <span>Próximo</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </>
            ) : (
              onDismiss && (
                <button
                  type="button"
                  onClick={onDismiss}
                  className={`inline-flex items-center gap-1 h-7 px-3 rounded-lg text-[11px] font-semibold transition-colors ${accent.btn}`}
                >
                  <span>Entendi</span>
                </button>
              )
            )}
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
