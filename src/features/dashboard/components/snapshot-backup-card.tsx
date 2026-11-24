'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  Download,
  Upload,
} from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { FINMIND_SNAPSHOT_FORMAT, FINMIND_SNAPSHOT_VERSION } from '@/features/dashboard/domain/snapshot-schema';

interface PendingSnapshotPreview {
  fileName: string;
  exportedAt: string;
  rawPayload: unknown;
  summary: {
    accounts: number;
    creditCards: number;
    categories: number;
    transactions: number;
    goals: number;
    rules: number;
    forecasts: number;
  };
}

export function SnapshotBackupCard() {
  const router = useRouter();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [pending, setPending] = React.useState<PendingSnapshotPreview | null>(null);
  const [isImporting, setIsImporting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setError(null);
    setSuccessMsg(null);

    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as Record<string, unknown>;
      const data = parsed?.data as Record<string, unknown> | undefined;

      if (
        parsed?.format !== FINMIND_SNAPSHOT_FORMAT ||
        parsed?.version !== FINMIND_SNAPSHOT_VERSION ||
        !data ||
        typeof data !== 'object'
      ) {
        setError('Arquivo inválido. Selecione um snapshot exportado pelo FinMind.');
        return;
      }

      const arrLen = (key: string) => (Array.isArray(data[key]) ? (data[key] as unknown[]).length : 0);
      setPending({
        fileName: file.name,
        exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : '',
        rawPayload: parsed,
        summary: {
          accounts: arrLen('accounts'),
          creditCards: arrLen('creditCards'),
          categories: arrLen('categories'),
          transactions: arrLen('transactions'),
          goals: arrLen('portfolioGoals'),
          rules: arrLen('recurrenceRules'),
          forecasts: arrLen('valueForecastItems') + arrLen('balanceTargetChecks'),
        },
      });
    } catch {
      setError('Não foi possível ler o arquivo selecionado. Verifique se é um arquivo de snapshot válido.');
    }
  };

  const handleConfirmImport = async () => {
    if (!pending) return;
    setIsImporting(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/snapshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pending.rawPayload),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        counts?: {
          accounts: number;
          transactions: number;
          categories: number;
          portfolioGoals: number;
        };
      };

      if (!res.ok || !data.ok) {
        setError(data.error || 'Erro ao importar o snapshot.');
        return;
      }

      setPending(null);
      setSuccessMsg(
        `Snapshot restaurado com sucesso! ${data.counts?.accounts ?? 0} contas, ${
          data.counts?.categories ?? 0
        } categorias, ${data.counts?.transactions ?? 0} lançamentos e ${
          data.counts?.portfolioGoals ?? 0
        } metas pareados.`
      );
      router.refresh();
    } catch {
      setError('Falha de conexão ao restaurar o snapshot.');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-indigo-200/80 dark:border-indigo-900/60 bg-indigo-50/30 dark:bg-indigo-950/20 p-4 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-0.5">
          <div className="text-sm font-semibold text-slate-900 dark:text-zinc-100 flex items-center gap-1.5">
            <Archive className="h-4 w-4 text-indigo-500 shrink-0" />
            Snapshot Completo (Backup & Restauração)
          </div>
          <div className="text-xs text-slate-500 dark:text-zinc-400">
            Exporte um snapshot com todos os dados da aplicação ou importe um arquivo salvo para parear toda a aplicação com o backup.
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <a
            href="/api/snapshot"
            download
            className="inline-flex items-center justify-center gap-1.5 rounded-xl font-medium whitespace-nowrap leading-none transition-all duration-150 border border-slate-200 bg-white text-slate-900 hover:bg-slate-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800 h-8 px-3 text-xs"
          >
            <Download className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
            <span>Exportar Snapshot</span>
          </a>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
          >
            <Upload className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
            <span>Importar Snapshot</span>
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleFileChange}
            className="hidden"
            aria-label="Selecionar arquivo de snapshot"
          />
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/60 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
          {error}
        </div>
      )}

      {successMsg && (
        <div className="rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/50 px-3 py-2 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {pending && (
        <div className="rounded-xl border border-amber-300 dark:border-amber-800/80 bg-amber-50/80 dark:bg-amber-950/40 p-3.5 space-y-3">
          <div className="flex items-start gap-2 text-xs text-amber-950 dark:text-amber-200">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-semibold">
                Confirmar restauração de {pending.fileName}
              </div>
              <p className="text-[11px] leading-relaxed">
                Todos os dados atuais serão substituídos e pareados com este snapshot:{' '}
                <strong>{pending.summary.accounts}</strong> contas,{' '}
                <strong>{pending.summary.creditCards}</strong> cartões,{' '}
                <strong>{pending.summary.categories}</strong> categorias,{' '}
                <strong>{pending.summary.transactions}</strong> lançamentos,{' '}
                <strong>{pending.summary.goals}</strong> metas,{' '}
                <strong>{pending.summary.rules}</strong> regras fixas e{' '}
                <strong>{pending.summary.forecasts}</strong> previsões.
              </p>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setPending(null)}
              disabled={isImporting}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleConfirmImport}
              isLoading={isImporting}
            >
              Confirmar e Parear Dados
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
