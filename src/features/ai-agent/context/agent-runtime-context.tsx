'use client';

import * as React from 'react';
import { useWorkbench } from '@/features/dashboard/context/workbench-context';
import type {
  AgentExecutionStatus,
  AgentInteractionMode,
  AgentVisualStep,
  CapturedAnnotatedImage,
  CoachmarkTourState,
  ScreenshotCaptureDirective,
  UiStateSnapshot,
} from '@/features/ai-agent/domain/agent-types';
import {
  findAgentTargetElement,
  scrollTargetIntoViewSmooth,
} from '@/features/ai-agent/visual/dom-target-resolver';
import { runAgentVisualSteps } from '@/features/ai-agent/visual/agent-visual-runner';
import type { VirtualCursorState } from '@/features/ai-agent/visual/ai-virtual-cursor';
import type { SpotlightState } from '@/features/ai-agent/visual/ai-element-spotlight';
import { captureAnnotatedScreenClient } from '@/features/ai-agent/capture/screen-capture-engine';
import {
  buildInteractiveSpotlight,
  createUiStateSnapshot,
  createWorkbenchBridge,
  HIDDEN_CURSOR,
} from '@/features/ai-agent/context/agent-runtime-helpers';

interface AgentRuntimeContextValue {
  mode: AgentInteractionMode;
  status: AgentExecutionStatus;
  setStatus: (s: AgentExecutionStatus) => void;
  stepIndex: number;
  totalSteps: number;
  caption: string;
  cursorState: VirtualCursorState;
  spotlightState: SpotlightState;
  togglePause: () => void;
  stopExecution: (reason?: string) => void;
  dismissCoachmark: () => void;
  prevCoachmarkStep: () => void;
  nextCoachmarkStep: () => void;
  buildUiStateSnapshot: () => UiStateSnapshot;
  runVisualSequence: (steps: AgentVisualStep[]) => Promise<{ interrupted: boolean; completedSteps: number }>;
  executeScreenshotDirective: (directive: ScreenshotCaptureDirective) => Promise<CapturedAnnotatedImage | null>;
  flashSuccessSpotlight: (targetId: string, label: string, body?: string) => void;
}

const AgentRuntimeContext = React.createContext<AgentRuntimeContextValue | null>(null);

