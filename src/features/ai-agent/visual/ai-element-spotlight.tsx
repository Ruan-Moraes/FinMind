'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { findAgentTargetElement } from '@/features/ai-agent/visual/dom-target-resolver';
import { AiCoachmarkTooltip } from '@/features/ai-agent/visual/ai-coachmark-tooltip';

export interface SpotlightState {
  targetId: string | null;
  fallbackTextMatch?: string;
  label?: string;
  tooltipTitle?: string;
  tooltipBody?: string;
  tooltipPlacement?: 'auto' | 'top' | 'bottom' | 'left' | 'right';
  tone?: 'indigo' | 'emerald' | 'amber';
  stepNumber?: number;
  totalSteps?: number;
  interactive?: boolean;
  canPrev?: boolean;
  canNext?: boolean;
}

export function AiElementSpotlight(props: {
  state: SpotlightState;
  onPrev?: () => void;
  onNext?: () => void;
  onDismiss?: () => void;
}) {
  const { state, onPrev, onNext, onDismiss } = props;
  const [mounted, setMounted] = React.useState(false);
  const [rect, setRect] = React.useState<DOMRect | null>(null);
  const missingTicksRef = React.useRef(0);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (!state.targetId) {
      setRect(null);
      missingTicksRef.current = 0;
      return;
    }

    missingTicksRef.current = 0;

    const update = () => {
      const el = findAgentTargetElement(state.targetId!, state.fallbackTextMatch);
      const next = el ? el.getBoundingClientRect() : null;

      if (!next && state.interactive) {
        missingTicksRef.current += 1;
        if (missingTicksRef.current >= 3 && onDismiss) {
          onDismiss();
          return;
        }
      } else if (next) {
        missingTicksRef.current = 0;
      }

      setRect((prev) => {
        if (!prev && !next) return prev;
        if (
          prev &&
          next &&
          Math.abs(prev.top - next.top) < 0.5 &&
          Math.abs(prev.left - next.left) < 0.5 &&
          Math.abs(prev.width - next.width) < 0.5 &&
          Math.abs(prev.height - next.height) < 0.5
        ) {
          return prev;
        }
        return next;
      });
    };

    update();
    const interval = window.setInterval(update, 120);
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [state.targetId, state.fallbackTextMatch, state.interactive, onDismiss]);

  if (!mounted || !state.targetId || !rect) return null;

  const toneRing =
    state.tone === 'emerald'
      ? 'border-emerald-500 ring-emerald-500/35 bg-emerald-500/[0.06] shadow-[0_0_24px_rgba(16,185,129,0.28)]'
      : state.tone === 'amber'
      ? 'border-amber-500 ring-amber-500/35 bg-amber-500/[0.06] shadow-[0_0_24px_rgba(245,158,11,0.28)]'
      : 'border-indigo-500 ring-indigo-500/35 bg-indigo-500/[0.06] shadow-[0_0_24px_rgba(99,102,241,0.32)]';

  const badgeBg =
    state.tone === 'emerald'
      ? 'bg-emerald-600'
      : state.tone === 'amber'
      ? 'bg-amber-600'
      : 'bg-indigo-600';

  const pad = 6;
  const top = Math.max(4, rect.top - pad);
  const left = Math.max(4, rect.left - pad);
  const hasRichTooltip = Boolean(state.tooltipBody);

  return (
    <>
      {createPortal(
        <div
          data-agent-capture-ignore="true"
          data-agent-spotlight-ring="true"
          aria-hidden="true"
          className="fixed inset-0 z-[115] pointer-events-none"
        >
          <div
            className={`fixed rounded-2xl border-2 ring-4 transition-all duration-200 ${toneRing}`}
            style={{
              top,
              left,
              width: rect.width + pad * 2,
              height: rect.height + pad * 2,
            }}
          >
            {!hasRichTooltip && state.label && (
              <div
                className={`absolute -top-7 left-0 inline-flex items-center rounded-lg px-2.5 py-0.5 text-[11px] font-semibold text-white shadow-md whitespace-nowrap ${badgeBg}`}
              >
                {state.label}
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      {hasRichTooltip && (
        <AiCoachmarkTooltip
          targetRect={rect}
          title={state.tooltipTitle || state.label || 'Orientação do Agente IA'}
          body={state.tooltipBody!}
          tone={state.tone}
          placement={state.tooltipPlacement}
          stepNumber={state.stepNumber}
          totalSteps={state.totalSteps}
          interactive={state.interactive}
          canPrev={state.canPrev}
          canNext={state.canNext}
          onPrev={onPrev}
          onNext={onNext}
          onDismiss={onDismiss}
        />
      )}
    </>
  );
}
