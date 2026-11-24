'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { Sparkles } from 'lucide-react';

export interface VirtualCursorState {
  visible: boolean;
  x: number;
  y: number;
  clicking: boolean;
  caption: string;
}

export function AiVirtualCursor({ state }: { state: VirtualCursorState }) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !state.visible) return null;

  return createPortal(
    <div
      data-agent-capture-ignore="true"
      aria-hidden="true"
      className="fixed inset-0 z-[120] pointer-events-none overflow-hidden"
    >
      <div
        className="absolute top-0 left-0 will-change-transform"
        style={{
          transform: `translate3d(${state.x}px, ${state.y}px, 0)`,
        }}
      >
        {state.clicking && (
          <span className="absolute -left-3 -top-3 h-7 w-7 rounded-full border-2 border-indigo-500/80 bg-indigo-500/20 animate-ping" />
        )}

        <svg
          width="26"
          height="26"
          viewBox="0 0 28 28"
          fill="none"
          className={`drop-shadow-[0_4px_10px_rgba(79,70,229,0.45)] transition-transform duration-150 ${
            state.clicking ? 'scale-90' : 'scale-100'
          }`}
        >
          <path
            d="M4 3L23 12.2L14.5 14.9L11.6 23.5L4 3Z"
            fill="#4F46E5"
            stroke="#FFFFFF"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>

        {state.caption && (
          <div className="ml-5 -mt-1 inline-flex items-center gap-1.5 rounded-full border border-indigo-400/50 bg-zinc-950/92 text-white px-3 py-1 text-[11px] font-medium shadow-lg backdrop-blur-md whitespace-nowrap max-w-[280px] truncate">
            <Sparkles className="h-3 w-3 text-indigo-400 shrink-0" />
            <span className="truncate">{state.caption}</span>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
