'use client';

import * as React from 'react';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Clock,
  RotateCcw,
} from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Badge } from '@/shared/ui/badge';
import type { SerializedImportBatch } from '@/features/reconciliation/components/statement-reconciliation-workbench';

const PAGE_SIZE = 6;

function getBatchFileSignature(batch: SerializedImportBatch): string {
  return batch.files
    .map((f) => f.fileName.trim().toLowerCase())
    .filter(Boolean)
    .sort()
    .join('|');
}

export function ImportBatchesHistoryList({
  importBatches,
  onRequestRevert,
}: {
  importBatches: SerializedImportBatch[];
  onRequestRevert: (batch: SerializedImportBatch) => void;
}) {
  const [filterMode, setFilterMode] = React.useState<'ALL' | 'DUPLICATES'>('ALL');
  const [page, setPage] = React.useState(1);

  const activeSignatureCounts = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const batch of importBatches) {
      if (batch.status === 'REVERTED') continue;
      const sig = getBatchFileSignature(batch);
      if (!sig) continue;
      counts.set(sig, (counts.get(sig) || 0) + 1);
    }
    return counts;
  }, [importBatches]);

  const isDuplicateBatch = React.useCallback(
    (batch: SerializedImportBatch) => {
      if (batch.status === 'REVERTED') return false;
      const sig = getBatchFileSignature(batch);
      return Boolean(sig && (activeSignatureCounts.get(sig) || 0) > 1);
    },
    [activeSignatureCounts]
  );

  const duplicateCount = React.useMemo(
    () => importBatches.filter(isDuplicateBatch).length,
    [importBatches, isDuplicateBatch]
  );

  const filteredBatches = React.useMemo(
    () => (filterMode === 'DUPLICATES' ? importBatches.filter(isDuplicateBatch) : importBatches),
    [importBatches, filterMode, isDuplicateBatch]
  );

  const totalPages = Math.max(1, Math.ceil(filteredBatches.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const startIdx = (safePage - 1) * PAGE_SIZE;
  const pageBatches = filteredBatches.slice(startIdx, startIdx + PAGE_SIZE);

  React.useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  if (importBatches.length === 0) return null;

  return (
    <div className="pt-4 border-t border-slate-200 dark:border-zinc-800 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Clock className="h-4 w-4 text-indigo-500" />
            Histórico de Importações Confirmadas & Auditoria
          </h3>
          {duplicateCount > 0 && (
            <Badge variant="warning">
              <AlertTriangle className="h-3 w-3 shrink-0" />
              {duplicateCount} arquivo(s) duplicado(s)
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-1.5 text-xs">
          <button
            type="button"
            onClick={() => {
              setFilterMode('ALL');
              setPage(1);
            }}
            className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
              filterMode === 'ALL'
                ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950'
                : 'text-slate-500 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
            }`}
          >
            Todos ({importBatches.length})
          </button>
          <button
            type="button"
            onClick={() => {
              setFilterMode('DUPLICATES');
              setPage(1);
            }}
            className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
              filterMode === 'DUPLICATES'
                ? 'bg-amber-600 text-white'
                : 'text-slate-500 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
            }`}
          >
            Duplicados ({duplicateCount})
          </button>
        </div>
      </div>

      {pageBatches.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 dark:border-zinc-800 p-6 text-center text-xs text-slate-400">
          Nenhuma importação duplicada ativa encontrada.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {pageBatches.map((batch) => {
            const isReverted = batch.status === 'REVERTED';
            const sig = getBatchFileSignature(batch);
            const repeatCount = !isReverted && sig ? activeSignatureCounts.get(sig) || 0 : 0;
            const duplicate = repeatCount > 1;

            return (
              <div
                key={batch.id}
                className={`rounded-xl border p-3.5 flex items-center justify-between gap-3 ${
                  isReverted
                    ? 'border-slate-200 dark:border-zinc-800 bg-slate-100/50 dark:bg-zinc-900/30 opacity-60'
                    : duplicate
                    ? 'border-amber-300 dark:border-amber-800/70 bg-amber-50/30 dark:bg-amber-950/20'
                    : 'border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950'
                }`}
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs font-semibold text-slate-900 dark:text-zinc-100 truncate max-w-[230px]">
                      {batch.files.map((f) => f.fileName).join(', ') || `Lote #${batch.id.slice(-6)}`}
                    </span>
                    <Badge variant={isReverted ? 'neutral' : 'income'}>
                      {isReverted ? 'Revertido' : 'Confirmado'}
                    </Badge>
                    {duplicate && (
                      <Badge variant="warning">Duplicado ({repeatCount}×)</Badge>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-zinc-400">
                    {new Date(batch.createdAt).toLocaleString('pt-BR')} •{' '}
                    {batch.reconciledCount} conciliado(s) • {batch.createdTransactionsCount}{' '}
                    registro(s)
                    {batch.skippedDuplicatesCount > 0
                      ? ` • ${batch.skippedDuplicatesCount} ignorado(s)`
                      : ''}
                  </div>
                </div>
                {!isReverted && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => onRequestRevert(batch)}
                    className="shrink-0"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Reverter
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-slate-500 dark:text-zinc-400 tabular-nums">
          <span>
            Mostrando {startIdx + 1}–{Math.min(startIdx + PAGE_SIZE, filteredBatches.length)} de{' '}
            {filteredBatches.length}
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>Anterior</span>
            </Button>
            <span className="font-medium text-slate-700 dark:text-zinc-200 px-1">
              Página {safePage} de {totalPages}
            </span>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              <span>Próxima</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
