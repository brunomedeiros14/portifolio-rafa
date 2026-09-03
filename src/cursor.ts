import { $, lerp, isTouchDevice } from './utils';

export function initCursor(): void {
    if (isTouchDevice()) return;

    const cursor = $('#cursor');
    const cursorLabel = $('#cursor-label');

    if (!cursor) return;

    let mouseX = 0;
    let mouseY = 0;
    let cursorX = 0;
    let cursorY = 0;

    document.addEventListener('mousemove', (e: MouseEvent) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
    });

    const el = cursor;

    function animate(): void {
        cursorX = lerp(cursorX, mouseX, 0.15);
        cursorY = lerp(cursorY, mouseY, 0.15);
        el.style.transform = `translate(${cursorX}px, ${cursorY}px)`;
        requestAnimationFrame(animate);
    }

    animate();

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
