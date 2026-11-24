'use client';

import * as React from 'react';
import { useWorkbench } from '@/features/dashboard/context/workbench-context';
import type { ActiveTab } from '@/features/dashboard/types/workbench-types';
import type {
  AgentExecutionStatus,
  AgentInteractionMode,
  AgentVisualStep,
  CapturedAnnotatedImage,
  ScreenshotCaptureDirective,
  UiStateSnapshot,
} from '@/features/ai-agent/domain/agent-types';
import { collectMountedAgentTargets } from '@/features/ai-agent/visual/dom-target-resolver';
import {
  runAgentVisualSteps,
  type WorkbenchBridgeActions,
} from '@/features/ai-agent/visual/agent-visual-runner';
import type { VirtualCursorState } from '@/features/ai-agent/visual/ai-virtual-cursor';
import type { SpotlightState } from '@/features/ai-agent/visual/ai-element-spotlight';
import { captureAnnotatedScreenClient } from '@/features/ai-agent/capture/screen-capture-engine';

interface AgentRuntimeContextValue {
  mode: AgentInteractionMode;
  setMode: (m: AgentInteractionMode) => void;
  status: AgentExecutionStatus;
  setStatus: (s: AgentExecutionStatus) => void;
  stepIndex: number;
  totalSteps: number;
  caption: string;
  cursorState: VirtualCursorState;
  spotlightState: SpotlightState;
  togglePause: () => void;
  stopExecution: (reason?: string) => void;
  buildUiStateSnapshot: () => UiStateSnapshot;
  runVisualSequence: (steps: AgentVisualStep[]) => Promise<{ interrupted: boolean; completedSteps: number }>;
  executeScreenshotDirective: (directive: ScreenshotCaptureDirective) => Promise<CapturedAnnotatedImage | null>;
  flashSuccessSpotlight: (targetId: string, label: string) => void;
}

const AgentRuntimeContext = React.createContext<AgentRuntimeContextValue | null>(null);

const HIDDEN_CURSOR: VirtualCursorState = {
  visible: false,
  x: 0,
  y: 0,
  clicking: false,
  caption: '',
};

