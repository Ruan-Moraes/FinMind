import type { AgentVisualStep } from '@/features/ai-agent/domain/agent-types';

export interface PreparedMutationPreview {
  title: string;
  summary: string;
  beforePreview: Array<{ label: string; value: string }>;
  afterPreview: Array<{ label: string; value: string }>;
  beforeState: unknown;
  normalizedParams: Record<string, unknown>;
  postConfirmVisualSteps: AgentVisualStep[];
  reversible: boolean;
}

export interface ExecutedMutationResult {
  ok: boolean;
  verified: boolean;
  summary: string;
  afterState?: unknown;
  verificationDetail?: Record<string, unknown>;
  error?: string;
}

export interface AgentToolExecutor {
  preparePreview: (userId: string, rawArgs: Record<string, unknown>) => Promise<PreparedMutationPreview>;
  executeAndVerify: (userId: string, params: Record<string, unknown>) => Promise<ExecutedMutationResult>;
  rollback?: (userId: string, beforeState: unknown, afterState: unknown) => Promise<{ ok: boolean; summary: string }>;
}
