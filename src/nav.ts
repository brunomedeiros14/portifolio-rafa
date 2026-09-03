import { $, $$, prefersReducedMotion } from './utils';

export function initNav(): void {
    const nav = $('#nav');
    const menuBtn = $('#menu-toggle');
    const mobileMenu = $('#mobile-menu');
    const mobileLinks = $$('.mobile-menu__link');
    const backToTop = $('#back-to-top');
    const navLinks = $$('.nav__link');

    if (!nav) return;

    const navEl = nav;

    function onScroll(): void {
        const scrollY = window.scrollY;

        if (scrollY > 100) {
            navEl.classList.add('is-scrolled');
        } else {
            navEl.classList.remove('is-scrolled');
        }

        updateScrollProgress();
        updateActiveNavLink();
    }

    function updateScrollProgress(): void {
        const bar = $('.scroll-progress__bar');
        if (!bar) return;

        const scrollTop = window.scrollY;
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
        bar.style.width = progress + '%';
    }

    function updateActiveNavLink(): void {
        const sections = ['work', 'projects', 'about', 'contact'];
        const scrollY = window.scrollY + window.innerHeight / 3;

        let current = '';

        sections.forEach((id) => {
            const section = document.getElementById(id);
            if (section && section.offsetTop <= scrollY) {
                current = id;
            }
        });

        navLinks.forEach((link) => {
            const href = link.getAttribute('href');
            if (href === '#' + current) {
                link.classList.add('is-active');
            } else {
                link.classList.remove('is-active');
            }
        });
    }

    function toggleMenu(): void {
        const isOpen = mobileMenu?.classList.contains('is-open') ?? false;

        if (isOpen) {
            mobileMenu?.classList.remove('is-open');
            mobileMenu?.setAttribute('aria-hidden', 'true');
            menuBtn?.classList.remove('is-open');
            menuBtn?.setAttribute('aria-expanded', 'false');
            document.body.classList.remove('menu-open');
        } else {
            mobileMenu?.classList.add('is-open');
            mobileMenu?.setAttribute('aria-hidden', 'false');
            menuBtn?.classList.add('is-open');
            menuBtn?.setAttribute('aria-expanded', 'true');
            document.body.classList.add('menu-open');
        }
    }

    window.addEventListener('scroll', onScroll, { passive: true });

    menuBtn?.addEventListener('click', toggleMenu);

    mobileLinks.forEach((link) => {
        link.addEventListener('click', () => {
            if (mobileMenu?.classList.contains('is-open')) {
                toggleMenu();
            }
        });
    });

    backToTop?.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    initSmoothScroll();
    onScroll();
}

function initSmoothScroll(): void {
    $$<HTMLAnchorElement>('a[href^="#"]').forEach((anchor) => {
        anchor.addEventListener('click', (e) => {
            const targetId = anchor.getAttribute('href');
            if (!targetId || targetId === '#') return;

            const target = document.querySelector(targetId);
            if (target) {
                e.preventDefault();
                const navHeight = parseInt(
                    getComputedStyle(document.documentElement).getPropertyValue('--nav-height'),
                );
                const targetPos =
                    target.getBoundingClientRect().top + window.scrollY - navHeight;

                window.scrollTo({
                    top: targetPos,
                    behavior: prefersReducedMotion() ? 'auto' : 'smooth',
                });
            }
        });
    });
}
