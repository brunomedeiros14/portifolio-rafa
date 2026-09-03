import { $, $$ } from './utils';
import type { PortfolioData, PortfolioImage, GalleryImage, Project } from './types';

/* =============================================
   LIGHTBOX
   ============================================= */

class Lightbox {
    private el: HTMLElement | null = null;
    private imgEl: HTMLImageElement | null = null;
    private titleEl: HTMLElement | null = null;
    private catEl: HTMLElement | null = null;
    private counterEl: HTMLElement | null = null;
    private items: PortfolioImage[] = [];
    private currentIndex = 0;

    init(): void {
        this.el = $('#lightbox');
        if (!this.el) return;

        this.imgEl = $('#lightbox-img') as HTMLImageElement | null;
        this.titleEl = $('#lightbox-title');
        this.catEl = $('#lightbox-category');
        this.counterEl = $('#lightbox-counter');

        $('#lightbox-close')?.addEventListener('click', () => this.close());
        $('#lightbox-prev')?.addEventListener('click', () => this.prev());
        $('#lightbox-next')?.addEventListener('click', () => this.next());

        this.el.querySelector('.lightbox__backdrop')?.addEventListener('click', () => this.close());

        document.addEventListener('keydown', (e: KeyboardEvent) => {
            if (!this.el?.classList.contains('is-open')) return;
            if (e.key === 'Escape') this.close();
            if (e.key === 'ArrowLeft') this.prev();
            if (e.key === 'ArrowRight') this.next();
        });

        let touchStartX = 0;
        this.el.addEventListener('touchstart', (e: TouchEvent) => {
            touchStartX = e.touches[0].clientX;
        }, { passive: true });

        this.el.addEventListener('touchend', (e: TouchEvent) => {
            const diff = touchStartX - e.changedTouches[0].clientX;
            if (Math.abs(diff) > 50) {
                diff > 0 ? this.next() : this.prev();
            }
        }, { passive: true });
    }

    open(items: PortfolioImage[], index: number): void {
        if (!this.el) return;
        this.items = items;
        this.currentIndex = index;
        this.update();
        this.el.classList.add('is-open');
        this.el.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
    }

    close(): void {
        if (!this.el) return;
        this.el.classList.remove('is-open');
        this.el.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
    }

    prev(): void {
        if (this.items.length === 0) return;
        this.currentIndex = (this.currentIndex - 1 + this.items.length) % this.items.length;
        this.update();
    }

    next(): void {
        if (this.items.length === 0) return;
        this.currentIndex = (this.currentIndex + 1) % this.items.length;
        this.update();
    }

