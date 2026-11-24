'use client';

import * as React from 'react';
import type { QueuedFileItem } from '@/features/reconciliation/components/reconciliation-ui-helpers';

export function useStatementFileQueue(onQueueChanged?: () => void) {
  const [queuedFiles, setQueuedFiles] = React.useState<QueuedFileItem[]>([]);
  const [manualTextSnippet, setManualTextSnippet] = React.useState('');
  const [manualSnippetBankName, setManualSnippetBankName] = React.useState('Extrato Colado');
  const [showManualTextPanel, setShowManualTextPanel] = React.useState(false);

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    const newQueued: QueuedFileItem[] = [];
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const lower = file.name.toLowerCase();
      const isBinary =
        lower.endsWith('.xlsx') || lower.endsWith('.xls') || lower.endsWith('.pdf');
      const content = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => resolve('');
        if (isBinary) reader.readAsDataURL(file);
        else reader.readAsText(file);
      });
      newQueued.push({
        fileId: `file-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`,
        fileName: file.name,
        mimeType: file.type,
        sizeInBytes: file.size,
        content,
        isBase64: isBinary,
        progressState: 'QUEUED',
      });
    }

    setQueuedFiles((prev) => [...prev, ...newQueued]);
    onQueueChanged?.();
    e.target.value = '';
  };

  const handleAddManualSnippetToQueue = () => {
    const trimmed = manualTextSnippet.trim();
    if (!trimmed) return;
    const label = manualSnippetBankName.trim() || 'Extrato Manual';
    const fileName = `${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${
      queuedFiles.length + 1
    }.csv`;
    setQueuedFiles((prev) => [
      ...prev,
      {
        fileId: `manual-${Date.now()}-${prev.length}`,
        fileName,
        mimeType: 'text/plain',
        sizeInBytes: trimmed.length,
        content: trimmed,
        isBase64: false,
        progressState: 'QUEUED',
      },
    ]);
    setManualTextSnippet('');
    setShowManualTextPanel(false);
    onQueueChanged?.();
  };

  const handleRemoveQueuedFile = (fileId: string) => {
    setQueuedFiles((prev) => prev.filter((f) => f.fileId !== fileId));
  };

  return {
    queuedFiles,
    setQueuedFiles,
    manualTextSnippet,
    setManualTextSnippet,
    manualSnippetBankName,
    setManualSnippetBankName,
    showManualTextPanel,
    setShowManualTextPanel,
    handleFilesSelected,
    handleAddManualSnippetToQueue,
    handleRemoveQueuedFile,
  };
}
