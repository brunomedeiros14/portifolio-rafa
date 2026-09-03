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

const heroVertexShader = `
    varying vec2 vUv;
    uniform float uTime;
    uniform vec2 uMouse;
    uniform float uIntensity;

    void main() {
        vUv = uv;
        vec3 pos = position;

        float dist = distance(uv, uMouse);
        float wave = sin(dist * 8.0 - uTime * 1.5) * uIntensity;
        float falloff = smoothstep(0.5, 0.0, dist);
        pos.z += wave * falloff;

        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
`;

const heroFragmentShader = `
    varying vec2 vUv;
    uniform sampler2D uTexture;
    uniform float uTime;
    uniform vec2 uMouse;
    uniform float uIntensity;

    void main() {
        vec2 uv = vUv;

        float dist = distance(uv, uMouse);
        float wave = sin(dist * 10.0 - uTime * 2.0) * uIntensity * 0.01;
        float falloff = smoothstep(0.4, 0.0, dist);
        uv.x += wave * falloff;
        uv.y += wave * falloff * 0.5;

        vec4 color = texture2D(uTexture, uv);
        gl_FragColor = color;
    }
`;

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
   HERO SCENE
   ============================================= */

const HeroScene = {
    scene: null as THREE.Scene | null,
    camera: null as THREE.OrthographicCamera | null,
    renderer: null as THREE.WebGLRenderer | null,
    material: null as THREE.ShaderMaterial | null,
    mesh: null as THREE.Mesh | null,
    mouse: { x: 0.5, y: 0.5 },
    targetMouse: { x: 0.5, y: 0.5 },
    time: 0,
    isActive: false,
    animFrameId: 0,
    texture: null as THREE.Texture | null,

    init(canvas: HTMLCanvasElement, imageUrl: string): void {
        if (reducedMotion || isMobile) return;

        try {
            this.scene = new THREE.Scene();
            this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
            this.renderer = new THREE.WebGLRenderer({
                canvas,
                alpha: true,
                antialias: false,
                powerPreference: 'low-power',
            });

            const rect = canvas.parentElement!.getBoundingClientRect();
            this.renderer.setSize(rect.width, rect.height);
            this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

            const loader = new THREE.TextureLoader();
            (loader as any).crossOrigin = 'anonymous';
            this.texture = loader.load(imageUrl, (texture) => {
                texture.minFilter = THREE.LinearFilter;
                texture.magFilter = THREE.LinearFilter;
                this.updatePlaneSize(canvas);
            });

            this.material = new THREE.ShaderMaterial({
                vertexShader: heroVertexShader,
                fragmentShader: heroFragmentShader,
                uniforms: {
                    uTexture: { value: this.texture },
                    uTime: { value: 0 },
                    uMouse: { value: new THREE.Vector2(0.5, 0.5) },
                    uIntensity: { value: 0.0 },
                },
                transparent: true,
            });

            const geometry = new THREE.PlaneGeometry(2, 2, 64, 64);
            this.mesh = new THREE.Mesh(geometry, this.material);
            this.scene.add(this.mesh);

            this.bindEvents(canvas);
            this.isActive = true;
            this.animate();
        } catch (e) {
            console.warn('WebGL hero initialization failed:', e);
            this.isActive = false;
        }
    },

    updatePlaneSize(canvas: HTMLCanvasElement): void {
        if (!canvas.parentElement) return;
        const rect = canvas.parentElement.getBoundingClientRect();
        const imageAspect = this.texture?.image
            ? (this.texture.image as HTMLImageElement).width / (this.texture.image as HTMLImageElement).height
            : rect.width / rect.height;
        const containerAspect = rect.width / rect.height;

        let scaleX = 2;
        let scaleY = 2;

        if (containerAspect > imageAspect) {
            scaleY = 2 * (containerAspect / imageAspect);
        } else {
            scaleX = 2 * (imageAspect / containerAspect);
        }

        this.mesh?.scale.set(scaleX, scaleY, 1);
    },

    bindEvents(canvas: HTMLCanvasElement): void {
        const hero = canvas.closest<HTMLElement>('.hero');
        if (!hero) return;

        hero.addEventListener('mousemove', (e: MouseEvent) => {
            const rect = hero.getBoundingClientRect();
            this.targetMouse.x = (e.clientX - rect.left) / rect.width;
            this.targetMouse.y = 1.0 - (e.clientY - rect.top) / rect.height;
        });

        window.addEventListener('resize', () => {
            if (!this.isActive || !this.renderer || !canvas.parentElement) return;
            const rect = canvas.parentElement.getBoundingClientRect();
            this.renderer.setSize(rect.width, rect.height);
            this.updatePlaneSize(canvas);
        });
    },

    animate(): void {
        if (!this.isActive) return;

        this.animFrameId = requestAnimationFrame(() => this.animate());

        this.time += 0.016;
        this.mouse.x += (this.targetMouse.x - this.mouse.x) * 0.05;
        this.mouse.y += (this.targetMouse.y - this.mouse.y) * 0.05;

        if (this.material) {
            this.material.uniforms.uTime.value = this.time;
            this.material.uniforms.uMouse.value.set(this.mouse.x, this.mouse.y);

            const hero = document.querySelector('.hero');
            if (hero) {
                const rect = hero.getBoundingClientRect();
                const visible = rect.bottom > 0 && rect.top < window.innerHeight;
                this.material.uniforms.uIntensity.value = visible
                    ? THREE.MathUtils.lerp(this.material.uniforms.uIntensity.value, 1.0, 0.02)
                    : THREE.MathUtils.lerp(this.material.uniforms.uIntensity.value, 0.0, 0.05);
            }
        }

        this.renderer?.render(this.scene!, this.camera!);
    },

    destroy(): void {
        this.isActive = false;
        if (this.animFrameId) {
            cancelAnimationFrame(this.animFrameId);
            this.animFrameId = 0;
        }
        this.texture?.dispose();
        this.texture = null;
        this.material?.dispose();
        this.material = null;
        if (this.mesh) {
            (this.mesh.geometry as THREE.BufferGeometry).dispose();
            this.mesh = null;
        }
        this.renderer?.dispose();
        this.renderer = null;
        this.scene = null;
        this.camera = null;
    },
};

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
    const heroCanvas = document.getElementById('hero-canvas') as HTMLCanvasElement | null;
    if (heroCanvas && data.portfolio[0]) {
        HeroScene.init(heroCanvas, data.portfolio[0].src);
    }

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
    HeroScene.destroy();
    if (GalleryScene.renderer) {
        GalleryScene.renderer.dispose();
        GalleryScene.renderer = null;
    }
}
