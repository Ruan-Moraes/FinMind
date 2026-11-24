'use client';

import * as React from 'react';
import { AttachmentPreviewModal } from '@/features/transactions/components/attachment-preview-modal';
import { ResetDataModal } from '@/features/dashboard/components/reset-data-modal';
import { ConfirmDeleteModal } from '@/features/dashboard/components/confirm-delete-modal';

export function SecurityAndPreviewModals() {
    return (
    <>
      <AttachmentPreviewModal />
      <ResetDataModal />
      <ConfirmDeleteModal />
    </>
  );
}
