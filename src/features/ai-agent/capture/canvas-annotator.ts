export interface RectBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CanvasAnnotationDrawItem {
  rect: RectBox;
  stepNumber: number;
  label: string;
  color: 'indigo' | 'emerald' | 'amber' | 'rose';
}

const COLOR_HEX: Record<
  CanvasAnnotationDrawItem['color'],
  { stroke: string; fill: string; bg: string }
> = {
  indigo: { stroke: '#6366F1', fill: 'rgba(99, 102, 241, 0.16)', bg: '#4F46E5' },
  emerald: { stroke: '#10B981', fill: 'rgba(16, 185, 129, 0.16)', bg: '#059669' },
  amber: { stroke: '#F59E0B', fill: 'rgba(245, 158, 11, 0.16)', bg: '#D97706' },
  rose: { stroke: '#F43F5E', fill: 'rgba(244, 63, 94, 0.16)', bg: '#E11D48' },
};

export function clampRectToCanvas(rect: RectBox, maxWidth: number, maxHeight: number): RectBox {
  const x = Math.max(4, Math.min(rect.x, maxWidth - 16));
  const y = Math.max(4, Math.min(rect.y, maxHeight - 16));
  const width = Math.max(12, Math.min(rect.width, maxWidth - x - 4));
  const height = Math.max(12, Math.min(rect.height, maxHeight - y - 4));
  return { x, y, width, height };
}

/**
 * Calcula um recorte vertical focado apenas na região que contém os elementos anotados,
 * evitando capturar milhares de pixels irrelevantes abaixo que tornariam o texto ilegível.
 */
export function computeFocusedCropRegion(
  items: CanvasAnnotationDrawItem[],
  rootWidth: number,
  rootHeight: number
): RectBox {
  if (rootHeight <= 960 || items.length === 0) {
    return { x: 0, y: 0, width: rootWidth, height: Math.min(rootHeight, 1050) };
  }

  let minY = Infinity;
  let maxY = 0;
  for (const item of items) {
    if (item.rect.y < minY) minY = item.rect.y;
    const bottom = item.rect.y + item.rect.height;
    if (bottom > maxY) maxY = bottom;
  }

  const cropTop = Math.max(0, Math.floor(minY - 88));
  const cropBottom = Math.min(rootHeight, Math.ceil(maxY + 200));
  const cropHeight = Math.max(420, cropBottom - cropTop);

  return {
    x: 0,
    y: cropTop,
    width: rootWidth,
    height: Math.min(cropHeight, rootHeight - cropTop),
  };
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

export function drawAnnotationsOnCanvas(
  canvas: HTMLCanvasElement,
  items: CanvasAnnotationDrawItem[],
  redactionBoxes: RectBox[],
  scale = 1
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // 1. Redação automática de áreas sensíveis
  for (const box of redactionBoxes) {
    const r = clampRectToCanvas(
      { x: box.x * scale, y: box.y * scale, width: box.width * scale, height: box.height * scale },
      canvas.width,
      canvas.height
    );
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
    drawRoundedRect(ctx, r.x, r.y, r.width, r.height, 10 * scale);
    ctx.fill();
    ctx.fillStyle = '#E2E8F0';
    ctx.font = `600 ${Math.round(13 * scale)}px system-ui, -apple-system, sans-serif`;
    ctx.fillText(
      'Conteúdo sensível ocultado',
      r.x + 14 * scale,
      r.y + Math.min(28 * scale, r.height / 2)
    );
    ctx.restore();
  }

  // 2. Destaques nítidos, badges numerados e legendas sem sobrepor o botão
  for (const item of items) {
    const palette = COLOR_HEX[item.color] || COLOR_HEX.indigo;
    const pad = 7 * scale;
    const box = clampRectToCanvas(
      {
        x: item.rect.x * scale - pad,
        y: item.rect.y * scale - pad,
        width: item.rect.width * scale + pad * 2,
        height: item.rect.height * scale + pad * 2,
      },
      canvas.width,
      canvas.height
    );

    ctx.save();
    ctx.fillStyle = palette.fill;
    ctx.strokeStyle = palette.stroke;
    ctx.lineWidth = 3.5 * scale;
    drawRoundedRect(ctx, box.x, box.y, box.width, box.height, 12 * scale);
    ctx.fill();
    ctx.stroke();

    const badgeR = 16 * scale;
    const labelText = item.label.length > 52 ? `${item.label.slice(0, 52)}…` : item.label;
    ctx.font = `600 ${Math.round(13 * scale)}px system-ui, -apple-system, sans-serif`;
    const textW = ctx.measureText(labelText).width;
    const pillH = 30 * scale;
    const pillW = textW + 24 * scale;

    // Posiciona a legenda ACIMA do elemento (ou abaixo se estiver muito perto do topo)
    const placeBelow = box.y < pillH + 20 * scale;
    const calloutY = placeBelow
      ? Math.min(canvas.height - pillH - 8 * scale, box.y + box.height + 10 * scale)
      : Math.max(8 * scale, box.y - pillH - 10 * scale);

    const totalCalloutW = badgeR * 2 + 6 * scale + pillW;
    const startX = Math.max(
      8 * scale,
      Math.min(box.x, canvas.width - totalCalloutW - 8 * scale)
    );
    const bx = startX + badgeR;
    const by = calloutY + pillH / 2;

    // Sombra suave para destacar do fundo claro ou escuro
    ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
    ctx.shadowBlur = 10 * scale;
    ctx.shadowOffsetY = 3 * scale;

    // Pill da legenda
    const pillX = bx + badgeR + 6 * scale;
    ctx.fillStyle = 'rgba(9, 9, 11, 0.94)';
    drawRoundedRect(ctx, pillX, calloutY, pillW, pillH, 9 * scale);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = palette.stroke;
    ctx.lineWidth = 2 * scale;
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(labelText, pillX + 12 * scale, by + 0.5 * scale);

    // Badge circular numerado
    ctx.fillStyle = palette.bg;
    ctx.beginPath();
    ctx.arc(bx, by, badgeR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2.5 * scale;
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = `700 ${Math.round(14 * scale)}px system-ui, -apple-system, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(item.stepNumber), bx, by + 0.5 * scale);
    ctx.restore();
  }
}
