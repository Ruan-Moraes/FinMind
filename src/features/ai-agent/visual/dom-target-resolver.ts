'use client';

function normalizeLookupText(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function isElementVisible(el: Element): el is HTMLElement {
  if (!(el instanceof HTMLElement)) return false;
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return false;
  const style = window.getComputedStyle(el);
  return style.visibility !== 'hidden' && style.display !== 'none' && style.opacity !== '0';
}

export function findOpenModalRoot(): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  const dialogs = Array.from(document.querySelectorAll('[role="dialog"]')).filter(
    (d) => d.getAttribute('data-agent-capture-ignore') !== 'true' && isElementVisible(d)
  );
  return (dialogs[dialogs.length - 1] as HTMLElement | undefined) || null;
}

export function findAgentTargetElement(
  targetId: string,
  fallbackTextMatch?: string
): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  const escaped = CSS.escape(targetId);

  // Prioriza alvos dentro de um modal aberto quando o targetId pertence ao modal
  const openModal = findOpenModalRoot();
  if (openModal && targetId.startsWith('modal.')) {
    const insideModal = openModal.querySelector(`[data-agent-id="${escaped}"]`);
    if (insideModal && isElementVisible(insideModal)) return insideModal;
  }

  const nodes = Array.from(document.querySelectorAll(`[data-agent-id="${escaped}"]`));
  for (const node of nodes) {
    if (isElementVisible(node)) return node;
  }

  if (fallbackTextMatch) {
    const byText = inspectOpenModalAndFindByText(fallbackTextMatch);
    if (byText) return byText;
  }

  return (nodes[0] as HTMLElement | undefined) || null;
}

/**
 * Inspeciona o DOM real do modal aberto (ou documento) para localizar um container/seção
 * por texto de título/botão quando o targetId específico não foi montado.
 */
export function inspectOpenModalAndFindByText(queryText: string): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  const needle = normalizeLookupText(queryText);
  if (!needle) return null;

  const root = findOpenModalRoot() || document.body;
  const headings = Array.from(root.querySelectorAll('h2, h3, h4, label, button'));
  for (const node of headings) {
    if (!isElementVisible(node)) continue;
    const text = normalizeLookupText(node.textContent || '');
    if (text.includes(needle)) {
      const card = node.closest('[data-agent-id], .rounded-2xl, section, form > div');
      if (card instanceof HTMLElement && isElementVisible(card)) return card;
      return node;
    }
  }
  return null;
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
  timeoutMs = 3500,
  fallbackTextMatch?: string
): Promise<HTMLElement | null> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve(null);
      return;
    }

    const immediate = findAgentTargetElement(targetId, fallbackTextMatch);
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
      const found = findAgentTargetElement(targetId, fallbackTextMatch);
      if (found) finish(found);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-agent-id', 'class', 'style'],
    });

    const timer = setTimeout(() => {
      finish(findAgentTargetElement(targetId, fallbackTextMatch));
    }, timeoutMs);
  });
}

export function findScrollableAncestor(el: HTMLElement): HTMLElement | null {
  const modalBody = el.closest('[data-agent-modal-body="true"]');
  if (modalBody instanceof HTMLElement && modalBody.scrollHeight > modalBody.clientHeight + 4) {
    return modalBody;
  }

  let parent = el.parentElement;
  while (parent && parent !== document.body && parent !== document.documentElement) {
    const style = window.getComputedStyle(parent);
    const overflowY = style.overflowY;
    if (
      (overflowY === 'auto' || overflowY === 'scroll') &&
      parent.scrollHeight > parent.clientHeight + 4
    ) {
      return parent;
    }
    parent = parent.parentElement;
  }
  return null;
}

async function waitForScrollSettle(el: HTMLElement, maxMs: number): Promise<DOMRect> {
  const start = performance.now();
  let lastTop = el.getBoundingClientRect().top;
  let stableFrames = 0;

  while (performance.now() - start < maxMs) {
    await new Promise((r) => requestAnimationFrame(r));
    const currentTop = el.getBoundingClientRect().top;
    if (Math.abs(currentTop - lastTop) < 0.75) {
      stableFrames += 1;
      if (stableFrames >= 3) break;
    } else {
      stableFrames = 0;
      lastTop = currentTop;
    }
  }
  return el.getBoundingClientRect();
}

export function scrollTargetIntoViewSmooth(
  el: HTMLElement,
  instant = false
): Promise<DOMRect> {
  return scrollTargetIntoViewImpl(el, instant);
}

async function scrollTargetIntoViewImpl(el: HTMLElement, instant: boolean): Promise<DOMRect> {
  const scrollContainer = findScrollableAncestor(el);
  if (scrollContainer) {
    const cRect = scrollContainer.getBoundingClientRect();
    const eRect = el.getBoundingClientRect();
    const fullyInside = eRect.top >= cRect.top + 24 && eRect.bottom <= cRect.bottom - 24;
    if (!fullyInside) {
      const offsetTop = eRect.top - cRect.top + scrollContainer.scrollTop;
      const targetTop = Math.max(0, offsetTop - scrollContainer.clientHeight / 2 + eRect.height / 2);
      scrollContainer.scrollTo({ top: targetTop, behavior: instant ? 'auto' : 'smooth' });
      await waitForScrollSettle(el, instant ? 60 : 480);
    }
    return el.getBoundingClientRect();
  }

  const rect = el.getBoundingClientRect();
  const inView =
    rect.top >= 88 && rect.bottom <= window.innerHeight - 88 && rect.left >= 0 && rect.right <= window.innerWidth;
  if (!inView) {
    el.scrollIntoView({ behavior: instant ? 'auto' : 'smooth', block: 'center', inline: 'nearest' });
    await waitForScrollSettle(el, instant ? 60 : 450);
  }
  return el.getBoundingClientRect();
}

export function setReactControlledFieldValue(el: HTMLElement, value: string): boolean {
  const input =
    el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement
      ? el
      : (el.querySelector('input, textarea, select') as
          | HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null);
  if (!input) return false;

  const proto =
    input instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : input instanceof HTMLSelectElement
        ? HTMLSelectElement.prototype
        : HTMLInputElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
  if (descriptor?.set) descriptor.set.call(input, value);
  else input.value = value;

  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}
