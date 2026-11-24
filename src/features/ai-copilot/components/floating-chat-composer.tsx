'use client';

import * as React from 'react';
import { Check, Loader2, Mic, Pause, Play, Send, X } from 'lucide-react';
import { useVoiceInput } from '@/features/ai-voice/hooks/use-voice-input';
import { refineVoiceTranscriptAction } from '@/features/ai-voice/actions/voice-refine.actions';
import type { VoiceRefinementMode } from '@/features/ai-voice/domain/voice-refinement-types';
import { VoiceRefinementBar } from '@/features/ai-voice/components/voice-refinement-bar';

export function FloatingChatComposer(props: {
  input: string;
  setInput: (next: string) => void;
  isLoading: boolean;
  onSubmit: () => void;
}) {
  const { input, setInput, isLoading, onSubmit } = props;
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const [originalTranscript, setOriginalTranscript] = React.useState<string | null>(null);
  const [showRefinementBar, setShowRefinementBar] = React.useState(false);
  const [activeRefineMode, setActiveRefineMode] = React.useState<VoiceRefinementMode>('original');
  const [refineModelUsed, setRefineModelUsed] = React.useState<string | null>(null);
  const [isRefining, setIsRefining] = React.useState(false);
  const [refineError, setRefineError] = React.useState<string | null>(null);
  const [refineWarning, setRefineWarning] = React.useState<string | null>(null);

  const voice = useVoiceInput({
    value: input,
    onChange: setInput,
    onTranscriptFinalized: (finalText) => {
      setOriginalTranscript(finalText);
      setActiveRefineMode('original');
      setRefineModelUsed(null);
      setRefineError(null);
      setRefineWarning(null);
      setShowRefinementBar(true);
    },
  });

  React.useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(112, Math.max(24, el.scrollHeight))}px`;
  }, [input, voice.interimText]);

  const clearRefinementState = React.useCallback(() => {
    setShowRefinementBar(false);
    setOriginalTranscript(null);
    setActiveRefineMode('original');
    setRefineModelUsed(null);
    setRefineError(null);
    setRefineWarning(null);
  }, []);

  const handleSelectRefinement = async (mode: VoiceRefinementMode) => {
    const sourceText = originalTranscript ?? input.trim();
    if (!sourceText) return;
    setRefineError(null);
    setRefineWarning(null);

    if (mode === 'original') {
      setActiveRefineMode('original');
      setInput(sourceText);
      return;
    }

    setIsRefining(true);
    try {
      const res = await refineVoiceTranscriptAction({ originalText: sourceText, mode });
      if (!res.ok) {
        setRefineError(res.error);
        return;
      }
      setActiveRefineMode(mode);
      setRefineModelUsed(res.modelUsed);
      setRefineWarning(res.warning || null);
      setInput(res.refinedText);
    } catch {
      setRefineError('Erro de comunicação ao aprimorar a transcrição.');
    } finally {
      setIsRefining(false);
    }
  };

  const handleFormSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (isLoading || isRefining || voice.status === 'transcribing') return;
    if (voice.status === 'listening' || voice.status === 'paused') {
      voice.finishCapture();
      return;
    }
    if (!input.trim()) return;
    clearRefinementState();
    onSubmit();
  };

  const isRecordingActive = voice.status === 'listening' || voice.status === 'paused';
  const displayedValue =
    voice.status === 'listening' && voice.interimText
      ? `${input.trimEnd()}${input.trimEnd() ? ' ' : ''}${voice.interimText}`
      : input;

  return (
    <div className="bg-white dark:bg-zinc-950 border-t border-slate-200 dark:border-zinc-800">
      {isRecordingActive && (
        <div
          data-voice-status={voice.status}
          className="px-3 pt-2 pb-1 flex items-center justify-between gap-2 bg-indigo-50/70 dark:bg-indigo-950/30 border-b border-indigo-200/60 dark:border-indigo-900/50 text-[11px]"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`h-2 w-2 rounded-full shrink-0 ${
                voice.status === 'listening'
                  ? 'bg-rose-500 animate-pulse'
                  : 'bg-amber-500'
              }`}
            />
            <span className="font-medium text-slate-700 dark:text-zinc-200 truncate">
              {voice.status === 'listening'
                ? voice.engineMode === 'webspeech'
                  ? 'Ouvindo e transcrevendo em tempo real...'
                  : 'Gravando áudio (transcrição ao finalizar)...'
                : 'Captura pausada — edite ou retome'}
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={voice.status === 'listening' ? voice.pauseCapture : voice.resumeCapture}
              aria-label={voice.status === 'listening' ? 'Pausar captura de voz' : 'Retomar captura de voz'}
              className="inline-flex items-center gap-1 h-6 px-2 rounded-md border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800"
            >
              {voice.status === 'listening' ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
              <span>{voice.status === 'listening' ? 'Pausar' : 'Retomar'}</span>
            </button>
            <button
              type="button"
              onClick={voice.finishCapture}
              aria-label="Finalizar captura de voz"
              className="inline-flex items-center gap-1 h-6 px-2 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
            >
              <Check className="h-3 w-3" />
              <span>Concluir</span>
            </button>
            <button
              type="button"
              onClick={voice.cancelCapture}
              aria-label="Cancelar captura de voz"
              className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {voice.status === 'transcribing' && (
        <div className="px-3 py-1.5 flex items-center gap-2 text-[11px] text-indigo-600 dark:text-indigo-300 bg-indigo-50/50 dark:bg-indigo-950/20 border-b border-slate-200 dark:border-zinc-800">
          <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
          <span>Transcrevendo áudio capturado...</span>
        </div>
      )}

      {voice.errorMessage && (
        <div className="px-3 py-1.5 flex items-center justify-between gap-2 text-[11px] text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border-b border-rose-200 dark:border-rose-900/60">
          <span>{voice.errorMessage}</span>
          <button
            type="button"
            onClick={voice.clearError}
            aria-label="Fechar aviso de microfone"
            className="p-0.5 rounded hover:bg-rose-100 dark:hover:bg-rose-900/40"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {showRefinementBar && !isRecordingActive && voice.status !== 'transcribing' && originalTranscript && (
        <VoiceRefinementBar
          activeMode={activeRefineMode}
          modelUsed={refineModelUsed}
          isRefining={isRefining}
          error={refineError}
          warning={refineWarning}
          hasModifiedFromOriginal={input.trim() !== originalTranscript.trim()}
          onSelectMode={(m) => void handleSelectRefinement(m)}
          onRestoreOriginal={() => {
            setActiveRefineMode('original');
            setRefineWarning(null);
            setRefineError(null);
            setInput(originalTranscript);
          }}
          onDismiss={clearRefinementState}
        />
      )}

      <form onSubmit={handleFormSubmit} className="p-2.5 sm:p-3">
        <div className="flex items-end gap-1.5 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50/80 dark:bg-zinc-900/90 pl-3.5 pr-1.5 py-1.5 transition-all focus-within:border-indigo-500/70 focus-within:ring-2 focus-within:ring-indigo-500/20">
          <textarea
            ref={textareaRef}
            rows={1}
            value={displayedValue}
            readOnly={voice.status === 'listening'}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleFormSubmit();
              }
            }}
            placeholder="Pergunte, peça gráficos ou comande..."
            aria-label="Campo de mensagem do assistente IA"
            className="flex-1 min-h-[24px] max-h-[112px] py-1 resize-none bg-transparent text-xs sm:text-[13px] text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none leading-5"
          />
          <div className="flex items-center gap-1 shrink-0 pb-0.5">
            <button
              type="button"
              disabled={isLoading || isRefining || voice.status === 'transcribing'}
              onClick={() => {
                if (isRecordingActive) voice.finishCapture();
                else voice.startCapture();
              }}
              aria-label={isRecordingActive ? 'Finalizar gravação de voz' : 'Falar solicitação por microfone'}
              title={isRecordingActive ? 'Concluir ditado por voz' : 'Ditar solicitação por voz'}
              className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 transition-all disabled:opacity-40 ${
                isRecordingActive
                  ? 'bg-rose-600 text-white hover:bg-rose-500 shadow-sm shadow-rose-600/30 animate-pulse'
                  : 'text-slate-500 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-200/70 dark:hover:bg-zinc-800'
              }`}
            >
              <Mic className="h-4 w-4" />
            </button>
            <button
              type="submit"
              disabled={isLoading || isRefining || isRecordingActive || voice.status === 'transcribing' || !input.trim()}
              aria-label="Enviar pergunta ao assistente IA"
              title="Enviar"
              className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0 transition-all bg-indigo-600 text-white hover:bg-indigo-500 shadow-sm shadow-indigo-600/25 disabled:bg-slate-200/90 dark:disabled:bg-zinc-800 disabled:text-slate-400 dark:disabled:text-zinc-500 disabled:shadow-none disabled:cursor-not-allowed"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
