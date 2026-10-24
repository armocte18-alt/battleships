/* ==========================================================================
   SIOS ARCADE · ASTEROIDES (1 a 3 jugadores)
   --------------------------------------------------------------------------
   Modelo de red: el navegador del anfitrión (jugador 0) simula el mundo:
   asteroides, platillo, balas, colisiones, puntos y vidas. Cada jugador
   pilota su nave localmente (respuesta inmediata) y envía su estado y sus
   disparos ~10 veces por segundo; el anfitrión manda una "foto" del mundo
   que los invitados extrapolan (todo se mueve en línea recta, así que la
   extrapolación es exacta entre fotos).
   ========================================================================== */
(function () {
    'use strict';
    const BS = window.BS;
    const CFG = window.AST;
    const $ = (s) => document.querySelector(s);

    const W = 1280, H = 720;
    const TAU = Math.PI * 2;
    const R = { 3: 46, 2: 24, 1: 12 };
    const POINTS = { 3: 20, 2: 50, 1: 100 };
    const NET_MS = 95;

    const canvas = $('#ast-canvas');
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.scale(dpr, dpr);
    const overlay = $('#ast-overlay');

    const rnd = (a, b) => a + Math.random() * (b - a);
    const wrapX = (x) => ((x % W) + W) % W;
    const wrapY = (y) => ((y % H) + H) % H;
    // Distancia mínima considerando que el mapa se envuelve en los bordes.
    function dist2(ax, ay, bx, by) {
        let dx = Math.abs(ax - bx), dy = Math.abs(ay - by);
        if (dx > W / 2) dx = W - dx;
        if (dy > H / 2) dy = H - dy;
        return dx * dx + dy * dy;
    }
    const r1 = (n) => Math.round(n * 10) / 10;
    // Los datos de otros navegadores no son de confianza: solo números finitos.
    const num = (v, d = 0) => (Number.isFinite(+v) ? +v : d);
    const cleanShip = (s) => (s && typeof s === 'object'
        ? { x: wrapX(num(s.x)), y: wrapY(num(s.y)), vx: num(s.vx), vy: num(s.vy), a: num(s.a), th: s.th ? 1 : 0, al: s.al ? 1 : 0, inv: s.inv ? 1 : 0 }
        : null);

    /* ---------------- Fondo ---------------- */
    const bg = document.createElement('canvas');
    bg.width = W; bg.height = H;
    (function paintBg() {
        const g = bg.getContext('2d');
        g.fillStyle = '#03020c'; g.fillRect(0, 0, W, H);
        [[220, 160, 380, 'rgba(255,51,153,.10)'], [1040, 540, 420, 'rgba(91,63,214,.14)'], [700, 80, 260, 'rgba(63,242,255,.06)']].forEach(([x, y, r, c]) => {
            const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, c); gr.addColorStop(1, 'rgba(0,0,0,0)');
            g.fillStyle = gr; g.fillRect(0, 0, W, H);
        });
        for (let i = 0; i < 220; i++) {
            g.fillStyle = `rgba(255,255,255,${rnd(0.15, 0.8)})`;
            const s = Math.random() < 0.08 ? 2 : 1;
            g.fillRect(Math.random() * W, Math.random() * H, s, s);
        }
    })();
    const twinkles = Array.from({ length: 30 }, () => ({ x: Math.random() * W, y: Math.random() * H, p: Math.random() * TAU }));

    /* ---------------- Forma de cada asteroide (determinista por id) ---------------- */
    const shapes = new Map();
    function shapeOf(id, size) {
        const k = id + ':' + size;
        if (shapes.has(k)) return shapes.get(k);
        let s = (id * 9301 + 49297) % 233280;
        const rand = () => (s = (s * 9301 + 49297) % 233280) / 233280;
        const n = 9 + Math.floor(rand() * 4), pts = [];
        for (let i = 0; i < n; i++) {
            const a = (i / n) * TAU, rr = R[size] * (0.72 + rand() * 0.38);
            pts.push([Math.cos(a) * rr, Math.sin(a) * rr]);
        }
        const craters = Array.from({ length: size }, () => [(rand() - 0.5) * R[size], (rand() - 0.5) * R[size], R[size] * (0.12 + rand() * 0.12)]);
        const v = { pts, craters };
        shapes.set(k, v);
        return v;
    }

    /* ---------------- Sonido ---------------- */
    const tone = (...a) => BS.sfx.tone(...a);
    let thrustNode = null;
    const snd = {
        fire() { tone(1100, 0.09, { type: 'square', vol: 0.035, slide: 260 }); },
        boom(size) { size >= 3 ? BS.sfx.explosion(true) : (size === 2 ? BS.sfx.explosion(false) : tone(180, 0.25, { type: 'sawtooth', vol: 0.08, slide: 50 })); },
        die() { BS.sfx.explosion(true); tone(600, 0.9, { type: 'sawtooth', vol: 0.06, slide: 60 }); },
        life() { [880, 1175, 1568, 2093].forEach((f, i) => tone(f, 0.15, { type: 'triangle', vol: 0.1, delay: i * 0.09 })); },
        hyper() { tone(200, 0.35, { type: 'sine', vol: 0.12, slide: 2400 }); },
        beat(hi) { tone(hi ? 72 : 60, 0.12, { type: 'square', vol: 0.11 }); },
        saucer() { tone(900, 0.18, { type: 'sine', vol: 0.03, slide: 1200 }); },
        thrust(on) {
            const a = BS.sfx.ctx && BS.sfx.ctx();
            if (!a) return;
            if (!thrustNode) {
                const buf = a.createBuffer(1, a.sampleRate, a.sampleRate), d = buf.getChannelData(0);
                for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
                const src = a.createBufferSource(); src.buffer = buf; src.loop = true;
                const f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 380;
                const g = a.createGain(); g.gain.value = 0;
                src.connect(f).connect(g).connect(a.destination); src.start();
                thrustNode = g;
            }
            thrustNode.gain.setTargetAtTime(on && !BS.sfx.isMuted() ? 0.16 : 0, a.currentTime, 0.04);
        },
    };

    /* ---------------- Estado ---------------- */
    let ui = 'menu';          // menu | waiting | playing | over
    let room = null;          // sala actual (null = individual)
    let mySlot = 0;
    let isHost = true;
    let players = [{ slot: 0, name: CFG.me.name, color: CFG.colors[0], id: CFG.me.id }];
    let keys = {};
    let paused = false;
    let shake = 0;
    let t0 = 0;               // inicio de la partida (ms)
    let lastFrame = performance.now();
    const particles = [];

    // Mi nave (todos los clientes)
    let ship = null;
    let myBullets = [];
    let shotSeq = 0;
    let fireCd = 0;
    let hyperCd = 0;
    let respawnAt = 0;
    let sentShots = [];       // disparos recientes que reenvío (por si se pierde un paquete)

    // Mundo (lo simula el anfitrión; los invitados lo reciben)
    let world = null;
    // Lo que ve un invitado
    let snap = null, snapAt = 0, snapAge = 0;
    const seenEvents = new Set();
    let hostLostSince = 0;

    // Datos de invitados que recibe el anfitrión
    const peers = {};         // slot -> { ship, age, at, shotsSeen:Set }

    function color(slot) { return (players.find((p) => p.slot === slot) || {}).color || CFG.colors[slot] || '#fff'; }
    function pname(slot) { return (players.find((p) => p.slot === slot) || {}).name || 'Jugador ' + (slot + 1); }

    function newShip() {
        const n = players.length, i = players.findIndex((p) => p.slot === mySlot);
        return { x: W / 2 + (i - (n - 1) / 2) * 90, y: H / 2, vx: 0, vy: 0, a: -Math.PI / 2, th: false, al: true, inv: 2.5 };
    }

    function newWorld() {
        const w = { wave: 0, rocks: [], bullets: [], saucer: null, sbullets: [], scores: {}, lives: {}, extra: {}, events: [], eid: 0, nextId: 1, over: false, waveAt: 1.2, saucerAt: rnd(18, 28), present: {} };
        players.forEach((p) => { w.scores[p.slot] = 0; w.lives[p.slot] = 3; w.extra[p.slot] = 10000; w.present[p.slot] = true; });
        return w;
    }

    function spawnWave(w) {
        w.wave++;
        const ships = shipsForSim();
        const count = Math.min(4 + w.wave, 11) + (players.length - 1);
        for (let i = 0; i < count; i++) {
            let x, y, tries = 0;
            do { x = Math.random() * W; y = Math.random() * H; tries++; }
            while (tries < 50 && Object.values(ships).some((s) => dist2(x, y, s.x, s.y) < 220 * 220));
            addRock(w, x, y, 3);
        }
    }

    function addRock(w, x, y, size, baseA) {
        const a = baseA ?? rnd(0, TAU), sp = rnd(size === 3 ? 35 : size === 2 ? 65 : 100, size === 3 ? 75 : size === 2 ? 120 : 175) * (1 + Math.min(w.wave, 10) * 0.04);
        w.rocks.push({ id: w.nextId++, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, size, rot: rnd(0, TAU), vr: rnd(-1.2, 1.2) });
    }

    function pushEvent(e) {
        e.id = ++world.eid;
        world.events.push(e);
        if (world.events.length > 40) world.events.shift();
        handleEvent(e);
    }

    /* ---------------- Simulación del anfitrión ---------------- */
    function shipsForSim() {
        const out = {};
        if (ship) out[mySlot] = ship;
        for (const [slot, p] of Object.entries(peers)) {
            if (!p.ship || !world?.present[slot]) continue;
            const dt = p.age + (performance.now() - p.at) / 1000;
            out[slot] = { ...p.ship, x: wrapX(p.ship.x + p.ship.vx * dt), y: wrapY(p.ship.y + p.ship.vy * dt) };
        }
        return out;
    }

    function simulate(dt) {
        const w = world;
        if (w.over) return;

        // Oleadas
        if (!w.rocks.length && !w.saucer) {
            w.waveAt -= dt;
            if (w.waveAt <= 0) { spawnWave(w); w.waveAt = 2.2; }
        }

        w.rocks.forEach((r) => { r.x = wrapX(r.x + r.vx * dt); r.y = wrapY(r.y + r.vy * dt); r.rot += r.vr * dt; });
        w.bullets.forEach((b) => { b.x = wrapX(b.x + b.vx * dt); b.y = wrapY(b.y + b.vy * dt); b.life -= dt; });
        w.sbullets.forEach((b) => { b.x = wrapX(b.x + b.vx * dt); b.y = wrapY(b.y + b.vy * dt); b.life -= dt; });
        w.bullets = w.bullets.filter((b) => b.life > 0);
        w.sbullets = w.sbullets.filter((b) => b.life > 0);

        // Platillo volador
        if (w.wave >= 2 && !w.saucer) {
            w.saucerAt -= dt;
            if (w.saucerAt <= 0) {
                const small = w.wave >= 4 && Math.random() < 0.5;
                const left = Math.random() < 0.5;
                w.saucer = { x: left ? -20 : W + 20, y: rnd(80, H - 80), vx: (left ? 1 : -1) * (small ? 170 : 120), vy: 0, small, turn: 1.5, shot: 1.2 };
                w.saucerAt = rnd(16, 26);
            }
        }
        const ships = shipsForSim();
        if (w.saucer) {
            const s = w.saucer;
            s.x += s.vx * dt; s.y = wrapY(s.y + s.vy * dt);
            s.turn -= dt; s.shot -= dt;
            if (s.turn <= 0) { s.turn = rnd(0.8, 1.8); s.vy = [0, 90, -90][Math.floor(Math.random() * 3)]; }
            if (s.shot <= 0) {
                s.shot = s.small ? 0.9 : 1.3;
                const targets = Object.values(ships).filter((sh) => sh.al);
                let a = rnd(0, TAU);
                if (s.small && targets.length) {
                    const t = targets.sort((p, q) => dist2(s.x, s.y, p.x, p.y) - dist2(s.x, s.y, q.x, q.y))[0];
                    a = Math.atan2(t.y - s.y, t.x - s.x) + rnd(-0.18, 0.18);
                }
                w.sbullets.push({ x: s.x, y: s.y, vx: Math.cos(a) * 420, vy: Math.sin(a) * 420, life: 1.3 });
            }
            if (s.x < -40 || s.x > W + 40) w.saucer = null;
        }

        // Balas vs asteroides / platillo
        for (const b of w.bullets) {
            if (b.life <= 0) continue;
            for (const r of w.rocks) {
                if (r.dead) continue;
                if (dist2(b.x, b.y, r.x, r.y) < R[r.size] * R[r.size] * 0.9) {
                    b.life = 0; r.dead = true;
                    award(b.o, POINTS[r.size]);
                    if (r.size > 1) { const a = Math.atan2(r.vy, r.vx); addRock(w, r.x, r.y, r.size - 1, a + rnd(0.3, 0.9)); addRock(w, r.x, r.y, r.size - 1, a - rnd(0.3, 0.9)); }
                    pushEvent({ k: 'rock', x: r1(r.x), y: r1(r.y), s: r.size, o: b.o, b: b.id });
                    break;
                }
            }
            if (b.life > 0 && w.saucer && dist2(b.x, b.y, w.saucer.x, w.saucer.y) < (w.saucer.small ? 14 : 24) ** 2) {
                b.life = 0;
                award(b.o, w.saucer.small ? 1000 : 200);
                pushEvent({ k: 'ufo', x: r1(w.saucer.x), y: r1(w.saucer.y), o: b.o, b: b.id, p: w.saucer.small ? 1000 : 200 });
                w.saucer = null;
            }
        }
        w.rocks = w.rocks.filter((r) => !r.dead);

        // Naves vs asteroides, platillo y balas enemigas
        for (const [slotStr, s] of Object.entries(ships)) {
            const slot = +slotStr;
            if (!s.al || s.inv > 0 || (w.deadUntil?.[slot] || 0) > performance.now()) continue;
            let hit = w.rocks.find((r) => dist2(s.x, s.y, r.x, r.y) < (R[r.size] * 0.85 + 11) ** 2);
            if (hit) {
                hit.dead = true;
                if (hit.size > 1) { addRock(w, hit.x, hit.y, hit.size - 1); addRock(w, hit.x, hit.y, hit.size - 1); }
                pushEvent({ k: 'rock', x: r1(hit.x), y: r1(hit.y), s: hit.size, o: slot });
                award(slot, POINTS[hit.size]);
            }
            const bullet = !hit && w.sbullets.find((b) => dist2(s.x, s.y, b.x, b.y) < 15 * 15);
            const ufo = !hit && !bullet && w.saucer && dist2(s.x, s.y, w.saucer.x, w.saucer.y) < 30 * 30;
            if (bullet) bullet.life = 0;
            if (ufo) { pushEvent({ k: 'ufo', x: r1(w.saucer.x), y: r1(w.saucer.y), o: slot, p: 0 }); w.saucer = null; }
            if (hit || bullet || ufo) {
                w.lives[slot] = Math.max(0, w.lives[slot] - 1);
                (w.deadUntil ??= {})[slot] = performance.now() + 2500;
                pushEvent({ k: 'ship', slot, x: r1(s.x), y: r1(s.y) });
            }
        }
        w.rocks = w.rocks.filter((r) => !r.dead);

        // ¿Fin de la partida? Todos los presentes sin vidas y sin nave.
        const alive = Object.entries(ships).some(([sl, s]) => s.al && w.present[sl]);
        const anyLives = Object.keys(w.present).some((sl) => w.present[sl] && w.lives[sl] > 0);
        if (!alive && !anyLives) {
            w.over = true;
            pushEvent({ k: 'over' });
        }
    }

    function award(slot, pts) {
        const w = world;
        if (w.scores[slot] === undefined) return;
        w.scores[slot] += pts;
        if (w.scores[slot] >= w.extra[slot]) {
            w.extra[slot] += 10000; w.lives[slot]++;
            pushEvent({ k: 'life', slot });
        }
    }

    /* ---------------- Eventos (todos los clientes) ---------------- */
    function handleEvent(e) {
        if (seenEvents.has(e.id)) return;
        seenEvents.add(e.id);
        if (e.k === 'rock') {
            explode(e.x, e.y, e.s === 3 ? 26 : e.s === 2 ? 16 : 9, '#c4b5fd', e.s);
            snd.boom(e.s);
            if (e.s === 3) shake = Math.max(shake, 0.35);
            if (e.o === mySlot && e.b) myBullets = myBullets.filter((b) => b.id !== e.b);
        } else if (e.k === 'ufo') {
            explode(e.x, e.y, 30, '#3dffa0', 3); snd.boom(3); shake = Math.max(shake, 0.5);
            if (e.p) floatText(e.x, e.y, '+' + e.p, color(e.o));
            if (e.o === mySlot && e.b) myBullets = myBullets.filter((b) => b.id !== e.b);
        } else if (e.k === 'ship') {
            explode(e.x, e.y, 40, color(e.slot), 3);
            if (e.slot === mySlot && ship && ship.al) {
                ship.al = false; ship.th = false; respawnAt = performance.now() + 2200;
                snd.die(); snd.thrust(false); shake = 1;
                const r = canvas.getBoundingClientRect();
                BS.fx.explosion(r.left + (e.x / W) * r.width, r.top + (e.y / H) * r.height, 0.9);
            } else snd.boom(2);
        } else if (e.k === 'life') {
            if (e.slot === mySlot) { snd.life(); floatText(ship ? ship.x : W / 2, (ship ? ship.y : H / 2) - 30, '¡VIDA EXTRA!', '#3dffa0'); }
        } else if (e.k === 'over') {
            setTimeout(gameOver, 1600);
        }
    }

    function explode(x, y, n, col, size) {
        for (let i = 0; i < n; i++) {
            const a = rnd(0, TAU), v = rnd(40, 220) * (size === 3 ? 1.2 : 1);
            particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rnd(0.4, 1.1), col: Math.random() < 0.3 ? '#fff' : col, line: Math.random() < 0.35, a: rnd(0, TAU), va: rnd(-6, 6), len: rnd(4, 12) });
        }
        particles.push({ x, y, ring: true, r: 4, life: 0.5, col });
    }
    function floatText(x, y, text, col) { particles.push({ x, y, vx: 0, vy: -30, life: 1.4, text, col }); }

    /* ---------------- Mi nave ---------------- */
    function updateShip(dt) {
        if (!ship) return;
        const now = performance.now();
        const lives = currentLives(mySlot);
        if (!ship.al) {
            if (lives > 0 && now >= respawnAt && !gameIsOver()) { Object.assign(ship, newShip()); ship.x = W / 2; ship.y = H / 2; }
            return;
        }
        if (paused) return;
        const rot = (keys.left ? -1 : 0) + (keys.right ? 1 : 0);
        ship.a += rot * 4.4 * dt;
        ship.th = !!keys.thrust;
        if (ship.th) { ship.vx += Math.cos(ship.a) * 430 * dt; ship.vy += Math.sin(ship.a) * 430 * dt; }
        const damp = Math.exp(-0.55 * dt);
        ship.vx *= damp; ship.vy *= damp;
        const sp = Math.hypot(ship.vx, ship.vy);
        if (sp > 520) { ship.vx *= 520 / sp; ship.vy *= 520 / sp; }
        ship.x = wrapX(ship.x + ship.vx * dt); ship.y = wrapY(ship.y + ship.vy * dt);
        ship.inv = Math.max(0, ship.inv - dt);
        snd.thrust(ship.th);

        fireCd -= dt; hyperCd -= dt;
        if (keys.fire && fireCd <= 0 && myBullets.length < 6) {
            fireCd = 0.17;
            const b = { id: ++shotSeq, x: ship.x + Math.cos(ship.a) * 16, y: ship.y + Math.sin(ship.a) * 16, vx: ship.vx + Math.cos(ship.a) * 720, vy: ship.vy + Math.sin(ship.a) * 720, life: 0.95, born: now };
            myBullets.push(b);
            snd.fire();
            if (isHost) world.bullets.push({ ...b, o: mySlot });
            else { sentShots.push(b); }
        }
        if (keys.hyper && hyperCd <= 0) {
            hyperCd = 3; keys.hyper = false;
            explode(ship.x, ship.y, 12, color(mySlot), 1);
            ship.x = rnd(40, W - 40); ship.y = rnd(40, H - 40); ship.vx = ship.vy = 0;
            snd.hyper();
        }
    }

    function updateMyBullets(dt) {
        myBullets.forEach((b) => { b.x = wrapX(b.x + b.vx * dt); b.y = wrapY(b.y + b.vy * dt); b.life -= dt; });
        myBullets = myBullets.filter((b) => b.life > 0);
        if (isHost) {
            // En el anfitrión mis balas viven en el mundo: sincroniza las que ya chocaron.
            const live = new Set(world.bullets.filter((b) => b.o === mySlot && b.life > 0).map((b) => b.id));
            myBullets = myBullets.filter((b) => live.has(b.id));
        }
    }

    const currentLives = (slot) => (isHost ? world?.lives[slot] : snap?.lv?.[slot]) ?? 0;
    const gameIsOver = () => (isHost ? world?.over : snap?.over);

    /* ---------------- Red ---------------- */
    function shipPacket() {
        return ship ? { x: r1(ship.x), y: r1(ship.y), vx: r1(ship.vx), vy: r1(ship.vy), a: r1(ship.a * 100) / 100, th: ship.th ? 1 : 0, al: ship.al ? 1 : 0, inv: ship.inv > 0 ? 1 : 0 } : null;
    }

    function hostSnapshot() {
        const w = world, ships = {};
        ships[mySlot] = shipPacket();
        for (const [slot, p] of Object.entries(peers)) if (p.ship && w.present[slot]) ships[slot] = p.ship;
        return {
            w: w.wave,
            r: w.rocks.map((r) => [r.id, r1(r.x), r1(r.y), r1(r.vx), r1(r.vy), r.size, r1(r.rot), r1(r.vr)]),
            b: w.bullets.map((b) => [r1(b.x), r1(b.y), r1(b.vx), r1(b.vy), b.o, r1(b.life)]),
            u: w.saucer ? [r1(w.saucer.x), r1(w.saucer.y), r1(w.saucer.vx), r1(w.saucer.vy), w.saucer.small ? 1 : 0] : null,
            ub: w.sbullets.map((b) => [r1(b.x), r1(b.y), r1(b.vx), r1(b.vy), r1(b.life)]),
            s: ships, sc: w.scores, lv: w.lives, pr: w.present, e: w.events, over: w.over ? 1 : 0,
        };
    }

    async function netLoop(token) {
        while (ui === 'playing' && token === netToken) {
            const started = performance.now();
            try {
                const body = isHost ? hostSnapshot() : { s: shipPacket(), sh: sentShots.map((b) => [b.id, r1(b.x), r1(b.y), r1(b.vx), r1(b.vy), +((performance.now() - b.born) / 1000).toFixed(2)]) };
                const res = await fetch(`${BS.base}/asteroides/salas/${room.id}/sync`, {
                    method: 'POST', credentials: 'same-origin',
                    headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content },
                    body: JSON.stringify(body),
                });
                if (res.ok) receive(await res.json());
            } catch (e) { /* reintenta */ }
            // Descarta disparos viejos ya confirmados por tiempo.
            sentShots = sentShots.filter((b) => performance.now() - b.born < 600);
            const wait = NET_MS - (performance.now() - started);
            if (wait > 0) await BS.sleep(wait);
        }
    }
    let netToken = 0;

    function receive(data) {
        const now = performance.now();
        if (isHost) {
            for (const p of players) {
                if (p.slot === mySlot) continue;
                const d = data.peers[p.slot];
                const peer = (peers[p.slot] ??= { shotsSeen: new Set() });
                if (!d) { if (peer.at || now - t0 > 12000) world.present[p.slot] = false; continue; }
                peer.age = num(d.age); peer.at = now; peer.ship = cleanShip(d.d && d.d.s);
                world.present[p.slot] = d.age < 6;
                if (peer.ship && !peer.ship.al && world.deadUntil?.[p.slot]) world.deadUntil[p.slot] = 0;
                for (const shot of (Array.isArray(d.d && d.d.sh) ? d.d.sh.slice(0, 12) : [])) {
                    if (!Array.isArray(shot)) continue;
                    const [id, x, y, vx, vy, age] = shot.map((v) => num(v));
                    if (peer.shotsSeen.has(id)) continue;
                    peer.shotsSeen.add(id);
                    const late = Math.max(0, Math.min(0.5, age + num(d.age)));
                    // Velocidad máxima creíble de una bala: descarta disparos fabricados.
                    if (Math.hypot(vx, vy) > 1400) continue;
                    world.bullets.push({ id, o: p.slot, x: wrapX(x + vx * late), y: wrapY(y + vy * late), vx, vy, life: 0.95 - late });
                }
            }
        } else {
            const d = data.peers['0'];
            if (!d || d.age > 6) { if (!hostLostSince) hostLostSince = now; }
            else {
                hostLostSince = 0;
                snap = d.d; snapAt = now; snapAge = d.age;
                (snap.e || []).forEach(handleEvent);
            }
            if (hostLostSince && now - hostLostSince > 8000 && ui === 'playing') {
                ui = 'over'; snd.thrust(false);
                showOverlay(`<h2>CONEXIÓN PERDIDA</h2><p>El anfitrión salió de la partida.</p><div class="actions"><button class="btn" id="ast-back">Volver</button></div>`);
                $('#ast-back').onclick = () => location.reload();
            }
        }
    }

    /* ---------------- Bucle principal ---------------- */
    let beatT = 0, beatHi = false;
    function frame(now) {
        const dt = Math.min(0.05, (now - lastFrame) / 1000);
        lastFrame = now;
        if (ui === 'playing' && !paused) {
            updateShip(dt);
            updateMyBullets(dt);
            if (isHost) simulate(dt);
            // Latido de fondo: más rápido cuantas menos rocas quedan.
            const rocks = isHost ? world.rocks.length : (snap?.r?.length || 0);
            if (rocks) {
                beatT -= dt;
                if (beatT <= 0) { beatHi = !beatHi; snd.beat(beatHi); beatT = Math.max(0.28, 0.25 + rocks * 0.05); }
            }
            if ((isHost ? world.saucer : snap?.u) && Math.floor(now / 180) !== Math.floor((now - dt * 1000) / 180)) snd.saucer();
        }
        particles.forEach((p) => {
            p.life -= dt;
            if (p.ring) { p.r += 260 * dt; return; }
            p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.97; p.vy *= 0.97; if (p.a !== undefined) p.a += p.va * dt;
        });
        for (let i = particles.length - 1; i >= 0; i--) if (particles[i].life <= 0) particles.splice(i, 1);
        shake = Math.max(0, shake - dt * 2.2);
        draw(now);
        requestAnimationFrame(frame);
    }

    /* ---------------- Dibujo ---------------- */
    function draw(now) {
        ctx.save();
        if (shake) ctx.translate(rnd(-1, 1) * 14 * shake, rnd(-1, 1) * 14 * shake);
        ctx.drawImage(bg, -20, -20, W + 40, H + 40);
        twinkles.forEach((t) => { ctx.fillStyle = `rgba(255,255,255,${0.3 + 0.7 * Math.abs(Math.sin(now / 900 + t.p))})`; ctx.fillRect(t.x, t.y, 2, 2); });

        if (ui === 'playing' || ui === 'over') {
            const view = viewState(now);
            ctx.lineJoin = 'round'; ctx.lineCap = 'round';
            view.rocks.forEach(drawRock);
            if (view.saucer) drawSaucer(view.saucer, now);
            ctx.shadowBlur = 10;
            view.bullets.forEach((b) => { ctx.fillStyle = color(b.o); ctx.shadowColor = color(b.o); ctx.beginPath(); ctx.arc(b.x, b.y, 2.6, 0, TAU); ctx.fill(); });
            myBullets.forEach((b) => { ctx.fillStyle = color(mySlot); ctx.shadowColor = color(mySlot); ctx.beginPath(); ctx.arc(b.x, b.y, 2.8, 0, TAU); ctx.fill(); });
            ctx.fillStyle = '#3dffa0'; ctx.shadowColor = '#3dffa0';
            view.sbullets.forEach((b) => { ctx.beginPath(); ctx.arc(b.x, b.y, 3, 0, TAU); ctx.fill(); });
            ctx.shadowBlur = 0;
            for (const [slot, s] of Object.entries(view.ships)) drawShip(+slot, s, now);
            drawParticles();
            drawHud(view, now);
        } else drawParticles();
        ctx.restore();
    }

    /** Lo que hay que dibujar: el mundo local (anfitrión) o la foto extrapolada (invitado). */
    function viewState(now) {
        if (isHost) {
            const ships = {};
            if (ship) ships[mySlot] = ship;
            const sim = shipsForSim();
            for (const sl of Object.keys(peers)) if (sim[sl]) ships[sl] = sim[sl];
            return { rocks: world.rocks, bullets: world.bullets.filter((b) => b.o !== mySlot), saucer: world.saucer, sbullets: world.sbullets, ships, scores: world.scores, lives: world.lives, wave: world.wave, present: world.present };
        }
        if (!snap) return { rocks: [], bullets: [], sbullets: [], ships: ship ? { [mySlot]: ship } : {}, scores: {}, lives: {}, wave: 0, present: {} };
        const dt = snapAge + (now - snapAt) / 1000;
        const rocks = snap.r.map(([id, x, y, vx, vy, size, rot, vr]) => ({ id, x: wrapX(x + vx * dt), y: wrapY(y + vy * dt), size, rot: rot + vr * dt }));
        const bullets = snap.b.filter((b) => b[4] !== mySlot && b[5] - dt > 0).map(([x, y, vx, vy, o]) => ({ x: wrapX(x + vx * dt), y: wrapY(y + vy * dt), o }));
        const sbullets = snap.ub.filter((b) => b[4] - dt > 0).map(([x, y, vx, vy]) => ({ x: wrapX(x + vx * dt), y: wrapY(y + vy * dt) }));
        const saucer = snap.u ? { x: snap.u[0] + snap.u[2] * dt, y: wrapY(snap.u[1] + snap.u[3] * dt), small: !!snap.u[4] } : null;
        const ships = {};
        for (const [slot, s] of Object.entries(snap.s || {})) {
            if (+slot === mySlot || !s) continue;
            ships[slot] = { ...s, x: wrapX(s.x + s.vx * dt), y: wrapY(s.y + s.vy * dt) };
        }
        if (ship) ships[mySlot] = ship;
        return { rocks, bullets, saucer, sbullets, ships, scores: snap.sc, lives: snap.lv, wave: snap.w, present: snap.pr || {} };
    }

    function drawRock(r) {
        const sh = shapeOf(r.id, r.size);
        ctx.save(); ctx.translate(r.x, r.y); ctx.rotate(r.rot);
        ctx.shadowColor = '#a78bfa'; ctx.shadowBlur = 12;
        ctx.strokeStyle = '#d8ccff'; ctx.lineWidth = 2.2; ctx.fillStyle = 'rgba(91,63,214,.18)';
        ctx.beginPath(); sh.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.shadowBlur = 0; ctx.strokeStyle = 'rgba(216,204,255,.35)'; ctx.lineWidth = 1.2;
        sh.craters.forEach(([x, y, cr]) => { ctx.beginPath(); ctx.arc(x, y, cr, 0, TAU); ctx.stroke(); });
        ctx.restore();
    }

    function drawSaucer(s, now) {
        const k = s.small ? 0.6 : 1;
        ctx.save(); ctx.translate(s.x, s.y); ctx.scale(k, k);
        ctx.shadowColor = '#3dffa0'; ctx.shadowBlur = 16; ctx.strokeStyle = '#3dffa0'; ctx.lineWidth = 2.2; ctx.fillStyle = 'rgba(61,255,160,.15)';
        ctx.beginPath(); ctx.ellipse(0, 0, 26, 9, 0, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(0, -7, 11, 9, 0, Math.PI, 0); ctx.stroke();
        for (let i = -2; i <= 2; i++) { ctx.fillStyle = Math.floor(now / 150 + i) % 2 ? '#ffd23d' : '#ff3399'; ctx.beginPath(); ctx.arc(i * 9, 2, 2, 0, TAU); ctx.fill(); }
        ctx.restore();
    }

    function drawShip(slot, s, now) {
        if (!s || !s.al) return;
        if (s.inv && Math.floor(now / 110) % 2 === 0) return;
        const col = color(slot);
        ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.a);
        ctx.shadowColor = col; ctx.shadowBlur = 16;
        if (s.th) {
            ctx.fillStyle = Math.random() < 0.5 ? '#ffd23d' : '#ff6a1a';
            ctx.beginPath(); ctx.moveTo(-9, -5); ctx.lineTo(-20 - Math.random() * 12, 0); ctx.lineTo(-9, 5); ctx.closePath(); ctx.fill();
        }
        ctx.strokeStyle = col; ctx.lineWidth = 2.4; ctx.fillStyle = 'rgba(255,255,255,.08)';
        ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(-12, -12); ctx.lineTo(-7, 0); ctx.lineTo(-12, 12); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = col; ctx.beginPath(); ctx.arc(4, 0, 2.6, 0, TAU); ctx.fill();
        if (s.inv) { ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.arc(0, 0, 24, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1; }
        ctx.restore();
        if (players.length > 1) {
            ctx.font = '700 11px Montserrat, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = col; ctx.globalAlpha = 0.85;
            ctx.fillText(slot === mySlot ? 'TÚ' : pname(slot).split(' ')[0], s.x, s.y + 34); ctx.globalAlpha = 1;
        }
    }

    function drawParticles() {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        particles.forEach((p) => {
            ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 1.4));
            if (p.ring) { ctx.strokeStyle = p.col; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.stroke(); }
            else if (p.text) { ctx.globalCompositeOperation = 'source-over'; ctx.font = '800 16px Montserrat, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = p.col; ctx.fillText(p.text, p.x, p.y); ctx.globalCompositeOperation = 'lighter'; }
            else if (p.line) { ctx.strokeStyle = p.col; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(p.x - Math.cos(p.a) * p.len, p.y - Math.sin(p.a) * p.len); ctx.lineTo(p.x + Math.cos(p.a) * p.len, p.y + Math.sin(p.a) * p.len); ctx.stroke(); }
            else { ctx.fillStyle = p.col; ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3); }
        });
        ctx.restore();
    }

    function drawHud(v, now) {
        ctx.save();
        ctx.textBaseline = 'top';
        const list = players.filter((p) => v.present[p.slot] !== false || p.slot === mySlot);
        list.forEach((p, i) => {
            const x = 24 + i * 250;
            ctx.fillStyle = p.color; ctx.shadowColor = p.color; ctx.shadowBlur = 10;
            ctx.font = '26px "Black Ops One", Impact, sans-serif'; ctx.textAlign = 'left';
            ctx.fillText(String(v.scores[p.slot] ?? 0).padStart(5, '0'), x, 18);
            ctx.shadowBlur = 0;
            ctx.font = '700 11px Montserrat, sans-serif'; ctx.fillStyle = 'rgba(230,244,255,.7)';
            ctx.fillText((p.slot === mySlot ? 'TÚ · ' : '') + p.name.toUpperCase().slice(0, 22), x, 50);
            for (let l = 0; l < Math.min(v.lives[p.slot] ?? 0, 6); l++) {
                ctx.save(); ctx.translate(x + 8 + l * 18, 76); ctx.rotate(-Math.PI / 2);
                ctx.strokeStyle = p.color; ctx.lineWidth = 1.6;
                ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-6, -6); ctx.lineTo(-3, 0); ctx.lineTo(-6, 6); ctx.closePath(); ctx.stroke();
                ctx.restore();
            }
        });
        ctx.textAlign = 'right'; ctx.font = '700 13px Montserrat, sans-serif'; ctx.fillStyle = 'rgba(230,244,255,.7)';
        ctx.fillText('OLEADA ' + (v.wave || 1), W - 24, 22);
        if (room) ctx.fillText('SALA #' + room.id, W - 24, 42);

        if (ship && !ship.al && currentLives(mySlot) > 0 && !gameIsOver()) {
            ctx.textAlign = 'center'; ctx.font = '22px "Black Ops One", Impact, sans-serif'; ctx.fillStyle = color(mySlot);
            ctx.fillText('REAPARECIENDO EN ' + Math.max(0, Math.ceil((respawnAt - now) / 1000)), W / 2, H / 2 + 60);
        } else if (ship && !ship.al && !gameIsOver()) {
            ctx.textAlign = 'center'; ctx.font = '22px "Black Ops One", Impact, sans-serif'; ctx.fillStyle = '#ff3355';
            ctx.fillText('SIN VIDAS · ¡APOYA A TU EQUIPO!', W / 2, H / 2 + 60);
        }
        if (paused) { ctx.textAlign = 'center'; ctx.font = '48px "Black Ops One", Impact, sans-serif'; ctx.fillStyle = '#ff7ac0'; ctx.fillText('PAUSA', W / 2, H / 2 - 24); }
        if (hostLostSince) { ctx.textAlign = 'center'; ctx.font = '700 16px Montserrat, sans-serif'; ctx.fillStyle = '#ffc23d'; ctx.fillText('Esperando conexión con el anfitrión…', W / 2, H - 40); }
        ctx.restore();
    }

    /* ---------------- Pantallas ---------------- */
    function showOverlay(html) { overlay.hidden = false; overlay.innerHTML = `<div class="ast-menu">${html}</div>`; }
    const shipIcon = (c) => `<svg viewBox="-20 -20 40 40"><path d="M0 -16 L12 12 L0 6 L-12 12 Z" fill="none" stroke="${c}" stroke-width="2.5" stroke-linejoin="round"/></svg>`;

    let roomsTimer = null;
    function menu() {
        ui = 'menu'; room = null; isHost = true; mySlot = 0;
        showOverlay(`<h2>ASTEROIDES</h2>
            <p>Pulveriza las rocas espaciales y esquiva al platillo. Juega solo o forma un escuadrón de hasta 3 pilotos.</p>
            <div class="actions">
                <button class="btn big" id="ast-solo" style="--c1:#ff3399;--c2:#8a1250">🚀 Jugar solo</button>
                <button class="btn big ghost" id="ast-create">👥 Crear sala</button>
            </div>
            <div style="width:100%"><div class="game-tagline" style="color:#ff7ac0;margin-bottom:8px">Salas abiertas</div>
            <div class="ast-rooms" id="ast-rooms"><div class="empty">Buscando salas…</div></div></div>`);
        $('#ast-solo').onclick = () => { players = [{ slot: 0, name: CFG.me.name, color: CFG.colors[0], id: CFG.me.id }]; startGame(); };
        $('#ast-create').onclick = async () => {
            try { enterRoom(await BS.api('POST', '/asteroides/salas')); } catch (e) { BS.error(e); }
        };
        pollRooms();
    }

    async function pollRooms() {
        clearTimeout(roomsTimer);
        if (ui !== 'menu') return;
        try {
            const d = await BS.api('GET', '/asteroides/salas');
            if (ui !== 'menu') return;
            if (d.mine) return enterRoom(d.mine);
            const box = $('#ast-rooms');
            if (box) {
                box.innerHTML = d.rooms.length ? d.rooms.map((r) => `
                    <div class="ast-room"><div class="dots">${[0, 1, 2].map((i) => `<i style="${r.players[i] ? `background:${r.players[i].color};box-shadow:0 0 8px ${r.players[i].color}` : ''}"></i>`).join('')}</div>
                    <div class="info"><b>Sala #${r.id} · ${BS.esc(r.players[0]?.name || '')}</b>${r.players.length}/3 pilotos</div>
                    <button class="btn sm" data-join="${r.id}" ${r.players.length >= 3 ? 'disabled' : ''} style="--c1:#ff3399;--c2:#8a1250">Unirme</button></div>`).join('')
                    : '<div class="empty">No hay salas abiertas. ¡Crea una e invita a tus compañeros!</div>';
                box.querySelectorAll('[data-join]').forEach((b) => b.onclick = async () => {
                    b.disabled = true;
                    try { enterRoom(await BS.api('POST', `/asteroides/salas/${b.dataset.join}/unirse`)); } catch (e) { BS.error(e); b.disabled = false; }
                });
            }
        } catch (e) { /* */ }
        roomsTimer = setTimeout(pollRooms, 2500);
    }

    let roomTimer = null;
    function enterRoom(r) {
        room = r;
        players = r.players;
        mySlot = (players.find((p) => p.id === CFG.me.id) || {}).slot ?? 0;
        isHost = r.host_id === CFG.me.id;
        if (r.status === 'playing') return startGame();
        ui = 'waiting';
        renderWaiting();
        pollRoom();
    }

    function renderWaiting() {
        const slots = [0, 1, 2].map((i) => {
            const p = players.find((pl) => pl.slot === i), c = CFG.colors[i];
            return p ? `<div class="ast-slot on" style="--c:${c}">${shipIcon(c)}<b>${BS.esc(p.name)}</b><small>${p.slot === 0 ? 'Anfitrión' : 'Piloto ' + (i + 1)}${p.id === CFG.me.id ? ' · tú' : ''}</small></div>`
                : `<div class="ast-slot" style="--c:${c}">${shipIcon('rgba(255,255,255,.25)')}<small>Esperando piloto…</small></div>`;
        }).join('');
        showOverlay(`<h2 style="font-size:40px">SALA #${room.id}</h2>
            <p>${isHost ? 'Comparte el número de sala. Cuando tu escuadrón esté listo, ¡despega!' : 'Esperando a que el anfitrión inicie la partida…'}</p>
            <div class="ast-slots">${slots}</div>
            <div class="actions">
                ${isHost ? `<button class="btn big" id="ast-go" style="--c1:#ff3399;--c2:#8a1250">🚀 ¡Despegar! (${players.length}/3)</button>` : ''}
                <button class="btn ghost" id="ast-leave">Salir de la sala</button>
            </div>`);
        if (isHost) $('#ast-go').onclick = async () => {
            try { const r = await BS.api('POST', `/asteroides/salas/${room.id}/iniciar`); room = r; players = r.players; startGame(); } catch (e) { BS.error(e); }
        };
        $('#ast-leave').onclick = async () => {
            clearTimeout(roomTimer);
            await BS.api('POST', `/asteroides/salas/${room.id}/salir`).catch(() => {});
            menu();
        };
    }

    async function pollRoom() {
        clearTimeout(roomTimer);
        if (ui !== 'waiting') return;
        try {
            const r = await BS.api('GET', `/asteroides/salas/${room.id}`);
            if (ui !== 'waiting') return;
            if (r.status === 'finished') { BS.toast('El anfitrión cerró la sala.'); return menu(); }
            const changed = JSON.stringify(r.players) !== JSON.stringify(players);
            room = r; players = r.players;
            if (changed) { BS.sfx.message(); renderWaiting(); }
            if (r.status === 'playing') return startGame();
        } catch (e) {
            if (/403|No estás/.test(e.message)) return menu();
        }
        roomTimer = setTimeout(pollRoom, 1000);
    }

    function startGame() {
        clearTimeout(roomsTimer); clearTimeout(roomTimer);
        overlay.hidden = true;
        ui = 'playing'; paused = false;
        t0 = performance.now();
        seenEvents.clear(); particles.length = 0;
        myBullets = []; sentShots = []; snap = null; hostLostSince = 0;
        ship = newShip();
        if (isHost) { world = newWorld(); }
        BS.sfx.alarm();
        if (room) netLoop(++netToken);
    }

    async function gameOver() {
        if (ui !== 'playing') return;
        ui = 'over'; snd.thrust(false); netToken++;
        const v = viewState(performance.now());
        const myScore = Math.max(0, Math.floor(num(v.scores[mySlot])));
        const wave = Math.max(1, Math.floor(num(v.wave, 1)));
        const rows = players.map((p) => ({ ...p, score: num(v.scores[p.slot]) })).sort((a, b) => b.score - a.score);
        if (isHost && room) BS.api('POST', `/asteroides/salas/${room.id}/terminar`).catch(() => {});
        showOverlay(`<h2>FIN DEL JUEGO</h2>
            <p>Llegaron hasta la oleada <b>${wave}</b>.</p>
            <table class="ast-results">${rows.map((p, i) => `<tr><td style="color:${p.color}">${i === 0 && rows.length > 1 ? '👑 ' : ''}${BS.esc(p.name)}${p.slot === mySlot ? ' (tú)' : ''}</td><td style="color:${p.color}">${p.score.toLocaleString('es-MX')}</td></tr>`).join('')}</table>
            <p id="go-msg">${myScore ? 'Guardando tu puntaje…' : '¡Suerte para la próxima!'}</p>
            <div class="actions"><button class="btn" id="ast-again" style="--c1:#ff3399;--c2:#8a1250">↻ Menú</button>
            <a class="btn ghost" href="${BS.base}/">🎮 Sala de juegos</a></div>`);
        $('#ast-again').onclick = menu;
        if (!myScore) return;
        try {
            const r = await BS.api('POST', '/puntajes/asteroids', { mode: 'classic', score: myScore, duration: Math.max(1, Math.round((performance.now() - t0) / 1000)), meta: { wave, players: players.length } });
            renderRanking(r.leaderboard);
            const m = $('#go-msg');
            if (m) m.innerHTML = (r.new_best ? '<span class="new-best">★ ¡NUEVO RÉCORD PERSONAL! ★</span><br>' : '') + `Quedaste en el lugar <b>#${r.rank}</b> de los mejores pilotos.`;
            if (r.new_best) { BS.sfx.victory(); BS.fx.confetti(); }
        } catch (e) { const m = $('#go-msg'); if (m) m.textContent = 'No se pudo guardar: ' + e.message; }
    }

    function renderRanking(rows) {
        $('#ast-ranking').innerHTML = rows.length
            ? rows.map((r, i) => `<tr class="${r.user_id === BS.userId ? 'me' : ''}"><td class="pos">${i + 1}</td>
                <td>${BS.esc(r.name)}<br><small style="color:var(--muted)">Oleada ${BS.esc(r.meta.wave ?? '—')} · ${r.meta.players > 1 ? 'equipo de ' + BS.esc(r.meta.players) : 'solo'}</small></td>
                <td class="pts">${r.score.toLocaleString('es-MX')}</td></tr>`).join('')
            : '<tr><td class="empty">Nadie ha volado todavía. ¡Sé el primero!</td></tr>';
    }

    /* ---------------- Controles ---------------- */
    const KEYMAP = { ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right', ArrowUp: 'thrust', w: 'thrust', W: 'thrust', ' ': 'fire', ArrowDown: 'hyper', s: 'hyper', S: 'hyper', h: 'hyper', H: 'hyper' };
    window.addEventListener('keydown', (e) => {
        if (e.target.closest && e.target.closest('input, textarea')) return;
        if (KEYMAP[e.key] && ui === 'playing') { e.preventDefault(); keys[KEYMAP[e.key]] = true; }
        if ((e.key === 'p' || e.key === 'P') && ui === 'playing' && !room) { paused = !paused; snd.thrust(false); }
    });
    window.addEventListener('keyup', (e) => { if (KEYMAP[e.key]) keys[KEYMAP[e.key]] = false; });
    window.addEventListener('blur', () => { keys = {}; snd.thrust(false); if (ui === 'playing' && !room) paused = true; });
    document.querySelectorAll('#ast-touch button').forEach((b) => {
        const k = b.dataset.k;
        b.addEventListener('pointerdown', (e) => { e.preventDefault(); keys[k] = true; b.classList.add('on'); b.setPointerCapture(e.pointerId); });
        const up = () => { keys[k] = false; b.classList.remove('on'); };
        b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up);
    });

    renderRanking(CFG.leaderboard || []);
    menu();
    requestAnimationFrame(frame);
})();
