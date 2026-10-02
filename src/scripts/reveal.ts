/**
 * Animacao de entrada (.reveal).
 *
 * Cada elemento observado cria o proprio IntersectionObserver para poder se
 * desinscrever assim que entra na viewport. Elementos que nunca entram na tela
 * mantem o observer vivo, por isso reaproveitamos um unico observer e apenas
 * limpamos a lista apos cada troca de pagina.
 */

let observer: IntersectionObserver | null = null;
let observed = new Set<Element>();

function getObserver(): IntersectionObserver | null {
  if (typeof IntersectionObserver === 'undefined') return null;

  if (!observer) {
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          (entry.target as HTMLElement).classList.add('is-visible');
          observer?.unobserve(entry.target);
          observed.delete(entry.target);
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.05 },
    );
  }

  return observer;
}

export function mountReveal(node: Element): void {
  if (node.classList.contains('is-visible') || observed.has(node)) return;

  const io = getObserver();
  if (!io) {
    // Sem IntersectionObserver: mostra tudo, sem animacao.
    node.classList.add('is-visible');
    return;
  }

  observed.add(node);
  io.observe(node);
}

export function initReveal(): void {
  observer?.disconnect();
  observed = new Set();
  document.querySelectorAll<HTMLElement>('.reveal:not(.is-visible)').forEach(mountReveal);
}