    private update(): void {
        const item = this.items[this.currentIndex];
        if (!item) return;

        if (this.imgEl) {
            this.imgEl.style.opacity = '0';
            this.imgEl.style.transform = 'scale(0.95)';
            setTimeout(() => {
                if (!this.imgEl) return;
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
}

/* =============================================
   HORIZONTAL CAROUSEL
   ============================================= */

class Carousel {
    private track: HTMLElement | null = null;
    private slides: HTMLElement[] = [];
    private counterEl: HTMLElement | null = null;
    private currentIndex = 0;
    private isDragging = false;

    init(): void {
        this.track = $('#carousel-track');
        if (!this.track) return;

        this.slides = $$('.carousel__slide', this.track);
        this.counterEl = $('#carousel-counter');

        $('#carousel-prev')?.addEventListener('click', () => this.navigate(-1));
        $('#carousel-next')?.addEventListener('click', () => this.navigate(1));

        this.initDrag();
        this.initWheel();
        this.initKeyboard();
        this.updateCounter();
    }

    navigate(direction: number): void {
        if (!this.track) return;

        const slideWidth = this.slides[0] ? this.slides[0].offsetWidth + 16 : 300;
        const maxScroll = this.track.scrollWidth - this.track.clientWidth;
        const currentScroll = this.track.scrollLeft;

        let newScroll = currentScroll + direction * slideWidth;
        newScroll = Math.max(0, Math.min(newScroll, maxScroll));

        this.track.scrollTo({ left: newScroll, behavior: 'smooth' });

        this.currentIndex = Math.round(newScroll / slideWidth);
        this.updateCounter();
    }

    private initDrag(): void {
        if (!this.track) return;
        let startX = 0;
        let startScrollLeft = 0;

        this.track.addEventListener('mousedown', (e: MouseEvent) => {
            this.isDragging = true;
            this.track?.classList.add('is-dragging');
            startX = e.pageX - (this.track?.offsetLeft ?? 0);
            startScrollLeft = this.track?.scrollLeft ?? 0;
        });

        this.track.addEventListener('mouseleave', () => {
            this.isDragging = false;
            this.track?.classList.remove('is-dragging');
        });

        this.track.addEventListener('mouseup', () => {
            this.isDragging = false;
            this.track?.classList.remove('is-dragging');
        });

        this.track.addEventListener('mousemove', (e: MouseEvent) => {
            if (!this.isDragging || !this.track) return;
            e.preventDefault();
            const x = e.pageX - this.track.offsetLeft;
            const walk = (x - startX) * 1.5;
            this.track.scrollLeft = startScrollLeft - walk;
            this.updateCounterFromScroll();
        });

        let touchStartX = 0;
        let touchStartScroll = 0;

        this.track.addEventListener('touchstart', (e: TouchEvent) => {
            touchStartX = e.touches[0].pageX;
            touchStartScroll = this.track?.scrollLeft ?? 0;
        }, { passive: true });

        this.track.addEventListener('touchmove', (e: TouchEvent) => {
            if (!this.track) return;
            const x = e.touches[0].pageX;
            const walk = (touchStartX - x) * 1.2;
            this.track.scrollLeft = touchStartScroll + walk;
            this.updateCounterFromScroll();
        }, { passive: true });
    }

    private initWheel(): void {
        this.track?.addEventListener('wheel', (e: WheelEvent) => {
            if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
            e.preventDefault();
            if (this.track) this.track.scrollLeft += e.deltaY;
            this.updateCounterFromScroll();
        }, { passive: false });
    }

    private initKeyboard(): void {
        const carousel = $('#carousel');
        if (!carousel) return;

        carousel.setAttribute('tabindex', '0');
        carousel.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key === 'ArrowLeft') this.navigate(-1);
            if (e.key === 'ArrowRight') this.navigate(1);
        });
    }

    private updateCounterFromScroll(): void {
        if (!this.track || !this.slides.length) return;
        const slideWidth = this.slides[0].offsetWidth + 16;
        this.currentIndex = Math.round(this.track.scrollLeft / slideWidth);
        this.updateCounter();
    }

    private updateCounter(): void {
        if (!this.counterEl) return;
        const num = String(Math.min(this.currentIndex + 1, this.slides.length)).padStart(2, '0');
        const total = String(this.slides.length).padStart(2, '0');
        this.counterEl.textContent = `${num} / ${total}`;
    }
}

/* =============================================
   FULLSCREEN GALLERY
   ============================================= */

class FullscreenGallery {
    private imgEl: HTMLImageElement | null = null;
    private titleEl: HTMLElement | null = null;
    private catEl: HTMLElement | null = null;
    private counterEl: HTMLElement | null = null;
    private currentIndex = 0;
    private images: GalleryImage[] = [];
    private isTransitioning = false;

    init(galleryData: GalleryImage[]): void {
        this.imgEl = $('#gallery-current-img') as HTMLImageElement | null;
        this.titleEl = $('#gallery-title');
        this.catEl = $('#gallery-cat');
        this.counterEl = $('#gallery-counter');

        if (!this.imgEl) return;

        this.images = galleryData || [];
        this.currentIndex = 0;

        $('#gallery-prev')?.addEventListener('click', () => this.prev());
        $('#gallery-next')?.addEventListener('click', () => this.next());

        const expandBtn = $('#gallery-expand');
        expandBtn?.addEventListener('click', () => this.toggleFullscreen());

        document.addEventListener('keydown', (e: KeyboardEvent) => {
            if (!this.isInView()) return;
            const lightbox = $('#lightbox');
            const projectView = $('#project-view');
            if (lightbox?.classList.contains('is-open')) return;
            if (projectView?.classList.contains('is-open')) return;

            if (e.key === 'ArrowLeft') this.prev();
            if (e.key === 'ArrowRight') this.next();
        });

        this.update();
    }

    private isInView(): boolean {
        const gallery = $('#fullscreen-gallery');
        if (!gallery) return false;
        const rect = gallery.getBoundingClientRect();
        return rect.top < window.innerHeight && rect.bottom > 0;
    }

    prev(): void {
        if (this.isTransitioning || this.images.length === 0) return;
        this.currentIndex = (this.currentIndex - 1 + this.images.length) % this.images.length;
        this.transition();
    }

    next(): void {
        if (this.isTransitioning || this.images.length === 0) return;
        this.currentIndex = (this.currentIndex + 1) % this.images.length;
        this.transition();
    }

