'use client';

import * as React from 'react';
import { useWorkbench } from '@/features/dashboard/context/workbench-context';
import { Trash2, AlertTriangle } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Modal } from '@/shared/ui/modal';

export function ConfirmDeleteModal() {
  const { wb } = useWorkbench();
  const { pendingDelete, setPendingDelete, isDeleting, handleConfirmPendingDelete } = wb;

  return (
    <Modal
      isOpen={Boolean(pendingDelete)}
      onClose={() => {
        if (!isDeleting) setPendingDelete(null);
      }}
      title={pendingDelete?.title || 'Confirmar Exclusão'}
      description="Por segurança, confirme antes de remover este item."
      footer={
        <>
          <Button
            variant="secondary"
            type="button"
            disabled={isDeleting}
            onClick={() => setPendingDelete(null)}
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            type="button"
            isLoading={isDeleting}
            onClick={handleConfirmPendingDelete}
          >
            <Trash2 className="h-4 w-4" />
            {pendingDelete?.confirmLabel || 'Confirmar Exclusão'}
          </Button>
        </>
      }
    >
      {pendingDelete && (
        <div className="space-y-4">
          <div className="flex items-start gap-3.5 rounded-2xl border border-rose-200 dark:border-rose-900/70 bg-rose-50/70 dark:bg-rose-950/35 p-4">
            <div className="h-10 w-10 rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="space-y-1 min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                Item selecionado para exclusão
              </p>
              <p className="text-sm font-bold text-slate-900 dark:text-zinc-100 break-words">
                {pendingDelete.entityName}
              </p>
              <p className="text-xs text-slate-600 dark:text-zinc-300 leading-relaxed pt-0.5">
                {pendingDelete.description}
              </p>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
