# RAFA — Photography Portfolio

A premium, award-worthy photography portfolio website with WebGL effects, bilingual support, and cinematic scroll experiences.

## Technologies

- HTML5 semantic markup
- CSS3 with custom properties (design system)
- JavaScript ES6+ (vanilla, no framework)
- Three.js (WebGL displacement + gallery transitions)
- Google Fonts (Playfair Display + Space Grotesk + Inter)
- IntersectionObserver
- Responsive Design
- Accessibility (ARIA, keyboard nav, reduced-motion)

## Structure

```
/
├── index.html              # Main page — all sections
├── css/
│   └── style.css           # Design system + all styles
├── js/
│   ├── main.js             # Data, init, navigation, cursor, i18n, loading
│   ├── animations.js       # Scroll reveals, parallax, counters
│   ├── gallery.js          # Lightbox, carousel, fullscreen gallery, project view
│   └── three-scene.js      # WebGL hero displacement + gallery transitions
├── assets/
│   ├── images/             # Place for local full-size images
│   ├── thumbnails/         # Place for lazy-loaded thumbnails
│   └── textures/           # Place for displacement maps
└── README.md
```

## How to Run

### Option 1 — Direct file open

Double-click `index.html`. All CDN resources (fonts, Three.js) load from the web.

### Option 2 — Local server (recommended)

```bash
# Python
python3 -m http.server 8000

# Node.js
npx serve .

# PHP
php -S localhost:8000
```

Then open `http://localhost:8000`.

## How to Replace Images

All images are centralized in `js/main.js` inside the `DATA` object:

```javascript
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

## How to Customize the Photographer

### Name

In `index.html`, find and replace:

```html
<span class="nav__logo-text">RAFA</span>
<span class="hero__title-line">RAFA</span>
<span class="footer__name">RAFA</span>
```

### Bio and Details

Edit the `#about` section in `index.html`:

- Portrait image
- Name
- Role description
- Bio paragraphs
- Stats (years, projects, publications)

### Contact Information

Edit the `#contact` section in `index.html`:

- Email: `hello@rafaphoto.com`
- Instagram: `@rafaphoto`
- Location: `São Paulo, Brazil`

### SEO Meta Tags

Edit `<head>` in `index.html`:

```html
<title>YOUR NAME — Photography Portfolio</title>
<meta name="description" content="Your description here">
```

### Clients

Edit the `#clients` section in `index.html`. Example clients are clearly marked as demo.

## How to Add Projects

1. Add project data to `DATA.projects` in `js/main.js`:

```javascript
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

Edit CSS custom properties in `css/style.css`:

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

In `js/three-scene.js`, the hero automatically disables on mobile and when `prefers-reduced-motion` is active. To disable entirely:

```javascript
// In three-scene.js, comment out or remove the hero init:
// HeroScene.init(heroCanvas, data.portfolio[0].src);
```

### Disable gallery transitions

```javascript
// In three-scene.js, comment out the gallery init:
// GalleryScene.init(galleryCanvas);
```

The gallery falls back to a simple CSS opacity transition.

## How to Change Languages

All bilingual content is in `js/main.js` inside the `I18N` object. Edit or add languages:

```javascript
const I18N = {
    en: { 'nav.work': 'WORK', /* ... */ },
    pt: { 'nav.work': 'PORTFÓLIO', /* ... */ },
    // Add more languages:
    es: { 'nav.work': 'PORTAFOLIO', /* ... */ }
};
```

To add a language toggle button, add a new button in the nav and call `applyLang('es')`.

## How to Deploy

### Static hosting (recommended)

Upload all files to:

- **Netlify**: Drag and drop the folder
- **Vercel**: Connect your Git repository
- **GitHub Pages**: Push to a `gh-pages` branch
- **Cloudflare Pages**: Connect your repository

### Important notes

- Ensure all image paths are correct (relative or absolute)
- Test on mobile devices
- Verify Three.js loads (check console for errors)
- Set proper meta tags for social sharing

## Performance Checklist

- [x] Lazy loading on all images below the fold
- [x] Responsive images with appropriate sizing
- [x] `loading="lazy"` attribute on images
- [x] IntersectionObserver for scroll animations
- [x] `requestAnimationFrame` for smooth animations
- [x] WebGL disabled on mobile and low-power devices
- [x] `prefers-reduced-motion` support
- [x] Proper `will-change` hints
- [x] No forced reflow in animation loops
- [x] Three.js cleanup when not in use

## Accessibility Checklist

- [x] Semantic HTML5 elements
- [x] ARIA labels on interactive elements
- [x] Keyboard navigation support
- [x] Focus visible indicators
- [x] `prefers-reduced-motion` respected
- [x] Alt text on all images
- [x] Lightbox keyboard support (Escape, arrows)
- [x] Mobile menu keyboard accessible
- [x] Custom cursor disabled on touch devices

## Browser Support

- Chrome 80+
- Firefox 78+
- Safari 14+
- Edge 80+
- iOS Safari 14+
- Chrome for Android 80+

## Credits

- Fonts: Google Fonts (Playfair Display, Space Grotesk, Inter)
- Images: Unsplash (placeholder — replace with your own)
- WebGL: Three.js r128
