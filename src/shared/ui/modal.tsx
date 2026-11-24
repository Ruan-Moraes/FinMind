'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Button } from '@/shared/ui/button';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

/**
 * Modal Padronizado segundo DESIGN_SYSTEM.md (Seção 5):
 * - Renderizado via React Portal direto no document.body para nunca ser recortado por containers com backdrop-filter (como o Header)
 * - Desktop: Diálogo amplo centralizado com backdrop-blur e anel sutil de borda
 * - Mobile (< 640px): Drawer / Bottom Sheet ancorado na base da tela com barra puxadora
 */
export function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  description,
  children,
  footer,
  maxWidth = 'xl',
}: ModalProps) {
  const effectiveSubtitle = subtitle || description;
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !mounted) return null;

  const widthMap = {
    sm: 'sm:max-w-md',
    md: 'sm:max-w-xl',
    lg: 'sm:max-w-2xl',
    xl: 'sm:max-w-[680px]',
    '2xl': 'sm:max-w-[780px]',
  };

  const modalNode = (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-md p-0 sm:p-6 animate-in fade-in duration-150"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        className={`w-full ${widthMap[maxWidth]} rounded-t-3xl sm:rounded-2xl border border-slate-200/90 dark:border-zinc-800/90 bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-50 shadow-2xl ring-1 ring-black/5 dark:ring-white/10 overflow-hidden flex flex-col max-h-[90vh]`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Puxador Mobile (Bottom Sheet Thumb Handle) */}
        <div className="flex sm:hidden justify-center pt-3 pb-1 shrink-0">
          <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-zinc-700" />
        </div>

        {/* Header Padronizado */}
        <div className="flex items-start justify-between gap-4 px-6 sm:px-7 py-4 sm:py-5 border-b border-slate-200/80 dark:border-zinc-800/80 bg-slate-50/40 dark:bg-zinc-900/50 shrink-0">
          <div className="space-y-1 min-w-0">
            <h2
              id="modal-title"
              className="text-lg font-semibold tracking-tight text-slate-900 dark:text-zinc-50"
            >
              {title}
            </h2>
            {effectiveSubtitle && (
              <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 leading-relaxed">
                {effectiveSubtitle}
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Fechar modal"
            className="h-9 w-9 rounded-xl text-slate-400 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-100 -mr-1.5 shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Body Padronizado com Scroll Interno */}
        <div className="px-6 sm:px-7 py-5 overflow-y-auto space-y-4 flex-1">{children}</div>

        {/* Footer Padronizado */}
        {footer && (
          <div className="flex items-center justify-end gap-3 px-6 sm:px-7 py-4 border-t border-slate-200/80 dark:border-zinc-800/80 bg-slate-50/70 dark:bg-zinc-950/60 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modalNode, document.body);
}
