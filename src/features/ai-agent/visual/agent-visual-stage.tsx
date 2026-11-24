'use client';

import * as React from 'react';
import { useAgentRuntime } from '@/features/ai-agent/context/agent-runtime-context';
import { AiVirtualCursor } from '@/features/ai-agent/visual/ai-virtual-cursor';
import { AiElementSpotlight } from '@/features/ai-agent/visual/ai-element-spotlight';
import { AiExecutionControlPill } from '@/features/ai-agent/visual/ai-execution-control-pill';

export function AgentVisualStage() {
  const {
    status,
    stepIndex,
    totalSteps,
    caption,
    cursorState,
    spotlightState,
    togglePause,
    stopExecution,
  } = useAgentRuntime();

  return (
    <>
      <AiElementSpotlight state={spotlightState} />
      <AiVirtualCursor state={cursorState} />
      <AiExecutionControlPill
        status={status}
        stepIndex={stepIndex}
        totalSteps={totalSteps}
        caption={caption}
        onTogglePause={togglePause}
        onStop={stopExecution}
      />
    </>
  );
}