export function AgentRuntimeProvider({ children }: { children: React.ReactNode }) {
  const { props, wb } = useWorkbench();
  const [mode, setMode] = React.useState<AgentInteractionMode>('VISUAL');
  const [status, setStatus] = React.useState<AgentExecutionStatus>('IDLE');
  const [stepIndex, setStepIndex] = React.useState(0);
  const [totalSteps, setTotalSteps] = React.useState(0);
  const [caption, setCaption] = React.useState('');
  const [cursorState, setCursorState] = React.useState<VirtualCursorState>(HIDDEN_CURSOR);
  const [spotlightState, setSpotlightState] = React.useState<SpotlightState>({ targetId: null });

  const abortRef = React.useRef<AbortController | null>(null);
  const pausedRef = React.useRef(false);
  const resumeResolverRef = React.useRef<(() => void) | null>(null);

  const clearVisualOverlays = React.useCallback(() => {
    setCursorState(HIDDEN_CURSOR);
    setSpotlightState({ targetId: null });
    setStepIndex(0);
    setTotalSteps(0);
    setCaption('');
  }, []);

  const stopExecution = React.useCallback(() => {
    pausedRef.current = false;
    resumeResolverRef.current?.();
    resumeResolverRef.current = null;
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    clearVisualOverlays();
    setStatus('INTERRUPTED');
  }, [clearVisualOverlays]);

  const togglePause = React.useCallback(() => {
    if (status === 'RUNNING_VISUAL') {
      pausedRef.current = true;
      setStatus('PAUSED');
    } else if (status === 'PAUSED') {
      pausedRef.current = false;
      setStatus('RUNNING_VISUAL');
      resumeResolverRef.current?.();
      resumeResolverRef.current = null;
    }
  }, [status]);

  // Interrupção instantânea via tecla Escape ou clique humano fora da barra de controle/chat
  React.useEffect(() => {
    if (status !== 'RUNNING_VISUAL' && status !== 'PAUSED') return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        stopExecution();
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      if (!e.isTrusted) return;
      const target = e.target as HTMLElement | null;
      if (
        target?.closest('[data-agent-control-pill="true"]') ||
        target?.closest('[data-agent-chat-panel="true"]')
      ) {
        return;
      }
      stopExecution();
    };

    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('pointerdown', onPointerDown, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('pointerdown', onPointerDown, true);
    };
  }, [status, stopExecution]);

  const bridge: WorkbenchBridgeActions = React.useMemo(
    () => ({
      switchTab: (tab: ActiveTab) => wb.setActiveTab(tab),
      openModal: (modalType: string) => {
        if (modalType === 'SETTINGS') wb.setIsSettingsModalOpen(true);
        else if (modalType === 'GOAL') wb.handleOpenCreateGoalModal();
        else if (modalType === 'STATIC_RULE') wb.handleOpenCreateStaticRuleModal('EXPENSE');
        else if (modalType === 'TX') wb.handleOpenCreateTxModal();
        else if (modalType === 'ACCOUNT') wb.handleOpenCreateAccountModal();
        else if (modalType === 'CARD') wb.handleOpenCreateCardModal();
        else if (modalType === 'BUDGET') wb.setIsBudgetModalOpen(true);
      },
      closeModal: () => wb.closeModal(),
      setPeriod: (month: number, year: number) => wb.updatePeriodParams({ month, year }),
      setTxFilters: (f) => {
        if (f.searchQuery !== undefined) wb.setSearchQuery(f.searchQuery);
        if (f.filterType !== undefined) wb.setFilterType(f.filterType);
        if (f.filterNature !== undefined) wb.setFilterNature(f.filterNature);
        if (f.filterCategoryId !== undefined) wb.setFilterCategoryId(f.filterCategoryId);
      },
    }),
    [wb]
  );

  const buildUiStateSnapshot = React.useCallback((): UiStateSnapshot => {
    return {
      activeTab: wb.activeTab,
      selectedMonth: props.selectedMonth,
      selectedYear: props.selectedYear,
      activeModalType: wb.activeModal?.type || null,
      hideValues: wb.hideValues,
      theme: wb.theme,
      density: wb.density,
      viewport: typeof window !== 'undefined' && window.innerWidth < 640 ? 'MOBILE' : 'DESKTOP',
      activeFilters: {
        searchQuery: wb.searchQuery,
        filterType: wb.filterType,
        filterNature: wb.filterNature,
        filterCategoryId: wb.filterCategoryId,
      },
      mountedTargets: collectMountedAgentTargets(),
    };
  }, [props.selectedMonth, props.selectedYear, wb]);

  const runVisualSequence = React.useCallback(
    async (steps: AgentVisualStep[]) => {
      if (steps.length === 0) return { interrupted: false, completedSteps: 0 };
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      pausedRef.current = false;

      setTotalSteps(steps.length);
      setStepIndex(0);
      setStatus('RUNNING_VISUAL');

      const waitIfPaused = async () => {
        if (!pausedRef.current) return;
        await new Promise<void>((resolve) => {
          resumeResolverRef.current = resolve;
        });
      };

      const res = await runAgentVisualSteps({
        steps,
        mode,
        signal: controller.signal,
        bridge,
        callbacks: {
          setCursor: setCursorState,
          setSpotlight: setSpotlightState,
          onStepProgress: (idx, cap) => {
            setStepIndex(idx);
            setCaption(cap);
          },
          waitIfPaused,
        },
      });

      clearVisualOverlays();
      setStatus(res.interrupted ? 'INTERRUPTED' : 'IDLE');
      return { interrupted: res.interrupted, completedSteps: res.completedSteps };
    },
    [bridge, clearVisualOverlays, mode]
  );

  const executeScreenshotDirective = React.useCallback(
    async (directive: ScreenshotCaptureDirective): Promise<CapturedAnnotatedImage | null> => {
      if (directive.prepareSteps && directive.prepareSteps.length > 0) {
        const prep = await runVisualSequence(directive.prepareSteps);
        if (prep.interrupted) return null;
      }
      clearVisualOverlays();
      await new Promise((r) => setTimeout(r, 140));
      return captureAnnotatedScreenClient({ directive, hideValues: wb.hideValues });
    },
    [clearVisualOverlays, runVisualSequence, wb.hideValues]
  );

  const flashSuccessSpotlight = React.useCallback((targetId: string, label: string) => {
    setSpotlightState({ targetId, label, tone: 'emerald' });
    setTimeout(() => setSpotlightState({ targetId: null }), 1800);
  }, []);

  const value = React.useMemo(
    () => ({
      mode, setMode, status, setStatus, stepIndex, totalSteps, caption,
      cursorState, spotlightState, togglePause, stopExecution,
      buildUiStateSnapshot, runVisualSequence, executeScreenshotDirective, flashSuccessSpotlight,
    }),
    [mode, status, stepIndex, totalSteps, caption, cursorState, spotlightState, togglePause, stopExecution, buildUiStateSnapshot, runVisualSequence, executeScreenshotDirective, flashSuccessSpotlight]
  );

  return <AgentRuntimeContext.Provider value={value}>{children}</AgentRuntimeContext.Provider>;
}

export function useAgentRuntime(): AgentRuntimeContextValue {
  const ctx = React.useContext(AgentRuntimeContext);
  if (!ctx) throw new Error('useAgentRuntime deve ser usado dentro de <AgentRuntimeProvider>.');
  return ctx;
}
