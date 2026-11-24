'use client';

import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { SearchableSelectMenu } from '@/shared/ui/searchable-select-menu';

export interface ParsedSelectOption {
  value: string;
  label: string;
  group?: string;
  disabled?: boolean;
}

function extractText(node: React.ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractText).join('');
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) {
    return extractText(node.props.children);
  }
  return '';
}

function extractOptionsFromChildren(
  children: React.ReactNode,
  group?: string
): ParsedSelectOption[] {
  const result: ParsedSelectOption[] = [];
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;
    if (child.type === React.Fragment) {
      const fragProps = child.props as { children?: React.ReactNode };
      result.push(...extractOptionsFromChildren(fragProps.children, group));
      return;
    }
    if (child.type === 'optgroup') {
      const grpProps = child.props as { label?: string; children?: React.ReactNode };
      result.push(...extractOptionsFromChildren(grpProps.children, grpProps.label));
      return;
    }
    if (child.type === 'option') {
      const optProps = child.props as {
        value?: string | number;
        disabled?: boolean;
        children?: React.ReactNode;
      };
      const label = extractText(optProps.children).trim();
      const val = optProps.value !== undefined ? String(optProps.value) : label;
      result.push({ value: val, label: label || val, group, disabled: Boolean(optProps.disabled) });
    }
  });
  return result;
}

const normalizeSearch = (str: string) =>
  str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

export type SearchableSelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

export const SearchableSelect = React.forwardRef<HTMLSelectElement, SearchableSelectProps>(
  ({ className = '', children, value, defaultValue, onChange, disabled, id, name, 'aria-label': ariaLabel }, ref) => {
    const options = React.useMemo(() => extractOptionsFromChildren(children), [children]);
    const isControlled = value !== undefined;
    const [internalValue, setInternalValue] = React.useState<string>(
      defaultValue !== undefined ? String(defaultValue) : options[0]?.value ?? ''
    );
    const currentValue = isControlled ? String(value ?? '') : internalValue;

    const [isOpen, setIsOpen] = React.useState(false);
    const [query, setQuery] = React.useState('');
    const [highlightedIndex, setHighlightedIndex] = React.useState(0);
    const listboxId = React.useId();
    const containerRef = React.useRef<HTMLDivElement>(null);
    const triggerRef = React.useRef<HTMLButtonElement>(null);
    const menuRef = React.useRef<HTMLDivElement>(null);
    const searchInputRef = React.useRef<HTMLInputElement>(null);

    const selectedOption = options.find((o) => o.value === currentValue);

    const filteredOptions = React.useMemo(() => {
      const q = normalizeSearch(query.trim());
      if (!q) return options;
      return options.filter(
        (o) =>
          normalizeSearch(o.label).includes(q) ||
          normalizeSearch(o.value).includes(q) ||
          (o.group && normalizeSearch(o.group).includes(q))
      );
    }, [options, query]);

    React.useEffect(() => {
      if (!isOpen) return;
      setHighlightedIndex(0);
      const timer = window.setTimeout(() => searchInputRef.current?.focus(), 15);
      const handleClickOutside = (e: MouseEvent) => {
        const target = e.target as Node;
        const inTrigger = containerRef.current?.contains(target);
        const inMenu = menuRef.current?.contains(target);
        if (!inTrigger && !inMenu) {
          setIsOpen(false);
          setQuery('');
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        window.clearTimeout(timer);
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }, [isOpen]);

    const handleSelect = (opt: ParsedSelectOption) => {
      if (opt.disabled) return;
      if (!isControlled) setInternalValue(opt.value);
      setIsOpen(false);
      setQuery('');
      if (onChange) {
        const syntheticEvent = {
          target: { value: opt.value, name: name || '' },
          currentTarget: { value: opt.value, name: name || '' },
        } as React.ChangeEvent<HTMLSelectElement>;
        onChange(syntheticEvent);
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        e.stopPropagation();
        setIsOpen(false);
        setQuery('');
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightedIndex((i) => Math.min(filteredOptions.length - 1, i + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightedIndex((i) => Math.max(0, i - 1));
      } else if (e.key === 'Enter' && isOpen) {
        e.preventDefault();
        const target = filteredOptions[highlightedIndex];
        if (target) handleSelect(target);
      }
    };

    return (
      <div ref={containerRef} className="relative w-full" onKeyDown={handleKeyDown}>
        <select ref={ref} value={currentValue} onChange={onChange} className="sr-only" tabIndex={-1} aria-hidden="true">
          {children}
        </select>
        {name && <input type="hidden" name={name} value={currentValue} />}

        <button
          ref={triggerRef}
          id={id}
          type="button"
          role="combobox"
          aria-controls={listboxId}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-label={ariaLabel}
          disabled={disabled}
          onClick={() => !disabled && setIsOpen((v) => !v)}
          className={`h-11 w-full flex items-center justify-between gap-2 rounded-xl border border-slate-200/90 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-950/90 pl-3.5 pr-3 text-sm font-medium text-left text-slate-900 dark:text-zinc-100 hover:border-slate-300 dark:hover:border-zinc-700 focus:bg-white dark:focus:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-500 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${className}`}
        >
          <span className="truncate">
            {selectedOption ? selectedOption.label : options[0]?.label || 'Selecionar...'}
          </span>
          <ChevronDown
            className={`h-4 w-4 text-slate-400 dark:text-zinc-500 shrink-0 transition-transform duration-150 ${
              isOpen ? 'rotate-180 text-indigo-500' : ''
            }`}
          />
        </button>

        {isOpen && (
          <SearchableSelectMenu
            anchorEl={triggerRef.current}
            menuRef={menuRef}
            searchInputRef={searchInputRef}
            listboxId={listboxId}
            query={query}
            onQueryChange={(val) => {
              setQuery(val);
              setHighlightedIndex(0);
            }}
            options={filteredOptions}
            currentValue={currentValue}
            highlightedIndex={highlightedIndex}
            onHighlight={setHighlightedIndex}
            onSelect={handleSelect}
            onKeyDown={handleKeyDown}
          />
        )}
      </div>
    );
  }
);
SearchableSelect.displayName = 'SearchableSelect';
