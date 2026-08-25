/**
 * WeatherAtmosphere - Dynamic iOS-style Atmospheric Weather Animations Engine
 * Rendered inside section#heroWeatherCard with 60fps canvas simulation
 * Full dual-theme support (Dark Mode & Light Mode)
 * Supports: Sun with volumetric rays & solar dust, Starry Night with Moon & shooting stars,
 *           realistic layered drifting clouds, rain with splashes, thunderstorm with branching lightning,
 *           snow flurries, and atmospheric mist/fog.
 */

(function () {
    class WeatherAtmosphereEngine {
        constructor() {
            this.card = null;
            this.container = null;
            this.canvas = null;
            this.ctx = null;
            this.width = 0;
            this.height = 0;
            this.dpr = 1;
            this.animationFrameId = null;
            this.lastTime = 0;
            this.isRunning = false;
            this.resizeObserver = null;
            this.themeObserver = null;

            // Current weather state
            this.condition = 'clear_day'; // clear_day, clear_night, partly_cloudy_day, partly_cloudy_night, cloudy, drizzle, rain, heavy_rain, thunderstorm, snow, fog
            this.isDay = true;

            // Particle systems & objects
            this.particles = [];
            this.splashes = [];
            this.stars = [];
            this.clouds = [];
            this.shootingStars = [];
            this.fogBands = [];

            // Lightning system
            this.lightningActive = false;
            this.lightningTimer = 0;
            this.lightningNextTime = 4000 + Math.random() * 5000;
            this.lightningIntensity = 0;
            this.lightningBolts = [];

            // Sun & Moon
            this.sunRotation = 0;
            this.sunPulse = 0;

            // DOM elements
            this.sunFlareEl = null;
            this.lightningEl = null;
            this.mistEl = null;

            this.init();
        }

        init() {
            this.card = document.getElementById('heroWeatherCard');
            this.container = document.getElementById('weatherAtmosphere');
            this.canvas = document.getElementById('weatherCanvas');
            this.sunFlareEl = document.getElementById('skySunFlare');
            this.lightningEl = document.getElementById('skyLightningFlash');
            this.mistEl = document.getElementById('skyMistOverlay');

            if (!this.canvas) return;

            this.ctx = this.canvas.getContext('2d', { alpha: true });

            // Sizing observer on heroWeatherCard
            if (this.card && window.ResizeObserver) {
                this.resizeObserver = new ResizeObserver(() => {
                    this.resize();
                });
                this.resizeObserver.observe(this.card);
            }

            // Window resize fallback
            window.addEventListener('resize', () => this.resize());

            // Theme switch observer (Dark <-> Light Mode dynamic adaptation)
            this.themeObserver = new MutationObserver((mutations) => {
                for (const mutation of mutations) {
                    if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
                        this.rebuildEntities();
                    }
                }
            });
            this.themeObserver.observe(document.documentElement, {
                attributes: true,
                attributeFilter: ['data-theme']
            });

            document.addEventListener('visibilitychange', () => {
                if (document.hidden) {
                    this.stop();
                } else {
                    this.start();
                }
            });

            // Initial sizing
            this.resize();

            // Set initial daytime condition
            const hour = new Date().getHours();
            const initialIsDay = hour >= 6 && hour < 18;
            this.setWeather(initialIsDay ? 'clear' : 'clear', initialIsDay ? 1 : 0);

            this.start();
        }

        resize() {
            if (!this.canvas) return;
            this.dpr = Math.min(window.devicePixelRatio || 1, 2);

            const target = this.card || this.container || this.canvas.parentElement;
            if (target) {
                const rect = target.getBoundingClientRect();
                this.width = Math.max(Math.round(rect.width), 320);
                this.height = Math.max(Math.round(rect.height), 220);
            } else {
                this.width = 600;
                this.height = 320;
            }

            this.canvas.width = Math.floor(this.width * this.dpr);
            this.canvas.height = Math.floor(this.height * this.dpr);
            this.canvas.style.width = '100%';
            this.canvas.style.height = '100%';

            if (this.ctx) {
                this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
            }

            this.rebuildEntities();
        }

        setWeather(categoryOrCode, isDay = 1) {
            this.isDay = Boolean(isDay);
            let normalized = 'clear_day';

            const cat = typeof categoryOrCode === 'string' ? categoryOrCode.toLowerCase() : '';
            const code = typeof categoryOrCode === 'number' ? categoryOrCode : null;

            if (cat.includes('thunder') || code === 95 || code === 96 || code === 99) {
                normalized = 'thunderstorm';
            } else if (cat.includes('heavy') || code === 65 || code === 82) {
                normalized = 'heavy_rain';
            } else if (cat.includes('rain') || cat.includes('shower') || (code >= 60 && code <= 67) || (code >= 80 && code <= 82)) {
                normalized = 'rain';
            } else if (cat.includes('drizzle') || (code >= 51 && code <= 57)) {
                normalized = 'drizzle';
            } else if (cat.includes('snow') || (code >= 71 && code <= 77) || code === 85 || code === 86) {
                normalized = 'snow';
            } else if (cat.includes('fog') || code === 45 || code === 48) {
                normalized = 'fog';
            } else if (cat.includes('cloudy') || cat.includes('encoberto') || code === 3) {
                normalized = 'cloudy';
            } else if (cat.includes('partly') || cat.includes('mostly') || code === 1 || code === 2) {
                normalized = this.isDay ? 'partly_cloudy_day' : 'partly_cloudy_night';
            } else {
                normalized = this.isDay ? 'clear_day' : 'clear_night';
            }

            this.condition = normalized;
            if (this.container) {
                this.container.setAttribute('data-condition', normalized);
                this.container.setAttribute('data-daytime', this.isDay ? 'day' : 'night');
            }
            if (this.card) {
                this.card.setAttribute('data-weather-condition', normalized);
            }

            this.resize();
            this.rebuildEntities();
        }

        rebuildEntities() {
            this.particles = [];
            this.splashes = [];
            this.stars = [];
            this.clouds = [];
            this.shootingStars = [];
            this.fogBands = [];
            this.lightningBolts = [];
            this.lightningActive = false;

            const w = this.width || 600;
            const h = this.height || 320;
            const isLight = document.documentElement.getAttribute('data-theme') === 'light';

            // 1. Stars (Night states)
            if (!this.isDay || this.condition === 'clear_night' || this.condition === 'partly_cloudy_night') {
                const starCount = this.condition === 'clear_night' ? 75 : 40;
                for (let i = 0; i < starCount; i++) {
                    this.stars.push({
                        x: Math.random() * w,
                        y: Math.random() * (h * 0.8),
                        size: Math.random() * 1.6 + 0.6,
                        alpha: Math.random() * 0.8 + 0.2,
                        baseAlpha: Math.random() * 0.7 + 0.3,
                        twinkleSpeed: 0.02 + Math.random() * 0.05,
                        phase: Math.random() * Math.PI * 2,
                        color: Math.random() > 0.3 ? '#ffffff' : (Math.random() > 0.5 ? '#bfe3ff' : '#ffe8b5')
                    });
                }
            }

            // 2. Sun Dust / Sparkles (Day clear)
            if (this.isDay && (this.condition === 'clear_day' || this.condition === 'partly_cloudy_day')) {
                const sparkleCount = this.condition === 'clear_day' ? 22 : 12;
                for (let i = 0; i < sparkleCount; i++) {
                    this.particles.push({
                        type: 'sun_dust',
                        x: Math.random() * w,
                        y: Math.random() * h,
                        radius: Math.random() * 2.5 + 1,
                        alpha: Math.random() * 0.5 + 0.2,
                        baseAlpha: Math.random() * 0.5 + 0.2,
                        vx: (Math.random() - 0.4) * 0.25,
                        vy: -0.15 - Math.random() * 0.3,
                        pulse: Math.random() * Math.PI * 2,
                        pulseSpeed: 0.02 + Math.random() * 0.03
                    });
                }
            }

            // 3. Clouds (Partly cloudy, cloudy, thunderstorm, fog)
            if (this.condition.includes('cloud') || this.condition === 'thunderstorm' || this.condition === 'fog') {
                const isDense = this.condition === 'cloudy' || this.condition === 'thunderstorm';
                const cloudCount = isDense ? 5 : 3;

                for (let i = 0; i < cloudCount; i++) {
                    const layer = i % 2; // 0 = bg, 1 = fg
                    const speed = layer === 0 ? 0.08 : 0.16;
                    const scale = layer === 0 ? 0.85 : 1.15;
                    const baseOpacity = isDense 
                        ? (layer === 0 ? (isLight ? 0.35 : 0.45) : (isLight ? 0.55 : 0.65)) 
                        : (layer === 0 ? 0.22 : 0.35);

                    this.clouds.push({
                        x: (i * (w / cloudCount)) + (Math.random() * 60 - 30),
                        y: 15 + (i * 30) + Math.random() * 20,
                        width: (260 + Math.random() * 120) * scale,
                        height: (90 + Math.random() * 45) * scale,
                        speed: speed,
                        opacity: baseOpacity,
                        layer: layer,
                        puffs: this.generateCloudPuffs(260 * scale, 90 * scale)
                    });
                }
            }

            // 4. Rain Particles
            if (this.condition === 'drizzle' || this.condition === 'rain' || this.condition === 'heavy_rain' || this.condition === 'thunderstorm') {
                let rainCount = 65;
                let baseSpeed = 14;
                let baseLen = 14;

                if (this.condition === 'drizzle') {
                    rainCount = 45;
                    baseSpeed = 9;
                    baseLen = 9;
                } else if (this.condition === 'heavy_rain' || this.condition === 'thunderstorm') {
                    rainCount = 110;
                    baseSpeed = 22;
                    baseLen = 22;
                } else {
                    rainCount = 75;
                    baseSpeed = 15;
                    baseLen = 15;
                }

                for (let i = 0; i < rainCount; i++) {
                    this.particles.push({
                        type: 'rain',
                        x: Math.random() * (w + 60) - 30,
                        y: Math.random() * h,
                        length: baseLen + Math.random() * 8,
                        speed: baseSpeed + Math.random() * 6,
                        wind: -1.8 - Math.random() * 1.2,
                        alpha: 0.3 + Math.random() * 0.45,
                        thickness: this.condition === 'drizzle' ? 0.8 : (this.condition === 'thunderstorm' ? 1.6 : 1.1)
                    });
                }
            }

            // 5. Snow Particles
            if (this.condition === 'snow') {
                const snowCount = 60;
                for (let i = 0; i < snowCount; i++) {
                    this.particles.push({
                        type: 'snow',
                        x: Math.random() * w,
                        y: Math.random() * h,
                        radius: Math.random() * 2.8 + 1,
                        speedY: Math.random() * 0.9 + 0.4,
                        speedX: Math.random() * 0.5 - 0.25,
                        angle: Math.random() * Math.PI * 2,
                        angleSpeed: 0.02 + Math.random() * 0.03,
                        alpha: Math.random() * 0.6 + 0.3
                    });
                }
            }

            // 6. Fog Bands
            if (this.condition === 'fog') {
                const bandCount = 4;
                for (let i = 0; i < bandCount; i++) {
                    this.fogBands.push({
                        x: Math.random() * w,
                        y: h * 0.25 + (i * (h * 0.18)),
                        width: w * 1.5,
                        height: 90 + Math.random() * 60,
                        speed: 0.12 + (i * 0.06),
                        alpha: 0.18 + Math.random() * 0.18,
                        pulse: Math.random() * Math.PI * 2
                    });
                }
            }
        }

        generateCloudPuffs(width, height) {
            const puffs = [];
            const count = 6;
            for (let i = 0; i < count; i++) {
                puffs.push({
                    rx: (i / (count - 1) - 0.5) * (width * 0.75),
                    ry: (Math.sin(i * 0.9) * -0.2) * height,
                    radius: (height * 0.45) + Math.random() * (height * 0.28)
                });
            }
            return puffs;
        }

        start() {
            if (this.isRunning) return;
            this.isRunning = true;
            this.lastTime = performance.now();
            this.loop(this.lastTime);
        }

        stop() {
            this.isRunning = false;
            if (this.animationFrameId) {
                cancelAnimationFrame(this.animationFrameId);
                this.animationFrameId = null;
            }
        }

        loop(currentTime) {
            if (!this.isRunning) return;

            const delta = Math.min((currentTime - this.lastTime) / 1000, 0.1);
            this.lastTime = currentTime;

            this.update(delta);
            this.render();

            this.animationFrameId = requestAnimationFrame((t) => this.loop(t));
        }

        update(delta) {
            const w = this.width;
            const h = this.height;

            // 1. Sun Rotation & Pulse
            this.sunRotation += delta * 0.04;
            this.sunPulse = Math.sin(performance.now() * 0.0015) * 0.06 + 1;

            // 2. Stars & Shooting stars
            if (this.stars.length > 0) {
                for (const star of this.stars) {
                    star.phase += star.twinkleSpeed;
                    star.alpha = star.baseAlpha * (0.5 + 0.5 * Math.sin(star.phase));
                }

                if (Math.random() < 0.003 && this.shootingStars.length < 1 && this.condition === 'clear_night') {
                    this.shootingStars.push({
                        x: Math.random() * (w * 0.7),
                        y: Math.random() * (h * 0.35),
                        length: 60 + Math.random() * 40,
                        speed: 550 + Math.random() * 200,
                        angle: Math.PI / 4 + (Math.random() * 0.2 - 0.1),
                        alpha: 1.0,
                        life: 0.5
                    });
                }

                for (let i = this.shootingStars.length - 1; i >= 0; i--) {
                    const ss = this.shootingStars[i];
                    ss.x += Math.cos(ss.angle) * ss.speed * delta;
                    ss.y += Math.sin(ss.angle) * ss.speed * delta;
                    ss.life -= delta;
                    ss.alpha = Math.max(0, ss.life / 0.5);
                    if (ss.life <= 0 || ss.x > w || ss.y > h) {
                        this.shootingStars.splice(i, 1);
                    }
                }
            }

            // 3. Clouds Drift
            for (const cloud of this.clouds) {
                cloud.x += cloud.speed * 60 * delta;
                if (cloud.x - cloud.width > w) {
                    cloud.x = -cloud.width - 20;
                }
            }

            // 4. Fog Drift
            for (const fog of this.fogBands) {
                fog.x += fog.speed * 60 * delta;
                fog.pulse += delta * 0.5;
                if (fog.x - fog.width > w) {
                    fog.x = -fog.width;
                }
            }

            // 5. Particles (Rain, Snow, Dust)
            for (const p of this.particles) {
                if (p.type === 'rain') {
                    p.x += p.wind * 60 * delta;
                    p.y += p.speed * 60 * delta;

                    if (p.y > h - 8) {
                        if (Math.random() < 0.3 && this.splashes.length < 25) {
                            this.splashes.push({
                                x: p.x,
                                y: h - 6 + (Math.random() * 6 - 3),
                                radius: 1.5,
                                maxRadius: 6 + Math.random() * 4,
                                alpha: p.alpha * 0.6,
                                life: 0.2
                            });
                        }
                        p.y = -p.length - Math.random() * 30;
                        p.x = Math.random() * (w + 60) - 30;
                    }
                } else if (p.type === 'snow') {
                    p.angle += p.angleSpeed;
                    p.x += (p.speedX + Math.sin(p.angle) * 0.6) * 60 * delta;
                    p.y += p.speedY * 60 * delta;

                    if (p.y > h + 10) {
                        p.y = -10;
                        p.x = Math.random() * w;
                    }
                    if (p.x > w + 10) p.x = -10;
                    if (p.x < -10) p.x = w + 10;
                } else if (p.type === 'sun_dust') {
                    p.pulse += p.pulseSpeed;
                    p.alpha = p.baseAlpha * (0.6 + 0.4 * Math.sin(p.pulse));
                    p.x += p.vx * 60 * delta;
                    p.y += p.vy * 60 * delta;

                    if (p.y < -10) {
                        p.y = h + 10;
                        p.x = Math.random() * w;
                    }
                    if (p.x < -10) p.x = w + 10;
                    if (p.x > w + 10) p.x = -10;
                }
            }

            // 6. Splashes
            for (let i = this.splashes.length - 1; i >= 0; i--) {
                const s = this.splashes[i];
                s.life -= delta;
                s.radius += (s.maxRadius - s.radius) * 9 * delta;
                s.alpha = Math.max(0, s.life / 0.2) * 0.4;
                if (s.life <= 0) {
                    this.splashes.splice(i, 1);
                }
            }

            // 7. Thunderstorm Lightning
            if (this.condition === 'thunderstorm') {
                this.lightningTimer += delta * 1000;
                if (this.lightningTimer >= this.lightningNextTime) {
                    this.triggerLightning();
                    this.lightningTimer = 0;
                    this.lightningNextTime = 4000 + Math.random() * 7000;
                }

                if (this.lightningActive) {
                    this.lightningIntensity -= delta * 3.8;
                    if (this.lightningIntensity <= 0) {
                        this.lightningIntensity = 0;
                        this.lightningActive = false;
                        this.lightningBolts = [];
                    }
                }
            }
        }

        triggerLightning() {
            this.lightningActive = true;
            this.lightningIntensity = 0.95 + Math.random() * 0.05;

            const startX = this.width * (0.3 + Math.random() * 0.4);
            const startY = 10;
            this.lightningBolts = this.generateLightningBolt(startX, startY, this.height * 0.75);

            if (this.lightningEl) {
                this.lightningEl.classList.remove('active');
                void this.lightningEl.offsetWidth;
                this.lightningEl.classList.add('active');
                setTimeout(() => {
                    if (this.lightningEl) this.lightningEl.classList.remove('active');
                }, 450);
            }
        }

        generateLightningBolt(startX, startY, maxDepth) {
            const segments = [];
            let currentX = startX;
            let currentY = startY;

            while (currentY < maxDepth) {
                const nextX = currentX + (Math.random() * 30 - 15);
                const nextY = currentY + (Math.random() * 20 + 12);
                segments.push({ x1: currentX, y1: currentY, x2: nextX, y2: nextY });

                if (Math.random() < 0.22) {
                    let branchX = nextX;
                    let branchY = nextY;
                    for (let b = 0; b < 2; b++) {
                        const bx = branchX + (Math.random() * 24 - 12);
                        const by = branchY + (Math.random() * 16 + 8);
                        segments.push({ x1: branchX, y1: branchY, x2: bx, y2: by, isBranch: true });
                        branchX = bx;
                        branchY = by;
                    }
                }

                currentX = nextX;
                currentY = nextY;
            }

            return segments;
        }

        render() {
            if (!this.ctx) return;
            const ctx = this.ctx;
            const w = this.width;
            const h = this.height;

            ctx.clearRect(0, 0, w, h);

            // 1. Sky Gradient (Background)
            this.renderSkyGradient(ctx, w, h);

            // 2. Sun / Moon
            if (this.isDay) {
                if (this.condition === 'clear_day' || this.condition === 'partly_cloudy_day') {
                    this.renderSun(ctx, w, h);
                }
            } else {
                if (this.condition === 'clear_night' || this.condition === 'partly_cloudy_night') {
                    this.renderMoon(ctx, w, h);
                }
            }

            // 3. Stars
            if (this.stars.length > 0) {
                this.renderStars(ctx);
            }

            // 4. Clouds
            if (this.clouds.length > 0) {
                this.renderClouds(ctx);
            }

            // 5. Fog
            if (this.fogBands.length > 0) {
                this.renderFog(ctx);
            }

            // 6. Rain / Snow / Dust
            if (this.particles.length > 0) {
                this.renderParticles(ctx);
            }

            if (this.splashes.length > 0) {
                this.renderSplashes(ctx);
            }

            // 7. Lightning Bolts
            if (this.lightningActive && this.lightningBolts.length > 0) {
                this.renderLightningBolts(ctx);
            }
        }

        renderSkyGradient(ctx, w, h) {
            const grad = ctx.createLinearGradient(0, 0, 0, h);
            const isLightMode = document.documentElement.getAttribute('data-theme') === 'light';

            switch (this.condition) {
                case 'clear_day':
                    if (isLightMode) {
                        grad.addColorStop(0, '#38bdf8');
                        grad.addColorStop(0.55, '#7dd3fc');
                        grad.addColorStop(1, '#bae6fd');
                    } else {
                        grad.addColorStop(0, '#0c4a6e');
                        grad.addColorStop(0.55, '#0369a1');
                        grad.addColorStop(1, '#0284c7');
                    }
                    break;
                case 'clear_night':
                    if (isLightMode) {
                        grad.addColorStop(0, '#0f172a');
                        grad.addColorStop(0.6, '#1e293b');
                        grad.addColorStop(1, '#334155');
                    } else {
                        grad.addColorStop(0, '#030712');
                        grad.addColorStop(0.55, '#091428');
                        grad.addColorStop(1, '#0f172a');
                    }
                    break;
                case 'partly_cloudy_day':
                    if (isLightMode) {
                        grad.addColorStop(0, '#0284c7');
                        grad.addColorStop(0.55, '#38bdf8');
                        grad.addColorStop(1, '#e0f2fe');
                    } else {
                        grad.addColorStop(0, '#072448');
                        grad.addColorStop(0.55, '#0f3860');
                        grad.addColorStop(1, '#1e293b');
                    }
                    break;
                case 'partly_cloudy_night':
                    grad.addColorStop(0, '#050b14');
                    grad.addColorStop(0.55, '#0c1a2f');
                    grad.addColorStop(1, '#18253b');
                    break;
                case 'cloudy':
                    if (isLightMode) {
                        grad.addColorStop(0, '#64748b');
                        grad.addColorStop(0.55, '#94a3b8');
                        grad.addColorStop(1, '#cbd5e1');
                    } else {
                        grad.addColorStop(0, '#111827');
                        grad.addColorStop(0.55, '#1e293b');
                        grad.addColorStop(1, '#334155');
                    }
                    break;
                case 'drizzle':
                case 'rain':
                    if (isLightMode) {
                        grad.addColorStop(0, '#475569');
                        grad.addColorStop(0.55, '#64748b');
                        grad.addColorStop(1, '#94a3b8');
                    } else {
                        grad.addColorStop(0, '#09111e');
                        grad.addColorStop(0.55, '#121f33');
                        grad.addColorStop(1, '#1e2f47');
                    }
                    break;
                case 'heavy_rain':
                case 'thunderstorm':
                    grad.addColorStop(0, '#05080f');
                    grad.addColorStop(0.5, '#0d1527');
                    grad.addColorStop(1, '#162238');
                    break;
                case 'snow':
                    if (isLightMode) {
                        grad.addColorStop(0, '#7dd3fc');
                        grad.addColorStop(0.55, '#bae6fd');
                        grad.addColorStop(1, '#f0f9ff');
                    } else {
                        grad.addColorStop(0, '#10233d');
                        grad.addColorStop(0.55, '#1c395e');
                        grad.addColorStop(1, '#2c4f7c');
                    }
                    break;
                case 'fog':
                    if (isLightMode) {
                        grad.addColorStop(0, '#94a3b8');
                        grad.addColorStop(0.55, '#cbd5e1');
                        grad.addColorStop(1, '#e2e8f0');
                    } else {
                        grad.addColorStop(0, '#1e293b');
                        grad.addColorStop(0.55, '#334155');
                        grad.addColorStop(1, '#475569');
                    }
                    break;
                default:
                    grad.addColorStop(0, '#091322');
                    grad.addColorStop(1, '#1e293b');
            }

            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, w, h);
        }

        renderSun(ctx, w, h) {
            const sunX = Math.max(w - 70, w * 0.8);
            const sunY = 55;
            const baseRadius = 32 * this.sunPulse;

            // Outer Volumetric Glow
            const outerGlow = ctx.createRadialGradient(sunX, sunY, 6, sunX, sunY, baseRadius * 4.5);
            outerGlow.addColorStop(0, 'rgba(255, 235, 130, 0.45)');
            outerGlow.addColorStop(0.35, 'rgba(253, 186, 116, 0.2)');
            outerGlow.addColorStop(0.7, 'rgba(249, 115, 22, 0.06)');
            outerGlow.addColorStop(1, 'rgba(249, 115, 22, 0)');

            ctx.fillStyle = outerGlow;
            ctx.beginPath();
            ctx.arc(sunX, sunY, baseRadius * 4.5, 0, Math.PI * 2);
            ctx.fill();

            // Rotating Light Rays
            ctx.save();
            ctx.translate(sunX, sunY);
            ctx.rotate(this.sunRotation);
            const rayCount = 10;
            for (let i = 0; i < rayCount; i++) {
                ctx.rotate((Math.PI * 2) / rayCount);
                const rayLen = baseRadius * 3.2 + Math.sin(this.sunRotation * 2 + i) * 10;
                const rayGrad = ctx.createLinearGradient(0, 0, rayLen, 0);
                rayGrad.addColorStop(0, 'rgba(255, 248, 200, 0.28)');
                rayGrad.addColorStop(0.5, 'rgba(253, 186, 116, 0.1)');
                rayGrad.addColorStop(1, 'rgba(253, 186, 116, 0)');

                ctx.fillStyle = rayGrad;
                ctx.beginPath();
                ctx.moveTo(baseRadius * 0.7, -5);
                ctx.lineTo(rayLen, -2);
                ctx.lineTo(rayLen, 2);
                ctx.lineTo(baseRadius * 0.7, 5);
                ctx.closePath();
                ctx.fill();
            }
            ctx.restore();

            // Sun Core
            const coreGlow = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, baseRadius);
            coreGlow.addColorStop(0, '#ffffff');
            coreGlow.addColorStop(0.35, '#fffbeb');
            coreGlow.addColorStop(0.7, '#fef08a');
            coreGlow.addColorStop(1, 'rgba(251, 191, 36, 0.85)');

            ctx.fillStyle = coreGlow;
            ctx.beginPath();
            ctx.arc(sunX, sunY, baseRadius, 0, Math.PI * 2);
            ctx.fill();
        }

        renderMoon(ctx, w, h) {
            const moonX = Math.max(w - 70, w * 0.8);
            const moonY = 55;
            const radius = 28;

            // Halo Bloom
            const halo = ctx.createRadialGradient(moonX, moonY, 6, moonX, moonY, radius * 3.2);
            halo.addColorStop(0, 'rgba(224, 242, 254, 0.35)');
            halo.addColorStop(0.5, 'rgba(186, 230, 253, 0.1)');
            halo.addColorStop(1, 'rgba(186, 230, 253, 0)');

            ctx.fillStyle = halo;
            ctx.beginPath();
            ctx.arc(moonX, moonY, radius * 3.2, 0, Math.PI * 2);
            ctx.fill();

            // Moon Disc
            const moonGrad = ctx.createRadialGradient(moonX - 6, moonY - 6, 2, moonX, moonY, radius);
            moonGrad.addColorStop(0, '#ffffff');
            moonGrad.addColorStop(0.7, '#e2e8f0');
            moonGrad.addColorStop(1, '#94a3b8');

            ctx.fillStyle = moonGrad;
            ctx.beginPath();
            ctx.arc(moonX, moonY, radius, 0, Math.PI * 2);
            ctx.fill();

            // Soft Craters
            ctx.fillStyle = 'rgba(100, 116, 139, 0.18)';
            ctx.beginPath();
            ctx.arc(moonX - 7, moonY - 4, 6, 0, Math.PI * 2);
            ctx.arc(moonX + 8, moonY + 6, 7, 0, Math.PI * 2);
            ctx.arc(moonX - 3, moonY + 10, 4, 0, Math.PI * 2);
            ctx.fill();
        }

        renderStars(ctx) {
            for (const s of this.stars) {
                ctx.fillStyle = s.color;
                ctx.globalAlpha = s.alpha;
                ctx.beginPath();
                ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1.0;

            for (const ss of this.shootingStars) {
                const tailX = ss.x - Math.cos(ss.angle) * ss.length;
                const tailY = ss.y - Math.sin(ss.angle) * ss.length;

                const grad = ctx.createLinearGradient(tailX, tailY, ss.x, ss.y);
                grad.addColorStop(0, 'rgba(255, 255, 255, 0)');
                grad.addColorStop(0.7, `rgba(186, 230, 253, ${ss.alpha * 0.6})`);
                grad.addColorStop(1, `rgba(255, 255, 255, ${ss.alpha})`);

                ctx.strokeStyle = grad;
                ctx.lineWidth = 1.6;
                ctx.beginPath();
                ctx.moveTo(tailX, tailY);
                ctx.lineTo(ss.x, ss.y);
                ctx.stroke();
            }
        }

        renderClouds(ctx) {
            const isLight = document.documentElement.getAttribute('data-theme') === 'light';
            const cloudColor = this.condition === 'thunderstorm'
                ? 'rgba(30, 41, 59, '
                : (isLight ? 'rgba(255, 255, 255, ' : 'rgba(203, 213, 225, ');

            for (const c of this.clouds) {
                ctx.save();
                ctx.translate(c.x, c.y);

                for (const p of c.puffs) {
                    const grad = ctx.createRadialGradient(p.rx, p.ry, 0, p.rx, p.ry, p.radius);
                    grad.addColorStop(0, `${cloudColor}${c.opacity})`);
                    grad.addColorStop(0.65, `${cloudColor}${c.opacity * 0.65})`);
                    grad.addColorStop(1, `${cloudColor}0)`);

                    ctx.fillStyle = grad;
                    ctx.beginPath();
                    ctx.arc(p.rx, p.ry, p.radius, 0, Math.PI * 2);
                    ctx.fill();
                }

                ctx.restore();
            }
        }

        renderFog(ctx) {
            const isLight = document.documentElement.getAttribute('data-theme') === 'light';
            const fogColor = isLight ? '241, 245, 249' : '71, 85, 105';

            for (const f of this.fogBands) {
                const grad = ctx.createLinearGradient(f.x, f.y, f.x + f.width, f.y);
                grad.addColorStop(0, `rgba(${fogColor}, 0)`);
                grad.addColorStop(0.3, `rgba(${fogColor}, ${f.alpha})`);
                grad.addColorStop(0.7, `rgba(${fogColor}, ${f.alpha * 1.2})`);
                grad.addColorStop(1, `rgba(${fogColor}, 0)`);

                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.ellipse(f.x + f.width * 0.5, f.y, f.width * 0.5, f.height * 0.5, 0, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        renderParticles(ctx) {
            for (const p of this.particles) {
                if (p.type === 'rain') {
                    ctx.strokeStyle = `rgba(186, 230, 253, ${p.alpha})`;
                    ctx.lineWidth = p.thickness;
                    ctx.beginPath();
                    ctx.moveTo(p.x, p.y);
                    ctx.lineTo(p.x + p.wind * 1.8, p.y + p.length);
                    ctx.stroke();
                } else if (p.type === 'snow') {
                    const snowGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius);
                    snowGrad.addColorStop(0, `rgba(255, 255, 255, ${p.alpha})`);
                    snowGrad.addColorStop(0.6, `rgba(240, 249, 255, ${p.alpha * 0.7})`);
                    snowGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');

                    ctx.fillStyle = snowGrad;
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                    ctx.fill();
                } else if (p.type === 'sun_dust') {
                    ctx.fillStyle = `rgba(254, 240, 138, ${p.alpha})`;
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }

        renderSplashes(ctx) {
            for (const s of this.splashes) {
                ctx.strokeStyle = `rgba(186, 230, 253, ${s.alpha})`;
                ctx.lineWidth = 1.0;
                ctx.beginPath();
                ctx.ellipse(s.x, s.y, s.radius * 1.4, s.radius * 0.5, 0, 0, Math.PI * 2);
                ctx.stroke();
            }
        }

        renderLightningBolts(ctx) {
            ctx.save();
            ctx.strokeStyle = `rgba(255, 255, 255, ${this.lightningIntensity})`;
            ctx.shadowColor = '#38bdf8';
            ctx.shadowBlur = 16;

            for (const bolt of this.lightningBolts) {
                ctx.lineWidth = bolt.isBranch ? 1.2 : 2.4;
                ctx.beginPath();
                ctx.moveTo(bolt.x1, bolt.y1);
                ctx.lineTo(bolt.x2, bolt.y2);
                ctx.stroke();
            }

            ctx.restore();
        }
    }

    // Expose global instance
    window.WeatherAtmosphere = new WeatherAtmosphereEngine();
})();
