/* ============================================
   THREE-SCENE.JS — WebGL hero displacement + gallery transitions
   ============================================ */

(function () {
    'use strict';

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    /* ------------------------------------------
       SHADERS
       ------------------------------------------ */

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

    /* ------------------------------------------
       HERO SCENE
       ------------------------------------------ */

    const HeroScene = {
        scene: null,
        camera: null,
        renderer: null,
        material: null,
        mesh: null,
        mouse: { x: 0.5, y: 0.5 },
        targetMouse: { x: 0.5, y: 0.5 },
        time: 0,
        isActive: false,
        animFrameId: null,
        texture: null,

        init(canvas, imageUrl) {
            if (typeof THREE === 'undefined' || reducedMotion || isMobile) return;

            try {
                this.scene = new THREE.Scene();
                this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
                this.renderer = new THREE.WebGLRenderer({
                    canvas: canvas,
                    alpha: true,
                    antialias: false,
                    powerPreference: 'low-power'
                });

                const rect = canvas.parentElement.getBoundingClientRect();
                this.renderer.setSize(rect.width, rect.height);
                this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

                const loader = new THREE.TextureLoader();
                loader.crossOrigin = 'anonymous';
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
                        uIntensity: { value: 0.0 }
                    },
                    transparent: true
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

        updatePlaneSize(canvas) {
            if (!canvas) return;
            const rect = canvas.parentElement.getBoundingClientRect();
            const imageAspect = this.texture.image ?
                this.texture.image.width / this.texture.image.height :
                rect.width / rect.height;
            const containerAspect = rect.width / rect.height;

            let scaleX = 2;
            let scaleY = 2;

            if (containerAspect > imageAspect) {
                scaleY = 2 * (containerAspect / imageAspect);
            } else {
                scaleX = 2 * (imageAspect / containerAspect);
            }

            if (this.mesh) {
                this.mesh.scale.set(scaleX, scaleY, 1);
            }
        },

        bindEvents(canvas) {
            const hero = canvas.closest('.hero');
            if (!hero) return;

            hero.addEventListener('mousemove', (e) => {
                const rect = hero.getBoundingClientRect();
                this.targetMouse.x = (e.clientX - rect.left) / rect.width;
                this.targetMouse.y = 1.0 - (e.clientY - rect.top) / rect.height;
            });

            window.addEventListener('resize', () => {
                if (!this.isActive) return;
                const rect = canvas.parentElement.getBoundingClientRect();
                this.renderer.setSize(rect.width, rect.height);
                this.updatePlaneSize(canvas);
            });
        },

        animate() {
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
                    this.material.uniforms.uIntensity.value = visible ?
                        THREE.MathUtils.lerp(this.material.uniforms.uIntensity.value, 1.0, 0.02) :
                        THREE.MathUtils.lerp(this.material.uniforms.uIntensity.value, 0.0, 0.05);
                }
            }

            this.renderer.render(this.scene, this.camera);
        },

        destroy() {
            this.isActive = false;
            if (this.animFrameId) {
                cancelAnimationFrame(this.animFrameId);
                this.animFrameId = null;
            }
            if (this.texture) {
                this.texture.dispose();
                this.texture = null;
            }
            if (this.material) {
                this.material.dispose();
                this.material = null;
            }
            if (this.mesh) {
                this.mesh.geometry.dispose();
                this.mesh = null;
            }
            if (this.renderer) {
                this.renderer.dispose();
                this.renderer = null;
            }
            this.scene = null;
            this.camera = null;
        }
    };

    /* ------------------------------------------
       GALLERY TRANSITION SCENE
       ------------------------------------------ */

    const GalleryScene = {
        scene: null,
        camera: null,
        renderer: null,
        material: null,
        mesh: null,
        textureA: null,
        textureB: null,
        isAnimating: false,
        animFrameId: null,

        init(canvas) {
            if (typeof THREE === 'undefined' || reducedMotion || isMobile) return false;

            try {
                this.scene = new THREE.Scene();
                this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
                this.renderer = new THREE.WebGLRenderer({
                    canvas: canvas,
                    alpha: false,
                    antialias: false,
                    powerPreference: 'low-power'
                });

                const rect = canvas.parentElement.getBoundingClientRect();
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
                        uDirection: { value: 1.0 }
                    }
                });

                const geometry = new THREE.PlaneGeometry(2, 2);
                this.mesh = new THREE.Mesh(geometry, this.material);
                this.scene.add(this.mesh);

                window.addEventListener('resize', () => {
                    if (!this.renderer) return;
                    const r = canvas.parentElement.getBoundingClientRect();
                    this.renderer.setSize(r.width, r.height);
                });

                return true;
            } catch (e) {
                console.warn('WebGL gallery initialization failed:', e);
                return false;
            }
        },

        transition(imageUrlA, imageUrlB, direction, onComplete) {
            if (!this.renderer || this.isAnimating) {
                if (onComplete) onComplete();
                return;
            }

            this.isAnimating = true;
            const loader = new THREE.TextureLoader();
            loader.crossOrigin = 'anonymous';

            const onLoad = () => {
                if (!this.renderer) {
                    this.isAnimating = false;
                    if (onComplete) onComplete();
                    return;
                }

                this.material.uniforms.uTextureA.value = this.textureA;
                this.material.uniforms.uTextureB.value = this.textureB;
                this.material.uniforms.uDirection.value = direction || 1.0;

                let progress = 0;
                const duration = 800;
                const startTime = performance.now();

                const animateTransition = (now) => {
                    if (!this.renderer) {
                        this.isAnimating = false;
                        if (onComplete) onComplete();
                        return;
                    }

                    const elapsed = now - startTime;
                    progress = Math.min(elapsed / duration, 1);
                    const eased = progress < 0.5
                        ? 4 * progress * progress * progress
                        : 1 - Math.pow(-2 * progress + 2, 3) / 2;

                    this.material.uniforms.uProgress.value = eased;
                    this.renderer.render(this.scene, this.camera);

                    if (progress < 1) {
                        requestAnimationFrame(animateTransition);
                    } else {
                        this.isAnimating = false;
                        if (this.textureA) this.textureA.dispose();
                        if (this.textureB) this.textureB.dispose();
                        if (onComplete) onComplete();
                    }
                };

                requestAnimationFrame(animateTransition);
            };

            if (this.textureA) this.textureA.dispose();
            if (this.textureB) this.textureB.dispose();

            let loaded = 0;
            const checkLoad = () => {
                loaded++;
                if (loaded === 2) onLoad();
            };

            this.textureA = loader.load(imageUrlA, checkLoad, undefined, () => {
                checkLoad();
            });
            this.textureB = loader.load(imageUrlB, checkLoad, undefined, () => {
                checkLoad();
            });
            this.textureA.minFilter = THREE.LinearFilter;
            this.textureB.minFilter = THREE.LinearFilter;
        }
    };

    /* ------------------------------------------
       INIT
       ------------------------------------------ */

    window.initThreeScene = function (data) {
        if (typeof THREE === 'undefined') {
            console.warn('Three.js not loaded. WebGL features disabled.');
            return;
        }

        const heroCanvas = document.getElementById('hero-canvas');
        if (heroCanvas && data.portfolio && data.portfolio[0]) {
            HeroScene.init(heroCanvas, data.portfolio[0].src);
        }

        const galleryCanvas = document.getElementById('gallery-canvas');
        if (galleryCanvas) {
            const initialized = GalleryScene.init(galleryCanvas);
            if (initialized && data.gallery && data.gallery.length >= 2) {
                window.galleryTransition = function (newIndex, onComplete) {
                    const gallery = data.gallery;
                    const prevIndex = (newIndex - 1 + gallery.length) % gallery.length;
                    const direction = 1;

                    GalleryScene.transition(
                        gallery[prevIndex].src,
                        gallery[newIndex].src,
                        direction,
                        onComplete
                    );
                };
            }
        }
    };

    window.destroyThreeScene = function () {
        HeroScene.destroy();
        if (GalleryScene.renderer) {
            GalleryScene.renderer.dispose();
            GalleryScene.renderer = null;
        }
    };

})();
