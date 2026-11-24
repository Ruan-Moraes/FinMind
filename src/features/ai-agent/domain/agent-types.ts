import type { ActiveTab } from '@/features/dashboard/types/workbench-types';
import type { AssistantChartSpec } from '@/features/ai-copilot/assistant/assistant-chart-builder';
import type { AgentTargetId } from '@/features/ai-agent/domain/agent-target-registry';
import type { DynamicContentBlock } from '@/features/ai-agent/domain/dynamic-content-schemas';

export type AgentInteractionMode = 'VISUAL' | 'GUIDED' | 'FAST';

export type AgentModality =
  | 'ANALYTICAL'
  | 'AUTONOMOUS'
  | 'INTERACTIVE_GUIDE'
  | 'ANNOTATED_SCREENSHOT'
  | 'HYBRID';

export type AgentRiskLevel = 'L0' | 'L1' | 'L2' | 'L3' | 'BLOCKED';

export type AgentExecutionStatus =
  | 'IDLE'
  | 'PLANNING'
  | 'AWAITING_CONFIRMATION'
  | 'RUNNING_VISUAL'
  | 'PAUSED'
  | 'VERIFYING'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'INTERRUPTED'
  | 'FAILED';

export interface UiStateSnapshot {
  activeTab: ActiveTab;
  selectedMonth: number;
  selectedYear: number;
  activeModalType: string | null;
  hideValues: boolean;
  theme: 'LIGHT' | 'DARK' | 'SYSTEM';
  density: 'COMFORTABLE' | 'COMPACT';
  viewport: 'DESKTOP' | 'MOBILE';
  activeFilters: {
    searchQuery: string;
    filterType: string;
    filterNature: string;
    filterCategoryId: string;
  };
  mountedTargets: string[];
}

export type AgentVisualActionType =
  | 'SWITCH_TAB'
  | 'OPEN_MODAL'
  | 'CLOSE_MODAL'
  | 'SET_PERIOD'
  | 'SET_TX_FILTERS'
  | 'HIGHLIGHT'
  | 'CLICK'
  | 'FILL_FIELD'
  | 'SCROLL_TO'
  | 'WAIT_PAINT';

export interface AgentVisualStep {
  id: string;
  action: AgentVisualActionType;
  targetId?: AgentTargetId | string;
  tab?: ActiveTab;
  modalType?: string;
  modalPayload?: Record<string, unknown>;
  fieldValue?: string;
  caption: string;
  pauseMs?: number;
  tooltipTitle?: string;
  tooltipBody?: string;
  tooltipPlacement?: 'auto' | 'top' | 'bottom' | 'left' | 'right';
  tone?: 'indigo' | 'emerald' | 'amber';
  fallbackTextMatch?: string;
  persistCoachmark?: boolean;
}

export interface CoachmarkTourState {
  steps: AgentVisualStep[];
  activeIndex: number;
}

export interface ScreenshotAnnotationSpec {
  targetId: AgentTargetId | string;
  stepNumber: number;
  label: string;
  color?: 'indigo' | 'emerald' | 'amber' | 'rose';
}

export interface ScreenshotCaptureDirective {
  title: string;
  subtitle?: string;
  prepareSteps?: AgentVisualStep[];
  annotations: ScreenshotAnnotationSpec[];
}

export interface CapturedAnnotatedImage {
  id: string;
  title: string;
  subtitle?: string;
  dataUrl: string;
  privacyMasked: boolean;
  annotationsCount: number;
  capturedAt: string;
}

export interface PendingAgentMutation {
  auditLogId: string;
  runId: string;
  idempotencyKey: string;
  toolName: string;
  riskLevel: AgentRiskLevel;
  title: string;
  summary: string;
  beforePreview: Array<{ label: string; value: string }>;
  afterPreview: Array<{ label: string; value: string }>;
  params: Record<string, unknown>;
  postConfirmVisualSteps: AgentVisualStep[];
  reversible: boolean;
}

export interface AgentKnowledgeCitation {
  docId: string;
  module: string;
  sectionPath: string;
  score: number;
}

export interface AgentTraceStep {
  toolName: string;
  phase: 'READ_DATA' | 'RENDER_UI' | 'UI_ACTION' | 'MUTATION_PLAN' | 'VALIDATION';
  status: 'OK' | 'RETRY' | 'ERROR';
  durationMs: number;
  note?: string;
}

export interface AgentExecutionTrace {
  iterations: number;
  retriedForAlignment: boolean;
  validationNote?: string;
  steps: AgentTraceStep[];
}

export interface AgentTurnPayload {
  runId: string;
  modality: AgentModality;
  narrative: string;
  providerUsed: string;
  modelUsed: string;
  executionMode: 'LIVE_AGENT_TOOLS' | 'DETERMINISTIC_AGENT_LOCAL';
  systemSources: AgentKnowledgeCitation[];
  visualSteps: AgentVisualStep[];
  dryRunGuide: boolean;
  pendingMutation?: PendingAgentMutation | null;
  screenshotDirective?: ScreenshotCaptureDirective | null;
  executedImmediateResult?: {
    auditLogId: string;
    toolName: string;
    verified: boolean;
    summary: string;
    reversible?: boolean;
  } | null;
  charts?: AssistantChartSpec[];
  contentBlocks?: DynamicContentBlock[];
  executionTrace?: AgentExecutionTrace;
  historicalFacts?: string[];
  calculatedResults?: string[];
  projectionsAndEstimates?: string[];
  personalizedRecommendations?: string[];
  apiWarning?: string | null;
  answeredAt: string;
}
