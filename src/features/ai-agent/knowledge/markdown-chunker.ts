import crypto from 'node:crypto';

export interface ParsedKnowledgeFrontmatter {
  docId: string;
  module: string;
  version: string;
  screens: string[];
  relatedTools: string[];
  tags: string[];
}

export interface SemanticKnowledgeChunkDraft {
  docId: string;
  filePath: string;
  module: string;
  version: string;
  chunkIndex: number;
  sectionPath: string;
  screens: string[];
  relatedTools: string[];
  tags: string[];
  contentText: string;
  contentHash: string;
}

export interface ParsedKnowledgeDocument {
  frontmatter: ParsedKnowledgeFrontmatter;
  filePath: string;
  contentHash: string;
  chunks: SemanticKnowledgeChunkDraft[];
}

function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function parseYamlArray(rawValue: string): string[] {
  const trimmed = rawValue.trim();
  if (!trimmed.startsWith('[') || !trimmed.endsWith(']')) return [];
  try {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed.map((v) => String(v).trim()).filter(Boolean) : [];
  } catch {
    return trimmed
      .slice(1, -1)
      .split(',')
      .map((s) => s.trim().replace(/^["']|["']$/g, ''))
      .filter(Boolean);
  }
}

export function parseKnowledgeMarkdown(
  rawMarkdown: string,
  filePath: string
): ParsedKnowledgeDocument {
  const match = rawMarkdown.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) {
    throw new Error(`Documento sem frontmatter YAML válido: ${filePath}`);
  }

  const [, rawFm, body] = match;
  const kv: Record<string, string> = {};
  for (const line of rawFm.split(/\r?\n/)) {
    const idx = line.indexOf(':');
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
    kv[key] = val;
  }

  const docId = kv.docId || filePath.replace(/\.md$/, '');
  const moduleName = kv.module || 'system';
  const version = kv.version || '1.0.0';
  const screens = parseYamlArray(kv.screens || '[]');
  const relatedTools = parseYamlArray(kv.relatedTools || '[]');
  const tags = parseYamlArray(kv.tags || '[]');

  const lines = body.split(/\r?\n/);
  let docTitle = docId;
  let currentH2 = '';
  let currentH3 = '';
  let buffer: string[] = [];
  const rawSections: Array<{ sectionPath: string; text: string }> = [];

  const flush = () => {
    const text = buffer.join('\n').trim();
    if (!text) return;
    const pathParts = [docTitle, currentH2, currentH3].filter(Boolean);
    rawSections.push({ sectionPath: pathParts.join(' > '), text });
    buffer = [];
  };

  for (const line of lines) {
    if (line.startsWith('# ')) {
      flush();
      docTitle = line.slice(2).trim();
    } else if (line.startsWith('## ')) {
      flush();
      currentH2 = line.slice(3).trim();
      currentH3 = '';
    } else if (line.startsWith('### ')) {
      flush();
      currentH3 = line.slice(4).trim();
    } else {
      buffer.push(line);
    }
  }
  flush();

  const chunks: SemanticKnowledgeChunkDraft[] = rawSections.map((sec, idx) => {
    const contentText = `[Documento: ${docTitle} | Módulo: ${moduleName} | Seção: ${sec.sectionPath}]\n${sec.text}`;
    return {
      docId,
      filePath,
      module: moduleName,
      version,
      chunkIndex: idx,
      sectionPath: sec.sectionPath,
      screens,
      relatedTools,
      tags,
      contentText,
      contentHash: sha256(`${docId}::${version}::${sec.sectionPath}::${contentText}`),
    };
  });

  return {
    frontmatter: { docId, module: moduleName, version, screens, relatedTools, tags },
    filePath,
    contentHash: sha256(rawMarkdown),
    chunks,
  };
}
