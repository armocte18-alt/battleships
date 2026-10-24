/* ==========================================================================
   SIOS ARCADE · SERPIENTE
   Movimiento por casillas con render interpolado (fluido), power-ups,
   rocas, dos modos (bordes sólidos / atravesables) y récords.
   ========================================================================== */
(function () {
    'use strict';
    const BS = window.BS;
    const CFG = window.SNAKE;
    const $ = (s) => document.querySelector(s);

    const COLS = 28, ROWS = 20, S = 24, W = COLS * S, H = ROWS * S;
    const DIRS = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
    const POWERS = {
        star: { color: '#ffd23d', label: '★ +50' },
        double: { color: '#a78bfa', label: '×2' },
        ice: { color: '#3ff2ff', label: '❄ Lento' },
    };

    const canvas = $('#snake-canvas');
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    let mode = 'classic';
    try { mode = localStorage.getItem('snake-mode') || 'classic'; } catch (e) { /* */ }
    if (!CFG.modes[mode]) mode = 'classic';
    let tab = mode;

    let G = { state: 'title' };
    const particles = [];

    /* ---------------- Sonido ---------------- */
    const tone = (...a) => BS.sfx.tone(...a);
    const snd = {
        eat(n) { tone(520 + Math.min(n, 30) * 18, 0.08, { type: 'square', vol: 0.06, slide: 900 + n * 20 }); },
        power() { [660, 880, 1100, 1320].forEach((f, i) => tone(f, 0.1, { type: 'triangle', vol: 0.08, delay: i * 0.05 })); },
        turn() { tone(240, 0.03, { type: 'sine', vol: 0.03 }); },
        die() { BS.sfx.explosion(true); [400, 300, 200, 120].forEach((f, i) => tone(f, 0.25, { type: 'sawtooth', vol: 0.06, delay: 0.1 + i * 0.18, slide: f * 0.7 })); },
        start() { [392, 523, 659, 784].forEach((f, i) => tone(f, 0.12, { type: 'square', vol: 0.06, delay: i * 0.09 })); },
    };

    /* ---------------- Partida ---------------- */
    const key = (p) => p.x + ',' + p.y;
    function freeCell(minDist = 0) {
        const taken = new Set([...G.snake.map(key), ...G.rocks.map(key)]);
        if (G.apple) taken.add(key(G.apple));
        if (G.power) taken.add(key(G.power));
        const head = G.snake[0];
        for (let tries = 0; tries < 500; tries++) {
            const p = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
            if (taken.has(key(p))) continue;
            if (minDist && Math.abs(p.x - head.x) + Math.abs(p.y - head.y) < minDist) continue;
            return p;
        }
        return null;
    }

    function start() {
        $('#snake-overlay').hidden = true;
        const y = Math.floor(ROWS / 2);
        G = {
            state: 'playing', mode, score: 0, best: CFG.best[mode] || 0, eaten: 0, t0: performance.now(),
            snake: [{ x: 8, y }, { x: 7, y }, { x: 6, y }], prev: null, dir: DIRS.right, queue: [], grow: 0,
            rocks: [], apple: null, power: null, double: 0, ice: 0, acc: 0, deathT: 0, shake: 0,
        };
        G.prev = G.snake.map((p) => ({ ...p }));
        G.apple = freeCell(4);
        hud(); snd.start();
    }

    function interval() {
        const base = Math.max(55, 125 - G.eaten * 2.2);
        return G.ice > 0 ? base * 1.7 : base;
    }

    function step() {
        if (G.queue.length) {
            const d = G.queue.shift();
            if (d.x !== -G.dir.x || d.y !== -G.dir.y) G.dir = d;
        }
        const head = G.snake[0];
        let nx = head.x + G.dir.x, ny = head.y + G.dir.y;
        if (G.mode === 'wrap') { nx = (nx + COLS) % COLS; ny = (ny + ROWS) % ROWS; }
        const next = { x: nx, y: ny };

        const willGrow = G.grow > 0 || (G.apple && key(G.apple) === key(next));
        const body = willGrow ? G.snake : G.snake.slice(0, -1);
        if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS || body.some((p) => key(p) === key(next)) || G.rocks.some((r) => key(r) === key(next))) {
            return die();
        }

        G.prev = G.snake.map((p) => ({ ...p }));
        G.snake.unshift(next);
        if (G.grow > 0) G.grow--; else if (!(G.apple && key(G.apple) === key(next))) G.snake.pop();
        if (G.prev.length < G.snake.length) G.prev.push({ ...G.prev[G.prev.length - 1] });

        const mult = G.double > 0 ? 2 : 1;
        if (G.apple && key(G.apple) === key(next)) {
            G.eaten++; G.grow += 1;
            add(10 * mult, next, '#ff3355');
            snd.eat(G.eaten);
            G.apple = freeCell(3);
            if (G.eaten % 4 === 0 && !G.power) spawnPower();
            if (G.eaten % 5 === 0 && G.rocks.length < 18) { const r = freeCell(6); if (r) G.rocks.push(r); }
        }
        if (G.power && key(G.power) === key(next)) {
            const p = G.power; G.power = null;
            snd.power();
            if (p.type === 'star') add(50 * mult, next, '#ffd23d');
            if (p.type === 'double') { G.double = 8; burst(next, '#a78bfa', 26); }
            if (p.type === 'ice') { G.ice = 6; burst(next, '#3ff2ff', 26); }
            float(next, POWERS[p.type].label, POWERS[p.type].color);
        }
        hud();
    }

    function spawnPower() {
        const types = ['star', 'star', 'double', 'ice'];
        const c = freeCell(4);
        if (c) G.power = { ...c, type: types[Math.floor(Math.random() * types.length)], t: 7 };
    }

    function add(points, at, color) {
        G.score += points;
        if (G.score > G.best) G.best = G.score;
        burst(at, color, 14);
        float(at, '+' + points, color);
    }

    function die() {
        G.state = 'dying'; G.deathT = 0; G.shake = 1;
        snd.die();
        const r = canvas.getBoundingClientRect();
        const h = G.snake[0];
        BS.fx.explosion(r.left + ((h.x + 0.5) * S / W) * r.width, r.top + ((h.y + 0.5) * S / H) * r.height, 1);
    }

    /* ---------------- Partículas internas ---------------- */
    function burst(cell, color, n) {
        const cx = (cell.x + 0.5) * S, cy = (cell.y + 0.5) * S;
        for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2, v = 1 + Math.random() * 3.5;
            particles.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, color, r: 2 + Math.random() * 2.5 });
        }
    }
    function float(cell, text, color) { particles.push({ x: (cell.x + 0.5) * S, y: cell.y * S, vx: 0, vy: -0.6, life: 1.4, text, color }); }

    /* ---------------- Bucle ---------------- */
    let last = performance.now();
    function frame(now) {
        const dt = Math.min(0.1, (now - last) / 1000);
        last = now;
        if (G.state === 'playing') {
            G.acc += dt * 1000;
            G.double = Math.max(0, G.double - dt);
            G.ice = Math.max(0, G.ice - dt);
            if (G.power) { G.power.t -= dt; if (G.power.t <= 0) G.power = null; }
            let iv = interval();
            while (G.acc >= iv && G.state === 'playing') { G.acc -= iv; step(); iv = interval(); }
            hudPower();
        } else if (G.state === 'dying') {
            G.deathT += dt;
            const k = Math.floor(G.deathT / 0.045);
            while (G.snake.length && k > (G.popped || 0)) {
                const seg = G.snake.shift(); G.prev.shift(); G.popped = (G.popped || 0) + 1;
                burst(seg, `hsl(${150 + (G.popped * 7) % 90},100%,60%)`, 6);
                if (G.popped % 4 === 0) tone(300 - G.popped * 3, 0.05, { type: 'square', vol: 0.03 });
            }
            if (!G.snake.length && G.deathT > 0.8) gameOver();
        }
        G.shake = Math.max(0, (G.shake || 0) - dt * 2);
        particles.forEach((p) => { p.x += p.vx; p.y += p.vy; p.vx *= 0.94; p.vy *= 0.94; p.life -= dt * 1.6; });
        for (let i = particles.length - 1; i >= 0; i--) if (particles[i].life <= 0) particles.splice(i, 1);
        draw(now);
        requestAnimationFrame(frame);
    }

    /* ---------------- Dibujo ---------------- */
    function draw(now) {
        ctx.save();
        if (G.shake) ctx.translate((Math.random() - 0.5) * 12 * G.shake, (Math.random() - 0.5) * 12 * G.shake);
        ctx.fillStyle = G.ice > 0 ? '#021219' : '#020d0a';
        ctx.fillRect(-10, -10, W + 20, H + 20);

        // Rejilla con pulso suave
        const pulse = 0.05 + 0.025 * Math.sin(now / 600);
        ctx.strokeStyle = `rgba(61,255,160,${pulse})`; ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = 0; x <= COLS; x++) { ctx.moveTo(x * S + 0.5, 0); ctx.lineTo(x * S + 0.5, H); }
        for (let y = 0; y <= ROWS; y++) { ctx.moveTo(0, y * S + 0.5); ctx.lineTo(W, y * S + 0.5); }
        ctx.stroke();
        if (G.state !== 'title' && (G.mode || mode) === 'classic') {
            ctx.strokeStyle = '#3dffa0'; ctx.lineWidth = 3; ctx.shadowColor = '#3dffa0'; ctx.shadowBlur = 14;
            ctx.strokeRect(1.5, 1.5, W - 3, H - 3); ctx.shadowBlur = 0;
        }

        if (G.state === 'title') { ctx.restore(); return; }

        // Rocas
        G.rocks.forEach((r) => {
            const x = r.x * S, y = r.y * S;
            const g = ctx.createLinearGradient(x, y, x + S, y + S);
            g.addColorStop(0, '#7b8496'); g.addColorStop(1, '#2e3442');
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.moveTo(x + 4, y + 7); ctx.lineTo(x + 11, y + 2); ctx.lineTo(x + 20, y + 5); ctx.lineTo(x + 22, y + 15); ctx.lineTo(x + 15, y + 22); ctx.lineTo(x + 5, y + 19); ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,.15)'; ctx.lineWidth = 1; ctx.stroke();
        });

        // Manzana y power-up
        if (G.apple) glowBall(G.apple, '#ff3355', 0.36 + 0.04 * Math.sin(now / 150), true);
        if (G.power) {
            const blink = G.power.t > 2 || Math.floor(now / 120) % 2;
            if (blink) {
                const c = POWERS[G.power.type].color;
                const cx = (G.power.x + 0.5) * S, cy = (G.power.y + 0.5) * S;
                ctx.save(); ctx.translate(cx, cy); ctx.rotate(now / 500);
                ctx.shadowColor = c; ctx.shadowBlur = 18; ctx.fillStyle = c;
                if (G.power.type === 'star') star(0, 0, 5, S * 0.45, S * 0.2);
                else if (G.power.type === 'ice') { ctx.rotate(-now / 500); ctx.font = `bold ${S * 0.8}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('❄', 0, 1); }
                else { ctx.rotate(-now / 500); ctx.beginPath(); ctx.arc(0, 0, S * 0.42, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#1a0b3a'; ctx.font = `900 ${S * 0.5}px Montserrat, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('×2', 0, 1); }
                ctx.restore();
            }
        }

        drawSnake(now);

        // Partículas y textos
        particles.forEach((p) => {
            ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
            ctx.fillStyle = p.color;
            if (p.text) { ctx.font = '800 14px Montserrat, sans-serif'; ctx.textAlign = 'center'; ctx.shadowColor = p.color; ctx.shadowBlur = 8; ctx.fillText(p.text, p.x, p.y); ctx.shadowBlur = 0; }
            else { ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill(); }
        });
        ctx.globalAlpha = 1;

        if (G.state === 'paused') {
            ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, 0, W, H);
            ctx.fillStyle = '#3dffa0'; ctx.font = '36px "Black Ops One", Impact, sans-serif'; ctx.textAlign = 'center';
            ctx.fillText('PAUSA', W / 2, H / 2);
        }
        ctx.restore();
    }

    function glowBall(c, color, rr, leaf) {
        const cx = (c.x + 0.5) * S, cy = (c.y + 0.5) * S;
        ctx.save();
        ctx.shadowColor = color; ctx.shadowBlur = 16;
        const g = ctx.createRadialGradient(cx - 3, cy - 3, 1, cx, cy, S * rr);
        g.addColorStop(0, '#ffd1d8'); g.addColorStop(0.5, color); g.addColorStop(1, '#7a0018');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(cx, cy, S * rr, 0, Math.PI * 2); ctx.fill();
        if (leaf) { ctx.shadowBlur = 0; ctx.fillStyle = '#3dffa0'; ctx.beginPath(); ctx.ellipse(cx + 3, cy - S * 0.38, 4, 2, -0.6, 0, Math.PI * 2); ctx.fill(); }
        ctx.restore();
    }

    function star(x, y, n, ro, ri) {
        ctx.beginPath();
        for (let i = 0; i < n * 2; i++) {
            const r = i % 2 ? ri : ro, a = (i * Math.PI) / n - Math.PI / 2;
            ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
        }
        ctx.closePath(); ctx.fill();
    }

    function drawSnake(now) {
        const t = G.state === 'playing' ? Math.min(1, G.acc / interval()) : 1;
        const n = G.snake.length;
        const pts = G.snake.map((p, i) => {
            const a = G.prev[i] || p;
            const jump = Math.abs(a.x - p.x) > 1 || Math.abs(a.y - p.y) > 1; // cruzó un borde
            const k = jump ? 1 : t;
            return { x: (a.x + (p.x - a.x) * k + 0.5) * S, y: (a.y + (p.y - a.y) * k + 0.5) * S };
        });
        // Cuerpo: de la cola a la cabeza para que la cabeza quede encima.
        for (let i = n - 1; i >= 0; i--) {
            const p = pts[i];
            const hue = G.double > 0 ? 260 + (i * 6) % 60 : G.ice > 0 ? 185 + (i * 3) % 30 : 150 - Math.min(i, 30) * 1.2 + Math.sin(now / 300 + i * 0.4) * 6;
            const r = S * (0.46 - Math.min(i / Math.max(n, 1), 1) * 0.16);
            ctx.shadowColor = `hsl(${hue},100%,55%)`; ctx.shadowBlur = i === 0 ? 18 : 8;
            ctx.fillStyle = `hsl(${hue},100%,${i === 0 ? 70 : 55 - Math.min(i, 20)}%)`;
            ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
            // Une con el siguiente segmento para un cuerpo continuo.
            if (i < n - 1) {
                const q = pts[i + 1];
                if (Math.abs(q.x - p.x) <= S * 1.1 && Math.abs(q.y - p.y) <= S * 1.1) {
                    ctx.lineWidth = r * 2; ctx.lineCap = 'round'; ctx.strokeStyle = ctx.fillStyle;
                    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
                }
            }
        }
        ctx.shadowBlur = 0;
        if (!n) return;
        // Ojos
        const h = pts[0], d = G.dir, px = -d.y, py = d.x;
        for (const s of [-1, 1]) {
            const ex = h.x + d.x * S * 0.12 + px * s * S * 0.2, ey = h.y + d.y * S * 0.12 + py * s * S * 0.2;
            ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex, ey, S * 0.12, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#04121f'; ctx.beginPath(); ctx.arc(ex + d.x * 2, ey + d.y * 2, S * 0.06, 0, Math.PI * 2); ctx.fill();
        }
        // Lengua
        if (G.state === 'playing' && Math.floor(now / 400) % 3 === 0) {
            ctx.strokeStyle = '#ff3355'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(h.x + d.x * S * 0.45, h.y + d.y * S * 0.45); ctx.lineTo(h.x + d.x * S * 0.75, h.y + d.y * S * 0.75); ctx.stroke();
        }
    }

    /* ---------------- HUD / ranking / pantallas ---------------- */
    function hud() {
        $('#hud-score').textContent = (G.score || 0).toLocaleString('es-MX');
        $('#hud-best').textContent = (G.best ?? CFG.best[mode] ?? 0).toLocaleString('es-MX');
        $('#hud-len').textContent = G.snake ? G.snake.length : 3;
    }
    function hudPower() {
        const parts = [];
        if (G.double > 0) parts.push('×2 ' + Math.ceil(G.double));
        if (G.ice > 0) parts.push('❄ ' + Math.ceil(G.ice));
        $('#hud-power').textContent = parts.join(' ') || '—';
    }

    function renderRanking() {
        document.querySelectorAll('#snake-tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
        const rows = CFG.leaderboards[tab] || [];
        $('#snake-ranking').innerHTML = rows.length
            ? rows.map((r, i) => `<tr class="${r.user_id === BS.userId ? 'me' : ''}"><td class="pos">${i + 1}</td>
                <td>${BS.esc(r.name)}<br><small style="color:var(--muted)">Longitud ${BS.esc(r.meta.length ?? '—')} · ${BS.esc(r.date || '')}</small></td>
                <td class="pts">${r.score.toLocaleString('es-MX')}</td></tr>`).join('')
            : '<tr><td class="empty">Aún no hay récords en este modo.</td></tr>';
    }

    function paintModes() {
        document.querySelectorAll('#snake-modes button').forEach((b) => b.classList.toggle('on', b.dataset.mode === mode));
    }

    async function gameOver() {
        G.state = 'over';
        const score = G.score, length = G.eaten + 3;
        const dur = Math.max(1, Math.round((performance.now() - G.t0) / 1000));
        const ov = $('#snake-overlay');
        ov.className = 'pac-overlay go'; ov.hidden = false;
        ov.innerHTML = `<div><h2>¡CHOCASTE!</h2><div class="pac-final">${score.toLocaleString('es-MX')}</div>
            <p id="go-msg">${score ? 'Guardando tu puntaje…' : '¡Inténtalo de nuevo!'}</p>
            <div class="actions"><button class="btn" id="btn-again" style="--c1:#3dffa0;--c2:#0c8a5a;color:#04121f">↻ Otra vez</button>
            <button class="btn ghost" id="btn-menu">Cambiar modo</button>
            <a class="btn ghost" href="${BS.base}/">🎮 Sala de juegos</a></div></div>`;
        $('#btn-again').onclick = start;
        $('#btn-menu').onclick = () => location.reload();
        if (!score) return;
        try {
            const r = await BS.api('POST', '/puntajes/snake', { mode: G.mode, score, duration: dur, meta: { length } });
            CFG.leaderboards[G.mode] = r.leaderboard; CFG.best[G.mode] = r.best; tab = G.mode; renderRanking();
            G.best = r.best; hud();
            $('#go-msg').innerHTML = (r.new_best ? '<span class="new-best">★ ¡NUEVO RÉCORD PERSONAL! ★</span><br>' : '')
                + `Longitud ${length} · lugar <b>#${r.rank}</b> en ${BS.esc(CFG.modes[G.mode])}.`;
            if (r.new_best) { BS.sfx.victory(); BS.fx.confetti(); }
        } catch (e) { $('#go-msg').textContent = 'No se pudo guardar: ' + e.message; }
    }

    function pause() {
        if (G.state === 'playing') G.state = 'paused';
        else if (G.state === 'paused') { G.state = 'playing'; last = performance.now(); }
    }

    /* ---------------- Controles ---------------- */
    function turn(name) {
        if (G.state !== 'playing') return;
        const d = DIRS[name];
        const lastDir = G.queue.length ? G.queue[G.queue.length - 1] : G.dir;
        if ((d.x === lastDir.x && d.y === lastDir.y) || (d.x === -lastDir.x && d.y === -lastDir.y)) return;
        if (G.queue.length < 3) { G.queue.push(d); snd.turn(); }
    }
    const KEYS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right', W: 'up', S: 'down', A: 'left', D: 'right' };
    window.addEventListener('keydown', (e) => {
        if (e.target.closest && e.target.closest('input, textarea')) return;
        if (KEYS[e.key]) { e.preventDefault(); turn(KEYS[e.key]); }
        else if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') pause();
        else if ((e.key === 'Enter' || e.key === ' ') && (G.state === 'title' || G.state === 'over')) { e.preventDefault(); start(); }
    });
    let touch = null;
    canvas.addEventListener('touchstart', (e) => { touch = [e.touches[0].clientX, e.touches[0].clientY]; }, { passive: true });
    canvas.addEventListener('touchmove', (e) => {
        if (!touch) return;
        const dx = e.touches[0].clientX - touch[0], dy = e.touches[0].clientY - touch[1];
        if (Math.hypot(dx, dy) < 18) return;
        turn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
        touch = [e.touches[0].clientX, e.touches[0].clientY];
        e.preventDefault();
    }, { passive: false });
    document.querySelectorAll('#pac-dpad button').forEach((b) => b.addEventListener('pointerdown', (e) => { e.preventDefault(); turn(b.dataset.dir); }));
    window.addEventListener('blur', () => { if (G.state === 'playing') pause(); });
    document.querySelectorAll('#snake-modes button').forEach((b) => b.addEventListener('click', () => {
        mode = b.dataset.mode; tab = mode;
        try { localStorage.setItem('snake-mode', mode); } catch (e) { /* */ }
        paintModes(); renderRanking(); BS.sfx.click(); hud();
    }));
    document.querySelectorAll('#snake-tabs button').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab; renderRanking(); }));
    $('#btn-start').addEventListener('click', start);

    paintModes(); renderRanking(); hud();
    requestAnimationFrame(frame);
})();
