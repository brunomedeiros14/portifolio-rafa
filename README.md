# RAFA — Photography Portfolio

A premium, award-worthy photography portfolio website with WebGL effects, bilingual support, and cinematic scroll experiences.

## Technologies

- **Vite 8** — build tool and dev server
- **TypeScript** (strict) — all source in `src/`
- **Bun** — package manager and runtime
- **Three.js** (npm) — WebGL displacement + gallery transitions
- HTML5 semantic markup + CSS3 custom properties (design system)
- Google Fonts (Playfair Display + Space Grotesk + Inter)
- IntersectionObserver, requestAnimationFrame
- Responsive design, ARIA, keyboard nav, `prefers-reduced-motion`

## Structure

```
/
├── index.html               # Main page — all sections
├── vite.config.ts           # Vite config (Three.js chunk splitting, publicDir)
├── tsconfig.json            # Strict TypeScript config
├── package.json             # Scripts + deps
├── src/
│   ├── main.ts              # Entry point — wires all modules
│   ├── data.ts              # Portfolio/carousel/gallery/projects data
│   ├── types.ts             # All TypeScript interfaces
│   ├── i18n.ts              # Bilingual (EN/PT) translations + applyLang
│   ├── utils.ts             # DOM helpers + utilities
│   ├── loader.ts            # Loading screen
│   ├── nav.ts               # Navigation, mobile menu, smooth scroll
│   ├── cursor.ts            # Custom cursor
│   ├── animations.ts        # Scroll reveals, parallax, counters
│   ├── gallery.ts           # Lightbox, carousel, gallery, project view
│   ├── three-scene.ts       # WebGL hero displacement + gallery transitions
│   └── styles/style.css     # Design system + all styles
├── assets/
│   ├── images/              # Local full-size images
│   ├── thumbnails/          # Lazy-loaded thumbnails
│   └── textures/            # Displacement maps
└── README.md
```

## How to Run

Prerequisite: [Bun](https://bun.sh) installed.

```bash
bun install        # install dependencies
bun run dev        # start dev server (http://localhost:3000)
bun run build      # type-check + production build to dist/
bun run preview    # preview the production build
```

## How to Replace Images

All images are centralized in `src/data.ts` inside the `DATA` object:

```ts
const DATA = {
    portfolio: [
        {
            src: 'assets/images/your-image.jpg',   // Full-size
            thumb: 'assets/images/thumb-image.jpg',  // Thumbnail
            title: 'Your Image Title',
            category: 'Portrait',
            year: '2026'
        },
        // ... more images
    ],
    carousel: [ /* ... */ ],
    gallery: [ /* ... */ ],
    projects: [
        {
            title: 'PROJECT NAME',
            description: 'Project description.',
            year: '2026',
            location: 'City, Country',
            images: [
                { src: 'assets/images/project-01.jpg', layout: 'wide' },
                { src: 'assets/images/project-02.jpg', layout: 'full' },
                // layout options: 'wide', 'full', 'portrait', 'square'
            ]
        }
    ]
};
```

### Layout options for project images

- `wide` — Full width, 21:9 ratio
- `full` — Full width, 16:9 ratio
- `portrait` — Centered, 3:4 ratio, max 60% width
- `square` — Centered, 1:1 ratio, max 70% width

The same data (used by both the lightbox and HTML markup) lives in `src/data.ts` and is strongly typed via `src/types.ts`.

## How to Customize the Photographer

### Name

In `index.html`, find and replace:

```html
<span class="nav__logo-text">RAFA</span>
<span class="hero__title-line">RAFA</span>
<span class="footer__name">RAFA</span>
```

### Bio and Details

Edit the `#about` section in `index.html` (or its translations in `src/i18n.ts`).

### Contact Information

Edit the `#contact` section in `index.html`.

### SEO Meta Tags

Edit `<head>` in `index.html` (title, description, Open Graph, Twitter, JSON-LD).

## How to Add Projects

1. Add project data to `DATA.projects` in `src/data.ts`:

```ts
{
    title: 'NEW PROJECT',
    description: 'Description text.',
    year: '2026',
    location: 'City, Country',
    images: [
        { src: 'path/to/image.jpg', layout: 'wide' }
    ]
}
```

2. Add a corresponding `<article class="project">` block in `index.html`:

```html
<article class="project" data-project="3" data-reveal>
    <div class="project__header">
        <span class="project__number">04</span>
        <div class="project__meta">
            <h3 class="project__title">NEW PROJECT</h3>
            <p class="project__desc">Description text.</p>
            <div class="project__details">
                <span>2026</span>
                <span>City, Country</span>
            </div>
        </div>
        <a href="#" class="project__link" data-cursor="OPEN">VIEW PROJECT →</a>
    </div>
    <div class="project__cover">
        <img src="path/to/cover.jpg" alt="Cover" loading="lazy">
    </div>
</article>
```

3. Update `data-project="3"` to match the index in `DATA.projects`.

## How to Modify Colors

Edit CSS custom properties in `src/styles/style.css`:

```css
:root {
    --color-bg: #0a0a0a;              /* Background */
    --color-text: #f0ece4;            /* Primary text */
    --color-text-muted: #7a7a7a;      /* Muted text */
    --color-accent: #c8a97e;          /* Accent (links, highlights) */
    --color-border: rgba(240, 236, 228, 0.08);  /* Borders */
}
```

## How to Disable Three.js

### Disable hero displacement

In `src/three-scene.ts`, the hero automatically disables on mobile and when `prefers-reduced-motion` is active. To disable entirely, remove the hero init call.

### Disable gallery transitions

Remove the gallery init call in `src/three-scene.ts`. The gallery falls back to a simple CSS opacity transition.

## How to Change Languages

All bilingual content is in `src/i18n.ts` inside the `I18N` object. Edit or add languages:

```ts
const I18N = {
    en: { 'nav.work': 'WORK', /* ... */ },
    pt: { 'nav.work': 'PORTFÓLIO', /* ... */ },
    // Add more languages:
    es: { 'nav.work': 'PORTAFOLIO', /* ... */ }
};
```

## How to Deploy

Run `bun run build`, then deploy the `dist/` folder to any static host:

- **Netlify**: Drag and drop `dist/` (or build command `bun run build`)
- **Vercel**: Connect your Git repository
- **GitHub Pages**: Push `dist/` to a `gh-pages` branch
- **Cloudflare Pages**: Connect your repository

## Credits

- Fonts: Google Fonts (Playfair Display, Space Grotesk, Inter)
- Images: Unsplash (placeholder — replace with your own)
- WebGL: Three.js (npm)
