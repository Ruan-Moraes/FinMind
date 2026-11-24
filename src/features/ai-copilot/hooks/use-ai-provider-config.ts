'use client';

import * as React from 'react';
import {
  AI_PROVIDER_META,
  type AiConnectionMode,
  type AiProviderId,
} from '@/features/ai-copilot/providers';
import { updateAiSettingsAction } from '@/features/ai-copilot/actions/ai-governance.actions';
import type { AiFinancialHubProps } from '@/features/ai-copilot/components/ai-financial-hub';

export function useAiProviderConfig(aiSettings: AiFinancialHubProps['aiSettings']) {
  const [provider, setProvider] = React.useState<AiProviderId>(aiSettings.aiProvider || 'OPENAI');
  const [connectionMode, setConnectionMode] = React.useState<AiConnectionMode>(
    aiSettings.aiConnectionMode || 'SUBSCRIPTION'
  );
  const [openaiKey, setOpenaiKey] = React.useState(aiSettings.openaiApiKey || '');
  const [geminiKey, setGeminiKey] = React.useState(aiSettings.geminiApiKey || '');
  const [claudeKey, setClaudeKey] = React.useState(aiSettings.claudeApiKey || '');
  const [openaiModel, setOpenaiModel] = React.useState(aiSettings.openaiModel || 'gpt-4o-mini');
  const [geminiModel, setGeminiModel] = React.useState(
    aiSettings.geminiModel || 'gemini-2.0-flash'
  );
  const [claudeModel, setClaudeModel] = React.useState(
    aiSettings.claudeModel || 'claude-3-5-sonnet-latest'
  );
  const [isSavingConfig, setIsSavingConfig] = React.useState(false);
  const [configSavedBanner, setConfigSavedBanner] = React.useState(false);
  const bannerTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    return () => {
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    };
  }, []);

  React.useEffect(() => {
    setProvider(aiSettings.aiProvider || 'OPENAI');
    setOpenaiModel(aiSettings.openaiModel || 'gpt-4o-mini');
    setGeminiModel(aiSettings.geminiModel || 'gemini-2.0-flash');
    setClaudeModel(aiSettings.claudeModel || 'claude-3-5-sonnet-latest');
  }, [
    aiSettings.aiProvider,
    aiSettings.openaiModel,
    aiSettings.geminiModel,
    aiSettings.claudeModel,
  ]);

  const currentProviderMeta = AI_PROVIDER_META[provider];

  const handleSaveAiConfig = async () => {
    setIsSavingConfig(true);
    setConfigSavedBanner(false);
    try {
      await updateAiSettingsAction({
        aiProvider: provider,
        aiConnectionMode: connectionMode,
        openaiApiKey: openaiKey,
        geminiApiKey: geminiKey,
        claudeApiKey: claudeKey,
        openaiModel,
        geminiModel,
        claudeModel,
      });
      setConfigSavedBanner(true);
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
      bannerTimerRef.current = setTimeout(() => setConfigSavedBanner(false), 3000);
    } finally {
      setIsSavingConfig(false);
    }
  };

  return {
    provider,
    setProvider,
    connectionMode,
    setConnectionMode,
    openaiKey,
    setOpenaiKey,
    geminiKey,
    setGeminiKey,
    claudeKey,
    setClaudeKey,
    openaiModel,
    setOpenaiModel,
    geminiModel,
    setGeminiModel,
    claudeModel,
    setClaudeModel,
    isSavingConfig,
    configSavedBanner,
    currentProviderMeta,
    handleSaveAiConfig,
  };
}
