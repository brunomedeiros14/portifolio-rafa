export function $<T extends HTMLElement = HTMLElement>(
    selector: string,
    parent: ParentNode = document,
): T | null {
    return parent.querySelector<T>(selector);
}

export function $$<T extends HTMLElement = HTMLElement>(
    selector: string,
    parent: ParentNode = document,
): T[] {
    return Array.from(parent.querySelectorAll<T>(selector));
}

export function lerp(start: number, end: number, factor: number): number {
    return start + (end - start) * factor;
}

export function isTouchDevice(): boolean {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

export function prefersReducedMotion(): boolean {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