export function AgentRuntimeProvider({ children }: { children: React.ReactNode }) {
  const { props, wb } = useWorkbench();
  const mode: AgentInteractionMode = 'VISUAL';
  const [status, setStatus] = React.useState<AgentExecutionStatus>('IDLE');
  const [stepIndex, setStepIndex] = React.useState(0);
  const [totalSteps, setTotalSteps] = React.useState(0);
  const [caption, setCaption] = React.useState('');
  const [cursorState, setCursorState] = React.useState<VirtualCursorState>(HIDDEN_CURSOR);
  const [spotlightState, setSpotlightState] = React.useState<SpotlightState>({ targetId: null });
  const [coachmarkTour, setCoachmarkTour] = React.useState<CoachmarkTourState | null>(null);

  const abortRef = React.useRef<AbortController | null>(null);
  const runSeqRef = React.useRef(0);
  const flashTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const pausedRef = React.useRef(false);
  const resumeResolverRef = React.useRef<(() => void) | null>(null);

  React.useEffect(() => () => {
    abortRef.current?.abort();
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
  }, []);

  const clearVisualOverlays = React.useCallback(() => {
    setCursorState(HIDDEN_CURSOR);
    setSpotlightState({ targetId: null });
    setCoachmarkTour(null);
    setStepIndex(0);
    setTotalSteps(0);
    setCaption('');
  }, []);

  const dismissCoachmark = React.useCallback(() => {
    setCoachmarkTour(null);
    setSpotlightState({ targetId: null });
  }, []);

  const focusCoachmarkIndex = React.useCallback((tour: CoachmarkTourState, nextIdx: number) => {
    const clamped = Math.max(0, Math.min(tour.steps.length - 1, nextIdx));
    const nextTour: CoachmarkTourState = { ...tour, activeIndex: clamped };
    const step = nextTour.steps[clamped];
    setCoachmarkTour(nextTour);
    if (step?.targetId) {
      const el = findAgentTargetElement(step.targetId, step.fallbackTextMatch);
      if (el) void scrollTargetIntoViewSmooth(el, false);
    }
    setSpotlightState(buildInteractiveSpotlight(nextTour));
  }, []);

  const prevCoachmarkStep = React.useCallback(() => {
    if (!coachmarkTour || coachmarkTour.activeIndex <= 0) return;
    focusCoachmarkIndex(coachmarkTour, coachmarkTour.activeIndex - 1);
  }, [coachmarkTour, focusCoachmarkIndex]);

  const nextCoachmarkStep = React.useCallback(() => {
    if (!coachmarkTour || coachmarkTour.activeIndex >= coachmarkTour.steps.length - 1) return;
    focusCoachmarkIndex(coachmarkTour, coachmarkTour.activeIndex + 1);
  }, [coachmarkTour, focusCoachmarkIndex]);

  const stopExecution = React.useCallback(() => {
    pausedRef.current = false;
    resumeResolverRef.current?.();
    resumeResolverRef.current = null;
    if (abortRef.current) { abortRef.current.abort(); abortRef.current = null; }
    clearVisualOverlays();
    setStatus('INTERRUPTED');
  }, [clearVisualOverlays]);

  const togglePause = React.useCallback(() => {
    if (status === 'RUNNING_VISUAL') { pausedRef.current = true; setStatus('PAUSED'); }
    else if (status === 'PAUSED') {
      pausedRef.current = false;
      setStatus('RUNNING_VISUAL');
      resumeResolverRef.current?.();
      resumeResolverRef.current = null;
    }
  }, [status]);

  React.useEffect(() => {
    if (status !== 'RUNNING_VISUAL' && status !== 'PAUSED') return;
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); stopExecution(); } };
    const onPointerDown = (e: PointerEvent) => {
      if (!e.isTrusted) return;
      const target = e.target as HTMLElement | null;
      if (
        target?.closest('[data-agent-control-pill="true"]') ||
        target?.closest('[data-agent-chat-panel="true"]') ||
        target?.closest('[data-agent-coachmark="true"]')
      ) return;
      stopExecution();
    };
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('pointerdown', onPointerDown, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('pointerdown', onPointerDown, true);
    };
  }, [status, stopExecution]);

  const bridge = React.useMemo(() => createWorkbenchBridge(wb), [wb]);

  const buildUiStateSnapshot = React.useCallback(
    (): UiStateSnapshot => createUiStateSnapshot(wb, props.selectedMonth, props.selectedYear),
    [props.selectedMonth, props.selectedYear, wb]
  );

  const runVisualSequence = React.useCallback(
    async (steps: AgentVisualStep[]) => {
      if (steps.length === 0) return { interrupted: false, completedSteps: 0 };
      const myRunSeq = ++runSeqRef.current;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      pausedRef.current = false;
      setCoachmarkTour(null);
      setTotalSteps(steps.length);
      setStepIndex(0);
      setStatus('RUNNING_VISUAL');

      const waitIfPaused = async () => {
        if (!pausedRef.current) return;
        await new Promise<void>((resolve) => { resumeResolverRef.current = resolve; });
      };

      const res = await runAgentVisualSteps({
        steps, mode, signal: controller.signal, bridge,
        callbacks: {
          setCursor: (next) => { if (runSeqRef.current === myRunSeq) setCursorState(next); },
          setSpotlight: (next) => { if (runSeqRef.current === myRunSeq) setSpotlightState(next); },
          onStepProgress: (idx, cap) => {
            if (runSeqRef.current === myRunSeq) { setStepIndex(idx); setCaption(cap); }
          },
          waitIfPaused,
        },
      });

      if (runSeqRef.current === myRunSeq) {
        setCursorState(HIDDEN_CURSOR);
        setStepIndex(0);
        setTotalSteps(0);
        setCaption('');
        if (!res.interrupted && res.coachmarkSteps.length > 0) {
          const tour: CoachmarkTourState = { steps: res.coachmarkSteps, activeIndex: res.initialCoachmarkIndex };
          setCoachmarkTour(tour);
          setSpotlightState(buildInteractiveSpotlight(tour));
        } else {
          setCoachmarkTour(null);
          setSpotlightState({ targetId: null });
        }
        setStatus(res.interrupted ? 'INTERRUPTED' : 'IDLE');
      }
      return { interrupted: res.interrupted, completedSteps: res.completedSteps };
    },
    [bridge, mode]
  );

  const executeScreenshotDirective = React.useCallback(
    async (directive: ScreenshotCaptureDirective): Promise<CapturedAnnotatedImage | null> => {
      const openedModalForCapture = Boolean(directive.prepareSteps?.some((s) => s.action === 'OPEN_MODAL'));
      if (directive.prepareSteps?.length) {
        const prep = await runVisualSequence(directive.prepareSteps);
        if (prep.interrupted) return null;
      }
      clearVisualOverlays();
      await new Promise((r) => setTimeout(r, 140));
      try { return await captureAnnotatedScreenClient({ directive, hideValues: wb.hideValues }); }
      finally { if (openedModalForCapture) bridge.closeModal(); }
    },
    [bridge, clearVisualOverlays, runVisualSequence, wb.hideValues]
  );

  const flashSuccessSpotlight = React.useCallback((targetId: string, label: string, body?: string) => {
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    setSpotlightState({ targetId, label, tooltipTitle: body ? label : undefined, tooltipBody: body, tone: 'emerald' });
    flashTimerRef.current = setTimeout(() => {
      setSpotlightState({ targetId: null });
      flashTimerRef.current = null;
    }, body ? 3200 : 1800);
  }, []);

  const value = React.useMemo(
    () => ({
      mode, status, setStatus, stepIndex, totalSteps, caption,
      cursorState, spotlightState, togglePause, stopExecution,
      dismissCoachmark, prevCoachmarkStep, nextCoachmarkStep,
      buildUiStateSnapshot, runVisualSequence, executeScreenshotDirective, flashSuccessSpotlight,
    }),
    [mode, status, stepIndex, totalSteps, caption, cursorState, spotlightState, togglePause, stopExecution, dismissCoachmark, prevCoachmarkStep, nextCoachmarkStep, buildUiStateSnapshot, runVisualSequence, executeScreenshotDirective, flashSuccessSpotlight]
  );

  return <AgentRuntimeContext.Provider value={value}>{children}</AgentRuntimeContext.Provider>;
}

export function useAgentRuntime(): AgentRuntimeContextValue {
  const ctx = React.useContext(AgentRuntimeContext);
  if (!ctx) throw new Error('useAgentRuntime deve ser usado dentro de <AgentRuntimeProvider>.');
  return ctx;
}
