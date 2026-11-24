'use client';

import * as React from 'react';
import { AlertCircle, ChevronDown, ExternalLink } from 'lucide-react';
import type {
  AiModelDescriptor,
  AiProviderId,
  IntegrationDiagnosticCode,
} from '@/features/ai-copilot/models';
import { Button } from '@/shared/ui/button';

const DIAGNOSTIC_COPY: Record<
  IntegrationDiagnosticCode,
  { badge: string; title: string; advice: string; needsAuthAction: boolean }
> = {
  VALID: {
    badge: 'Conectado',
    title: 'Conexão validada',
    advice: 'O modelo respondeu corretamente.',
    needsAuthAction: false,
  },
  RATE_LIMITED_OR_QUOTA: {
    badge: 'Limite de cota atingido',
    title: 'Limite de uso atingido para este modelo',
    advice:
      'Sua conta atingiu o limite de requisições ou este modelo não está liberado no plano gratuito. Selecione outro modelo na lista acima ou verifique o plano da sua conta.',
    needsAuthAction: false,
  },
  MODEL_UNAVAILABLE: {
    badge: 'Modelo indisponível',
    title: 'Este modelo não está disponível na sua conta',
    advice:
      'O provedor descontinuou ou não liberou este modelo para sua chave. Clique em "Atualizar Google" e escolha outro modelo ativo na lista acima.',
    needsAuthAction: false,
  },
  MISSING_CREDENTIALS: {
    badge: 'Chave não configurada',
    title: 'Nenhuma chave conectada para este provedor',
    advice: 'Conecte sua chave de acesso para testar e usar este modelo.',
    needsAuthAction: true,
  },
  INVALID_CREDENTIALS: {
    badge: 'Chave inválida',
    title: 'A chave informada foi recusada',
    advice: 'Verifique se a chave foi copiada completa e sem espaços extras e atualize a conexão.',
    needsAuthAction: true,
  },
  AUTH_ERROR: {
    badge: 'Sem permissão',
    title: 'Permissão negada pelo provedor',
    advice: 'Sua chave não tem permissão para este modelo. Atualize a chave ou escolha outro modelo.',
    needsAuthAction: true,
  },
  FEATURE_INCOMPATIBLE: {
    badge: 'Recurso incompatível',
    title: 'Este modelo não suporta o formato solicitado',
    advice: 'Escolha outro modelo padrão na lista acima.',
    needsAuthAction: false,
  },
  SERVICE_UNAVAILABLE: {
    badge: 'Serviço instável',
    title: 'O provedor está temporariamente indisponível',
    advice: 'Aguarde alguns instantes e tente novamente.',
    needsAuthAction: false,
  },
  NETWORK_ERROR: {
    badge: 'Falha de conexão',
    title: 'Não foi possível comunicar com o provedor',
    advice: 'Verifique sua conexão com a internet e tente novamente.',
    needsAuthAction: false,
  },
};

export function getFriendlyDiagnosticBadge(code?: IntegrationDiagnosticCode | null): string {
  return DIAGNOSTIC_COPY[code || 'AUTH_ERROR']?.badge || 'Erro de conexão';
}

export function AiDiagnosticErrorCard({
  diagnosticCode,
  rawError,
  currentModel,
  isCurrentProviderLogged,
  onOpenPopup,
}: {
  diagnosticCode?: IntegrationDiagnosticCode | null;
  rawError: string;
  currentModel: AiModelDescriptor;
  isCurrentProviderLogged: boolean;
  onOpenPopup: (provider: AiProviderId, targetModelId?: string) => void;
}) {
  const info = DIAGNOSTIC_COPY[diagnosticCode || 'AUTH_ERROR'] || DIAGNOSTIC_COPY.NETWORK_ERROR;
  const showConnectBtn = info.needsAuthAction || !isCurrentProviderLogged;

  return (
    <div className="rounded-2xl border border-rose-300/80 dark:border-rose-900/70 bg-rose-50/80 dark:bg-rose-950/40 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="h-8 w-8 rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 mt-0.5">
          <AlertCircle className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <h5 className="text-xs font-semibold text-rose-900 dark:text-rose-200">{info.title}</h5>
          <p className="text-xs text-rose-700/90 dark:text-rose-300/90 leading-relaxed">
            {info.advice}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-rose-200/70 dark:border-rose-900/60">
        <details className="group flex-1 min-w-[180px]">
          <summary className="list-none cursor-pointer inline-flex items-center gap-1 text-[11px] font-medium text-rose-700/80 dark:text-rose-300/80 hover:text-rose-900 dark:hover:text-rose-100 select-none">
            <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
            <span>Ver detalhes técnicos</span>
          </summary>
          <pre className="mt-2 max-h-32 overflow-y-auto whitespace-pre-wrap break-words rounded-xl bg-white/80 dark:bg-zinc-950/80 border border-rose-200/70 dark:border-rose-900/60 p-2.5 text-[11px] font-mono text-rose-800 dark:text-rose-200 leading-relaxed">
            {rawError}
          </pre>
        </details>

        {showConnectBtn && (
          <Button
            type="button"
            variant="primary"
            size="sm"
            className="shrink-0"
            onClick={() => onOpenPopup(currentModel.provider, currentModel.id)}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span>Conectar {currentModel.shortProviderName}</span>
          </Button>
        )}
      </div>
    </div>
  );
}
