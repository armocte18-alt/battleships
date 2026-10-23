/* ==========================================================================
   BATTLESHIPS · núcleo: API, sonido, efectos, barcos SVG, chat y toasts
   ========================================================================== */
(function () {
    'use strict';

    const meta = (n) => document.querySelector(`meta[name="${n}"]`)?.content || '';
    const BS = (window.BS = window.BS || {});
    BS.base = meta('bs-base').replace(/\/$/, '');
    BS.userId = parseInt(meta('bs-user'), 10) || 0;

    BS.esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    BS.sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    /* ---------------- API ---------------- */
    BS.api = async function (method, path, data) {
        const opts = {
            method,
            headers: { 'Accept': 'application/json', 'X-CSRF-TOKEN': meta('csrf-token'), 'X-Requested-With': 'XMLHttpRequest' },
            credentials: 'same-origin',
        };
        if (data !== undefined) {
            opts.headers['Content-Type'] = 'application/json';
            opts.body = JSON.stringify(data);
        }
        const res = await fetch(BS.base + path, opts);
        if (res.status === 401 || res.status === 419) {
            window.location.href = BS.base + '/login';
            throw new Error('Sesión expirada');
        }
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
            const first = json.errors ? Object.values(json.errors)[0][0] : json.message;
            throw new Error(first || 'Error de comunicación con el servidor');
        }
        return json;
    };

    /* ---------------- Toasts ---------------- */
    BS.toast = function (html, { type = '', timeout = 4000 } = {}) {
        let box = document.querySelector('.toasts');
        if (!box) {
            box = document.createElement('div');
            box.className = 'toasts';
            document.body.appendChild(box);
        }
        const el = document.createElement('div');
        el.className = 'toast ' + type;
        el.innerHTML = html;
        box.appendChild(el);
        const close = () => { el.style.transition = '.3s'; el.style.opacity = 0; el.style.transform = 'translateX(30px)'; setTimeout(() => el.remove(), 300); };
        if (timeout) setTimeout(close, timeout);
        el.close = close;
        return el;
    };
    BS.error = (e) => { BS.sfx.error(); BS.toast(BS.esc(e.message || e), { type: 'error' }); };

    /* ---------------- Sonido (sintetizado con WebAudio, sin archivos) ---------------- */
    const sfx = (BS.sfx = {});
    let ctx = null;
    let muted = false;
    try { muted = localStorage.getItem('bs-muted') === '1'; } catch (e) { /* sin almacenamiento */ }

    function ac() {
        if (!ctx) {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return null;
            ctx = new AC();
        }
        if (ctx.state === 'suspended') ctx.resume();
        return ctx;
    }
    ['pointerdown', 'keydown'].forEach((ev) => window.addEventListener(ev, () => ac(), { once: true }));

    function noise(dur) {
        const a = ac();
        const buf = a.createBuffer(1, a.sampleRate * dur, a.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        const src = a.createBufferSource();
        src.buffer = buf;
        return src;
    }
    function env(gain, t, attack, peak, decay) {
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(peak, t + attack);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    }
    function tone(freq, dur, { type = 'sine', vol = 0.2, delay = 0, slide = null } = {}) {
        const a = ac(); if (!a || muted) return;
        const t = a.currentTime + delay;
        const o = a.createOscillator(); const g = a.createGain();
        o.type = type; o.frequency.setValueAtTime(freq, t);
        if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
        env(g, t, 0.01, vol, dur);
        o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + 0.05);
    }

    sfx.isMuted = () => muted;
    sfx.tone = tone;
    sfx.ctx = ac;
    sfx.toggle = () => { muted = !muted; try { localStorage.setItem('bs-muted', muted ? '1' : '0'); } catch (e) { /* */ } return muted; };

    sfx.launch = () => {
        const a = ac(); if (!a || muted) return;
        const t = a.currentTime; const n = noise(0.5); const f = a.createBiquadFilter(); const g = a.createGain();
        f.type = 'bandpass'; f.Q.value = 2; f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(3000, t + 0.45);
        env(g, t, 0.03, 0.25, 0.45);
        n.connect(f).connect(g).connect(a.destination); n.start(t);
        tone(900, 0.45, { type: 'sawtooth', vol: 0.03, slide: 200 });
    };
    sfx.explosion = (big = false) => {
        const a = ac(); if (!a || muted) return;
        const t = a.currentTime; const dur = big ? 2.2 : 1.2;
        const n = noise(dur); const f = a.createBiquadFilter(); const g = a.createGain();
        f.type = 'lowpass'; f.frequency.setValueAtTime(big ? 1800 : 1200, t); f.frequency.exponentialRampToValueAtTime(60, t + dur);
        env(g, t, 0.005, big ? 0.9 : 0.6, dur);
        n.connect(f).connect(g).connect(a.destination); n.start(t);
        tone(110, dur * 0.7, { type: 'sine', vol: big ? 0.6 : 0.4, slide: 30 });
        if (big) { tone(70, 1.6, { type: 'triangle', vol: 0.4, slide: 25, delay: 0.25 }); }
    };
    sfx.splash = () => {
        const a = ac(); if (!a || muted) return;
        const t = a.currentTime; const n = noise(0.7); const f = a.createBiquadFilter(); const g = a.createGain();
        f.type = 'highpass'; f.frequency.setValueAtTime(600, t); f.frequency.exponentialRampToValueAtTime(2500, t + 0.3);
        env(g, t, 0.01, 0.28, 0.6);
        n.connect(f).connect(g).connect(a.destination); n.start(t);
        tone(300, 0.25, { vol: 0.08, slide: 900 });
    };
    sfx.sonar = () => { tone(1250, 1.4, { vol: 0.18 }); tone(1250, 1.2, { vol: 0.06, delay: 0.5 }); };
    sfx.click = () => tone(660, 0.07, { type: 'square', vol: 0.05 });
    sfx.place = () => { tone(220, 0.12, { type: 'triangle', vol: 0.2 }); tone(330, 0.12, { type: 'triangle', vol: 0.12, delay: 0.05 }); };
    sfx.rotate = () => tone(480, 0.08, { type: 'triangle', vol: 0.12, slide: 720 });
    sfx.error = () => { tone(180, 0.18, { type: 'square', vol: 0.08 }); tone(140, 0.25, { type: 'square', vol: 0.08, delay: 0.12 }); };
    sfx.message = () => { tone(880, 0.09, { vol: 0.1 }); tone(1320, 0.12, { vol: 0.08, delay: 0.08 }); };
    sfx.alarm = () => { for (let i = 0; i < 3; i++) tone(700, 0.18, { type: 'square', vol: 0.06, delay: i * 0.3, slide: 500 }); };
    sfx.victory = () => {
        [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, i === 5 ? 0.9 : 0.22, { type: 'triangle', vol: 0.18, delay: i * 0.16 }));
        [262, 330, 392].forEach((f) => tone(f, 1.3, { type: 'sine', vol: 0.08, delay: 0.8 }));
    };
    sfx.defeat = () => [392, 349, 311, 262].forEach((f, i) => tone(f, i === 3 ? 1.2 : 0.38, { type: 'sawtooth', vol: 0.06, delay: i * 0.38 }));

    /* ---------------- Partículas ---------------- */
    const fx = (BS.fx = {});
    let canvas, c2d, parts = [], running = false;
    function ensureCanvas() {
        if (canvas) return;
        canvas = document.createElement('canvas');
        canvas.id = 'fx-canvas';
        document.body.appendChild(canvas);
        c2d = canvas.getContext('2d');
        const resize = () => { canvas.width = innerWidth * devicePixelRatio; canvas.height = innerHeight * devicePixelRatio; c2d.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0); };
        resize(); addEventListener('resize', resize);
    }
    function loop() {
        c2d.clearRect(0, 0, canvas.width, canvas.height);
        parts = parts.filter((p) => p.life > 0);
        for (const p of parts) {
            p.life -= 1; p.x += p.vx; p.y += p.vy; p.vy += p.g; p.vx *= p.drag; p.vy *= p.drag; p.r *= p.shrink; p.rot += p.vr;
            const k = Math.max(0, p.life / p.max);
            c2d.globalAlpha = p.fade ? k : Math.min(1, k * 3);
            c2d.globalCompositeOperation = p.blend || 'source-over';
            if (p.shape === 'rect') {
                c2d.save(); c2d.translate(p.x, p.y); c2d.rotate(p.rot); c2d.fillStyle = p.color;
                c2d.fillRect(-p.r, -p.r * 0.5, p.r * 2, p.r); c2d.restore();
            } else if (p.shape === 'ring') {
                c2d.strokeStyle = p.color; c2d.lineWidth = 2 * k + 0.5; c2d.beginPath(); c2d.arc(p.x, p.y, p.r, 0, 6.283); c2d.stroke();
            } else {
                const grad = c2d.createRadialGradient(p.x, p.y, 0, p.x, p.y, Math.max(0.1, p.r));
                grad.addColorStop(0, p.color); grad.addColorStop(1, 'rgba(0,0,0,0)');
                c2d.fillStyle = grad; c2d.beginPath(); c2d.arc(p.x, p.y, Math.max(0.1, p.r), 0, 6.283); c2d.fill();
            }
        }
        c2d.globalAlpha = 1; c2d.globalCompositeOperation = 'source-over';
        if (parts.length) requestAnimationFrame(loop); else { running = false; c2d.clearRect(0, 0, canvas.width, canvas.height); }
    }
    function add(p) {
        ensureCanvas();
        parts.push(Object.assign({ vx: 0, vy: 0, g: 0, drag: 0.96, r: 4, shrink: 1, life: 60, color: '#fff', fade: true, rot: 0, vr: 0 }, p, { max: p.life || 60 }));
        if (!running) { running = true; requestAnimationFrame(loop); }
    }
    const rnd = (a, b) => a + Math.random() * (b - a);

    fx.explosion = (x, y, scale = 1) => {
        for (let i = 0; i < 26 * scale; i++) { const a = rnd(0, 6.283), s = rnd(1, 6) * scale; add({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1, r: rnd(10, 26) * scale, shrink: 0.95, life: rnd(25, 45), color: ['#fff3b0', '#ffc23d', '#ff6a1a', '#ff3355'][i % 4], blend: 'lighter' }); }
        for (let i = 0; i < 22 * scale; i++) { const a = rnd(0, 6.283), s = rnd(2, 9) * scale; add({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 3, g: 0.25, r: rnd(1.5, 3), shape: 'rect', vr: rnd(-0.4, 0.4), life: rnd(35, 60), color: ['#ffd23d', '#3a3f46', '#ff8a1a'][i % 3], drag: 0.98 }); }
        for (let i = 0; i < 10 * scale; i++) { add({ x: x + rnd(-10, 10), y: y + rnd(-10, 10), vx: rnd(-0.6, 0.6), vy: rnd(-1.8, -0.6), r: rnd(12, 22) * scale, shrink: 1.02, life: rnd(60, 100), color: 'rgba(70,70,80,0.75)', drag: 0.99 }); }
        add({ x, y, r: 6, shrink: 1.12, life: 22, shape: 'ring', color: '#ffd9a0' });
    };
    fx.splash = (x, y) => {
        for (let i = 0; i < 26; i++) { const a = rnd(-Math.PI, 0), s = rnd(1.5, 5.5); add({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 2, g: 0.28, r: rnd(2, 4.5), life: rnd(30, 50), color: ['#e8fbff', '#9fe6ff', '#4cc3ff'][i % 3], drag: 0.98 }); }
        add({ x, y, r: 4, shrink: 1.07, life: 40, shape: 'ring', color: '#bff3ff' });
        add({ x, y, r: 2, shrink: 1.09, life: 32, shape: 'ring', color: '#7fdcff' });
    };
    fx.confetti = (n = 160) => {
        const colors = ['#3ff2ff', '#ffc23d', '#ff3355', '#3dffa0', '#c23a6f', '#ffffff'];
        for (let i = 0; i < n; i++) add({ x: rnd(0, innerWidth), y: rnd(-innerHeight * 0.4, -10), vx: rnd(-1.5, 1.5), vy: rnd(1, 4), g: 0.05, drag: 0.995, r: rnd(3, 6), shape: 'rect', vr: rnd(-0.2, 0.2), life: rnd(160, 260), color: colors[i % colors.length], fade: false });
    };
    fx.fireworks = () => {
        for (let k = 0; k < 6; k++) setTimeout(() => {
            const x = rnd(innerWidth * 0.2, innerWidth * 0.8), y = rnd(innerHeight * 0.15, innerHeight * 0.45), col = ['#ffc23d', '#3ff2ff', '#ff3355', '#3dffa0'][k % 4];
            for (let i = 0; i < 50; i++) { const a = (i / 50) * 6.283, s = rnd(3, 5); add({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: 0.06, r: 3, life: rnd(50, 70), color: col, blend: 'lighter', drag: 0.97 }); }
            sfx.explosion(false);
        }, k * 380);
    };
    fx.shake = (big = false) => {
        const el = document.querySelector('.game-main') || document.body;
        el.classList.remove('shake', 'shake-big'); void el.offsetWidth; el.classList.add(big ? 'shake-big' : 'shake');
    };
    fx.callout = (text, cls, sub = '') => {
        const el = document.createElement('div');
        el.className = 'callout ' + cls;
        el.innerHTML = BS.esc(text) + (sub ? `<small>${BS.esc(sub)}</small>` : '');
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 1500);
    };
    /** Proyectil en arco desde (x0,y0) hasta (x1,y1). */
    fx.shell = (x0, y0, x1, y1, ms = 650) => new Promise((resolve) => {
        const el = document.createElement('div'); el.className = 'shell'; document.body.appendChild(el);
        const t0 = performance.now(); const peak = Math.min(220, Math.abs(x1 - x0) * 0.5 + 120);
        (function step(now) {
            const t = Math.min(1, (now - t0) / ms);
            const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t - Math.sin(t * Math.PI) * peak;
            el.style.left = x + 'px'; el.style.top = y + 'px'; el.style.transform = `scale(${1 + Math.sin(t * Math.PI) * 0.8})`;
            if (Math.random() < 0.8) add({ x, y, r: rnd(4, 7), shrink: 0.93, life: 22, color: 'rgba(255,170,80,0.9)', blend: 'lighter', vx: rnd(-0.3, 0.3), vy: rnd(-0.3, 0.3) });
            if (t < 1) requestAnimationFrame(step); else { el.remove(); resolve(); }
        })(t0);
    });

    /* ---------------- Barcos en SVG ---------------- */
    // Dibujo horizontal, proa a la derecha. Unidad: 100 por casilla, alto 100.
    BS.shipSVG = function (type, size, { id = '' } = {}) {
        const W = size * 100, uid = 's' + Math.random().toString(36).slice(2, 8) + id;
        const hullTop = 18, hullBot = 82;
        let hull = `M 10 50 Q 8 ${hullTop + 4} 34 ${hullTop} L ${W - 90} ${hullTop} Q ${W - 22} ${hullTop + 6} ${W - 6} 50 Q ${W - 22} ${hullBot - 6} ${W - 90} ${hullBot} L 34 ${hullBot} Q 8 ${hullBot - 4} 10 50 Z`;
        let deckFill = `url(#${uid}d)`, hullFill = `url(#${uid}h)`;
        let details = '';
        const turret = (x, dir = 1) => `<g transform="translate(${x} 50)"><rect x="${dir > 0 ? 6 : -40}" y="-9" width="34" height="5" rx="2" fill="#2b333b"/><rect x="${dir > 0 ? 6 : -40}" y="4" width="34" height="5" rx="2" fill="#2b333b"/><circle r="17" fill="#5d6b78" stroke="#2e3740" stroke-width="3"/><circle r="7" fill="#8796a3"/></g>`;
        const bridge = (x, w) => `<rect x="${x}" y="32" width="${w}" height="36" rx="6" fill="#9aa8b4" stroke="#3b4650" stroke-width="3"/><rect x="${x + 8}" y="40" width="${w - 16}" height="7" rx="2" fill="#2fd1ff" opacity=".85"/><circle cx="${x + w / 2}" cy="58" r="5" fill="#3b4650"/>`;

        switch (type) {
            case 'carrier':
                hull = `M 8 26 L ${W - 70} 14 Q ${W - 10} 22 ${W - 6} 50 Q ${W - 10} 78 ${W - 70} 86 L 8 74 Q 2 50 8 26 Z`;
                details = `<rect x="30" y="26" width="${W - 110}" height="48" rx="4" fill="#4a545d"/>`
                    + `<line x1="40" y1="50" x2="${W - 90}" y2="50" stroke="#f2f2f2" stroke-width="3" stroke-dasharray="18 14"/>`
                    + `<line x1="60" y1="30" x2="${W - 140}" y2="68" stroke="#ffc23d" stroke-width="2" opacity=".7"/>`
                    + `<rect x="${W * 0.55}" y="70" width="70" height="14" rx="3" fill="#9aa8b4" stroke="#3b4650" stroke-width="2"/>`
                    + [0.18, 0.34].map((p) => `<path transform="translate(${W * p} 40)" d="M0 10 L 26 0 L 26 6 L 40 6 L 40 14 L 26 14 L 26 20 Z" fill="#cfd8df" stroke="#59646e" stroke-width="1.5"/>`).join('');
                break;
            case 'battleship':
                details = turret(W * 0.2, -1) + turret(W * 0.36, -1) + bridge(W * 0.46, 70) + turret(W * 0.72) + `<circle cx="${W * 0.58}" cy="50" r="8" fill="#2b333b"/>`;
                break;
            case 'cruiser':
                details = turret(W * 0.2, -1) + bridge(W * 0.38, 64) + turret(W * 0.74) + `<rect x="${W * 0.58}" y="44" width="22" height="12" rx="3" fill="#2b333b"/>`;
                break;
            case 'submarine':
                hull = `M 12 50 Q 12 28 60 26 L ${W - 70} 26 Q ${W - 8} 30 ${W - 6} 50 Q ${W - 8} 70 ${W - 70} 74 L 60 74 Q 12 72 12 50 Z`;
                hullFill = `url(#${uid}s)`; deckFill = 'none';
                details = `<rect x="${W * 0.45}" y="36" width="64" height="28" rx="14" fill="#2c3a44" stroke="#111a20" stroke-width="3"/><rect x="${W * 0.45 + 22}" y="22" width="6" height="22" fill="#111a20"/>`
                    + `<path d="M 12 50 L 0 34 L 0 66 Z" fill="#1b252c"/>`
                    + `<line x1="70" y1="50" x2="${W * 0.42}" y2="50" stroke="#46606f" stroke-width="3" stroke-dasharray="6 10"/>`;
                break;
            default: // destroyer
                details = bridge(W * 0.3, 54) + turret(W * 0.7) + `<rect x="30" y="44" width="34" height="12" rx="4" fill="#2b333b"/>`;
        }

        return `<svg viewBox="0 0 ${W} 100" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="${uid}h" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#93a3b1"/><stop offset=".5" stop-color="#6b7c8c"/><stop offset="1" stop-color="#3a4652"/></linearGradient>
                <linearGradient id="${uid}d" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7f8f9c"/><stop offset="1" stop-color="#5d6c79"/></linearGradient>
                <linearGradient id="${uid}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4f6371"/><stop offset=".5" stop-color="#2e3d48"/><stop offset="1" stop-color="#151f26"/></linearGradient>
            </defs>
            <path d="${hull}" fill="${hullFill}" stroke="#1d252c" stroke-width="4"/>
            ${deckFill !== 'none' ? `<path d="${hull}" fill="${deckFill}" transform="translate(${W * 0.04} 7) scale(.92 .86)" opacity=".9"/>` : ''}
            ${details}
        </svg>`;
    };

    /* ---------------- Chat ---------------- */
    BS.chat = function (root, { gameId = null, onSend = null } = {}) {
        const log = root.querySelector('.chat-log');
        const form = root.querySelector('.chat-form');
        const input = form.querySelector('input');
        let lastId = 0;
        const seen = new Set();

        function append(m, { silent = false } = {}) {
            if (seen.has(m.id)) return;
            seen.add(m.id); lastId = Math.max(lastId, m.id);
            const mine = m.user_id === BS.userId;
            const cls = mine ? 'mine' : (m.user_id === 0 ? 'cpu' : '');
            const el = document.createElement('div');
            el.className = 'msg ' + cls;
            el.innerHTML = `<div class="who">${BS.esc(mine ? 'Tú' : m.user)}<time>${BS.esc(m.time || '')}</time></div><div class="bubble">${BS.esc(m.body)}</div>`;
            const nearBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 80;
            log.querySelector('.empty')?.remove();
            log.appendChild(el);
            if (nearBottom || mine) log.scrollTop = log.scrollHeight;
            if (!mine && !silent) sfx.message();
        }
        function system(text) {
            const el = document.createElement('div');
            el.className = 'msg system';
            el.innerHTML = `<div class="bubble">${BS.esc(text)}</div>`;
            log.querySelector('.empty')?.remove();
            log.appendChild(el); log.scrollTop = log.scrollHeight;
        }

        root.querySelectorAll('.chat-emojis button').forEach((b) => b.addEventListener('click', () => { input.value += b.textContent; input.focus(); }));
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const body = input.value.trim();
            if (!body) return;
            input.value = '';
            try {
                const m = await BS.api('POST', '/chat', { body, game_id: gameId });
                append(m);
                onSend && onSend(m);
            } catch (err) { BS.error(err); input.value = body; }
        });

        let first = true;
        return {
            get lastId() { return lastId; },
            push(list) { (list || []).forEach((m) => append(m, { silent: first })); first = false; },
            system,
        };
    };

    /* ---------------- Desafíos de Battleships entrantes (en cualquier página) ---------------- */
    const shownInvites = new Map();
    BS.showInvites = function (list) {
        const ids = new Set(list.map((i) => i.id));
        for (const [id, el] of shownInvites) if (!ids.has(id)) { el.close(); shownInvites.delete(id); }
        list.forEach((inv) => {
            if (shownInvites.has(inv.id)) return;
            sfx.alarm();
            const el = BS.toast(`
                <div class="toast-title">⚔ ¡Desafío entrante!</div>
                <div><b>${BS.esc(inv.from)}</b> te reta a una batalla naval.</div>
                <div class="actions">
                    <button class="btn sm green" data-act="accept">Aceptar</button>
                    <button class="btn sm ghost" data-act="decline">Rechazar</button>
                </div>`, { type: 'invite', timeout: 0 });
            el.querySelector('[data-act=accept]').addEventListener('click', async () => {
                try { const r = await BS.api('POST', `/games/${inv.id}/accept`); location.href = r.url; } catch (err) { BS.error(err); el.close(); }
            });
            el.querySelector('[data-act=decline]').addEventListener('click', async () => {
                el.close(); shownInvites.delete(inv.id);
                try { await BS.api('POST', `/games/${inv.id}/decline`); } catch (err) { BS.error(err); }
            });
            shownInvites.set(inv.id, el);
        });
    };

    BS.avatar = function (name, initials, url, extra = '') {
        return `<div class="avatar ${extra}">${url ? `<img src="${BS.esc(url)}" alt="" onerror="this.remove()">` : ''}${url ? '' : BS.esc(initials || '?')}</div>`;
    };

    /* ---------------- Botón de sonido ---------------- */
    document.addEventListener('DOMContentLoaded', () => {
        const btn = document.getElementById('sound-toggle');
        if (!btn) return;
        const paint = () => { btn.innerHTML = sfx.isMuted()
            ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="m23 9-6 6M17 9l6 6"/></svg>'
            : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/></svg>';
            btn.title = sfx.isMuted() ? 'Activar sonido' : 'Silenciar'; };
        paint();
        btn.addEventListener('click', () => { sfx.toggle(); paint(); sfx.click(); });
    });
})();
