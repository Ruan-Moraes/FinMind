'use client';

import * as React from 'react';
import { useWorkbench } from '@/features/dashboard/context/workbench-context';
import { FileText, Download } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Modal } from '@/shared/ui/modal';

export function AttachmentPreviewModal() {
  const { wb } = useWorkbench();
  const { previewAttachment, setPreviewAttachment } = wb;

  return (
    <Modal
      isOpen={Boolean(previewAttachment)}
      onClose={() => setPreviewAttachment(null)}
      title="Comprovante / Recibo Anexado"
      subtitle={previewAttachment?.fileName}
      footer={
        <>
          <Button variant="secondary" onClick={() => setPreviewAttachment(null)}>
            Fechar
          </Button>
          {previewAttachment && (
            <a
              href={previewAttachment.fileDataUrl}
              download={previewAttachment.fileName}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-950 h-10 px-4 text-sm font-medium whitespace-nowrap shrink-0"
            >
              <Download className="h-4 w-4 shrink-0" />
              Baixar Arquivo
            </a>
          )}
        </>
      }
    >
      {previewAttachment && (
        <div className="flex flex-col items-center justify-center">
          {previewAttachment.mimeType.startsWith('image/') ? (
            <img
              src={previewAttachment.fileDataUrl}
              alt={previewAttachment.fileName}
              className="max-h-96 rounded-xl border border-slate-200 dark:border-zinc-800 object-contain"
            />
          ) : (
            <div className="p-8 text-center space-y-2">
              <FileText className="h-12 w-12 mx-auto text-indigo-500" />
              <p className="text-sm font-medium">{previewAttachment.fileName}</p>
              <p className="text-xs text-slate-400">
                Documento PDF anexado. Clique em &ldquo;Baixar Arquivo&rdquo; para abrir.
              </p>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
