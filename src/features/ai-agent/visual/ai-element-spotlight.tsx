'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { findAgentTargetElement } from '@/features/ai-agent/visual/dom-target-resolver';

export interface SpotlightState {
  targetId: string | null;
  label?: string;
  tone?: 'indigo' | 'emerald' | 'amber';
}

export function AiElementSpotlight({ state }: { state: SpotlightState }) {
  const [mounted, setMounted] = React.useState(false);
  const [rect, setRect] = React.useState<DOMRect | null>(null);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (!state.targetId) {
      setRect(null);
      return;
    }

    const update = () => {
      const el = findAgentTargetElement(state.targetId!);
      setRect(el ? el.getBoundingClientRect() : null);
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
  }, [state.targetId]);

  if (!mounted || !state.targetId || !rect) return null;

  const toneRing =
    state.tone === 'emerald'
      ? 'border-emerald-500 ring-emerald-500/30 bg-emerald-500/5'
      : state.tone === 'amber'
      ? 'border-amber-500 ring-amber-500/30 bg-amber-500/5'
      : 'border-indigo-500 ring-indigo-500/30 bg-indigo-500/5';

  const badgeBg =
    state.tone === 'emerald'
      ? 'bg-emerald-600'
      : state.tone === 'amber'
      ? 'bg-amber-600'
      : 'bg-indigo-600';

  const pad = 6;
  const top = Math.max(4, rect.top - pad);
  const left = Math.max(4, rect.left - pad);

  return createPortal(
    <div
      data-agent-capture-ignore="true"
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
        {state.label && (
          <div
            className={`absolute -top-7 left-0 inline-flex items-center rounded-lg px-2.5 py-0.5 text-[11px] font-semibold text-white shadow-md whitespace-nowrap ${badgeBg}`}
          >
            {state.label}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
