'use client';

import * as React from 'react';
import { History, RefreshCw } from 'lucide-react';
import { listAgentAuditLogsAction } from '@/features/ai-agent/actions/agent.actions';

type AuditRow = Awaited<ReturnType<typeof listAgentAuditLogsAction>>['logs'][number];

const STATUS_LABEL: Record<string, { label: string; tone: string }> = {
  SUCCEEDED: { label: 'Executada', tone: 'text-emerald-600 dark:text-emerald-400' },
  FAILED: { label: 'Falhou', tone: 'text-rose-600 dark:text-rose-400' },
  CANCELLED: { label: 'Cancelada', tone: 'text-slate-500 dark:text-zinc-400' },
  ROLLED_BACK: { label: 'Desfeita', tone: 'text-amber-600 dark:text-amber-400' },
  AWAITING_CONFIRMATION: { label: 'Aguardando confirmação', tone: 'text-indigo-600 dark:text-indigo-400' },
  EXECUTING: { label: 'Executando', tone: 'text-indigo-600 dark:text-indigo-400' },
  PLANNED: { label: 'Planejada', tone: 'text-slate-500 dark:text-zinc-400' },
};

export function AgentAuditLogPanel() {
  const [logs, setLogs] = React.useState<AuditRow[]>([]);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setLoading(true);
    const res = await listAgentAuditLogsAction();
    setLogs(res.logs);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  return (
    <div data-agent-id="ai.panel.auditLog" className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-900/70 p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <History className="h-5 w-5 text-indigo-500" />
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100">Histórico de ações do Agente IA</h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400">Tudo que o agente planejou, executou ou desfez em seus dados (últimas 20).</p>
          </div>
        </div>
        <button type="button" onClick={() => void load()} className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 inline-flex items-center gap-1.5 hover:underline">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Atualizar
        </button>
      </div>
      {logs.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 dark:border-zinc-800 p-6 text-center text-xs text-slate-500 dark:text-zinc-400">
          {loading ? 'Carregando…' : 'Nenhuma ação do agente registrada ainda.'}
        </p>
      ) : (
        <ul className="divide-y divide-slate-200 dark:divide-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs">
          {logs.map((l) => {
            const st = STATUS_LABEL[l.status] || { label: l.status, tone: 'text-slate-500' };
            return (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                <div className="min-w-0">
                  <span className="font-mono font-semibold text-slate-800 dark:text-zinc-200">{l.toolName}</span>
                  <span className="ml-2 text-slate-400">{l.riskLevel}</span>
                  {l.errorMessage && <p className="text-rose-600 dark:text-rose-400 truncate max-w-md">{l.errorMessage}</p>}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={`font-semibold ${st.tone}`}>{st.label}</span>
                  <time className="text-slate-400" dateTime={l.createdAt}>{new Date(l.createdAt).toLocaleString('pt-BR')}</time>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
