export function mountReveal(node: Element): void {
  if (node.classList.contains('is-visible')) return;

  if (typeof IntersectionObserver === 'undefined') {
    node.classList.add('is-visible');
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.05 },
  );

  observer.observe(node);
}