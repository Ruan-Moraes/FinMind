'use client';

import type { ActiveTab } from '@/features/dashboard/types/workbench-types';
import type {
  AgentInteractionMode,
  AgentVisualStep,
} from '@/features/ai-agent/domain/agent-types';
import {
  scrollTargetIntoViewSmooth,
  setReactControlledFieldValue,
  waitForAgentTarget,
} from '@/features/ai-agent/visual/dom-target-resolver';
import type { VirtualCursorState } from '@/features/ai-agent/visual/ai-virtual-cursor';
import type { SpotlightState } from '@/features/ai-agent/visual/ai-element-spotlight';

export interface WorkbenchBridgeActions {
  switchTab: (tab: ActiveTab) => void;
  openModal: (modalType: string, payload?: Record<string, unknown>) => void;
  closeModal: () => void;
  setPeriod: (month: number, year: number) => void;
  setTxFilters: (filters: {
    searchQuery?: string;
    filterType?: string;
    filterNature?: string;
    filterCategoryId?: string;
  }) => void;
}

export interface VisualRunCallbacks {
  setCursor: (fn: (prev: VirtualCursorState) => VirtualCursorState) => void;
  setSpotlight: (s: SpotlightState) => void;
  onStepProgress: (index: number, caption: string) => void;
  waitIfPaused: () => Promise<void>;
}

function easeOutQuint(t: number): number {
  return 1 - Math.pow(1 - t, 5);
}

function sleepAbortable(ms: number, signal: AbortSignal): Promise<boolean> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve(false);
      return;
    }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve(true);
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      resolve(false);
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

async function animateCursorBezier(params: {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  caption: string;
  fast: boolean;
  signal: AbortSignal;
  setCursor: VisualRunCallbacks['setCursor'];
}): Promise<{ x: number; y: number }> {
  const { fromX, fromY, toX, toY, caption, fast, signal, setCursor } = params;
  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (fast || reducedMotion) {
    setCursor((p) => ({ ...p, visible: true, x: toX, y: toY, caption, clicking: false }));
    return { x: toX, y: toY };
  }

  const dist = Math.hypot(toX - fromX, toY - fromY);
  const durationMs = Math.min(480, Math.max(220, dist * 0.45));
  const midX = (fromX + toX) / 2 + (toY - fromY) * 0.12;
  const midY = (fromY + toY) / 2 - Math.min(45, dist * 0.12);

  return new Promise((resolve) => {
    const start = performance.now();
    const frame = (now: number) => {
      if (signal.aborted) {
        resolve({ x: toX, y: toY });
        return;
      }
      const rawT = Math.min(1, (now - start) / durationMs);
      const t = easeOutQuint(rawT);
      const u = 1 - t;
      const x = u * u * fromX + 2 * u * t * midX + t * t * toX;
      const y = u * u * fromY + 2 * u * t * midY + t * t * toY;
      setCursor((p) => ({ ...p, visible: true, x, y, caption, clicking: false }));
      if (rawT < 1) {
        requestAnimationFrame(frame);
      } else {
        resolve({ x: toX, y: toY });
      }
    };
    requestAnimationFrame(frame);
  });
}

export async function runAgentVisualSteps(params: {
  steps: AgentVisualStep[];
  mode: AgentInteractionMode;
  signal: AbortSignal;
  bridge: WorkbenchBridgeActions;
  callbacks: VisualRunCallbacks;
}): Promise<{ completedSteps: number; interrupted: boolean; failedReason?: string }> {
  const { steps, mode, signal, bridge, callbacks } = params;
  const fast = mode === 'FAST';
  let curX = typeof window !== 'undefined' ? window.innerWidth * 0.78 : 600;
  let curY = typeof window !== 'undefined' ? window.innerHeight * 0.72 : 400;

  for (let i = 0; i < steps.length; i += 1) {
    if (signal.aborted) return { completedSteps: i, interrupted: true };
    await callbacks.waitIfPaused();
    if (signal.aborted) return { completedSteps: i, interrupted: true };

    const step = steps[i];
    callbacks.onStepProgress(i, step.caption);

    let targetEl: HTMLElement | null = null;
    if (step.targetId) {
      targetEl = await waitForAgentTarget(step.targetId, signal, 3200);
      if (signal.aborted) return { completedSteps: i, interrupted: true };
      if (targetEl) {
        const rect = await scrollTargetIntoViewSmooth(targetEl, fast);
        const destX = rect.left + Math.min(rect.width * 0.5, 160);
        const destY = rect.top + rect.height * 0.5;
        callbacks.setSpotlight({ targetId: step.targetId, label: step.caption, tone: 'indigo' });
        const pos = await animateCursorBezier({
          fromX: curX,
          fromY: curY,
          toX: destX,
          toY: destY,
          caption: step.caption,
          fast,
          signal,
          setCursor: callbacks.setCursor,
        });
        curX = pos.x;
        curY = pos.y;
      }
    }

    if (step.action === 'SWITCH_TAB' && step.tab) {
      if (!fast && targetEl) {
        callbacks.setCursor((p) => ({ ...p, clicking: true }));
        await sleepAbortable(130, signal);
        callbacks.setCursor((p) => ({ ...p, clicking: false }));
      }
      bridge.switchTab(step.tab);
      await sleepAbortable(fast ? 60 : 220, signal);
    } else if (step.action === 'OPEN_MODAL' && step.modalType) {
      if (!fast && targetEl) {
        callbacks.setCursor((p) => ({ ...p, clicking: true }));
        await sleepAbortable(130, signal);
        callbacks.setCursor((p) => ({ ...p, clicking: false }));
      }
      bridge.openModal(step.modalType, step.modalPayload);
      await sleepAbortable(fast ? 80 : 280, signal);
    } else if (step.action === 'CLOSE_MODAL') {
      bridge.closeModal();
      await sleepAbortable(fast ? 50 : 180, signal);
    } else if (step.action === 'SET_PERIOD' && step.modalPayload) {
      const m = Number(step.modalPayload.month);
      const y = Number(step.modalPayload.year);
      if (m && y) bridge.setPeriod(m, y);
      await sleepAbortable(fast ? 80 : 250, signal);
    } else if (step.action === 'SET_TX_FILTERS' && step.modalPayload) {
      bridge.setTxFilters(step.modalPayload as Parameters<WorkbenchBridgeActions['setTxFilters']>[0]);
      await sleepAbortable(fast ? 80 : 240, signal);
    } else if (step.action === 'CLICK' && targetEl) {
      callbacks.setCursor((p) => ({ ...p, clicking: true }));
      await sleepAbortable(fast ? 40 : 140, signal);
      targetEl.click();
      callbacks.setCursor((p) => ({ ...p, clicking: false }));
      await sleepAbortable(fast ? 60 : 220, signal);
    } else if (step.action === 'FILL_FIELD' && targetEl && step.fieldValue !== undefined) {
      targetEl.focus();
      setReactControlledFieldValue(targetEl, step.fieldValue);
      await sleepAbortable(fast ? 50 : 260, signal);
    } else if (step.action === 'HIGHLIGHT' || step.action === 'SCROLL_TO' || step.action === 'WAIT_PAINT') {
      await sleepAbortable(fast ? 80 : step.pauseMs ?? 550, signal);
    }
  }

  return { completedSteps: steps.length, interrupted: signal.aborted };
}
