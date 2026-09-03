/* ============================================
   MAIN.JS — Data, Init, Navigation, Cursor, i18n, Loading
   ============================================ */

(function () {
    'use strict';

    /* ------------------------------------------
       DATA — All content centralized here
       Swap image srcs to use local files
       ------------------------------------------ */

    const DATA = {
        portfolio: [
            {
                src: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=1200&q=80',
                thumb: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400&q=60',
                title: 'Silent Morning',
                category: 'Portrait',
                year: '2026'
            },
            {
                src: 'https://images.unsplash.com/photo-1486325212027-8081e485255e?w=1200&q=80',
                thumb: 'https://images.unsplash.com/photo-1486325212027-8081e485255e?w=400&q=60',
                title: 'Urban Geometry',
                category: 'Architecture',
                year: '2025'
            },
            {
                src: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=1200&q=80',
                thumb: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=400&q=60',
                title: 'Metamorphosis',
                category: 'Fashion',
                year: '2026'
            },
            {
                src: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=1200&q=80',
                thumb: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=400&q=60',
                title: 'Eternal Vow',
                category: 'Wedding',
                year: '2026'
            },
            {
                src: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=1200&q=80',
                thumb: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=400&q=60',
                title: 'Urban Stories',
                category: 'Street',
                year: '2025'
            },
            {
                src: 'https://images.unsplash.com/photo-1542038784456-1ea8e935640e?w=1200&q=80',
                thumb: 'https://images.unsplash.com/photo-1542038784456-1ea8e935640e?w=400&q=60',
                title: 'Paper Dreams',
                category: 'Editorial',
                year: '2026'
            }
        ],

        carousel: [
            {
                src: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=900&q=80',
                title: 'Warmth',
                category: 'Portrait'
            },
            {
                src: 'https://images.unsplash.com/photo-1518098268026-4e89f1a2cd8e?w=900&q=80',
                title: 'Structure',
                category: 'Architecture'
            },
            {
                src: 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=900&q=80',
                title: 'Elegance',
                category: 'Fashion'
            },
            {
                src: 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=900&q=80',
                title: 'Serenity',
                category: 'Portrait'
            },
            {
                src: 'https://images.unsplash.com/photo-1504198453319-5ce911bafcde?w=900&q=80',
                title: 'Horizon',
                category: 'Landscape'
            },
            {
                src: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=900&q=80',
                title: 'Motion',
                category: 'Fashion'
            }
        ],

        gallery: [
            {
                src: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=1600&q=80',
                title: 'Silent Morning',
                category: 'Portrait'
            },
            {
                src: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=1600&q=80',
                title: 'Inner Light',
                category: 'Portrait'
            },
            {
                src: 'https://images.unsplash.com/photo-1486325212027-8081e485255e?w=1600&q=80',
                title: 'Urban Geometry',
                category: 'Architecture'
            },
            {
                src: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=1600&q=80',
                title: 'Metamorphosis',
                category: 'Fashion'
            },
            {
                src: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=1600&q=80',
                title: 'Eternal Vow',
                category: 'Wedding'
            },
            {
                src: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=1600&q=80',
                title: 'Urban Stories',
                category: 'Street'
            },
            {
                src: 'https://images.unsplash.com/photo-1542038784456-1ea8e935640e?w=1600&q=80',
                title: 'Paper Dreams',
                category: 'Editorial'
            },
            {
                src: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=1600&q=80',
                title: 'In Motion',
                category: 'Fashion'
            }
        ],

        projects: [
            {
                title: 'THE HUMAN CONDITION',
                description: 'Portraits exploring identity, silence and everyday gestures.',
                year: '2026',
                location: 'São Paulo, Brazil',
                images: [
                    { src: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=1400&q=80', layout: 'wide' },
                    { src: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=1400&q=80', layout: 'full' },
                    { src: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=800&q=80', layout: 'portrait' },
                    { src: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1400&q=80', layout: 'full' }
                ]
            },
            {
                title: 'URBAN GEOMETRY',
                description: 'Architecture and the rhythm of built spaces.',
                year: '2025',
                location: 'Multiple Cities',
                images: [
                    { src: 'https://images.unsplash.com/photo-1486325212027-8081e485255e?w=1400&q=80', layout: 'wide' },
                    { src: 'https://images.unsplash.com/photo-1487958449943-2429e8be8625?w=1400&q=80', layout: 'full' },
                    { src: 'https://images.unsplash.com/photo-1448630360428-65456885c650?w=1400&q=80', layout: 'square' },
                    { src: 'https://images.unsplash.com/photo-1511818966892-d7d671e672a2?w=1400&q=80', layout: 'full' }
                ]
            },
            {
                title: 'ETERNAL VOW',
                description: 'Wedding stories told through light and intimacy.',
                year: '2026',
                location: 'São Paulo, Brazil',
                images: [
                    { src: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=1400&q=80', layout: 'wide' },
                    { src: 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=1400&q=80', layout: 'full' },
                    { src: 'https://images.unsplash.com/photo-1465495976277-4387d4b0b4c6?w=800&q=80', layout: 'portrait' },
                    { src: 'https://images.unsplash.com/photo-1522673607200-164d1b6ce486?w=1400&q=80', layout: 'full' }
                ]
            }
        ]
    };

    /* ------------------------------------------
       i18n — Bilingual content
       ------------------------------------------ */

    const I18N = {
        en: {
            'loader.label': 'LOADING VISUAL ARCHIVE',
            'nav.work': 'WORK',
            'nav.projects': 'PROJECTS',
            'nav.about': 'ABOUT',
            'nav.contact': 'CONTACT',
            'hero.label': 'PHOTOGRAPHER',
            'hero.specialties': 'STORIES / PEOPLE / LIGHT / MOMENTS',
            'hero.location': 'BASED IN SÃO PAULO, BRAZIL',
            'hero.scroll': 'SCROLL',
            'manifesto.sub': 'The silence before the smile. The light before the shadow.',
            'work.title': 'SELECTED WORK',
            'carousel.title': 'FEATURED',
            'projects.title': 'PROJECTS',
            'projects.p1.desc': 'Portraits exploring identity, silence and everyday gestures.',
            'projects.p2.desc': 'Architecture and the rhythm of built spaces.',
            'projects.p3.desc': 'Wedding stories told through light and intimacy.',
            'projects.view': 'VIEW PROJECT →',
            'gallery.title': 'GALLERY',
            'about.title': 'ABOUT',
            'about.role': 'Photographer based in São Paulo, Brazil.',
            'about.bio1': 'With over a decade of experience behind the lens, I specialize in capturing the authentic essence of my subjects — whether through portraiture, editorial, or documentary work.',
            'about.bio2': 'My approach is rooted in observation. I believe the most powerful photographs are born not from staging, but from patience — waiting for the right light, the right gesture, the right silence.',
            'about.bio3': 'Every project is a collaboration. Every image, a conversation between light and emotion.',
            'about.years': 'YEARS EXPERIENCE',
            'about.projects_stat': 'PROJECTS',
            'about.publications': 'PUBLICATIONS',
            'clients.title': 'SELECTED CLIENTS',
            'clients.note': '* Example clients for demonstration purposes',
            'contact.line1': "LET'S CREATE",
            'contact.line2': 'SOMETHING',
            'contact.line3': 'MEMORABLE.',
            'contact.email': 'GET IN TOUCH →',
            'contact.email_label': 'EMAIL',
            'contact.instagram_label': 'INSTAGRAM',
            'contact.location_label': 'LOCATION',
            'footer.top': 'BACK TO TOP ↑'
        },
        pt: {
            'loader.label': 'CARREGANDO ARQUIVO VISUAL',
            'nav.work': 'PORTFÓLIO',
            'nav.projects': 'PROJETOS',
            'nav.about': 'SOBRE',
            'nav.contact': 'CONTATO',
            'hero.label': 'FOTÓGRAFO',
            'hero.specialties': 'HISTÓRIAS / PESSOAS / LUZ / MOMENTOS',
            'hero.location': 'BASED EM SÃO PAULO, BRASIL',
            'hero.scroll': 'ROLAR',
            'manifesto.sub': 'O silêncio antes do sorriso. A luz antes da sombra.',
            'work.title': 'PORTFÓLIO SELECIONADO',
            'carousel.title': 'DESTAQUES',
            'projects.title': 'PROJETOS',
            'projects.p1.desc': 'Retratos explorando identidade, silêncio e gestos cotidianos.',
            'projects.p2.desc': 'Arquitetura e o ritmo dos espaços construídos.',
            'projects.p3.desc': 'Histórias de casamento contadas através da luz e intimidade.',
            'projects.view': 'VER PROJETO →',
            'gallery.title': 'GALERIA',
            'about.title': 'SOBRE',
            'about.role': 'Fotógrafo baseado em São Paulo, Brasil.',
            'about.bio1': 'Com mais de uma década de experiência atrás da lente, sou especializado em capturar a essência autêntica dos meus temas — seja através de retratos, editorial ou trabalho documental.',
            'about.bio2': 'Minha abordagem é enraizada na observação. Acredito que as fotografias mais poderosas nascem não da encenação, mas da paciência — esperando a luz certa, o gesto certo, o silêncio certo.',
            'about.bio3': 'Cada projeto é uma colaboração. Cada imagem, uma conversa entre luz e emoção.',
            'about.years': 'ANOS DE EXPERIÊNCIA',
            'about.projects_stat': 'PROJETOS',
            'about.publications': 'PUBLICAÇÕES',
            'clients.title': 'CLIENTES SELECIONADOS',
            'clients.note': '* Clientes de exemplo para fins de demonstração',
            'contact.line1': 'VAMOS CRIAR',
            'contact.line2': 'ALGO',
            'contact.line3': 'MEMORÁVEL.',
            'contact.email': 'ENTRE EM CONTATO →',
            'contact.email_label': 'E-MAIL',
            'contact.instagram_label': 'INSTAGRAM',
            'contact.location_label': 'LOCALIZAÇÃO',
            'footer.top': 'VOLTAR AO TOPO ↑'
        }
    };

    /* ------------------------------------------
       UTILITIES
       ------------------------------------------ */

    function $(selector, parent = document) {
        return parent.querySelector(selector);
    }

    function $$(selector, parent = document) {
        return Array.from(parent.querySelectorAll(selector));
    }

    function debounce(fn, delay) {
        let timer;
        return function (...args) {
            clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, args), delay);
        };
    }

    function lerp(start, end, factor) {
        return start + (end - start) * factor;
    }

    function isTouchDevice() {
        return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    }

    function prefersReducedMotion() {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    function isWebGLAvailable() {
        try {
            const canvas = document.createElement('canvas');
            return !!(window.WebGLRenderingContext &&
                (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
        } catch (e) {
            return false;
        }
    }

    /* ------------------------------------------
       LOADING SCREEN
       ------------------------------------------ */

    function initLoader() {
        const loader = $('#loader');
        const counter = $('#loader-counter');
        const bar = $('#loader-bar');

        if (!loader || !counter || !bar) return Promise.resolve();

        return new Promise((resolve) => {
            let progress = 0;
            const target = 100;
            const duration = 1800;
            const startTime = performance.now();

            function update(now) {
                const elapsed = now - startTime;
                progress = Math.min((elapsed / duration) * target, target);

                counter.textContent = String(Math.floor(progress)).padStart(2, '0');
                bar.style.width = progress + '%';

                if (progress < target) {
                    requestAnimationFrame(update);
                } else {
                    setTimeout(() => {
                        loader.classList.add('is-hidden');
                        document.body.style.overflow = '';
                        resolve();
                    }, 400);
                }
            }

            document.body.style.overflow = 'hidden';
            requestAnimationFrame(update);
        });
    }

    /* ------------------------------------------
       NAVIGATION
       ------------------------------------------ */

    function initNav() {
        const nav = $('#nav');
        const menuBtn = $('#menu-toggle');
        const mobileMenu = $('#mobile-menu');
        const mobileLinks = $$('.mobile-menu__link');
        const backToTop = $('#back-to-top');
        const navLinks = $$('.nav__link');

        if (!nav) return;

        let lastScrollY = 0;

        function onScroll() {
            const scrollY = window.scrollY;

            if (scrollY > 100) {
                nav.classList.add('is-scrolled');
            } else {
                nav.classList.remove('is-scrolled');
            }

            lastScrollY = scrollY;

            updateScrollProgress();
            updateActiveNavLink();
        }

        function updateScrollProgress() {
            const bar = $('.scroll-progress__bar');
            if (!bar) return;

            const scrollTop = window.scrollY;
            const docHeight = document.documentElement.scrollHeight - window.innerHeight;
            const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
            bar.style.width = progress + '%';
        }

        function updateActiveNavLink() {
            const sections = ['work', 'projects', 'about', 'contact'];
            const scrollY = window.scrollY + window.innerHeight / 3;

            let current = '';

            sections.forEach(id => {
                const section = document.getElementById(id);
                if (section && section.offsetTop <= scrollY) {
                    current = id;
                }
            });

            navLinks.forEach(link => {
                const href = link.getAttribute('href');
                if (href === '#' + current) {
                    link.classList.add('is-active');
                } else {
                    link.classList.remove('is-active');
                }
            });
        }

        function toggleMenu() {
            const isOpen = mobileMenu.classList.contains('is-open');

            if (isOpen) {
                mobileMenu.classList.remove('is-open');
                mobileMenu.setAttribute('aria-hidden', 'true');
                menuBtn.classList.remove('is-open');
                menuBtn.setAttribute('aria-expanded', 'false');
                document.body.classList.remove('menu-open');
            } else {
                mobileMenu.classList.add('is-open');
                mobileMenu.setAttribute('aria-hidden', 'false');
                menuBtn.classList.add('is-open');
                menuBtn.setAttribute('aria-expanded', 'true');
                document.body.classList.add('menu-open');
            }
        }

        window.addEventListener('scroll', onScroll, { passive: true });

        if (menuBtn) {
            menuBtn.addEventListener('click', toggleMenu);
        }

        mobileLinks.forEach(link => {
            link.addEventListener('click', () => {
                if (mobileMenu.classList.contains('is-open')) {
                    toggleMenu();
                }
            });
        });

        if (backToTop) {
            backToTop.addEventListener('click', () => {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        }

        onScroll();
    }

    /* ------------------------------------------
       CUSTOM CURSOR
       ------------------------------------------ */

    function initCursor() {
        if (isTouchDevice()) return;

        const cursor = $('#cursor');
        const cursorLabel = $('#cursor-label');

        if (!cursor) return;

        let mouseX = 0;
        let mouseY = 0;
        let cursorX = 0;
        let cursorY = 0;

        document.addEventListener('mousemove', (e) => {
            mouseX = e.clientX;
            mouseY = e.clientY;
        });

        function animate() {
            cursorX = lerp(cursorX, mouseX, 0.15);
            cursorY = lerp(cursorY, mouseY, 0.15);

            cursor.style.transform = `translate(${cursorX}px, ${cursorY}px)`;
            requestAnimationFrame(animate);
        }

        animate();

        document.addEventListener('mouseover', (e) => {
            const target = e.target.closest('[data-cursor]');
            if (target) {
                const label = target.getAttribute('data-cursor');
                cursor.classList.add('is-hovering');
                if (cursorLabel && label) {
                    cursorLabel.textContent = label;
                }
            }
        });

        document.addEventListener('mouseout', (e) => {
            const target = e.target.closest('[data-cursor]');
            if (target) {
                cursor.classList.remove('is-hovering');
                if (cursorLabel) {
                    cursorLabel.textContent = '';
                }
            }
        });

        document.addEventListener('mouseleave', () => {
            cursor.classList.add('is-hidden');
        });

        document.addEventListener('mouseenter', () => {
            cursor.classList.remove('is-hidden');
        });
    }

    /* ------------------------------------------
       i18n — Language Toggle
       ------------------------------------------ */

    function initI18n() {
        const langToggle = $('#lang-toggle');
        const langToggleMobile = $('#lang-toggle-mobile');
        let currentLang = 'en';

        function applyLang(lang) {
            currentLang = lang;
            document.documentElement.setAttribute('data-lang', lang);
            document.documentElement.setAttribute('lang', lang);

            const translations = I18N[lang];
            if (!translations) return;

            $$('[data-i18n]').forEach(el => {
                const key = el.getAttribute('data-i18n');
                if (translations[key]) {
                    el.textContent = translations[key];
                }
            });

            $$('.nav__lang-en').forEach(el => {
                el.classList.toggle('active', lang === 'en');
            });
            $$('.nav__lang-pt').forEach(el => {
                el.classList.toggle('active', lang === 'pt');
            });
        }

        function toggleLang() {
            const newLang = currentLang === 'en' ? 'pt' : 'en';
            applyLang(newLang);
        }

        if (langToggle) langToggle.addEventListener('click', toggleLang);
        if (langToggleMobile) langToggleMobile.addEventListener('click', toggleLang);
    }

    /* ------------------------------------------
       SMOOTH SCROLL for anchor links
       ------------------------------------------ */

    function initSmoothScroll() {
        $$('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', (e) => {
                const targetId = anchor.getAttribute('href');
                if (targetId === '#') return;

                const target = document.querySelector(targetId);
                if (target) {
                    e.preventDefault();
                    const navHeight = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-height'));
                    const targetPos = target.getBoundingClientRect().top + window.scrollY - navHeight;

                    window.scrollTo({
                        top: targetPos,
                        behavior: prefersReducedMotion() ? 'auto' : 'smooth'
                    });
                }
            });
        });
    }

    /* ------------------------------------------
       INITIALIZATION
       ------------------------------------------ */

    async function init() {
        initCursor();
        initNav();
        initI18n();
        initSmoothScroll();

        await initLoader();

        if (typeof window.initAnimations === 'function') {
            window.initAnimations();
        }
        if (typeof window.initGallery === 'function') {
            window.initGallery(DATA);
        }
        if (typeof window.initThreeScene === 'function') {
            window.initThreeScene(DATA);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.portfolioData = DATA;
    window.portfolioI18N = I18N;

})();
