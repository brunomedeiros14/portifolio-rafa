/**
 * Lightbox da galeria.
 *
 * O `<dialog>` nativo cuida do foco e do `Esc`; aqui cuidamos deidxacao,
 * navegacao por teclado, swipe e do retorno de foco ao botao que abriu.
 *
 * Assim como o header, roda a cada `astro:page-load`: sob o `ClientRouter` o
 * markup do dialog e recriado a cada navegacao e os listeners precisam ser
 * religados no elemento novo.
 */

interface LightboxItem {
  el: HTMLElement;
  src: string;
  width: string;
  height: string;
  caption: string;
}

const BOUND = new WeakMap<HTMLDialogElement, AbortController>();

function readItem(node: HTMLElement): LightboxItem {
  return {
    el: node,
    src: node.dataset.src ?? '',
    width: node.dataset.width ?? '',
    height: node.dataset.height ?? '',
    caption: node.dataset.caption ?? '',
  };
}

function bindDialog(dialog: HTMLDialogElement): void {
  BOUND.get(dialog)?.abort();

  const gallery = dialog.dataset.galleryTarget ?? '';
  const items = Array.from(
    document.querySelectorAll<HTMLElement>(`[data-lightbox-item][data-gallery="${CSS.escape(gallery)}"]`),
  ).map(readItem);
  if (items.length === 0) return;

  const imgEl = dialog.querySelector<HTMLImageElement>('.lb-img');
  const captionEl = dialog.querySelector<HTMLElement>('.lb-caption');
  const prevEl = dialog.querySelector<HTMLButtonElement>('[data-lb-prev]');
  const nextEl = dialog.querySelector<HTMLButtonElement>('[data-lb-next]');
  const closeEl = dialog.querySelector<HTMLButtonElement>('[data-lb-close]');
  const counterEl = dialog.querySelector<HTMLElement>('[data-lb-counter]');
  if (!imgEl || !captionEl || !prevEl || !nextEl || !closeEl) return;

  const abort = new AbortController();
  const { signal } = abort;
  BOUND.set(dialog, abort);

  let index = 0;
  let trigger: HTMLElement | null = null;

  const preload = (nextIndex: number) => {
    const next = items[nextIndex];
    if (next?.src) new Image().src = next.src;
  };

  const render = () => {
    const item = items[index]!;
    imgEl.src = item.src;
    imgEl.alt = item.caption;
    if (item.width) imgEl.setAttribute('width', item.width);
    if (item.height) imgEl.setAttribute('height', item.height);
    captionEl.textContent = item.caption;
    if (counterEl) counterEl.textContent = `${index + 1} / ${items.length}`;

    const multiple = items.length > 1;
    prevEl.style.visibility = multiple ? 'visible' : 'hidden';
    nextEl.style.visibility = multiple ? 'visible' : 'hidden';
    if (multiple) preload((index + 1) % items.length);
  };

  const go = (next: number) => {
    index = (next + items.length) % items.length;
    render();
  };

  const close = () => {
    if (dialog.open) dialog.close();
  };

  for (const item of items) {
    item.el.addEventListener('click', () => {
      trigger = item.el;
      index = items.indexOf(item);
      render();
      if (!dialog.open) {
        dialog.showModal();
        document.body.classList.add('overflow-hidden');
      }
    }, { signal });
  }

  closeEl.addEventListener('click', close, { signal });

  // Clique no backdrop (o proprio <dialog>) fecha.
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) close();
  }, { signal });

  // `close` dispara tanto pelo botao, pelo Esc nativo e pelo swipe; centralizar
  // aqui evita listener duplicado e devolve o foco a quem abriu.
  dialog.addEventListener('close', () => {
    document.body.classList.remove('overflow-hidden');
    trigger?.focus();
    trigger = null;
  }, { signal });

  prevEl.addEventListener('click', () => go(index - 1), { signal });
  nextEl.addEventListener('click', () => go(index + 1), { signal });

  dialog.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowRight') { event.preventDefault(); go(index + 1); }
    else if (event.key === 'ArrowLeft') { event.preventDefault(); go(index - 1); }
    else if (event.key === 'Home') { event.preventDefault(); go(0); }
    else if (event.key === 'End') { event.preventDefault(); go(items.length - 1); }
  }, { signal });

  let touchX = 0;
  dialog.addEventListener('touchstart', (event) => {
    touchX = event.changedTouches[0]!.clientX;
  }, { passive: true, signal });

  dialog.addEventListener('touchend', (event) => {
    const delta = event.changedTouches[0]!.clientX - touchX;
    if (Math.abs(delta) > 48) go(index + (delta < 0 ? 1 : -1));
  }, { passive: true, signal });
}

export function initLightbox(): void {
  for (const dialog of document.querySelectorAll<HTMLDialogElement>('dialog[data-gallery-target]')) {
    bindDialog(dialog);
  }
}