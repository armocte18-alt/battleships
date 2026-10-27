/* ==========================================================================
   SIOS ARCADE · PING PONG
   --------------------------------------------------------------------------
   Contra la CPU todo se simula aquí. En línea (2 jugadores, cada uno en su
   PC) la pelota tiene un "dueño": el jugador hacia quien se dirige. Su
   navegador decide si la devuelve o si es punto, y lo anuncia con un número
   de secuencia mayor; el otro navegador extrapola la trayectoria mientras
   tanto. Así cada quien golpea con su paleta real, sin retraso de red.
   ========================================================================== */
(function () {
    'use strict';
    const BS = window.BS;
    const CFG = window.PONG;
    const $ = (s) => document.querySelector(s);

    const W = 1280, H = 720;
    const PW = 16, PH = 124, BR = 10;
    const PX = [56, W - 56 - PW];              // borde izquierdo de cada paleta
    const FACE = [PX[0] + PW, PX[1]];           // cara que golpea la pelota
    const V0 = 560, VMAX = 1500, SPEEDUP = 1.06, KEY_V = 950, MAX_BOUNCE = 0.96;
    const NET_MS = 50;
    const DIFF = {
        // miss = probabilidad de calcular mal el golpe en una jugada (para que se pueda vencer).
        easy: { name: 'Fácil', speed: 380, react: 0.32, err: 75, miss: 0.32 },
        normal: { name: 'Normal', speed: 560, react: 0.16, err: 36, miss: 0.17 },
        hard: { name: 'Difícil', speed: 860, react: 0.05, err: 12, miss: 0.07 },
    };

    const canvas = $('#pong-canvas');
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.scale(dpr, dpr);
    const overlay = $('#pong-overlay');

    const rnd = (a, b) => a + Math.random() * (b - a);
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const num = (v, d = 0) => (Number.isFinite(+v) ? +v : d);
    const r1 = (n) => Math.round(n * 10) / 10;

    /* ---------------- Sonido ---------------- */
    const tone = (...a) => BS.sfx.tone(...a);
    const snd = {
        hit(speed) { const f = 380 + (speed / VMAX) * 700; tone(f, 0.08, { type: 'square', vol: 0.08, slide: f * 1.4 }); },
        wall() { tone(240, 0.05, { type: 'triangle', vol: 0.07 }); },
        point(mine) { mine ? [660, 880, 1320].forEach((f, i) => tone(f, 0.12, { type: 'triangle', vol: 0.09, delay: i * 0.07 })) : tone(220, 0.4, { type: 'sawtooth', vol: 0.07, slide: 90 }); },
        serve() { tone(520, 0.08, { type: 'sine', vol: 0.06 }); },
    };

    /* ---------------- Estado ---------------- */
    let ui = 'menu';              // menu | waiting | playing | over
    let mode = 'cpu';             // cpu | pvp
    let difficulty = 'normal';
    try { difficulty = localStorage.getItem('pong-diff') || 'normal'; } catch (e) { /* */ }
    if (!DIFF[difficulty]) difficulty = 'normal';
    let room = null, isHost = true, mySide = 0;
    let names = ['', ''];
    let paddles = [{ y: H / 2, vy: 0 }, { y: H / 2, vy: 0 }];
    let ball = null;              // { s, x, y, vx, vy, wait, checked }
    let lost = [0, 0];            // puntos concedidos por cada lado
    let paused = false, t0 = 0, shake = 0, flash = null;
    let keys = {}, pointerY = null;
    const trail = [], particles = [];
    let cpu = { err: 0, reactAt: 0 };
    // En línea
    let peer = { y: H / 2, vy: 0, at: 0, seen: 0 };
    let lastRtt = 60, netToken = 0, peerLostSince = 0;

    const score = (side) => lost[1 - side];
    const owner = () => (ball ? (ball.vx < 0 ? 0 : 1) : -1);
    const authoritative = (side) => mode === 'cpu' || side === mySide;

    /* ---------------- Física ---------------- */
    function serve(towardSide, wait = 1.0) {
        const a = rnd(-0.42, 0.42), dir = towardSide === 0 ? -1 : 1;
        ball = { s: (ball ? ball.s : 0) + 1, x: W / 2, y: clamp(H / 2 + rnd(-140, 140), 80, H - 80), vx: dir * Math.cos(a) * V0, vy: Math.sin(a) * V0, wait, checked: false, kind: 2 };
        trail.length = 0;
        if (mode === 'cpu' || towardSide !== mySide) cpu.reactAt = 0;
    }

    function stepBall(dt, effects = true) {
        if (!ball) return;
        if (ball.wait > 0) { ball.wait -= dt; if (ball.wait <= 0 && effects) snd.serve(); return; }
        ball.x += ball.vx * dt; ball.y += ball.vy * dt;
        if (ball.y < BR) { ball.y = 2 * BR - ball.y; ball.vy = Math.abs(ball.vy); if (effects) { snd.wall(); burst(ball.x, BR, 6, '#ffffff'); } }
        if (ball.y > H - BR) { ball.y = 2 * (H - BR) - ball.y; ball.vy = -Math.abs(ball.vy); if (effects) { snd.wall(); burst(ball.x, H - BR, 6, '#ffffff'); } }

        const side = owner();
        const face = FACE[side];
        const reached = side === 0 ? ball.x - BR <= face : ball.x + BR >= face;
        if (!reached) return;

        if (!authoritative(side)) {
            // No me toca decidir: espero al rival con la pelota en su cara de paleta.
            ball.x = side === 0 ? face + BR : face - BR;
            return;
        }
        if (!ball.checked) {
            ball.checked = true;
            const p = paddles[side];
            if (Math.abs(ball.y - p.y) <= PH / 2 + BR * 0.8) return hit(side);
        }
        // Se le escapó: punto para el otro lado cuando la pelota sale de la mesa.
        if (ball.x < -40 || ball.x > W + 40) point(side);
    }

    function hit(side) {
        const p = paddles[side];
        const rel = clamp((ball.y - p.y) / (PH / 2), -1, 1);
        const speed = Math.min(VMAX, Math.hypot(ball.vx, ball.vy) * SPEEDUP);
        const ang = rel * MAX_BOUNCE;
        const dir = side === 0 ? 1 : -1;
        ball.x = side === 0 ? FACE[0] + BR : FACE[1] - BR;
        ball.vx = dir * Math.cos(ang) * speed;
        ball.vy = clamp(Math.sin(ang) * speed + p.vy * 0.18, -speed * 0.85, speed * 0.85);
        ball.s++; ball.checked = false; ball.kind = 1;
        hitFx(side);
        if (mode === 'cpu' && side === 0) newCpuError();
    }

    function hitFx(side) {
        snd.hit(Math.hypot(ball.vx, ball.vy));
        burst(ball.x, ball.y, 18, CFG.colors[side]);
        flash = { side, t: 0.25 };
    }

    function point(loserSide) {
        lost[loserSide]++;
        const winner = 1 - loserSide;
        const mine = mode === 'cpu' ? winner === 0 : winner === mySide;
        pointFx(loserSide, mine);
        if (gameWinner() === null) serve(loserSide, 1.1);
        else { ball = null; finish(); }
    }

    function pointFx(loserSide, mine) {
        snd.point(mine);
        shake = 0.8;
        const x = loserSide === 0 ? 30 : W - 30;
        burst(x, ball ? clamp(ball.y, 40, H - 40) : H / 2, 40, CFG.colors[1 - loserSide]);
        callout(mine ? '¡PUNTO!' : (mode === 'cpu' ? 'PUNTO CPU' : 'PUNTO RIVAL'), CFG.colors[1 - loserSide]);
    }

    const gameWinner = () => (score(0) >= CFG.target ? 0 : score(1) >= CFG.target ? 1 : null);

    /* ---------------- Paletas ---------------- */
    function movePaddle(side, dt) {
        const p = paddles[side];
        const before = p.y;
        if (pointerY !== null) {
            const d = pointerY - p.y, step = 2400 * dt;
            p.y += clamp(d, -step, step);
        }
        const k = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
        if (k) { p.y += k * KEY_V * dt; pointerY = null; }
        p.y = clamp(p.y, PH / 2, H - PH / 2);
        p.vy = dt ? (p.y - before) / dt : 0;
    }

    function newCpuError() {
        const d = DIFF[difficulty];
        cpu.err = rnd(-d.err, d.err) + (difficulty === 'hard' ? rnd(-30, 30) : 0); // el difícil busca ángulos
        if (Math.random() < d.miss) cpu.err = (Math.random() < 0.5 ? -1 : 1) * rnd(PH / 2 + BR + 8, PH / 2 + 60);
        cpu.reactAt = performance.now() + d.react * 1000;
    }

    /** Dónde cruzará la pelota la línea x (con rebotes en las bandas). */
    function predictY(x) {
        if (!ball || ball.vx === 0) return H / 2;
        const t = (x - ball.x) / ball.vx;
        if (t < 0) return H / 2;
        let y = ball.y + ball.vy * t;
        const span = H - 2 * BR;
        y = ((y - BR) % (2 * span) + 2 * span) % (2 * span);
        return BR + (y > span ? 2 * span - y : y);
    }

    function moveCpu(dt) {
        const p = paddles[1], d = DIFF[difficulty];
        const before = p.y;
        let target = H / 2;
        if (ball && ball.vx > 0 && ball.wait <= 0 && performance.now() >= cpu.reactAt) target = predictY(FACE[1] - BR) + cpu.err;
        else if (ball && ball.vx > 0) target = p.y;
        const step = d.speed * dt;
        p.y = clamp(p.y + clamp(target - p.y, -step, step), PH / 2, H - PH / 2);
        p.vy = (p.y - before) / dt;
    }

    /* ---------------- Efectos ---------------- */
    function burst(x, y, n, col) {
        for (let i = 0; i < n; i++) {
            const a = rnd(0, Math.PI * 2), v = rnd(60, 380);
            particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rnd(0.3, 0.8), col });
        }
    }
    let callouts = [];
    function callout(text, col) { callouts = [{ text, col, t: 1.2 }]; }

    /* ---------------- Red ---------------- */
    function packet() {
        return {
            p: [r1(paddles[mySide].y), r1(paddles[mySide].vy)],
            l: lost[mySide],
            b: ball ? [ball.s, r1(ball.x), r1(ball.y), r1(ball.vx), r1(ball.vy), +ball.wait.toFixed(3), ball.kind || 0] : null,
        };
    }

    async function netLoop(token) {
        // Sigue un momento tras terminar para que el rival reciba el marcador final.
        while ((ui === 'playing' || ui === 'over') && token === netToken) {
            const started = performance.now();
            try {
                const res = await fetch(`${BS.base}/pingpong/salas/${room.id}/sync`, {
                    method: 'POST', credentials: 'same-origin',
                    headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content },
                    body: JSON.stringify(packet()),
                });
                lastRtt = lastRtt * 0.8 + (performance.now() - started) * 0.2;
                if (res.ok) receive(await res.json());
            } catch (e) { /* reintenta */ }
            const wait = NET_MS - (performance.now() - started);
            if (wait > 0) await BS.sleep(wait);
        }
    }

    function receive(data) {
        if (ui !== 'playing') return;
        const now = performance.now();
        const d = data.peers[isHost ? '1' : '0'];
        if (!d || num(d.age) > 4) { if (!peerLostSince) peerLostSince = now; }
        else peerLostSince = 0;
        if (peerLostSince && now - peerLostSince > 12000) return abandon();
        if (!d || !d.d) return;

        const pk = d.d, age = clamp(num(d.age) + lastRtt / 2000, 0, 1);
        const other = 1 - mySide;
        if (Array.isArray(pk.p)) { peer.y = clamp(num(pk.p[0], H / 2), PH / 2, H - PH / 2); peer.vy = clamp(num(pk.p[1]), -3000, 3000); peer.at = now - age * 1000; }
        const peerLost = Math.max(lost[other], Math.floor(num(pk.l)));

        if (Array.isArray(pk.b)) {
            const [s, x, y, vx, vy, wait, kind] = pk.b.map((v) => num(v));
            const valid = Math.hypot(vx, vy) <= VMAX * 1.2 && x > -200 && x < W + 200 && y > -50 && y < H + 50;
            if (valid && s > (ball ? ball.s : 0)) {
                const wasLost = peerLost > lost[other];
                lost[other] = peerLost;
                ball = { s, x, y, vx, vy, wait, checked: false, kind };
                if (kind === 1) hitFx(other);
                if (wasLost) pointFx(other, true);
                trail.length = 0;
                // Pone la pelota donde está "ahora" (la información viene con retraso).
                for (let t = age; t > 0; t -= 1 / 120) stepBall(Math.min(1 / 120, t), false);
            } else if (valid && ball && s === ball.s && owner() === other && ball.wait <= 0) {
                // Misma jugada: corrige la deriva hacia la posición del dueño.
                const px = x + vx * age, py = y + vy * age;
                if (px > 0 && px < W && py > BR && py < H - BR) {
                    const k = Math.hypot(px - ball.x, py - ball.y) > 60 ? 1 : 0.25;
                    ball.x += (px - ball.x) * k; ball.y += (py - ball.y) * k;
                }
            }
        }
        lost[other] = Math.max(lost[other], peerLost);
        if (gameWinner() !== null && ui === 'playing') { ball = null; finish(); }
        if (data.status === 'finished' && gameWinner() === null) abandon();
    }

    /* ---------------- Bucle ---------------- */
    let last = performance.now();
    function frame(now) {
        const dt = Math.min(0.033, (now - last) / 1000);
        last = now;
        if (ui === 'playing' && !paused) {
            movePaddle(mySide, dt);
            if (mode === 'cpu') moveCpu(dt);
            else {
                // Paleta del rival: extrapola un poco su movimiento.
                const ahead = Math.min(0.12, (now - peer.at) / 1000);
                paddles[1 - mySide].y = clamp(peer.y + peer.vy * ahead, PH / 2, H - PH / 2);
                paddles[1 - mySide].vy = peer.vy;
            }
            // Sub-pasos para que la pelota rápida no atraviese la paleta.
            const n = 4;
            for (let i = 0; i < n && ball; i++) stepBall(dt / n);
            if (ball && ball.wait <= 0) { trail.push([ball.x, ball.y]); if (trail.length > 14) trail.shift(); }
        }
        particles.forEach((p) => { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.94; p.vy *= 0.94; p.life -= dt; });
        for (let i = particles.length - 1; i >= 0; i--) if (particles[i].life <= 0) particles.splice(i, 1);
        callouts.forEach((c) => { c.t -= dt; });
        callouts = callouts.filter((c) => c.t > 0);
        if (flash) { flash.t -= dt; if (flash.t <= 0) flash = null; }
        shake = Math.max(0, shake - dt * 2.5);
        draw(now);
        requestAnimationFrame(frame);
    }

    /* ---------------- Dibujo ---------------- */
    function draw(now) {
        ctx.save();
        if (shake) ctx.translate(rnd(-1, 1) * 10 * shake, rnd(-1, 1) * 10 * shake);
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#050b1c'); g.addColorStop(1, '#02040c');
        ctx.fillStyle = g; ctx.fillRect(-20, -20, W + 40, H + 40);
        // Brillo de cada mitad con el color del jugador
        [0, 1].forEach((s) => {
            const rg = ctx.createRadialGradient(s ? W : 0, H / 2, 0, s ? W : 0, H / 2, 620);
            rg.addColorStop(0, s ? 'rgba(255,51,153,.10)' : 'rgba(63,242,255,.10)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
        });
        // Rejilla sutil y red central
        ctx.strokeStyle = 'rgba(255,255,255,.035)'; ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = 0; x <= W; x += 64) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
        for (let y = 0; y <= H; y += 64) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
        ctx.stroke();
        ctx.setLineDash([18, 16]); ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(W / 2, 10); ctx.lineTo(W / 2, H - 10); ctx.stroke(); ctx.setLineDash([]);
        ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(W / 2, H / 2, 90, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,194,61,.5)'; ctx.lineWidth = 3; ctx.shadowColor = '#ffc23d'; ctx.shadowBlur = 12;
        ctx.strokeRect(4, 4, W - 8, H - 8); ctx.shadowBlur = 0;

        if (ui === 'playing' || ui === 'over') {
            drawScore();
            [0, 1].forEach(drawPaddle);
            drawBall(now);
        }
        // Partículas
        ctx.globalCompositeOperation = 'lighter';
        particles.forEach((p) => { ctx.globalAlpha = Math.max(0, p.life * 1.5); ctx.fillStyle = p.col; ctx.fillRect(p.x - 2, p.y - 2, 4, 4); });
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';

        callouts.forEach((c) => {
            const k = Math.min(1, c.t * 2.5), sc = 1 + (1.2 - c.t) * 0.15;
            ctx.save(); ctx.translate(W / 2, H / 2 - 120); ctx.scale(sc, sc);
            ctx.globalAlpha = k; ctx.textAlign = 'center'; ctx.font = '64px "Black Ops One", Impact, sans-serif';
            ctx.fillStyle = c.col; ctx.shadowColor = c.col; ctx.shadowBlur = 24; ctx.fillText(c.text, 0, 0);
            ctx.restore();
        });
        if (ui === 'playing' && ball && ball.wait > 0 && !callouts.length) {
            ctx.textAlign = 'center'; ctx.font = '28px "Black Ops One", Impact, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,.8)';
            ctx.fillText(ball.wait > 0.6 ? '¡LISTOS!' : '¡SAQUE!', W / 2, H / 2 - 120);
        }
        if (paused) { ctx.textAlign = 'center'; ctx.font = '56px "Black Ops One", Impact, sans-serif'; ctx.fillStyle = '#ffc23d'; ctx.fillText('PAUSA', W / 2, H / 2 + 20); }
        if (peerLostSince && ui === 'playing') { ctx.textAlign = 'center'; ctx.font = '700 18px Montserrat, sans-serif'; ctx.fillStyle = '#ffc23d'; ctx.fillText('Esperando conexión con ' + names[1 - mySide] + '…', W / 2, H - 40); }
        ctx.restore();
    }

    function drawScore() {
        ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        [0, 1].forEach((s) => {
            const x = s ? W / 2 + 120 : W / 2 - 120;
            ctx.font = '84px "Black Ops One", Impact, sans-serif';
            ctx.fillStyle = CFG.colors[s]; ctx.shadowColor = CFG.colors[s]; ctx.shadowBlur = 22;
            ctx.fillText(String(score(s)), x, 26);
            ctx.shadowBlur = 0; ctx.font = '700 13px Montserrat, sans-serif'; ctx.fillStyle = 'rgba(230,244,255,.75)';
            const me = mode === 'cpu' ? s === 0 : s === mySide;
            ctx.fillText(((me ? 'TÚ · ' : '') + names[s]).toUpperCase().slice(0, 30), x, 116);
        });
        ctx.font = '700 12px Montserrat, sans-serif'; ctx.fillStyle = 'rgba(230,244,255,.45)';
        ctx.fillText('A ' + CFG.target + ' PUNTOS', W / 2, H - 30);
        ctx.textBaseline = 'alphabetic';
    }

    function drawPaddle(s) {
        const p = paddles[s], col = CFG.colors[s];
        const lit = flash && flash.side === s ? flash.t / 0.25 : 0;
        ctx.save();
        ctx.shadowColor = col; ctx.shadowBlur = 20 + lit * 30;
        const gr = ctx.createLinearGradient(PX[s], 0, PX[s] + PW, 0);
        gr.addColorStop(0, col); gr.addColorStop(0.5, lit ? '#ffffff' : '#e8fbff'); gr.addColorStop(1, col);
        ctx.fillStyle = gr;
        roundRect(PX[s], p.y - PH / 2, PW, PH, 8); ctx.fill();
        ctx.restore();
    }

    function drawBall(now) {
        if (!ball) return;
        const sp = Math.hypot(ball.vx, ball.vy);
        const heat = clamp((sp - V0) / (VMAX - V0), 0, 1);
        const col = `hsl(${190 - heat * 180},100%,${60 + heat * 5}%)`;
        trail.forEach(([x, y], i) => {
            ctx.globalAlpha = (i / trail.length) * 0.45;
            ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, BR * (0.4 + (i / trail.length) * 0.6), 0, Math.PI * 2); ctx.fill();
        });
        ctx.globalAlpha = ball.wait > 0 ? 0.5 + 0.5 * Math.abs(Math.sin(now / 120)) : 1;
        ctx.shadowColor = col; ctx.shadowBlur = 26;
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(ball.x, ball.y, BR, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0; ctx.globalAlpha = 1;
    }

    function roundRect(x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
    }

    /* ---------------- Pantallas ---------------- */
    function showOverlay(html) { overlay.hidden = false; overlay.innerHTML = `<div class="ast-menu">${html}</div>`; }
    const padIcon = (c) => `<svg viewBox="0 0 40 40"><rect x="15" y="4" width="10" height="32" rx="5" fill="none" stroke="${c}" stroke-width="3"/></svg>`;

    let roomsTimer = null, roomTimer = null;
    function menu() {
        ui = 'menu'; room = null; netToken++; clearTimeout(roomTimer);
        showOverlay(`<h2>PING PONG</h2>
            <div class="pong-modes">
                <div class="pong-card"><h3>🤖 Contra la CPU</h3>
                    <div class="ms-levels" id="pong-diff">${Object.entries(DIFF).map(([k, d]) => `<button type="button" data-d="${k}">${d.name}</button>`).join('')}</div>
                    <button class="btn" id="pong-cpu" style="--c1:#ffc23d;--c2:#d17a00;color:#04121f">▶ Jugar</button></div>
                <div class="pong-card"><h3>👥 Contra un compañero</h3>
                    <p style="margin:0;font-size:13px">Abre una mesa y espera a tu rival, o únete a una abierta.</p>
                    <button class="btn" id="pong-create" style="--c1:#ff3399;--c2:#8a1250">🏓 Abrir mesa</button></div>
            </div>
            <div style="width:100%"><div class="game-tagline" style="color:#ffc23d;margin-bottom:8px">Mesas abiertas</div>
            <div class="ast-rooms" id="pong-rooms"><div class="empty">Buscando mesas…</div></div></div>`);
        const paintDiff = () => document.querySelectorAll('#pong-diff button').forEach((b) => b.classList.toggle('on', b.dataset.d === difficulty));
        paintDiff();
        document.querySelectorAll('#pong-diff button').forEach((b) => b.onclick = () => {
            difficulty = b.dataset.d; paintDiff(); BS.sfx.click();
            try { localStorage.setItem('pong-diff', difficulty); } catch (e) { /* */ }
        });
        $('#pong-cpu').onclick = () => startGame('cpu');
        $('#pong-create').onclick = async () => { try { enterRoom(await BS.api('POST', '/pingpong/salas')); } catch (e) { BS.error(e); } };
        pollRooms();
    }

    async function pollRooms() {
        clearTimeout(roomsTimer);
        if (ui !== 'menu') return;
        try {
            const d = await BS.api('GET', '/pingpong/salas');
            if (ui !== 'menu') return;
            if (d.mine) return enterRoom(d.mine);
            const box = $('#pong-rooms');
            if (box) {
                box.innerHTML = d.rooms.length ? d.rooms.map((r) => `
                    <div class="ast-room"><div class="dots">${[0, 1].map((i) => `<i style="${r.players[i] ? `background:${CFG.colors[i]};box-shadow:0 0 8px ${CFG.colors[i]}` : ''}"></i>`).join('')}</div>
                    <div class="info"><b>Mesa #${Number(r.id)} · ${BS.esc(r.players[0]?.name || '')}</b>${r.players.length < 2 ? 'Esperando rival' : 'Mesa llena'}</div>
                    <button class="btn sm" data-join="${Number(r.id)}" ${r.players.length >= 2 ? 'disabled' : ''} style="--c1:#ff3399;--c2:#8a1250">Jugar</button></div>`).join('')
                    : '<div class="empty">No hay mesas abiertas. ¡Abre una y reta a un compañero!</div>';
                box.querySelectorAll('[data-join]').forEach((b) => b.onclick = async () => {
                    b.disabled = true;
                    try { enterRoom(await BS.api('POST', `/pingpong/salas/${b.dataset.join}/unirse`)); } catch (e) { BS.error(e); b.disabled = false; }
                });
            }
        } catch (e) { /* */ }
        roomsTimer = setTimeout(pollRooms, 2500);
    }

    function enterRoom(r) {
        clearTimeout(roomsTimer);
        room = r;
        isHost = r.host_id === CFG.me.id;
        mySide = (r.players.find((p) => p.id === CFG.me.id) || {}).slot ?? 0;
        if (r.status === 'playing' && r.players.length === 2) return startGame('pvp');
        ui = 'waiting';
        renderWaiting();
        pollRoom();
    }

    function renderWaiting() {
        const slots = [0, 1].map((i) => {
            const p = room.players.find((pl) => pl.slot === i), c = CFG.colors[i];
            return p ? `<div class="ast-slot on" style="--c:${c}">${padIcon(c)}<b>${BS.esc(p.name)}</b><small>${i === 0 ? 'Lado izquierdo' : 'Lado derecho'}${p.id === CFG.me.id ? ' · tú' : ''}</small></div>`
                : `<div class="ast-slot" style="--c:${c}">${padIcon('rgba(255,255,255,.25)')}<small>Esperando rival…</small></div>`;
        }).join('');
        const full = room.players.length === 2;
        showOverlay(`<h2 style="font-size:40px">MESA #${Number(room.id)}</h2>
            <p>${isHost ? (full ? '¡Tu rival llegó! Cuando quieras, comienza la partida.' : 'Esperando a que un compañero se una a tu mesa…') : 'Esperando a que el anfitrión inicie la partida…'}</p>
            <div class="ast-slots">${slots}</div>
            <div class="actions">
                ${isHost ? `<button class="btn big" id="pong-go" ${full ? '' : 'disabled'} style="--c1:#ffc23d;--c2:#d17a00;color:#04121f">🏓 ¡A jugar!</button>` : ''}
                <button class="btn ghost" id="pong-leave">Salir de la mesa</button>
            </div>`);
        if (isHost) $('#pong-go').onclick = async () => {
            try { const r = await BS.api('POST', `/pingpong/salas/${room.id}/iniciar`); room = r; startGame('pvp'); } catch (e) { BS.error(e); }
        };
        $('#pong-leave').onclick = async () => {
            clearTimeout(roomTimer);
            await BS.api('POST', `/pingpong/salas/${room.id}/salir`).catch(() => {});
            menu();
        };
    }

    async function pollRoom() {
        clearTimeout(roomTimer);
        if (ui !== 'waiting') return;
        try {
            const r = await BS.api('GET', `/pingpong/salas/${room.id}`);
            if (ui !== 'waiting') return;
            if (r.status === 'finished') { BS.toast('El anfitrión cerró la mesa.'); return menu(); }
            const changed = JSON.stringify(r.players) !== JSON.stringify(room.players);
            room = r;
            if (changed) { BS.sfx.message(); renderWaiting(); }
            if (r.status === 'playing') return startGame('pvp');
        } catch (e) {
            if (/403|No estás/.test(e.message)) return menu();
        }
        roomTimer = setTimeout(pollRoom, 1000);
    }

    function startGame(m) {
        clearTimeout(roomsTimer); clearTimeout(roomTimer);
        mode = m; overlay.hidden = true; ui = 'playing'; paused = false;
        lost = [0, 0]; ball = null; trail.length = 0; particles.length = 0; callouts = [];
        paddles = [{ y: H / 2, vy: 0 }, { y: H / 2, vy: 0 }];
        peer = { y: H / 2, vy: 0, at: performance.now(), seen: 0 }; peerLostSince = 0;
        t0 = performance.now();
        if (mode === 'cpu') {
            mySide = 0; names = [CFG.me.name, 'CPU · ' + DIFF[difficulty].name];
            newCpuError();
            serve(Math.random() < 0.5 ? 0 : 1, 1.6);
        } else {
            names = [0, 1].map((i) => (room.players.find((p) => p.slot === i) || {}).name || 'Jugador');
            // El anfitrión pone la primera pelota en juego, hacia el invitado.
            if (isHost) serve(1, 2.0);
            netLoop(++netToken);
        }
        BS.sfx.alarm();
    }

    async function finish() {
        if (ui !== 'playing') return;
        ui = 'over';
        const w = gameWinner();
        const mine = mode === 'cpu' ? 0 : mySide;
        const won = w === mine;
        const myPts = score(mine), oppPts = score(1 - mine);
        // En línea sigue mandando el marcador final un momento para que el rival lo reciba.
        if (mode === 'pvp') setTimeout(() => { netToken++; }, 1500);
        if (mode === 'pvp' && isHost) setTimeout(() => BS.api('POST', `/pingpong/salas/${room.id}/terminar`).catch(() => {}), 1600);
        if (won) { BS.sfx.victory(); BS.fx.confetti(); } else BS.sfx.defeat();
        showOverlay(`<h2>${won ? '¡VICTORIA!' : 'DERROTA'}</h2>
            <div class="pac-final"><span style="color:${CFG.colors[mine]}">${myPts}</span> – <span style="color:${CFG.colors[1 - mine]}">${oppPts}</span></div>
            <p>${won ? 'Ganaste' : 'Perdiste'} contra <b>${BS.esc(names[1 - mine])}</b>.</p>
            <p id="pong-msg">Guardando resultado…</p>
            <div class="actions"><button class="btn" id="pong-again" style="--c1:#ffc23d;--c2:#d17a00;color:#04121f">↻ Menú</button>
            <a class="btn ghost" href="${BS.base}/">🎮 Sala de juegos</a></div>`);
        $('#pong-again').onclick = menu;
        try {
            const r = await BS.api('POST', '/pingpong/resultados', {
                mode: mode === 'cpu' ? 'cpu_' + difficulty : 'pvp', me: myPts, opp: oppPts,
                duration: Math.max(5, Math.round((performance.now() - t0) / 1000)), room_id: room ? room.id : null,
            });
            renderRanking(r.leaderboard, r.mine);
            const m = $('#pong-msg');
            if (m) m.textContent = won ? '¡Victoria registrada en el ranking!' : 'Resultado guardado. ¡La revancha te espera!';
        } catch (e) { const m = $('#pong-msg'); if (m) m.textContent = 'No se pudo guardar: ' + e.message; }
    }

    function abandon() {
        if (ui !== 'playing') return;
        ui = 'over'; netToken++; ball = null;
        showOverlay(`<h2>MESA ABANDONADA</h2><p>${BS.esc(names[1 - mySide])} se desconectó. La partida no cuenta para el ranking.</p>
            <div class="actions"><button class="btn" id="pong-again" style="--c1:#ffc23d;--c2:#d17a00;color:#04121f">↻ Menú</button></div>`);
        $('#pong-again').onclick = menu;
    }

    function renderRanking(rows, mine) {
        $('#pong-ranking').innerHTML = rows.length
            ? rows.map((r, i) => `<tr class="${r.user_id === BS.userId ? 'me' : ''}"><td class="pos">${i + 1}</td>
                <td>${BS.esc(r.name)}<br><small style="color:var(--muted)">${Number(r.wins)}V · ${Number(r.losses)}D · ${Number(r.pvp_wins)} vs compañeros</small></td>
                <td class="pts">${Number(r.points)}</td></tr>`).join('')
            : '<tr><td class="empty">Nadie ha jugado todavía. ¡Estrena la mesa!</td></tr>';
        $('#pong-mine').innerHTML = mine ? `Tus victorias: <b>${Number(mine.wins)}</b> · derrotas: <b>${Number(mine.losses)}</b>` : 'Aún no tienes partidas.';
    }

    /* ---------------- Controles ---------------- */
    function pointerToY(e) {
        const r = canvas.getBoundingClientRect();
        return ((e.clientY - r.top) / r.height) * H;
    }
    canvas.addEventListener('pointermove', (e) => { if (ui === 'playing') pointerY = pointerToY(e); });
    canvas.addEventListener('pointerdown', (e) => { if (ui === 'playing') { pointerY = pointerToY(e); canvas.setPointerCapture(e.pointerId); } });
    const KEYMAP = { ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down' };
    window.addEventListener('keydown', (e) => {
        if (e.target.closest && e.target.closest('input, textarea')) return;
        if (KEYMAP[e.key] && ui === 'playing') { e.preventDefault(); keys[KEYMAP[e.key]] = true; }
        if ((e.key === 'p' || e.key === 'P') && ui === 'playing' && mode === 'cpu') paused = !paused;
    });
    window.addEventListener('keyup', (e) => { if (KEYMAP[e.key]) keys[KEYMAP[e.key]] = false; });
    window.addEventListener('blur', () => { keys = {}; if (ui === 'playing' && mode === 'cpu') paused = true; });

    renderRanking(CFG.leaderboard || [], CFG.mine);
    menu();
    requestAnimationFrame(frame);
})();
