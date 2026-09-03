/* ============================================
   GALLERY.JS — Lightbox, Carousel, Fullscreen Gallery, Project View
   ============================================ */

(function () {
    'use strict';

    function $(selector, parent) { return (parent || document).querySelector(selector); }
    function $$(selector, parent) { return Array.from((parent || document).querySelectorAll(selector)); }

    let DATA = null;

    /* ------------------------------------------
       LIGHTBOX
       ------------------------------------------ */

    const Lightbox = {
        el: null,
        imgEl: null,
        titleEl: null,
        catEl: null,
        counterEl: null,
        items: [],
        currentIndex: 0,

        init() {
            this.el = $('#lightbox');
            if (!this.el) return;

            this.imgEl = $('#lightbox-img');
            this.titleEl = $('#lightbox-title');
            this.catEl = $('#lightbox-category');
            this.counterEl = $('#lightbox-counter');

            $('#lightbox-close').addEventListener('click', () => this.close());
            $('#lightbox-prev').addEventListener('click', () => this.prev());
            $('#lightbox-next').addEventListener('click', () => this.next());

            this.el.querySelector('.lightbox__backdrop').addEventListener('click', () => this.close());

            document.addEventListener('keydown', (e) => {
                if (!this.el.classList.contains('is-open')) return;
                if (e.key === 'Escape') this.close();
                if (e.key === 'ArrowLeft') this.prev();
                if (e.key === 'ArrowRight') this.next();
            });

            let touchStartX = 0;
            this.el.addEventListener('touchstart', (e) => {
                touchStartX = e.touches[0].clientX;
            }, { passive: true });

            this.el.addEventListener('touchend', (e) => {
                const diff = touchStartX - e.changedTouches[0].clientX;
                if (Math.abs(diff) > 50) {
                    diff > 0 ? this.next() : this.prev();
                }
            }, { passive: true });
        },

        open(items, index) {
            if (!this.el) return;
            this.items = items;
            this.currentIndex = index;
            this.update();
            this.el.classList.add('is-open');
            this.el.setAttribute('aria-hidden', 'false');
            document.body.style.overflow = 'hidden';
        },

        close() {
            if (!this.el) return;
            this.el.classList.remove('is-open');
            this.el.setAttribute('aria-hidden', 'true');
            document.body.style.overflow = '';
        },

        prev() {
            if (this.items.length === 0) return;
            this.currentIndex = (this.currentIndex - 1 + this.items.length) % this.items.length;
            this.update();
        },

        next() {
            if (this.items.length === 0) return;
            this.currentIndex = (this.currentIndex + 1) % this.items.length;
            this.update();
        },

        update() {
            const item = this.items[this.currentIndex];
            if (!item) return;

            if (this.imgEl) {
                this.imgEl.style.opacity = '0';
                this.imgEl.style.transform = 'scale(0.95)';
                setTimeout(() => {
                    this.imgEl.src = item.src;
                    this.imgEl.alt = item.title || '';
                    this.imgEl.style.opacity = '1';
                    this.imgEl.style.transform = 'scale(1)';
                }, 200);
            }

            if (this.titleEl) this.titleEl.textContent = item.title || '';
            if (this.catEl) this.catEl.textContent = item.category || '';
            if (this.counterEl) {
                const num = String(this.currentIndex + 1).padStart(2, '0');
                const total = String(this.items.length).padStart(2, '0');
                this.counterEl.textContent = `${num} / ${total}`;
            }
        }
    };

    /* ------------------------------------------
       HORIZONTAL CAROUSEL
       ------------------------------------------ */

    const Carousel = {
        track: null,
        slides: [],
        counterEl: null,
        currentIndex: 0,
        isDragging: false,
        startX: 0,
        scrollLeft: 0,

        init() {
            this.track = $('#carousel-track');
            if (!this.track) return;

            this.slides = $$('.carousel__slide', this.track);
            this.counterEl = $('#carousel-counter');

            $('#carousel-prev').addEventListener('click', () => this.navigate(-1));
            $('#carousel-next').addEventListener('click', () => this.navigate(1));

            this.initDrag();
            this.initWheel();
            this.initKeyboard();
            this.updateCounter();
        },

        navigate(direction) {
            if (!this.track) return;

            const slideWidth = this.slides[0] ? this.slides[0].offsetWidth + 16 : 300;
            const maxScroll = this.track.scrollWidth - this.track.clientWidth;
            const currentScroll = this.track.scrollLeft;

            let newScroll = currentScroll + (direction * slideWidth);
            newScroll = Math.max(0, Math.min(newScroll, maxScroll));

            this.track.scrollTo({
                left: newScroll,
                behavior: 'smooth'
            });

            this.currentIndex = Math.round(newScroll / slideWidth);
            this.updateCounter();
        },

        initDrag() {
            let startX, startScrollLeft;

            this.track.addEventListener('mousedown', (e) => {
                this.isDragging = true;
                this.track.classList.add('is-dragging');
                startX = e.pageX - this.track.offsetLeft;
                startScrollLeft = this.track.scrollLeft;
            });

            this.track.addEventListener('mouseleave', () => {
                this.isDragging = false;
                this.track.classList.remove('is-dragging');
            });

            this.track.addEventListener('mouseup', () => {
                this.isDragging = false;
                this.track.classList.remove('is-dragging');
            });

            this.track.addEventListener('mousemove', (e) => {
                if (!this.isDragging) return;
                e.preventDefault();
                const x = e.pageX - this.track.offsetLeft;
                const walk = (x - startX) * 1.5;
                this.track.scrollLeft = startScrollLeft - walk;
                this.updateCounterFromScroll();
            });

            let touchStartX, touchStartScroll;

            this.track.addEventListener('touchstart', (e) => {
                touchStartX = e.touches[0].pageX;
                touchStartScroll = this.track.scrollLeft;
            }, { passive: true });

            this.track.addEventListener('touchmove', (e) => {
                const x = e.touches[0].pageX;
                const walk = (touchStartX - x) * 1.2;
                this.track.scrollLeft = touchStartScroll + walk;
                this.updateCounterFromScroll();
            }, { passive: true });
        },

        initWheel() {
            this.track.addEventListener('wheel', (e) => {
                if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
                e.preventDefault();
                this.track.scrollLeft += e.deltaY;
                this.updateCounterFromScroll();
            }, { passive: false });
        },

        initKeyboard() {
            const carousel = $('#carousel');
            if (!carousel) return;

            carousel.setAttribute('tabindex', '0');
            carousel.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowLeft') this.navigate(-1);
                if (e.key === 'ArrowRight') this.navigate(1);
            });
        },

        updateCounterFromScroll() {
            if (!this.track || !this.slides.length) return;
            const slideWidth = this.slides[0].offsetWidth + 16;
            this.currentIndex = Math.round(this.track.scrollLeft / slideWidth);
            this.updateCounter();
        },

        updateCounter() {
            if (!this.counterEl) return;
            const num = String(Math.min(this.currentIndex + 1, this.slides.length)).padStart(2, '0');
            const total = String(this.slides.length).padStart(2, '0');
            this.counterEl.textContent = `${num} / ${total}`;
        }
    };

    /* ------------------------------------------
       FULLSCREEN GALLERY
       ------------------------------------------ */

    const FullscreenGallery = {
        imgEl: null,
        titleEl: null,
        catEl: null,
        counterEl: null,
        currentIndex: 0,
        images: [],
        isTransitioning: false,

        init(galleryData) {
            this.imgEl = $('#gallery-current-img');
            this.titleEl = $('#gallery-title');
            this.catEl = $('#gallery-cat');
            this.counterEl = $('#gallery-counter');

            if (!this.imgEl) return;

            this.images = galleryData || [];
            this.currentIndex = 0;

            $('#gallery-prev').addEventListener('click', () => this.prev());
            $('#gallery-next').addEventListener('click', () => this.next());

            const expandBtn = $('#gallery-expand');
            if (expandBtn) {
                expandBtn.addEventListener('click', () => this.toggleFullscreen());
            }

            document.addEventListener('keydown', (e) => {
                if (!this.isInView()) return;
                const lightbox = $('#lightbox');
                const projectView = $('#project-view');
                if (lightbox && lightbox.classList.contains('is-open')) return;
                if (projectView && projectView.classList.contains('is-open')) return;

                if (e.key === 'ArrowLeft') this.prev();
                if (e.key === 'ArrowRight') this.next();
            });

            this.update();
        },

        isInView() {
            const gallery = $('#fullscreen-gallery');
            if (!gallery) return false;
            const rect = gallery.getBoundingClientRect();
            return rect.top < window.innerHeight && rect.bottom > 0;
        },

        prev() {
            if (this.isTransitioning || this.images.length === 0) return;
            this.currentIndex = (this.currentIndex - 1 + this.images.length) % this.images.length;
            this.transition();
        },

        next() {
            if (this.isTransitioning || this.images.length === 0) return;
            this.currentIndex = (this.currentIndex + 1) % this.images.length;
            this.transition();
        },

        transition() {
            this.isTransitioning = true;

            if (typeof window.galleryTransition === 'function') {
                window.galleryTransition(this.currentIndex, () => {
                    this.update();
                    this.isTransitioning = false;
                });
            } else {
                this.imgEl.classList.add('is-transitioning');
                setTimeout(() => {
                    this.update();
                    this.imgEl.classList.remove('is-transitioning');
                    this.isTransitioning = false;
                }, 400);
            }
        },

        update() {
            const item = this.images[this.currentIndex];
            if (!item) return;

            this.imgEl.src = item.src;
            this.imgEl.alt = item.title || '';

            if (this.titleEl) this.titleEl.textContent = item.title || '';
            if (this.catEl) this.catEl.textContent = item.category || '';
            if (this.counterEl) {
                const num = String(this.currentIndex + 1).padStart(2, '0');
                const total = String(this.images.length).padStart(2, '0');
                this.counterEl.textContent = `${num} / ${total}`;
            }
        },

        toggleFullscreen() {
            const gallery = $('#fullscreen-gallery');
            if (!gallery) return;

            if (document.fullscreenElement) {
                document.exitFullscreen();
            } else {
                gallery.requestFullscreen().catch(() => {});
            }
        }
    };

    /* ------------------------------------------
       PROJECT VIEW
       ------------------------------------------ */

    const ProjectView = {
        el: null,
        titleEl: null,
        numberEl: null,
        galleryEl: null,

        init() {
            this.el = $('#project-view');
            if (!this.el) return;

            this.titleEl = $('#project-view-title');
            this.numberEl = $('#project-view-number');
            this.galleryEl = $('#project-view-gallery');

            $('#project-close').addEventListener('click', () => this.close());
            this.el.querySelector('.project-view__backdrop').addEventListener('click', () => this.close());

            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && this.el.classList.contains('is-open')) {
                    this.close();
                }
            });
        },

        open(project, index) {
            if (!this.el || !project) return;

            if (this.titleEl) this.titleEl.textContent = project.title;
            if (this.numberEl) this.numberEl.textContent = String(index + 1).padStart(2, '0');

            if (this.galleryEl) {
                this.galleryEl.innerHTML = '';
                project.images.forEach(img => {
                    const item = document.createElement('div');
                    item.className = `project-view__gallery-item project-view__gallery-item--${img.layout || 'full'}`;

                    const imgEl = document.createElement('img');
                    imgEl.src = img.src;
                    imgEl.alt = `${project.title} — image`;
                    imgEl.loading = 'lazy';

                    item.appendChild(imgEl);
                    this.galleryEl.appendChild(item);
                });
            }

            this.el.classList.add('is-open');
            this.el.setAttribute('aria-hidden', 'false');
            document.body.style.overflow = 'hidden';
        },

        close() {
            if (!this.el) return;
            this.el.classList.remove('is-open');
            this.el.setAttribute('aria-hidden', 'true');
            document.body.style.overflow = '';
            this.el.scrollTop = 0;
        }
    };

    /* ------------------------------------------
       WORK ITEM CLICK → LIGHTBOX
       ------------------------------------------ */

    function initWorkClicks(portfolioData) {
        const workItems = $$('.work__item[data-index]');

        workItems.forEach(item => {
            item.addEventListener('click', () => {
                const index = parseInt(item.getAttribute('data-index'));
                if (portfolioData && portfolioData.portfolio) {
                    Lightbox.open(portfolioData.portfolio, index);
                }
            });
        });
    }

    /* ------------------------------------------
       PROJECT CLICK → PROJECT VIEW
       ------------------------------------------ */

    function initProjectClicks(projectData) {
        const projectEls = $$('[data-project]');

        projectEls.forEach(el => {
            const index = parseInt(el.getAttribute('data-project'));
            const link = el.querySelector('.project__link');

            if (link) {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    if (projectData && projectData.projects && projectData.projects[index]) {
                        ProjectView.open(projectData.projects[index], index);
                    }
                });
            }

            el.querySelector('.project__cover')?.addEventListener('click', () => {
                if (projectData && projectData.projects && projectData.projects[index]) {
                    ProjectView.open(projectData.projects[index], index);
                }
            });
        });
    }

    /* ------------------------------------------
       INIT
       ------------------------------------------ */

    window.initGallery = function (data) {
        DATA = data;

        Lightbox.init();
        Carousel.init();
        FullscreenGallery.init(data.gallery);
        ProjectView.init();

        initWorkClicks(data);
        initProjectClicks(data);
    };

})();
