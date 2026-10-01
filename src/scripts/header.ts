/**
 * Comportamento do header: estado de scroll (transparente -> solido) e menu
 * mobile.
 *
 * Com o `ClientRouter` ligado, o `<body>` inteiro e trocado a cada
 * navegacao. Scripts de componente Astro sao executados uma unica vez, entao
 * nao podemos guardar referencias ao DOM no escopo do modulo: elas apontam
 * para o cabecalho do primeiro carregamento e ficam obsoletas depois da
 * primeira navegacao. Por isso `initHeader()` e re-executado a cada
 * `astro:page-load`.
 *
 * Os listeners de scroll/click/keydown vivem em `window`/`document`, que
 * sobrevivem a navegacao. Por isso o `AbortController` e unico e no escopo do
 * modulo: abortar o anterior e obrigatorio, senao cada navegacao adiciona
 * mais um conjunto de handlers e o menu abre e fecha varias vezes.
 */

let controller: AbortController | null = null;

export function initHeader(): void {
  controller?.abort();
  controller = new AbortController();
  const { signal } = controller;

  const header = document.querySelector<HTMLElement>('#site-header');
  const toggle = document.querySelector<HTMLButtonElement>('#menu-toggle');
  const menu = document.querySelector<HTMLElement>('#mobile-menu');
  if (!header || !toggle || !menu) return;

  const setScrolled = () => {
    if (window.scrollY > 24) header.classList.add('is-scrolled');
    else if (!header.classList.contains('header-solid')) header.classList.remove('is-scrolled');
  };

  const isOpen = () => menu.classList.contains('is-open');

  const setMenu = (open: boolean) => {
    menu.classList.toggle('is-open', open);
    menu.toggleAttribute('inert', !open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
    document.body.classList.toggle('menu-open', open);

    if (open) {
      menu.removeAttribute('aria-hidden');
      // Move o foco para o primeiro item para que teclado e leitor de tela
      // acompanhem a abertura.
      menu.querySelector<HTMLElement>('a, button')?.focus();
    } else {
      menu.setAttribute('aria-hidden', 'true');
    }
  };

  const closeMenu = ({ restoreFocus = false } = {}) => {
    if (!isOpen()) return;
    setMenu(false);
    if (restoreFocus) toggle.focus();
  };

  window.addEventListener('scroll', setScrolled, { passive: true, signal });
  setScrolled();

  toggle.addEventListener(
    'click',
    (event) => {
      event.stopPropagation();
      setMenu(!isOpen());
    },
    { signal },
  );

  // Fecha ao clicar/tocar fora do header.
  document.addEventListener(
    'click',
    (event) => {
      const target = event.target as HTMLElement | null;
      if (isOpen() && !target?.closest('#site-header')) closeMenu();
    },
    { signal },
  );

  // Fecha ao seguir qualquer link do menu.
  menu.addEventListener(
    'click',
    (event) => {
      if ((event.target as HTMLElement).closest('a')) closeMenu();
    },
    { signal },
  );

  // Esc fecha e devolve o foco ao botao que abriu o menu.
  document.addEventListener(
    'keydown',
    (event) => {
      if (event.key === 'Escape' && isOpen()) {
        event.preventDefault();
        closeMenu({ restoreFocus: true });
      }
    },
    { signal },
  );
}