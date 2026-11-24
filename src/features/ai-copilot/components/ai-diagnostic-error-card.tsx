'use client';

import * as React from 'react';
import { AlertCircle, ChevronDown, KeyRound } from 'lucide-react';
import type { IntegrationDiagnosticCode } from '@/features/ai-copilot/domain/ai-provider-types';
import { Button } from '@/shared/ui/button';

const DIAGNOSTIC_COPY: Record<
  IntegrationDiagnosticCode,
  { badge: string; title: string; advice: string; needsKeyAction: boolean }
> = {
  VALID: {
    badge: 'Conectado',
    title: 'Conexão validada',
    advice: 'O modelo respondeu corretamente.',
    needsKeyAction: false,
  },
  RATE_LIMITED_OR_QUOTA: {
    badge: 'Limite atingido',
    title: 'Limite de uso ou faturamento atingido',
    advice:
      'Sua conta atingiu o limite de requisições ou créditos para este modelo. Escolha outro modelo disponível ou revise o plano no console do provedor.',
    needsKeyAction: false,
  },
  MODEL_UNAVAILABLE: {
    badge: 'Modelo indisponível',
    title: 'Este modelo não está disponível na sua conta',
    advice:
      'O provedor descontinuou ou não liberou este modelo para sua chave. Atualize a lista de modelos e escolha um modelo ativo.',
    needsKeyAction: false,
  },
  MISSING_CREDENTIALS: {
    badge: 'Não configurado',
    title: 'Nenhuma chave de API configurada para este provedor',
    advice: 'Cadastre uma chave de API oficial para listar os modelos disponíveis e usar este provedor.',
    needsKeyAction: true,
  },
  INVALID_CREDENTIALS: {
    badge: 'Credencial inválida',
    title: 'A chave de API informada foi recusada',
    advice: 'Verifique se a chave foi copiada completa e sem espaços extras, ou gere uma nova chave no console do provedor.',
    needsKeyAction: true,
  },
  AUTH_ERROR: {
    badge: 'Acesso restrito',
    title: 'Permissão negada pelo provedor',
    advice: 'Sua chave de API não possui permissão para este modelo ou recurso. Revise as permissões da chave ou selecione outro modelo.',
    needsKeyAction: true,
  },
  FEATURE_INCOMPATIBLE: {
    badge: 'Incompatível',
    title: 'Este modelo não suporta o formato solicitado',
    advice: 'Escolha outro modelo compatível com chat e ferramentas na lista acima.',
    needsKeyAction: false,
  },
  SERVICE_UNAVAILABLE: {
    badge: 'Indisponível',
    title: 'O provedor está temporariamente indisponível',
    advice: 'Falha temporária no servidor do provedor. Sua credencial continua salva — tente novamente em alguns instantes.',
    needsKeyAction: false,
  },
  NETWORK_ERROR: {
    badge: 'Indisponível',
    title: 'Falha temporária de comunicação',
    advice: 'Verifique sua conexão com a internet e tente novamente.',
    needsKeyAction: false,
  },
};

export function getFriendlyDiagnosticBadge(code?: IntegrationDiagnosticCode | null): string {
  return DIAGNOSTIC_COPY[code || 'NETWORK_ERROR']?.badge || 'Erro de conexão';
}

export function AiDiagnosticErrorCard({
  diagnosticCode,
  rawError,
  providerName,
  onConfigureKey,
}: {
  diagnosticCode?: IntegrationDiagnosticCode | null;
  rawError: string;
  providerName: string;
  onConfigureKey?: () => void;
}) {
  const info = DIAGNOSTIC_COPY[diagnosticCode || 'NETWORK_ERROR'] || DIAGNOSTIC_COPY.NETWORK_ERROR;

  return (
    <div className="rounded-2xl border border-rose-300/80 dark:border-rose-900/70 bg-rose-50/80 dark:bg-rose-950/40 p-3.5 space-y-2.5">
      <div className="flex items-start gap-2.5">
        <div className="h-7 w-7 rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 mt-0.5">
          <AlertCircle className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1 space-y-0.5">
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
          <pre className="mt-2 max-h-28 overflow-y-auto whitespace-pre-wrap break-words rounded-xl bg-white/80 dark:bg-zinc-950/80 border border-rose-200/70 dark:border-rose-900/60 p-2 text-[11px] font-mono text-rose-800 dark:text-rose-200 leading-relaxed">
            {rawError}
          </pre>
        </details>

        {info.needsKeyAction && onConfigureKey && (
          <Button type="button" variant="primary" size="sm" className="shrink-0" onClick={onConfigureKey}>
            <KeyRound className="h-3.5 w-3.5" />
            <span>Configurar {providerName}</span>
          </Button>
        )}
      </div>
    </div>
  );
}
