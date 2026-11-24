'use client';

import * as React from 'react';
import { Download, FileJson, FileSpreadsheet } from 'lucide-react';

interface DataExportCardProps {
  month?: number;
  year?: number;
}

export function DataExportCard({ month, year }: DataExportCardProps) {
  const csvHref =
    month && year
      ? `/api/export?format=csv&month=${month}&year=${year}`
      : '/api/export?format=csv';

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-slate-200/90 dark:border-zinc-800/90 bg-slate-50/40 dark:bg-zinc-950/60 p-4">
      <div className="space-y-0.5">
        <div className="text-sm font-medium text-slate-900 dark:text-zinc-100 flex items-center gap-1.5">
          <Download className="h-4 w-4 text-indigo-500 shrink-0" />
          Exportação & Backup de Dados
        </div>
        <div className="text-xs text-slate-500 dark:text-zinc-400">
          Baixe seu extrato para planilha (Excel/Numbers) ou faça uma cópia de segurança completa dos seus dados.
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <a
          href={csvHref}
          download
          className="inline-flex items-center justify-center gap-1.5 rounded-xl font-medium whitespace-nowrap leading-none transition-all duration-150 border border-slate-200 bg-white text-slate-900 hover:bg-slate-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800 h-8 px-3 text-xs"
        >
          <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
          <span>Extrato CSV</span>
        </a>
        <a
          href="/api/export?format=json"
          download
          className="inline-flex items-center justify-center gap-1.5 rounded-xl font-medium whitespace-nowrap leading-none transition-all duration-150 border border-slate-200 bg-white text-slate-900 hover:bg-slate-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800 h-8 px-3 text-xs"
        >
          <FileJson className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
          <span>Backup Completo</span>
        </a>
      </div>
    </div>
  );
}
