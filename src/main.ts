import './styles/style.css';

import { DATA } from './data';
import { initI18n } from './i18n';
import { initLoader } from './loader';
import { initNav } from './nav';
import { initCursor } from './cursor';
import { initAnimations } from './animations';
import { initGallery } from './gallery';
import { initThreeScene } from './three-scene';

async function init(): Promise<void> {
    initCursor();
    initNav();
    initI18n();

    await initLoader();

    initAnimations();
    initGallery(DATA);
    initThreeScene(DATA);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => init());
} else {
    init();
}
