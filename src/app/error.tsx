'use client';

import * as React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/shared/ui/button';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-zinc-950 p-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 shadow-xl text-center space-y-5">
        <div className="h-12 w-12 rounded-2xl bg-rose-500/15 text-rose-500 flex items-center justify-center mx-auto">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-zinc-50">
            Algo inesperado aconteceu
          </h2>
          <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
            Não foi possível carregar o seu painel financeiro agora. Fique tranquilo: seus dados
            permanecem salvos com segurança.
          </p>
          {error.digest && (
            <p className="text-[11px] font-mono text-slate-400 dark:text-zinc-500 pt-1">
              Código: {error.digest}
            </p>
          )}
        </div>
        <Button type="button" variant="primary" size="md" onClick={reset} className="w-full">
          <RotateCcw className="h-4 w-4" />
          Tentar Novamente
        </Button>
      </div>
    </div>
  );
}
