import { $ } from './utils';

export function initLoader(): Promise<void> {
    const loaderEl = $('#loader');
    const counterEl = $('#loader-counter');
    const barEl = $('#loader-bar');

    if (!loaderEl || !counterEl || !barEl) return Promise.resolve();

    const loader = loaderEl;
    const counter = counterEl;
    const bar = barEl;

    return new Promise<void>((resolve) => {
        let progress = 0;
        const target = 100;
        const duration = 1800;
        const startTime = performance.now();

        function update(now: number): void {
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
