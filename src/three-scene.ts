import * as THREE from 'three';
import { prefersReducedMotion } from './utils';
import type { PortfolioData, GalleryImage } from './types';

const reducedMotion = prefersReducedMotion();
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent,
);

/* =============================================
   SHADERS
   ============================================= */

const galleryVertexShader = `
    varying vec2 vUv;
    void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

const galleryFragmentShader = `
    varying vec2 vUv;
    uniform sampler2D uTextureA;
    uniform sampler2D uTextureB;
    uniform float uProgress;
    uniform float uDirection;

    void main() {
        vec2 uv = vUv;

        float dist = distance(uv, vec2(0.5));
        float wave = sin(dist * 12.0 - uProgress * 6.28) * 0.02 * uProgress * (1.0 - uProgress);

        vec2 uvA = uv + wave * uDirection;
        vec2 uvB = uv - wave * uDirection;

        vec4 colorA = texture2D(uTextureA, uvA);
        vec4 colorB = texture2D(uTextureB, uvB);

        float alpha = smoothstep(0.0, 1.0, uProgress);
        gl_FragColor = mix(colorA, colorB, alpha);
    }
`;

/* =============================================
   GALLERY TRANSITION SCENE
   ============================================= */

const GalleryScene = {
    scene: null as THREE.Scene | null,
    camera: null as THREE.OrthographicCamera | null,
    renderer: null as THREE.WebGLRenderer | null,
    material: null as THREE.ShaderMaterial | null,
    mesh: null as THREE.Mesh | null,
    textureA: null as THREE.Texture | null,
    textureB: null as THREE.Texture | null,
    isAnimating: false,
    animFrameId: 0,

    init(canvas: HTMLCanvasElement): boolean {
        if (reducedMotion || isMobile) return false;

        try {
            this.scene = new THREE.Scene();
            this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
            this.renderer = new THREE.WebGLRenderer({
                canvas,
                alpha: false,
                antialias: false,
                powerPreference: 'low-power',
            });

            const rect = canvas.parentElement!.getBoundingClientRect();
            this.renderer.setSize(rect.width, rect.height);
            this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            this.renderer.setClearColor(0x0a0a0a, 1);

            this.material = new THREE.ShaderMaterial({
                vertexShader: galleryVertexShader,
                fragmentShader: galleryFragmentShader,
                uniforms: {
                    uTextureA: { value: null },
                    uTextureB: { value: null },
                    uProgress: { value: 0 },
                    uDirection: { value: 1.0 },
                },
            });

            const geometry = new THREE.PlaneGeometry(2, 2);
            this.mesh = new THREE.Mesh(geometry, this.material);
            this.scene.add(this.mesh);

            window.addEventListener('resize', () => {
                if (!this.renderer || !canvas.parentElement) return;
                const r = canvas.parentElement.getBoundingClientRect();
                this.renderer.setSize(r.width, r.height);
            });

            return true;
        } catch (e) {
            console.warn('WebGL gallery initialization failed:', e);
            return false;
        }
    },

    transition(imageUrlA: string, imageUrlB: string, direction: number, onComplete?: () => void): void {
        if (!this.renderer || this.isAnimating) {
            onComplete?.();
            return;
        }

        this.isAnimating = true;
        const loader = new THREE.TextureLoader();
        (loader as any).crossOrigin = 'anonymous';

        const onLoad = (): void => {
            if (!this.renderer) {
                this.isAnimating = false;
                onComplete?.();
                return;
            }

            this.material!.uniforms.uTextureA.value = this.textureA;
            this.material!.uniforms.uTextureB.value = this.textureB;
            this.material!.uniforms.uDirection.value = direction || 1.0;

            let progress = 0;
            const duration = 800;
            const startTime = performance.now();

            const animateTransition = (now: number): void => {
                if (!this.renderer) {
                    this.isAnimating = false;
                    onComplete?.();
                    return;
                }

                const elapsed = now - startTime;
                progress = Math.min(elapsed / duration, 1);
                const eased =
                    progress < 0.5
                        ? 4 * progress * progress * progress
                        : 1 - Math.pow(-2 * progress + 2, 3) / 2;

                this.material!.uniforms.uProgress.value = eased;
                this.renderer.render(this.scene!, this.camera!);

                if (progress < 1) {
                    requestAnimationFrame(animateTransition);
                } else {
                    this.isAnimating = false;
                    this.textureA?.dispose();
                    this.textureB?.dispose();
                    onComplete?.();
                }
            };

            requestAnimationFrame(animateTransition);
        };

        this.textureA?.dispose();
        this.textureB?.dispose();

        let loaded = 0;
        const checkLoad = (): void => {
            loaded++;
            if (loaded === 2) onLoad();
        };

        this.textureA = loader.load(imageUrlA, checkLoad, undefined, () => checkLoad());
        this.textureB = loader.load(imageUrlB, checkLoad, undefined, () => checkLoad());
        if (this.textureA) this.textureA.minFilter = THREE.LinearFilter;
        if (this.textureB) this.textureB.minFilter = THREE.LinearFilter;
    },
};

/* =============================================
   INIT
   ============================================= */

export function initThreeScene(data: PortfolioData): void {
    const galleryCanvas = document.getElementById('gallery-canvas') as HTMLCanvasElement | null;
    if (galleryCanvas) {
        const initialized = GalleryScene.init(galleryCanvas);
        if (initialized && data.gallery.length >= 2) {
            (window as any).galleryTransition = (newIndex: number, onComplete: () => void) => {
                const gallery: GalleryImage[] = data.gallery;
                const prevIndex = (newIndex - 1 + gallery.length) % gallery.length;
                GalleryScene.transition(gallery[prevIndex].src, gallery[newIndex].src, 1, onComplete);
            };
        }
    }
}

export function destroyThreeScene(): void {
    if (GalleryScene.renderer) {
        GalleryScene.renderer.dispose();
        GalleryScene.renderer = null;
    }
}
