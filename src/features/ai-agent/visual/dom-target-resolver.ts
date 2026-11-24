'use client';

export function isElementVisible(el: Element): el is HTMLElement {
  if (!(el instanceof HTMLElement)) return false;
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return false;
  const style = window.getComputedStyle(el);
  return style.visibility !== 'hidden' && style.display !== 'none' && style.opacity !== '0';
}

export function findAgentTargetElement(targetId: string): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  const escaped = CSS.escape(targetId);
  const nodes = Array.from(document.querySelectorAll(`[data-agent-id="${escaped}"]`));
  for (const node of nodes) {
    if (isElementVisible(node)) return node;
  }
  return (nodes[0] as HTMLElement | undefined) || null;
}

export function collectMountedAgentTargets(): string[] {
  if (typeof document === 'undefined') return [];
  const els = document.querySelectorAll('[data-agent-id]');
  const ids = new Set<string>();
  els.forEach((el) => {
    const id = el.getAttribute('data-agent-id');
    if (id && isElementVisible(el)) ids.add(id);
  });
  return Array.from(ids);
}

export function waitForAgentTarget(
  targetId: string,
  signal?: AbortSignal,
  timeoutMs = 3500
): Promise<HTMLElement | null> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve(null);
      return;
    }

    const immediate = findAgentTargetElement(targetId);
    if (immediate) {
      resolve(immediate);
      return;
    }

    let settled = false;
    const finish = (el: HTMLElement | null) => {
      if (settled) return;
      settled = true;
      observer.disconnect();
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      resolve(el);
    };

    const onAbort = () => finish(null);
    signal?.addEventListener('abort', onAbort, { once: true });

    const observer = new MutationObserver(() => {
      const found = findAgentTargetElement(targetId);
      if (found) finish(found);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-agent-id', 'class', 'style'],
    });

    const timer = setTimeout(() => {
      finish(findAgentTargetElement(targetId));
    }, timeoutMs);
  });
}

export async function scrollTargetIntoViewSmooth(
  el: HTMLElement,
  instant = false
): Promise<DOMRect> {
  const rect = el.getBoundingClientRect();
  const inView =
    rect.top >= 88 && rect.bottom <= window.innerHeight - 88 && rect.left >= 0 && rect.right <= window.innerWidth;

  if (!inView) {
    el.scrollIntoView({
      behavior: instant ? 'auto' : 'smooth',
      block: 'center',
      inline: 'nearest',
    });
    await new Promise((r) => setTimeout(r, instant ? 40 : 280));
  }
  return el.getBoundingClientRect();
}

export function setReactControlledFieldValue(el: HTMLElement, value: string): boolean {
  const input =
    el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement
      ? el
      : (el.querySelector('input, textarea, select') as
          | HTMLInputElement
          | HTMLTextAreaElement
          | HTMLSelectElement
          | null);

  if (!input) return false;

  const proto =
    input instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : input instanceof HTMLSelectElement
      ? HTMLSelectElement.prototype
      : HTMLInputElement.prototype;

  const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
  if (descriptor?.set) {
    descriptor.set.call(input, value);
  } else {
    input.value = value;
  }

  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}
