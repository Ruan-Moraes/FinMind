'use client';
import * as React from 'react';
import { FileSpreadsheet, ArrowRight, Upload, FileText, Plus, Sparkles, Building2, X, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Input, Select } from '@/shared/ui/input';
import { Badge } from '@/shared/ui/badge';
import { formatCentsToBRL } from '@/shared/lib/currency';
import type { StatementImportReviewPlan } from '@/features/reconciliation/engine';
import type { QueuedFileItem } from '@/features/reconciliation/components/reconciliation-ui-helpers';
export function StatementUploadQueuePanel(props: {
  queuedFiles: QueuedFileItem[];
  reviewPlan: StatementImportReviewPlan | null;
  isAnalyzing: boolean;
  showManualTextPanel: boolean;
  setShowManualTextPanel: React.Dispatch<React.SetStateAction<boolean>>;
  targetType: 'ACCOUNT' | 'CREDIT_CARD';
  setTargetType: (t: 'ACCOUNT' | 'CREDIT_CARD') => void;
  selectedAccountId: string;
  setSelectedAccountId: (id: string) => void;
  selectedCardId: string;
  setSelectedCardId: (id: string) => void;
  accounts: Array<{ id: string; name: string; currentBalanceInCents: number }>;
  creditCards: Array<{ id: string; name: string; closingDay: number }>;
  hideValues: boolean;
  manualSnippetBankName: string;
  setManualSnippetBankName: (v: string) => void;
  manualTextSnippet: string;
  setManualTextSnippet: (v: string) => void;
  reconcileBanner: { type: 'success' | 'error'; text: string } | null;
  handleFilesSelected: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleAddManualSnippetToQueue: () => void;
  handleRemoveQueuedFile: (fileId: string) => void;
  handleRunReconciliation: () => void;
  onClearAll: () => void;
}) {
  const {
    queuedFiles, reviewPlan, isAnalyzing, showManualTextPanel, setShowManualTextPanel,
    targetType, setTargetType, selectedAccountId, setSelectedAccountId, selectedCardId, setSelectedCardId,
    accounts, creditCards, hideValues, manualSnippetBankName, setManualSnippetBankName,
    manualTextSnippet, setManualTextSnippet, reconcileBanner, handleFilesSelected,
    handleAddManualSnippetToQueue, handleRemoveQueuedFile, handleRunReconciliation, onClearAll, } = props;
  return ( <>
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-emerald-500 shrink-0" />
            <h2 className="text-lg font-semibold">
              Importação & Conciliação Inteligente de Extratos com IA
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400">
            Importe extratos (<strong>CSV, OFX, XLSX, PDF ou TXT</strong>) e a IA concilia automaticamente com seus lançamentos e custos fixos.
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-zinc-400 shrink-0 whitespace-nowrap overflow-x-auto">
          <span
            className={`px-2.5 py-1 rounded-lg border shrink-0 ${
              queuedFiles.length > 0 && !reviewPlan
                ? 'border-indigo-500 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 font-semibold'
                : 'border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950'
            }`}
          >
            1. Selecionar Extratos
          </span>
          <ArrowRight className="h-3.5 w-3.5 shrink-0" />
          <span
            className={`px-2.5 py-1 rounded-lg border shrink-0 ${
              isAnalyzing
                ? 'border-indigo-500 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 font-semibold'
                : 'border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950'
            }`}
          >
            2. IA & Conciliação
          </span>
          <ArrowRight className="h-3.5 w-3.5 shrink-0" />
          <span
            className={`px-2.5 py-1 rounded-lg border shrink-0 ${
              reviewPlan
                ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 font-semibold'
                : 'border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950'
            }`}
          >
            3. Revisar & Confirmar
          </span>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-2xl border-2 border-dashed border-slate-300 dark:border-zinc-700 bg-white/80 dark:bg-zinc-950/60 p-5 flex flex-col sm:flex-row items-center justify-between gap-4 hover:border-indigo-500/70 transition-colors">
          <div className="flex items-center gap-3.5">
            <div className="h-12 w-12 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <Upload className="h-6 w-6" /> </div>
            <div className="space-y-1">
              <div className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
                Selecione um ou vários extratos simultaneamente </div>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Suporta <strong>PDF, OFX, CSV, XLSX e TXT</strong> de múltiplos bancos e períodos sobrepostos.
              </p> </div> </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <label className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900 text-xs font-semibold cursor-pointer hover:opacity-90 transition-opacity shadow-sm">
              <Upload className="h-4 w-4" />
              <span>Selecionar Arquivos</span>
              <input type="file"
                multiple
                accept=".csv,.ofx,.qfx,.xlsx,.xls,.pdf,.txt" onChange={handleFilesSelected} className="hidden"
              />
            </label>
            <Button variant="secondary"
              size="md" onClick={() => setShowManualTextPanel((v) => !v)}
            >
              <FileText className="h-4 w-4" />
              {showManualTextPanel ? 'Ocultar Texto' : 'Colar Extrato'} </Button>
          </div> </div>
        <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
            Conta / Cartão de Destino </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2.5">
            <Select value={targetType} onChange={(e) => setTargetType(e.target.value as 'ACCOUNT' | 'CREDIT_CARD')}
              className="h-9 text-xs"
            >
              <option value="ACCOUNT">Conta Bancária / Carteira</option>
              <option value="CREDIT_CARD">Fatura de Cartão de Crédito</option>
            </Select>
            {targetType === 'ACCOUNT' ? ( <Select value={selectedAccountId} onChange={(e) => setSelectedAccountId(e.target.value)}
                className="h-9 text-xs"
              >
                {accounts.length === 0 ? ( <option value="">Criar conta automaticamente pelo banco do extrato</option>
                ) : ( accounts.map((acc) => ( <option key={acc.id} value={acc.id}>
                      {acc.name} ({formatCentsToBRL(acc.currentBalanceInCents, hideValues)}) </option>
                  ))
                )}
              </Select>
            ) : ( <Select value={selectedCardId} onChange={(e) => setSelectedCardId(e.target.value)} className="h-9 text-xs"
              >
                {creditCards.length === 0 ? ( <option value="">Sem cartão cadastrado</option>
                ) : ( creditCards.map((c) => ( <option key={c.id} value={c.id}>
                      {c.name} (Fecha dia {c.closingDay}) </option>
                  ))
                )}
              </Select>
            )} </div>
        </div> </div>
      {showManualTextPanel && (
        <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
              Adicionar linhas de extrato manualmente à fila de importação </span>
            <div className="flex items-center gap-2">
              <Input value={manualSnippetBankName} onChange={(e) => setManualSnippetBankName(e.target.value)}
                placeholder="Nome do banco (ex: Nubank, Itaú)" className="h-8 text-xs w-48"
              />
              <Button variant="secondary" size="sm" onClick={handleAddManualSnippetToQueue}>
                <Plus className="h-3.5 w-3.5" /> Adicionar à Fila </Button>
            </div> </div>
          <textarea rows={4}
            value={manualTextSnippet} onChange={(e) => setManualTextSnippet(e.target.value)}
            placeholder={
              'Exemplo:\n10/11/2026;PIX ENVIADO IMOBILIARIA ABC;-1200,00\n12/11/2026;PAGAMENTO CLARO NET;-120,00\n12/11/2026;DEBITO SMART FIT;-120,00\n05/11/2026;TED RECEBIDA EMPRESA XYZ;+3500,00\n14/11/2026;COMPRA SUPERMERCADO;-250,00'
            }
            className="w-full rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 p-3 text-xs font-mono text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          /> </div>
      )}
      {queuedFiles.length > 0 && (
        <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">
                Arquivos Selecionados ({queuedFiles.length}) </span>
              <Badge variant="neutral">
                {queuedFiles.filter((f) => f.progressState === 'DONE').length} processado(s)
              </Badge>
              {queuedFiles.some((f) => f.progressState === 'ERROR') && ( <Badge variant="expense">
                  {queuedFiles.filter((f) => f.progressState === 'ERROR').length} com erro
                </Badge>
              )} </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost"
                size="sm" onClick={onClearAll}
              >
                Limpar Lista </Button>
              <Button variant="primary"
                size="md" onClick={handleRunReconciliation} isLoading={isAnalyzing}
              >
                <Sparkles className="h-4 w-4" />
                Analisar com IA & Conciliar ({queuedFiles.length}) </Button>
            </div> </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {queuedFiles.map((file) => ( <div key={file.fileId}
                className={`rounded-xl border p-3 flex items-center justify-between gap-3 ${
                  file.progressState === 'ERROR'
                    ? 'border-rose-300 dark:border-rose-900/70 bg-rose-50/40 dark:bg-rose-950/20'
                    : file.progressState === 'DONE'
                    ? 'border-emerald-300 dark:border-emerald-900/70 bg-emerald-50/30 dark:bg-emerald-950/20'
                    : 'border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/40'
                }`}
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-900 dark:text-zinc-100 truncate">
                      {file.fileName} </span>
                    {file.detectedBank && ( <Badge variant="neutral" className="gap-1">
                        <Building2 className="h-2.5 w-2.5" />
                        {file.detectedBank}
                      </Badge>
                    )} </div>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-zinc-400">
                    {file.progressState === 'QUEUED' && <span>Pronto para processar</span>}
                    {file.progressState === 'PROCESSING' && ( <span className="text-indigo-500 font-medium">
                        Extraindo e analisando com IA... </span>
                    )}
                    {file.progressState === 'DONE' && ( <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                        ✓ {file.extractedCount} movimentação(ões)
                        {file.detectedPeriod ? ` • Período: ${file.detectedPeriod}` : ''}
                      </span>
                    )}
                    {file.progressState === 'ERROR' && ( <span className="text-rose-600 dark:text-rose-400 font-medium">
                        ✕ {file.errorMessage || 'Arquivo inválido'} </span>
                    )} </div> </div>
                <Button variant="ghost"
                  size="icon" onClick={() => handleRemoveQueuedFile(file.fileId)}
                  className="h-7 w-7 text-slate-400 hover:text-rose-500 shrink-0" title="Remover arquivo"
                >
                  <X className="h-4 w-4" /> </Button> </div>
            ))} </div> </div>
      )}
      {queuedFiles.length === 0 && manualTextSnippet.trim().length > 0 && ( <div className="flex justify-end">
          <Button variant="primary"
            size="md" onClick={handleRunReconciliation} isLoading={isAnalyzing}
          >
            <Sparkles className="h-4 w-4" />
            Analisar Extrato & Conciliar Movimentações </Button> </div>
      )}
      {reconcileBanner && ( <div
          className={`rounded-xl p-4 text-xs font-medium border flex items-start gap-2.5 ${
            reconcileBanner.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
              : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
          }`}
        >
          {reconcileBanner.type === 'success' ? ( <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-500" />
          ) : ( <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-rose-500" />
          )}
          <span>{reconcileBanner.text}</span> </div>
      )}
    </> );
}