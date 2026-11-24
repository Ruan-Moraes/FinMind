'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import {
  Camera,
  Download,
  Maximize2,
  ShieldCheck,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import type { CapturedAnnotatedImage } from '@/features/ai-agent/domain/agent-types';

function buildSafeFilename(title: string): string {
  const slug = title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  return `finmind-${slug || 'captura'}-${stamp}.png`;
}

export function AgentScreenshotCard({ image }: { image: CapturedAnnotatedImage }) {
  const [zoomed, setZoomed] = React.useState(false);
  const [zoomPercent, setZoomPercent] = React.useState(100);

  const handleDownload = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const link = document.createElement('a');
    link.href = image.dataUrl;
    link.download = buildSafeFilename(image.title);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return (
    <>
      <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-900/70 overflow-hidden">
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-200/80 dark:border-zinc-800 text-[11px]">
          <div className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-zinc-200 truncate">
            <Camera className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
            <span className="truncate">{image.title}</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {image.privacyMasked && (
              <Badge variant="income">
                <ShieldCheck className="h-3 w-3" />
                Privacidade
              </Badge>
            )}
            <button
              type="button"
              onClick={handleDownload}
              className="p-1 rounded-md text-slate-500 hover:text-emerald-600 hover:bg-slate-200/60 dark:hover:bg-zinc-800"
              title="Salvar imagem"
              aria-label="Salvar imagem capturada"
            >
              <Download className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setZoomPercent(100);
                setZoomed(true);
              }}
              className="p-1 rounded-md text-slate-500 hover:text-indigo-600 hover:bg-slate-200/60 dark:hover:bg-zinc-800"
              title="Ampliar captura anotada"
              aria-label="Ampliar captura anotada"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setZoomPercent(100);
            setZoomed(true);
          }}
          className="group relative block w-full text-left cursor-zoom-in overflow-hidden bg-zinc-950/5 dark:bg-black/40"
        >
          <img
            src={image.dataUrl}
            alt={image.title}
            className="w-full max-h-72 object-cover object-top transition-transform duration-200 group-hover:scale-[1.01]"
          />
          <span className="absolute bottom-2 right-2 rounded-lg bg-zinc-950/85 text-white px-2.5 py-1 text-[10px] font-medium shadow-md backdrop-blur-sm">
            Clique para ampliar em HD
          </span>
        </button>

        <div className="px-3 py-1.5 text-[10px] text-slate-500 dark:text-zinc-400 flex items-center justify-between gap-2">
          <span>{image.annotationsCount} marcação(ões) contextual(is) na tela real</span>
          <button
            type="button"
            onClick={handleDownload}
            className="inline-flex items-center gap-1 font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            <Download className="h-3 w-3" />
            Salvar imagem
          </button>
        </div>
      </div>

      {zoomed &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            data-agent-capture-ignore="true"
            role="dialog"
            aria-modal="true"
            aria-label={image.title}
            onClick={() => setZoomed(false)}
            className="fixed inset-0 z-[140] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="relative w-[min(1380px,96vw)] h-[90vh] flex flex-col rounded-2xl border border-zinc-700 bg-zinc-950 overflow-hidden shadow-2xl"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-zinc-800 bg-zinc-900/90 text-white shrink-0">
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">{image.title}</div>
                  <div className="text-[11px] text-zinc-400">
                    Role verticalmente ou ajuste o zoom para ler cada detalhe com nitidez
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setZoomPercent((z) => Math.max(75, z - 25))}
                    className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
                    title="Reduzir zoom"
                    aria-label="Reduzir zoom"
                  >
                    <ZoomOut className="h-4 w-4" />
                  </button>
                  <span className="text-xs font-mono tabular-nums px-2 text-zinc-200">
                    {zoomPercent}%
                  </span>
                  <button
                    type="button"
                    onClick={() => setZoomPercent((z) => Math.min(200, z + 25))}
                    className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
                    title="Aumentar zoom"
                    aria-label="Aumentar zoom"
                  >
                    <ZoomIn className="h-4 w-4" />
                  </button>
                  <Button type="button" variant="primary" size="sm" onClick={handleDownload}>
                    <Download className="h-3.5 w-3.5" />
                    <span>Salvar Imagem</span>
                  </Button>
                  <button
                    type="button"
                    onClick={() => setZoomed(false)}
                    aria-label="Fechar ampliação"
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-auto p-4 bg-zinc-950">
                <div
                  className="mx-auto transition-all duration-150"
                  style={{ width: `${zoomPercent}%`, maxWidth: zoomPercent <= 100 ? '100%' : 'none' }}
                >
                  <img
                    src={image.dataUrl}
                    alt={image.title}
                    className="w-full h-auto rounded-xl border border-zinc-800 shadow-lg"
                  />
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
