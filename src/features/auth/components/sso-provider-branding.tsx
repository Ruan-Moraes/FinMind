'use client';
import * as React from 'react';
import { type AiProviderId } from '@/features/ai-copilot/models';

export function ProviderBrandIcon({ provider }: { provider: AiProviderId }) {
  if (provider === 'OPENAI') {
    return (
      <svg
        className="h-7 w-7 text-emerald-600 dark:text-emerald-400"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 2a4.5 4.5 0 0 0-3.89 2.25L4.5 10.5a4.5 4.5 0 0 0 0 4.5l3.61 6.25a4.5 4.5 0 0 0 7.78 0l3.61-6.25a4.5 4.5 0 0 0 0-4.5L15.89 4.25A4.5 4.5 0 0 0 12 2Z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  }
  if (provider === 'GEMINI') {
    return (
      <svg
        className="h-7 w-7 text-blue-600 dark:text-blue-400"
        viewBox="0 0 24 24"
        fill="currentColor"
      >
        <path d="M12 2C12.5 7.2 16.8 11.5 22 12C16.8 12.5 12.5 16.8 12 22C11.5 16.8 7.2 12.5 2 12C7.2 11.5 11.5 7.2 12 2Z" />
      </svg>
    );
  }
  return (
    <svg
      className="h-7 w-7 text-amber-600 dark:text-amber-400"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6 5.6 18.4" />
    </svg>
  );
}

export const PROVIDER_BRANDING: Record<
  AiProviderId,
  {
    name: string;
    shortName: string;
    portalTitle: string;
    subtitle: string;
    accentRing: string;
    iconBoxClass: string;
    buttonClass: string;
    badgeClass: string;
    officialKeyPortalUrl: string;
    domainHint: string;
    planLabel: string;
  }
> = {
  OPENAI: {
    name: 'OpenAI Platform',
    shortName: 'OpenAI',
    portalTitle: 'Conectar API Oficial OpenAI',
    subtitle:
      'Informe sua chave oficial da OpenAI Platform para liberar chamadas reais aos modelos GPT-4o Mini, GPT-4o e o3-mini.',
    accentRing: 'focus:ring-emerald-500/40 focus:border-emerald-500',
    iconBoxClass:
      'bg-emerald-500/10 border-emerald-500/30 shadow-emerald-500/10',
    buttonClass:
      'bg-[#10a37f] hover:bg-[#0e906f] text-white shadow-md shadow-emerald-500/20 dark:shadow-emerald-950/50',
    badgeClass:
      'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
    officialKeyPortalUrl: 'https://platform.openai.com/api-keys',
    domainHint: 'api.openai.com',
    planLabel: 'OpenAI API Oficial',
  },
  GEMINI: {
    name: 'Google AI Studio (Gemini)',
    shortName: 'Gemini',
    portalTitle: 'Conectar API Oficial Google Gemini',
    subtitle:
      'Informe sua chave do Google AI Studio para liberar chamadas reais aos modelos Gemini 2.5 Flash, 2.0 Flash e 1.5 Pro.',
    accentRing: 'focus:ring-blue-500/40 focus:border-blue-500',
    iconBoxClass: 'bg-blue-500/10 border-blue-500/30 shadow-blue-500/10',
    buttonClass:
      'bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-500/20 dark:shadow-blue-950/50',
    badgeClass:
      'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30',
    officialKeyPortalUrl: 'https://aistudio.google.com/app/apikey',
    domainHint: 'generativelanguage.googleapis.com',
    planLabel: 'Google AI Studio API',
  },
  CLAUDE: {
    name: 'Anthropic Console (Claude)',
    shortName: 'Claude',
    portalTitle: 'Conectar API Oficial Anthropic Claude',
    subtitle:
      'Informe sua chave do Anthropic Console para liberar chamadas reais aos modelos Claude 3.5 Haiku, 3.5 Sonnet e 3.7 Sonnet.',
    accentRing: 'focus:ring-amber-500/40 focus:border-amber-500',
    iconBoxClass: 'bg-amber-500/10 border-amber-500/30 shadow-amber-500/10',
    buttonClass:
      'bg-[#d97706] hover:bg-[#b45309] text-white shadow-md shadow-amber-500/20 dark:shadow-amber-950/50',
    badgeClass:
      'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30',
    officialKeyPortalUrl: 'https://console.anthropic.com/settings/keys',
    domainHint: 'api.anthropic.com',
    planLabel: 'Anthropic API Oficial',
  },
};

