/* ============================================
   ANIMATIONS.JS — Scroll reveals, parallax, transitions
   ============================================ */

(function () {
    'use strict';

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ------------------------------------------
       SCROLL REVEAL — IntersectionObserver
       ------------------------------------------ */

    function initScrollReveals() {
        if (reducedMotion) {
            document.querySelectorAll('[data-reveal]').forEach(el => {
                if (el.getAttribute('data-reveal') !== 'words') {
                    el.classList.add('is-visible');
                }
            });
            return;
        }

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('is-visible');
                        observer.unobserve(entry.target);
                    }
                });
            },
            {
                threshold: 0.15,
                rootMargin: '0px 0px -50px 0px'
            }
        );

        document.querySelectorAll('[data-reveal]').forEach(el => {
            if (el.getAttribute('data-reveal') !== 'words') {
                observer.observe(el);
            }
        });
    }

    /* ------------------------------------------
       WORD-BY-WORD REVEAL — Manifesto
       ------------------------------------------ */

    function initWordReveal() {
        const manifestoText = document.querySelector('.manifesto__text');
        if (!manifestoText) return;

        if (reducedMotion) {
            manifestoText.querySelectorAll('.manifesto__word').forEach(w => w.classList.add('is-visible'));
            const sub = document.querySelector('.manifesto__sub');
            if (sub) sub.classList.add('is-visible');
            return;
        }

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const words = manifestoText.querySelectorAll('.manifesto__word');
                        words.forEach((word, i) => {
                            setTimeout(() => {
                                word.classList.add('is-visible');
                            }, i * 120);
                        });

                        const sub = document.querySelector('.manifesto__sub');
                        if (sub) {
                            setTimeout(() => {
                                sub.classList.add('is-visible');
                            }, words.length * 120 + 200);
                        }

                        observer.unobserve(entry.target);
                    }
                });
            },
            { threshold: 0.4 }
        );

        observer.observe(manifestoText);
    }

    /* ------------------------------------------
       PARALLAX — Subtle depth on scroll
       ------------------------------------------ */

    function initParallax() {
        if (reducedMotion) return;

        const parallaxElements = document.querySelectorAll('.work__item-img img, .project__cover img');

        if (!parallaxElements.length) return;

        let ticking = false;

        function onScroll() {
            if (!ticking) {
                requestAnimationFrame(() => {
                    parallaxElements.forEach(img => {
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

    /* ------------------------------------------
       TRANSITION IMAGE — Scroll expand effect
       ------------------------------------------ */

    function initTransitionImage() {
        const transitionImage = document.querySelector('[data-transition-image]');
        if (!transitionImage) return;

        if (reducedMotion) {
            transitionImage.classList.add('is-visible');
            return;
        }

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        transitionImage.classList.add('is-visible');
                        observer.unobserve(entry.target);
                    }
                });
            },
            { threshold: 0.3 }
        );

        observer.observe(transitionImage);
    }

    /* ------------------------------------------
       STAGGER REVEAL — For grid items
       ------------------------------------------ */

    function initStaggerReveal() {
        if (reducedMotion) return;

        const gridItems = document.querySelectorAll('.work__item[data-reveal]');

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry, index) => {
                    if (entry.isIntersecting) {
                        setTimeout(() => {
                            entry.target.classList.add('is-visible');
                        }, index * 100);
                        observer.unobserve(entry.target);
                    }
                });
            },
            {
                threshold: 0.1,
                rootMargin: '0px 0px -30px 0px'
            }
        );

        gridItems.forEach(item => observer.observe(item));
    }

    /* ------------------------------------------
       COUNTER ANIMATION — About stats
       ------------------------------------------ */

    function initCounterAnimation() {
        const stats = document.querySelectorAll('.about__stat-num');
        if (!stats.length) return;

        if (reducedMotion) return;

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const el = entry.target;
                        const text = el.textContent;
                        const match = text.match(/(\d+)/);

                        if (match) {
                            const target = parseInt(match[1]);
                            const suffix = text.replace(match[1], '');
                            let current = 0;
                            const duration = 1500;
                            const startTime = performance.now();

                            function animate(now) {
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
            { threshold: 0.5 }
        );

        stats.forEach(stat => observer.observe(stat));
    }

    /* ------------------------------------------
       INIT
       ------------------------------------------ */

    window.initAnimations = function () {
        initScrollReveals();
        initWordReveal();
        initParallax();
        initTransitionImage();
        initStaggerReveal();
        initCounterAnimation();
    };

})();
