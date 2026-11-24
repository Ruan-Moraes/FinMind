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
    dismissCoachmark,
    prevCoachmarkStep,
    nextCoachmarkStep,
  } = useAgentRuntime();

  return (
    <>
      <AiElementSpotlight
        state={spotlightState}
        onPrev={prevCoachmarkStep}
        onNext={nextCoachmarkStep}
        onDismiss={dismissCoachmark}
      />
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