    private transition(): void {
        this.isTransitioning = true;

        if (typeof (window as any).galleryTransition === 'function') {
            (window as any).galleryTransition(this.currentIndex, () => {
                this.update();
                this.isTransitioning = false;
            });
        } else {
            this.imgEl?.classList.add('is-transitioning');
            setTimeout(() => {
                this.update();
                this.imgEl?.classList.remove('is-transitioning');
                this.isTransitioning = false;
            }, 400);
        }
    }

    private update(): void {
        const item = this.images[this.currentIndex];
        if (!item) return;

        if (this.imgEl) {
            this.imgEl.src = item.src;
            this.imgEl.alt = item.title || '';
        }

        if (this.titleEl) this.titleEl.textContent = item.title || '';
        if (this.catEl) this.catEl.textContent = item.category || '';
        if (this.counterEl) {
            const num = String(this.currentIndex + 1).padStart(2, '0');
            const total = String(this.images.length).padStart(2, '0');
            this.counterEl.textContent = `${num} / ${total}`;
        }
    }

    private toggleFullscreen(): void {
        const gallery = $('#fullscreen-gallery');
        if (!gallery) return;

        if (document.fullscreenElement) {
            document.exitFullscreen();
        } else {
            gallery.requestFullscreen().catch(() => {});
        }
    }
}

/* =============================================
   PROJECT VIEW
   ============================================= */

class ProjectView {
    private el: HTMLElement | null = null;
    private titleEl: HTMLElement | null = null;
    private numberEl: HTMLElement | null = null;
    private galleryEl: HTMLElement | null = null;

    init(): void {
        this.el = $('#project-view');
        if (!this.el) return;

        this.titleEl = $('#project-view-title');
        this.numberEl = $('#project-view-number');
        this.galleryEl = $('#project-view-gallery');

        $('#project-close')?.addEventListener('click', () => this.close());
        this.el.querySelector('.project-view__backdrop')?.addEventListener('click', () => this.close());

        document.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key === 'Escape' && this.el?.classList.contains('is-open')) {
                this.close();
            }
        });
    }

    open(project: Project, index: number): void {
        if (!this.el || !project) return;

        if (this.titleEl) this.titleEl.textContent = project.title;
        if (this.numberEl) this.numberEl.textContent = String(index + 1).padStart(2, '0');

        if (this.galleryEl) {
            this.galleryEl.innerHTML = '';
            project.images.forEach((img) => {
                const item = document.createElement('div');
                item.className = `project-view__gallery-item project-view__gallery-item--${img.layout || 'full'}`;

                const imgEl = document.createElement('img');
                imgEl.src = img.src;
                imgEl.alt = `${project.title} — image`;
                imgEl.loading = 'lazy';

                item.appendChild(imgEl);
                this.galleryEl!.appendChild(item);
            });
        }

        this.el.classList.add('is-open');
        this.el.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
    }

    close(): void {
        if (!this.el) return;
        this.el.classList.remove('is-open');
        this.el.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
        this.el.scrollTop = 0;
    }
}

/* =============================================
   CLICK HANDLERS
   ============================================= */

const lightbox = new Lightbox();
const carousel = new Carousel();
const fullscreenGallery = new FullscreenGallery();
const projectView = new ProjectView();

function initWorkClicks(data: PortfolioData): void {
    $$('.work__item[data-index]').forEach((item) => {
        item.addEventListener('click', () => {
            const index = parseInt(item.getAttribute('data-index') ?? '0', 10);
            lightbox.open(data.portfolio, index);
        });
    });
}

function initProjectClicks(data: PortfolioData): void {
    $$('[data-project]').forEach((el) => {
        const index = parseInt(el.getAttribute('data-project') ?? '0', 10);
        const link = el.querySelector<HTMLElement>('.project__link');

        link?.addEventListener('click', (e: Event) => {
            e.preventDefault();
            if (data.projects[index]) {
                projectView.open(data.projects[index], index);
            }
        });

        el.querySelector<HTMLElement>('.project__cover')?.addEventListener('click', () => {
            if (data.projects[index]) {
                projectView.open(data.projects[index], index);
            }
        });
    });
}

/* =============================================
   INIT
   ============================================= */

export function initGallery(data: PortfolioData): void {
    lightbox.init();
    carousel.init();
    fullscreenGallery.init(data.gallery);
    projectView.init();

    initWorkClicks(data);
    initProjectClicks(data);
}
