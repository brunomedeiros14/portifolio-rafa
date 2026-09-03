import { $, isTouchDevice } from './utils';

export function initCursor(): void {
    if (isTouchDevice()) return;

    const cursor = $('#cursor');
    const cursorLabel = $('#cursor-label');

    if (!cursor) return;

    document.addEventListener(
        'mousemove',
        (e: MouseEvent) => {
            cursor.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
        },
        { passive: true },
    );

    document.addEventListener('mouseover', (e: MouseEvent) => {
        const target = (e.target as HTMLElement).closest('[data-cursor]');
        if (target) {
            const label = target.getAttribute('data-cursor');
            cursor.classList.add('is-hovering');
            if (cursorLabel && label) {
                cursorLabel.textContent = label;
            }
        }
    });

    document.addEventListener('mouseout', (e: MouseEvent) => {
        const target = (e.target as HTMLElement).closest('[data-cursor]');
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
