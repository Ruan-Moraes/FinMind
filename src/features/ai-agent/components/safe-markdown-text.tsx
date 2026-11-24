'use client';

import * as React from 'react';

function renderInlineMarkdown(line: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      parts.push(line.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith('**') && token.endsWith('**')) {
      parts.push(
        <strong key={match.index} className="font-semibold text-slate-900 dark:text-white">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith('*') && token.endsWith('*')) {
      parts.push(
        <em key={match.index} className="italic">
          {token.slice(1, -1)}
        </em>
      );
    } else if (token.startsWith('`') && token.endsWith('`')) {
      parts.push(
        <code
          key={match.index}
          className="px-1 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-[11px] font-mono"
        >
          {token.slice(1, -1)}
        </code>
      );
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < line.length) {
    parts.push(line.slice(lastIndex));
  }
  return parts;
}

export function SafeMarkdownText({ content }: { content: string }) {
  const lines = content.split('\n');
  return (
    <div className="text-xs sm:text-[13px] text-slate-800 dark:text-zinc-100 leading-relaxed space-y-1.5">
      {lines.map((rawLine, idx) => {
        const trimmed = rawLine.trim();
        if (!trimmed) return <div key={idx} className="h-1" />;
        if (/^[-•*]\s+/.test(trimmed)) {
          return (
            <div key={idx} className="flex items-start gap-1.5 pl-1">
              <span className="text-indigo-500 mt-0.5 shrink-0">•</span>
              <span>{renderInlineMarkdown(trimmed.replace(/^[-•*]\s+/, ''))}</span>
            </div>
          );
        }
        return <p key={idx}>{renderInlineMarkdown(rawLine)}</p>;
      })}
    </div>
  );
}
