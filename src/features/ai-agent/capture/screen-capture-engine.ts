'use client';

import { domToCanvas } from 'modern-screenshot';
import type {
  CapturedAnnotatedImage,
  ScreenshotCaptureDirective,
} from '@/features/ai-agent/domain/agent-types';
import { findAgentTargetElement } from '@/features/ai-agent/visual/dom-target-resolver';
import {
  computeFocusedCropRegion,
  drawAnnotationsOnCanvas,
  type CanvasAnnotationDrawItem,
  type RectBox,
} from '@/features/ai-agent/capture/canvas-annotator';

export async function captureAnnotatedScreenClient(params: {
  directive: ScreenshotCaptureDirective;
  hideValues: boolean;
}): Promise<CapturedAnnotatedImage> {
  const { directive, hideValues } = params;

  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

  const openDialogs = document.querySelectorAll('[role="dialog"]');
  const captureRoot =
    (openDialogs.length > 0 ? (openDialogs[openDialogs.length - 1] as HTMLElement) : null) ||
    (document.querySelector('[data-agent-capture-root="true"]') as HTMLElement | null) ||
    document.body;

  const rootRect = captureRoot.getBoundingClientRect();

  const rawItems: CanvasAnnotationDrawItem[] = [];
  for (const ann of directive.annotations) {
    const el = findAgentTargetElement(ann.targetId);
    if (!el) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    rawItems.push({
      rect: {
        x: r.left - rootRect.left,
        y: r.top - rootRect.top,
        width: r.width,
        height: r.height,
      },
      stepNumber: ann.stepNumber,
      label: ann.label,
      color: ann.color || 'indigo',
    });
  }

  const rawRedactions: RectBox[] = [];
  captureRoot.querySelectorAll('[data-agent-sensitive="true"]').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) {
      rawRedactions.push({
        x: r.left - rootRect.left,
        y: r.top - rootRect.top,
        width: r.width,
        height: r.height,
      });
    }
  });

  const isDark = document.documentElement.classList.contains('dark');
  const scale = Math.min(2, Math.max(1.5, window.devicePixelRatio || 1.5));

  const fullCanvas = await domToCanvas(captureRoot, {
    scale,
    backgroundColor: isDark ? '#09090b' : '#ffffff',
    filter: (node) => {
      if (node instanceof HTMLElement && node.getAttribute('data-agent-capture-ignore') === 'true') {
        return false;
      }
      return true;
    },
  });

  // Recorta apenas a região focada contendo os elementos anotados para máxima nitidez e leitura
  const crop = computeFocusedCropRegion(rawItems, rootRect.width, rootRect.height);
  const cropPxX = Math.round(crop.x * scale);
  const cropPxY = Math.round(crop.y * scale);
  const cropPxW = Math.min(fullCanvas.width - cropPxX, Math.round(crop.width * scale));
  const cropPxH = Math.min(fullCanvas.height - cropPxY, Math.round(crop.height * scale));

  const croppedCanvas = document.createElement('canvas');
  croppedCanvas.width = Math.max(1, cropPxW);
  croppedCanvas.height = Math.max(1, cropPxH);
  const cctx = croppedCanvas.getContext('2d');
  if (cctx) {
    cctx.fillStyle = isDark ? '#09090b' : '#ffffff';
    cctx.fillRect(0, 0, croppedCanvas.width, croppedCanvas.height);
    cctx.drawImage(
      fullCanvas,
      cropPxX,
      cropPxY,
      cropPxW,
      cropPxH,
      0,
      0,
      croppedCanvas.width,
      croppedCanvas.height
    );
  }

  // Ajusta coordenadas das anotações e redações relativas ao recorte
  const shiftedItems: CanvasAnnotationDrawItem[] = rawItems.map((it) => ({
    ...it,
    rect: { ...it.rect, x: it.rect.x - crop.x, y: it.rect.y - crop.y },
  }));

  const shiftedRedactions: RectBox[] = rawRedactions
    .map((b) => ({ ...b, x: b.x - crop.x, y: b.y - crop.y }))
    .filter((b) => b.y + b.height > 0 && b.y < crop.height);

  drawAnnotationsOnCanvas(croppedCanvas, shiftedItems, shiftedRedactions, scale);

  // Mantém PNG nítido (até 1600px de largura para textos cristalinos sem borrado)
  let outputCanvas = croppedCanvas;
  if (croppedCanvas.width > 1600) {
    const ratio = 1600 / croppedCanvas.width;
    const resized = document.createElement('canvas');
    resized.width = 1600;
    resized.height = Math.round(croppedCanvas.height * ratio);
    const rctx = resized.getContext('2d');
    if (rctx) {
      rctx.imageSmoothingEnabled = true;
      rctx.imageSmoothingQuality = 'high';
      rctx.drawImage(croppedCanvas, 0, 0, resized.width, resized.height);
      outputCanvas = resized;
    }
  }

  const dataUrl = outputCanvas.toDataURL('image/png');

  return {
    id: `cap_${Date.now()}`,
    title: directive.title,
    subtitle: directive.subtitle,
    dataUrl,
    privacyMasked: hideValues || shiftedRedactions.length > 0,
    annotationsCount: shiftedItems.length,
    capturedAt: new Date().toISOString(),
  };
}
