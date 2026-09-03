import { prefersReducedMotion } from './utils';

const reducedMotion = prefersReducedMotion();

function initScrollReveals(): void {
    if (reducedMotion) {
        document.querySelectorAll<HTMLElement>('[data-reveal]').forEach((el) => {
            if (el.getAttribute('data-reveal') !== 'words') {
                el.classList.add('is-visible');
            }
        });
        return;
    }

    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    observer.unobserve(entry.target);
                }
            });
        },
        { threshold: 0.15, rootMargin: '0px 0px -50px 0px' },
    );

    document.querySelectorAll('[data-reveal]').forEach((el) => {
        if (el.getAttribute('data-reveal') !== 'words') {
            observer.observe(el);
        }
    });
}

function initWordReveal(): void {
    const manifestoText = document.querySelector<HTMLElement>('.manifesto__text');
    if (!manifestoText) return;

    if (reducedMotion) {
        manifestoText.querySelectorAll('.manifesto__word').forEach((w) => w.classList.add('is-visible'));
        document.querySelector('.manifesto__sub')?.classList.add('is-visible');
        return;
    }

    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    (window as any).__manifestoRevealed = true;
                    const words = manifestoText.querySelectorAll('.manifesto__word');
                    words.forEach((word, i) => {
                        setTimeout(() => word.classList.add('is-visible'), i * 120);
                    });

                    const sub = document.querySelector('.manifesto__sub');
                    if (sub) {
                        setTimeout(() => sub.classList.add('is-visible'), words.length * 120 + 200);
                    }

                    observer.unobserve(entry.target);
                }
            });
        },
        { threshold: 0.4 },
    );

    observer.observe(manifestoText);
}

function initParallax(): void {
    if (reducedMotion) return;

    const parallaxElements = document.querySelectorAll<HTMLElement>(
        '.work__item-img img, .project__cover img',
    );

    const heroImg = document.querySelector<HTMLElement>('.hero__bg-img');
    const heroEl = document.querySelector<HTMLElement>('.hero');

    if (!parallaxElements.length && !heroImg) return;

    let ticking = false;

    function onScroll(): void {
        if (!ticking) {
            requestAnimationFrame(() => {
                if (heroImg && heroEl) {
                    const rect = heroEl.getBoundingClientRect();
                    if (rect.bottom > 0 && rect.top < window.innerHeight) {
                        const progress = Math.min(Math.max(rect.top / window.innerHeight, 0), 1);
                        const translateY = progress * 8;
                        heroImg.style.transform = `translateY(${translateY}px) scale(1.05)`;
                    }
                }

                parallaxElements.forEach((img) => {
                    const rect = img.getBoundingClientRect();
                    const windowHeight = window.innerHeight;

                    if (rect.top < windowHeight && rect.bottom > 0) {
                        const progress = (windowHeight - rect.top) / (windowHeight + rect.height);
                        const translateY = (progress - 0.5) * 30;
                        img.style.transform = `translateY(${translateY}px) scale(1.05)`;
                    }
                });
                ticking = false;
            });
            ticking = true;
        }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
}

function initTransitionImage(): void {
    const transitionImage = document.querySelector<HTMLElement>('[data-transition-image]');
    if (!transitionImage) return;

    if (reducedMotion) {
        transitionImage.classList.add('is-visible');
        return;
    }

    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    transitionImage.classList.add('is-visible');
                    observer.unobserve(entry.target);
                }
            });
        },
        { threshold: 0.3 },
    );

    observer.observe(transitionImage);
}

function initStaggerReveal(): void {
    if (reducedMotion) return;

    const gridItems = document.querySelectorAll<HTMLElement>('.work__item[data-reveal]');

    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry, index) => {
                if (entry.isIntersecting) {
                    setTimeout(() => entry.target.classList.add('is-visible'), index * 100);
                    observer.unobserve(entry.target);
                }
            });
        },
        { threshold: 0.1, rootMargin: '0px 0px -30px 0px' },
    );

    gridItems.forEach((item) => observer.observe(item));
}

function initCounterAnimation(): void {
    const stats = document.querySelectorAll<HTMLElement>('.about__stat-num');
    if (!stats.length || reducedMotion) return;

    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    const el = entry.target as HTMLElement;
                    const text = el.textContent ?? '';
                    const match = text.match(/(\d+)/);

                    if (match) {
                        const target = parseInt(match[1]);
                        const suffix = text.replace(match[1], '');
                        let current = 0;
                        const duration = 1500;
                        const startTime = performance.now();

                        function animate(now: number): void {
                            const elapsed = now - startTime;
                            const progress = Math.min(elapsed / duration, 1);
                            const eased = 1 - Math.pow(1 - progress, 3);
                            current = Math.floor(eased * target);
                            el.textContent = current + suffix;

                            if (progress < 1) {
                                requestAnimationFrame(animate);
                            } else {
                                el.textContent = text;
                            }
                        }

                        requestAnimationFrame(animate);
                    }

                    observer.unobserve(el);
                }
            });
        },
        { threshold: 0.5 },
    );

    stats.forEach((stat) => observer.observe(stat));
}

export function initAnimations(): void {
    initScrollReveals();
    initWordReveal();
    initParallax();
    initTransitionImage();
    initStaggerReveal();
    initCounterAnimation();
}
