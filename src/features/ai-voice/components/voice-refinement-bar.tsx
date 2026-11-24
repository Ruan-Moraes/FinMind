'use client';

import * as React from 'react';
import { ChevronDown, Loader2, RotateCcw, Sparkles, X } from 'lucide-react';
import {
  VOICE_REFINEMENT_OPTIONS,
  type VoiceRefinementMode,
} from '@/features/ai-voice/domain/voice-refinement-types';

export function VoiceRefinementBar(props: {
  activeMode: VoiceRefinementMode;
  modelUsed: string | null;
  isRefining: boolean;
  error: string | null;
  warning: string | null;
  hasModifiedFromOriginal: boolean;
  onSelectMode: (mode: VoiceRefinementMode) => void;
  onRestoreOriginal: () => void;
  onDismiss: () => void;
}) {
  const {
    activeMode, modelUsed, isRefining, error, warning,
    hasModifiedFromOriginal, onSelectMode, onRestoreOriginal, onDismiss,
  } = props;
  const [menuOpen, setMenuOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!menuOpen) return;
    const onOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [menuOpen]);

  const currentOption =
    VOICE_REFINEMENT_OPTIONS.find((o) => o.id === activeMode) || VOICE_REFINEMENT_OPTIONS[0];

  return (
    <div
      ref={containerRef}
      data-voice-refinement-bar="true"
      className="relative px-3 pt-2 pb-1.5 bg-slate-50/90 dark:bg-zinc-900/80 border-t border-slate-200/80 dark:border-zinc-800 space-y-1.5"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <button
            type="button"
            disabled={isRefining}
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-label="Opções de aprimoramento da transcrição"
            className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg border border-indigo-200 dark:border-indigo-800/70 bg-white dark:bg-zinc-950 text-[11px] font-medium text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition-colors"
          >
            {isRefining ? (
              <Loader2 className="h-3 w-3 animate-spin shrink-0" />
            ) : (
              <Sparkles className="h-3 w-3 shrink-0" />
            )}
            <span className="truncate max-w-[190px]">
              {isRefining ? 'Aprimorando...' : `Transcrição: ${currentOption.label}`}
            </span>
            <ChevronDown className="h-3 w-3 opacity-70 shrink-0" />
          </button>

          {hasModifiedFromOriginal && !isRefining && (
            <button
              type="button"
              onClick={onRestoreOriginal}
              className="inline-flex items-center gap-1 h-7 px-2 rounded-lg text-[11px] font-medium text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 hover:bg-slate-200/60 dark:hover:bg-zinc-800 transition-colors"
              title="Restaurar texto original da voz"
            >
              <RotateCcw className="h-3 w-3" />
              <span className="hidden sm:inline">Original</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {modelUsed && activeMode !== 'original' && !isRefining && (
            <span className="text-[10px] text-slate-400 dark:text-zinc-500 hidden sm:inline">
              {modelUsed}
            </span>
          )}
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Ocultar opções de transcrição"
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 hover:bg-slate-200/60 dark:hover:bg-zinc-800"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {menuOpen && (
        <div
          role="menu"
          aria-label="Aprimorar transcrição com IA"
          className="absolute left-3 right-3 bottom-full mb-1.5 z-30 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 shadow-xl p-1.5 grid grid-cols-1 gap-0.5"
        >
          {VOICE_REFINEMENT_OPTIONS.map((opt) => {
            const selected = opt.id === activeMode;
            return (
              <button
                key={opt.id}
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  onSelectMode(opt.id);
                }}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg transition-colors flex flex-col ${
                  selected
                    ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
                    : 'hover:bg-slate-100 dark:hover:bg-zinc-900 text-slate-800 dark:text-zinc-200'
                }`}
              >
                <span className="text-xs font-medium">{opt.label}</span>
                <span className="text-[10px] text-slate-500 dark:text-zinc-400">
                  {opt.description}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {warning && (
        <p className="text-[11px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-lg px-2 py-1">
          {warning}
        </p>
      )}
      {error && (
        <p className="text-[11px] text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-lg px-2 py-1">
          {error}
        </p>
      )}
    </div>
  );
}
