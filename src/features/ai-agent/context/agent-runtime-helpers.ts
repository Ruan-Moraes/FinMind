'use client';

import type { ActiveTab } from '@/features/dashboard/types/workbench-types';
import type { CoachmarkTourState, UiStateSnapshot } from '@/features/ai-agent/domain/agent-types';
import type { WorkbenchBridgeActions } from '@/features/ai-agent/visual/agent-visual-runner';
import type { VirtualCursorState } from '@/features/ai-agent/visual/ai-virtual-cursor';
import type { SpotlightState } from '@/features/ai-agent/visual/ai-element-spotlight';
import { collectMountedAgentTargets } from '@/features/ai-agent/visual/dom-target-resolver';

export const HIDDEN_CURSOR: VirtualCursorState = {
  visible: false,
  x: 0,
  y: 0,
  clicking: false,
  caption: '',
};

export function buildInteractiveSpotlight(tour: CoachmarkTourState): SpotlightState {
  const step = tour.steps[tour.activeIndex];
  if (!step?.targetId) return { targetId: null };
  return {
    targetId: step.targetId,
    fallbackTextMatch: step.fallbackTextMatch,
    label: step.caption,
    tooltipTitle: step.tooltipTitle || step.caption,
    tooltipBody: step.tooltipBody,
    tooltipPlacement: step.tooltipPlacement,
    tone: step.tone || 'indigo',
    stepNumber: tour.activeIndex + 1,
    totalSteps: tour.steps.length,
    interactive: true,
    canPrev: tour.activeIndex > 0,
    canNext: tour.activeIndex < tour.steps.length - 1,
  };
}

export interface WorkbenchBridgeSource {
  activeTab: ActiveTab;
  activeModal: { type: string } | null;
  hideValues: boolean;
  theme: UiStateSnapshot['theme'];
  density: UiStateSnapshot['density'];
  searchQuery: string;
  filterType: string;
  filterNature: string;
  filterCategoryId: string;
  setActiveTab: (tab: ActiveTab) => void;
  setIsSettingsModalOpen: (open: boolean) => void;
  handleOpenCreateGoalModal: () => void;
  handleOpenCreateStaticRuleModal: (type: 'INCOME' | 'EXPENSE') => void;
  handleOpenCreateTxModal: () => void;
  handleOpenCreateAccountModal: () => void;
  handleOpenCreateCardModal: () => void;
  setIsBudgetModalOpen: (open: boolean) => void;
  handleOpenCreateCategoryModal: (presetType?: 'INCOME' | 'EXPENSE') => void;
  closeModal: () => void;
  updatePeriodParams: (params: { month?: number; year?: number }) => void;
  setSearchQuery: (v: string) => void;
  setFilterType: (v: string) => void;
  setFilterNature: (v: string) => void;
  setFilterCategoryId: (v: string) => void;
}

export function createWorkbenchBridge(wb: WorkbenchBridgeSource): WorkbenchBridgeActions {
  return {
    switchTab: (tab: ActiveTab) => wb.setActiveTab(tab),
    openModal: (modalType: string) => {
      if (modalType === 'SETTINGS') wb.setIsSettingsModalOpen(true);
      else if (modalType === 'GOAL') wb.handleOpenCreateGoalModal();
      else if (modalType === 'STATIC_RULE') wb.handleOpenCreateStaticRuleModal('EXPENSE');
      else if (modalType === 'TX') wb.handleOpenCreateTxModal();
      else if (modalType === 'ACCOUNT') wb.handleOpenCreateAccountModal();
      else if (modalType === 'CARD') wb.handleOpenCreateCardModal();
      else if (modalType === 'BUDGET') wb.setIsBudgetModalOpen(true);
      else if (modalType === 'CATEGORY') wb.handleOpenCreateCategoryModal('EXPENSE');
    },
    closeModal: () => wb.closeModal(),
    setPeriod: (month: number, year: number) => wb.updatePeriodParams({ month, year }),
    setTxFilters: (f) => {
      if (f.searchQuery !== undefined) wb.setSearchQuery(f.searchQuery);
      if (f.filterType !== undefined) wb.setFilterType(f.filterType);
      if (f.filterNature !== undefined) wb.setFilterNature(f.filterNature);
      if (f.filterCategoryId !== undefined) wb.setFilterCategoryId(f.filterCategoryId);
    },
  };
}

export function createUiStateSnapshot(
  wb: WorkbenchBridgeSource,
  selectedMonth: number,
  selectedYear: number
): UiStateSnapshot {
  return {
    activeTab: wb.activeTab,
    selectedMonth,
    selectedYear,
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
}
