import * as zlib from "node:zlib";
import { extractText, getDocumentProxy } from "unpdf";
import * as XLSX from "xlsx";

/**
 * PARSER 3: XLSX / XLS (usando SheetJS `xlsx` com fallback textual)
 */
export function extractTextRowsFromXlsx(content: string, isBase64?: boolean): string {
  const rawBuffer = isBase64
    ? Buffer.from(content.replace(/^data:[^;]+;base64,/, ''), 'base64')
    : Buffer.from(content, 'binary');

  if (
    rawBuffer.length >= 4 &&
    (rawBuffer.readUInt32LE(0) === 0x04034b50 || rawBuffer.readUInt32LE(0) === 0xe011cfd0)
  ) {
    try {
      const workbook = XLSX.read(rawBuffer, { type: 'buffer', raw: false, dateNF: 'yyyy-mm-dd' });
      const sheetLines: string[] = [];

      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) continue;
        const rows = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(sheet, {
          header: 1,
          raw: false,
          defval: '',
        });
        for (const row of rows) {
          if (!Array.isArray(row)) continue;
          const cells = row.map((c) => String(c ?? '').trim());
          if (cells.filter((c) => c.length > 0).length >= 2) {
            sheetLines.push(cells.join(';'));
          }
        }
      }

      if (sheetLines.length > 0) {
        return sheetLines.join('\n');
      }
    } catch {
      // Fallback
    }
  }

  return isBase64
    ? Buffer.from(content.replace(/^data:[^;]+;base64,/, ''), 'base64').toString('utf8')
    : content;
}

/**
 * Fallback síncrono para streams PDF simples (ex.: PDFs sintéticos de teste sem tabela xref completa).
 */
export function extractTextFromPdfFallbackSync(buf: Buffer): string {
  const rawLatin1 = buf.toString('latin1');
  const extractedChunks: string[] = [];

  const decodePdfLiteralString = (s: string): string =>
    s
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\\(/g, '(')
      .replace(/\\\)/g, ')')
      .replace(/\\\\/g, '\\');

  const collectTextOperators = (streamText: string) => {
    const lines: string[] = [];
    const btRegex = /BT([\s\S]*?)ET/g;
    let btMatch: RegExpExecArray | null;
    while ((btMatch = btRegex.exec(streamText)) !== null) {
      const block = btMatch[1];
      const parts: string[] = [];
      const tokenRegex = /\((?:\\.|[^\\)])*\)\s*Tj|\[([\s\S]*?)\]\s*TJ/g;
      let tok: RegExpExecArray | null;
      while ((tok = tokenRegex.exec(block)) !== null) {
        const literals = Array.from(tok[0].matchAll(/\((?:\\.|[^\\)])*\)/g));
        const textPiece = literals
          .map((m) => decodePdfLiteralString(m[0].slice(1, -1)))
          .join('');
        if (textPiece.trim()) {
          parts.push(textPiece);
        }
      }
      if (parts.length > 0) {
        lines.push(parts.join(' '));
      }
    }
    if (lines.length > 0) {
      extractedChunks.push(lines.join('\n'));
    }
  };

  collectTextOperators(rawLatin1);

  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let streamMatch: RegExpExecArray | null;
  while ((streamMatch = streamRegex.exec(rawLatin1)) !== null) {
    const streamBytes = Buffer.from(streamMatch[1], 'latin1');
    try {
      const inflated = zlib.inflateSync(streamBytes).toString('latin1');
      collectTextOperators(inflated);
    } catch {
      try {
        const inflatedRaw = zlib.inflateRawSync(streamBytes).toString('latin1');
        collectTextOperators(inflatedRaw);
      } catch {
        // Ignora stream binário
      }
    }
  }

  return extractedChunks.join('\n').trim();
}

/**
 * PARSER 4: PDF Real via `unpdf` (PDF.js serverless com reconstrução de linhas por coordenadas Y/X).
 */
export async function extractTextFromPdfContentAsync(
  content: string,
  isBase64?: boolean
): Promise<string> {
  const buf = isBase64
    ? Buffer.from(content.replace(/^data:[^;]+;base64,/, ''), 'base64')
    : Buffer.from(content, 'latin1');

  const rawHeader = buf.subarray(0, 16).toString('latin1');

  if (!rawHeader.startsWith('%PDF-')) {
    return isBase64 ? buf.toString('utf8') : content;
  }

  const uint8 = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);

  try {
    const pdf = await getDocumentProxy(uint8);
    const allPageLines: string[] = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();

      interface PositionedTextItem {
        str: string;
        x: number;
        y: number;
      }

      const items: PositionedTextItem[] = [];
      for (const rawItem of textContent.items as Array<{ str?: string; transform?: number[] }>) {
        if (!rawItem || typeof rawItem.str !== 'string') continue;
        const text = rawItem.str.trim();
        if (!text) continue;
        const x = Array.isArray(rawItem.transform) ? Number(rawItem.transform[4] ?? 0) : 0;
        const y = Array.isArray(rawItem.transform) ? Number(rawItem.transform[5] ?? 0) : 0;
        items.push({ str: text, x, y });
      }

      const rows: Array<{ y: number; items: PositionedTextItem[] }> = [];
      const Y_TOLERANCE = 4.5;

      for (const item of items) {
        let matchedRow = rows.find((r) => Math.abs(r.y - item.y) <= Y_TOLERANCE);
        if (!matchedRow) {
          matchedRow = { y: item.y, items: [] };
          rows.push(matchedRow);
        }
        matchedRow.items.push(item);
      }

      rows.sort((a, b) => b.y - a.y);

      for (const row of rows) {
        row.items.sort((a, b) => a.x - b.x);
        const lineStr = row.items.map((it) => it.str).join(' ').replace(/\s{2,}/g, ' ').trim();
        if (lineStr) {
          allPageLines.push(lineStr);
        }
      }
    }

    const joined = allPageLines.join('\n').trim();
    if (joined.length > 0) {
      return joined;
    }
  } catch {
    // Fallback
  }

  try {
    const extracted = await extractText(new Uint8Array(buf));
    const text = Array.isArray(extracted.text)
      ? extracted.text.join('\n')
      : String(extracted.text || '');
    if (text.trim().length > 0) {
      return text.trim();
    }
  } catch {
    // Fallback
  }

  return extractTextFromPdfFallbackSync(buf);
}
