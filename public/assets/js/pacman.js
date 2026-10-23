/* ==========================================================================
   SIOS ARCADE · PAC-MAN
   Motor en canvas con paso fijo (60 Hz), laberinto clásico de 28×31,
   cuatro fantasmas con su IA característica, frutas, niveles y récords.
   ========================================================================== */
(function () {
    'use strict';
    const BS = window.BS;
    const CFG = window.PAC;
    const $ = (s) => document.querySelector(s);

    /* ---------------- Laberinto ---------------- */
    const MAZE = [
        '############################',
        '#............##............#',
        '#.####.#####.##.#####.####.#',
        '#o####.#####.##.#####.####o#',
        '#.####.#####.##.#####.####.#',
        '#..........................#',
        '#.####.##.########.##.####.#',
        '#.####.##.########.##.####.#',
        '#......##....##....##......#',
        '######.##### ## #####.######',
        '     #.##### ## #####.#     ',
        '     #.##          ##.#     ',
        '     #.## ###--### ##.#     ',
        '######.## #      # ##.######',
        '      .   #      #   .      ',
        '######.## #      # ##.######',
        '     #.## ######## ##.#     ',
        '     #.##          ##.#     ',
        '     #.## ######## ##.#     ',
        '######.## ######## ##.######',
        '#............##............#',
        '#.####.#####.##.#####.####.#',
        '#.####.#####.##.#####.####.#',
        '#o..##.......  .......##..o#',
        '###.##.##.########.##.##.###',
        '###.##.##.########.##.##.###',
        '#......##....##....##......#',
        '#.##########.##.##########.#',
        '#.##########.##.##########.#',
        '#..........................#',
        '############################',
    ];
    const COLS = 28, ROWS = 31, T = 16, W = COLS * T, H = ROWS * T;
    const FPS = 60;
    const DIRS = { up: { x: 0, y: -1 }, left: { x: -1, y: 0 }, down: { x: 0, y: 1 }, right: { x: 1, y: 0 } };
    const NONE = { x: 0, y: 0 };
    const ORDER = [DIRS.up, DIRS.left, DIRS.down, DIRS.right];
    const PALETTES = ['#2f6bff', '#ff3399', '#21e6ff', '#ff8a1a', '#3dff8a', '#b04dff'];
    const FRUITS = [['🍒', 100], ['🍓', 300], ['🍊', 500], ['🍊', 500], ['🍎', 700], ['🍎', 700], ['🍈', 1000], ['🍈', 1000], ['🚀', 2000], ['🚀', 2000], ['🔔', 3000], ['🔔', 3000], ['🔑', 5000]];

    const tileAt = (grid, tx, ty) => {
        if (ty < 0 || ty >= ROWS) return '#';
        tx = ((tx % COLS) + COLS) % COLS;
        return grid[ty][tx];
    };
    const isWall = (tx, ty) => { const c = tileAt(MAZE, tx, ty); return c === '#' || c === '-'; };
    const same = (a, b) => a.x === b.x && a.y === b.y;
    const opposite = (d) => ({ x: -d.x, y: -d.y });

    /* ---------------- Canvas ---------------- */
    const canvas = $('#pac-canvas');
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    function buildMaze(color) {
        const c = document.createElement('canvas');
        c.width = W * dpr; c.height = H * dpr;
        const g = c.getContext('2d');
        g.scale(dpr, dpr);
        const shape = (r) => {
            g.beginPath();
            for (let y = 0; y < ROWS; y++) {
                for (let x = 0; x < COLS; x++) {
                    if (MAZE[y][x] !== '#') continue;
                    const cx = (x + 0.5) * T, cy = (y + 0.5) * T;
                    g.moveTo(cx + r, cy); g.arc(cx, cy, r, 0, Math.PI * 2);
                    if (x + 1 < COLS && MAZE[y][x + 1] === '#') g.rect(cx, cy - r, T, 2 * r);
                    if (y + 1 < ROWS && MAZE[y + 1][x] === '#') g.rect(cx - r, cy, 2 * r, T);
                    // Rellena bloques sólidos de 2×2 para que no queden huecos.
                    if (x + 1 < COLS && y + 1 < ROWS && MAZE[y][x + 1] === '#' && MAZE[y + 1][x] === '#' && MAZE[y + 1][x + 1] === '#') g.rect(cx, cy, T, T);
                }
            }
        };
        g.fillStyle = color; g.shadowColor = color; g.shadowBlur = 12;
        shape(T * 0.32 + 2.2); g.fill(); g.fill();
        g.shadowBlur = 0; g.fillStyle = '#03051a';
        shape(T * 0.32); g.fill();
        // Brillo interior sutil
        g.globalAlpha = 0.18; g.fillStyle = color; shape(T * 0.12); g.fill(); g.globalAlpha = 1;
        // Puerta de la casa de los fantasmas
        g.fillStyle = '#ff9ad6'; g.shadowColor = '#ff9ad6'; g.shadowBlur = 8;
        g.fillRect(13 * T, 12.5 * T - 1.5, 2 * T, 3);
        return c;
    }
    const mazeCache = {};
    const mazeFor = (color) => (mazeCache[color] ??= buildMaze(color));

    /* ---------------- Sonido ---------------- */
    const tone = (...a) => BS.sfx.tone(...a);
    const snd = {
        wakaFlip: false, last: 0,
        waka() {
            const now = performance.now();
            if (now - this.last < 75) return;
            this.last = now; this.wakaFlip = !this.wakaFlip;
            this.wakaFlip ? tone(480, 0.09, { type: 'triangle', vol: 0.11, slide: 240 }) : tone(260, 0.09, { type: 'triangle', vol: 0.11, slide: 500 });
        },
        power() { tone(220, 0.25, { type: 'square', vol: 0.05, slide: 880 }); },
        ghost() { tone(180, 0.35, { type: 'sawtooth', vol: 0.08, slide: 1800 }); tone(900, 0.2, { type: 'square', vol: 0.04, delay: 0.25, slide: 1400 }); },
        fruit() { [660, 880, 1320].forEach((f, i) => tone(f, 0.1, { type: 'square', vol: 0.06, delay: i * 0.06 })); },
        life() { [1046, 1318, 1568, 2093].forEach((f, i) => tone(f, 0.18, { type: 'triangle', vol: 0.1, delay: i * 0.1 })); },
        death() { for (let i = 0; i < 10; i++) tone(900 - i * 70, 0.13, { type: 'square', vol: 0.06, delay: i * 0.11, slide: 700 - i * 60 }); tone(120, 0.4, { type: 'sawtooth', vol: 0.08, delay: 1.15, slide: 50 }); },
        start() { // melodía original corta
            const notes = [523, 659, 784, 659, 523, 784, 1046, 0, 988, 784, 880, 1046];
            notes.forEach((f, i) => f && tone(f, 0.16, { type: 'square', vol: 0.06, delay: i * 0.17 }));
            [131, 196, 131, 196, 175, 262].forEach((f, i) => tone(f, 0.3, { type: 'triangle', vol: 0.12, delay: i * 0.34 }));
        },
        clear() { [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => tone(f, 0.14, { type: 'square', vol: 0.06, delay: i * 0.1 })); },
        siren: null,
        sirenOn(scared) {
            const a = BS.sfx.ctx && BS.sfx.ctx();
            if (!a || BS.sfx.isMuted()) return this.sirenOff();
            if (this.siren && this.siren.scared === scared) return;
            this.sirenOff();
            const o = a.createOscillator(), lfo = a.createOscillator(), lg = a.createGain(), g = a.createGain();
            o.type = scared ? 'square' : 'sine';
            o.frequency.value = scared ? 260 : 520;
            lfo.frequency.value = scared ? 9 : 3.2;
            lg.gain.value = scared ? 90 : 160;
            g.gain.value = scared ? 0.018 : 0.022;
            lfo.connect(lg).connect(o.frequency); o.connect(g).connect(a.destination);
            o.start(); lfo.start();
            this.siren = { o, lfo, scared };
        },
        sirenOff() { if (this.siren) { try { this.siren.o.stop(); this.siren.lfo.stop(); } catch (e) { /* */ } this.siren = null; } },
    };

    /* ---------------- Estado ---------------- */
    const G = {
        state: 'title', score: 0, best: CFG.best || 0, level: 1, lives: 3, extraGiven: false,
        dots: null, dotsLeft: 0, dotsEaten: 0, timer: 0, playTime: 0,
        mode: 'scatter', modeIdx: 0, modeTimer: 0, fright: 0, combo: 0, freeze: 0,
        fruit: null, fruitsShown: 0, popups: [], idleDots: 0, lastPause: 'playing',
    };
    let pac, ghosts;

    const tps = (v) => (v * T) / FPS; // casillas/seg → px por cuadro
    const pacSpeed = () => tps(Math.min(7.6 + (G.level - 1) * 0.35, 9.6) + (G.fright > 0 ? 0.6 : 0));
    const ghostSpeed = () => tps(Math.min(7.1 + (G.level - 1) * 0.42, 9.7));
    const frightTime = () => Math.max(1, 7 - G.level);
    const modeSchedule = () => (G.level < 5 ? [7, 20, 7, 20, 5, 20, 5, Infinity] : [5, 20, 5, 20, 5, 1037, 0.1, Infinity]);

    function newDots() {
        G.dots = MAZE.map((r) => r.split(''));
        G.dotsLeft = MAZE.join('').split('').filter((c) => c === '.' || c === 'o').length;
        G.dotsEaten = 0; G.fruitsShown = 0; G.fruit = null;
    }

    function makeGhost(name, color, tx, ty, state, scatter, dotLimit) {
        return { name, color, x: tx * T, y: (ty + 0.5) * T, dir: state === 'active' ? DIRS.left : DIRS.up, state, scatter, dotLimit, dotCount: 0, frightened: false, flashing: false, decidedAt: null, reverse: false, bob: 0 };
    }
    function resetActors() {
        pac = { x: 14 * T, y: 23.5 * T, dir: DIRS.left, want: DIRS.left, face: DIRS.left, mouth: 0, decidedAt: null, dying: 0 };
        const lim = G.level === 1 ? [0, 0, 30, 60] : G.level === 2 ? [0, 0, 0, 50] : [0, 0, 0, 0];
        ghosts = [
            makeGhost('blinky', '#ff3355', 14, 11, 'active', { x: 25, y: -3 }, lim[0]),
            makeGhost('pinky', '#ff9ad6', 14, 14, 'house', { x: 2, y: -3 }, lim[1]),
            makeGhost('inky', '#3ff2ff', 12, 14, 'house', { x: 27, y: 33 }, lim[2]),
            makeGhost('clyde', '#ffb347', 16, 14, 'house', { x: 0, y: 33 }, lim[3]),
        ];
        G.mode = 'scatter'; G.modeIdx = 0; G.modeTimer = 0; G.fright = 0; G.freeze = 0; G.idleDots = 0; G.fruit = null;
    }

    /* ---------------- Movimiento sobre la rejilla ---------------- */
    function step(e, dist, decide) {
        let guard = 0;
        while (dist > 0.0001 && guard++ < 8) {
            const tx = Math.floor(e.x / T), ty = Math.floor(e.y / T);
            const cx = (tx + 0.5) * T, cy = (ty + 0.5) * T;
            const key = tx + ',' + ty;
            if (same(e.dir, NONE)) {
                e.x = cx; e.y = cy;
                decide(e, tx, ty); e.decidedAt = key;
                if (same(e.dir, NONE)) return;
            }
            const d = (cx - e.x) * e.dir.x + (cy - e.y) * e.dir.y;
            if (d > 0.0001) {
                const m = Math.min(d, dist);
                e.x += e.dir.x * m; e.y += e.dir.y * m; dist -= m;
                continue;
            }
            if (Math.abs(d) <= 0.0001 && e.decidedAt !== key) {
                e.x = cx; e.y = cy; e.decidedAt = key;
                decide(e, tx, ty);
                if (same(e.dir, NONE)) return;
            }
            const m = Math.min(dist, T + Math.min(0, d));
            e.x += e.dir.x * m; e.y += e.dir.y * m; dist -= m;
            if (e.x < -T / 2) e.x += W; else if (e.x >= W + T / 2) e.x -= W;
        }
    }

    function decidePac(p, tx, ty) {
        if (!same(p.want, NONE) && !isWall(tx + p.want.x, ty + p.want.y)) p.dir = p.want;
        else if (isWall(tx + p.dir.x, ty + p.dir.y)) p.dir = NONE;
        if (!same(p.dir, NONE)) p.face = p.dir;
    }

    const pacTile = () => ({ x: Math.floor(pac.x / T), y: Math.floor(pac.y / T) });

    function targetOf(g) {
        if (g.state === 'eyes') return { x: 13, y: 11 };
        if (G.mode === 'scatter') return g.scatter;
        const p = pacTile(), f = pac.face;
        switch (g.name) {
            case 'pinky': return { x: p.x + f.x * 4, y: p.y + f.y * 4 };
            case 'inky': {
                const b = ghosts[0];
                const ax = p.x + f.x * 2, ay = p.y + f.y * 2;
                return { x: ax * 2 - Math.floor(b.x / T), y: ay * 2 - Math.floor(b.y / T) };
            }
            case 'clyde': {
                const gx = Math.floor(g.x / T), gy = Math.floor(g.y / T);
                return (gx - p.x) ** 2 + (gy - p.y) ** 2 > 64 ? p : g.scatter;
            }
            default: return p;
        }
    }

    function decideGhost(g, tx, ty) {
        if (g.reverse) {
            g.reverse = false;
            const back = opposite(g.dir);
            if (!isWall(tx + back.x, ty + back.y)) { g.dir = back; return; }
        }
        let options = ORDER.filter((d) => !same(d, opposite(g.dir)) && !isWall(tx + d.x, ty + d.y));
        if (!options.length) options = [opposite(g.dir)];
        if (g.frightened && g.state === 'active') { g.dir = options[Math.floor(Math.random() * options.length)]; return; }
        const t = targetOf(g);
        let best = options[0], bestD = Infinity;
        for (const d of options) {
            const dd = (tx + d.x - t.x) ** 2 + (ty + d.y - t.y) ** 2;
            if (dd < bestD) { bestD = dd; best = d; }
        }
        g.dir = best;
    }

    function moveTowards(g, tx, ty, sp) {
        const dx = tx - g.x, dy = ty - g.y;
        if (Math.abs(dx) > 0.01) { const m = Math.min(Math.abs(dx), sp); g.x += Math.sign(dx) * m; g.dir = dx < 0 ? DIRS.left : DIRS.right; return false; }
        if (Math.abs(dy) > 0.01) { const m = Math.min(Math.abs(dy), sp); g.y += Math.sign(dy) * m; g.dir = dy < 0 ? DIRS.up : DIRS.down; return false; }
        return true;
    }

    function updateGhost(g) {
        const base = ghostSpeed();
        const tx = Math.floor(g.x / T), ty = Math.floor(g.y / T);
        if (g.state === 'house') {
            g.bob += 0.08;
            g.y = 14.5 * T + Math.sin(g.bob) * T * 0.35;
            g.dir = Math.cos(g.bob) > 0 ? DIRS.down : DIRS.up;
            return;
        }
        if (g.state === 'leaving') {
            if (moveTowards(g, 14 * T, 11.5 * T, base * 0.55)) {
                g.state = 'active'; g.dir = DIRS.left; g.decidedAt = null;
            }
            return;
        }
        if (g.state === 'entering') {
            if (moveTowards(g, 14 * T, 14.5 * T, tps(10))) { g.state = 'leaving'; g.frightened = false; }
            return;
        }
        if (g.state === 'eyes' && (tx === 13 || tx === 14) && ty === 11) {
            g.state = 'entering'; g.y = 11.5 * T; return;
        }
        let sp = base;
        if (g.state === 'eyes') sp = tps(16);
        else if (g.frightened) sp = tps(4.4);
        if (g.state !== 'eyes' && ty === 14 && (tx < 6 || tx > 21)) sp *= 0.5;
        step(g, sp, decideGhost);
    }

    function releaseGhosts(dt) {
        const next = ghosts.find((g) => g.state === 'house');
        if (!next) return;
        G.idleDots += dt;
        if (next.dotCount >= next.dotLimit || G.idleDots > Math.max(2.5, 4.5 - G.level * 0.3)) {
            next.state = 'leaving'; G.idleDots = 0;
        }
    }

    /* ---------------- Efectos ---------------- */
    function popup(x, y, text, color = '#3ff2ff') { G.popups.push({ x, y, text, color, t: 1.2 }); }
    function pageXY(x, y) {
        const r = canvas.getBoundingClientRect();
        return [r.left + (x / W) * r.width, r.top + (y / H) * r.height];
    }

    function addScore(n) {
        G.score += n;
        if (!G.extraGiven && G.score >= 10000) { G.extraGiven = true; G.lives++; snd.life(); popup(pac.x, pac.y - 20, '¡VIDA EXTRA!', '#3dff8a'); }
        if (G.score > G.best) G.best = G.score;
        hud();
    }

    /* ---------------- Ciclo de juego ---------------- */
    function update(dt) {
        G.timer += dt;
        G.popups.forEach((p) => { p.t -= dt; p.y -= 0.4; });
        G.popups = G.popups.filter((p) => p.t > 0);

        if (G.state === 'ready') {
            if (G.timer > G.readyFor) { G.state = 'playing'; G.timer = 0; }
            return;
        }
        if (G.state === 'dying') {
            pac.dying += dt;
            if (pac.dying > 2.2) {
                G.lives--; hud();
                if (G.lives <= 0) return gameOver();
                resetActors(); G.state = 'ready'; G.timer = 0; G.readyFor = 1.8;
            }
            return;
        }
        if (G.state === 'levelclear') {
            if (G.timer > 2.4) { G.level++; newDots(); resetActors(); G.state = 'ready'; G.timer = 0; G.readyFor = 1.8; hud(); }
            return;
        }
        if (G.state !== 'playing') return;

        G.playTime += dt;
        if (G.freeze > 0) { G.freeze -= dt; return; }

        // Modos dispersión / persecución (se pausan durante el susto).
        if (G.fright > 0) {
            G.fright -= dt;
            ghosts.forEach((g) => { g.flashing = G.fright < 2 && Math.floor(G.fright * 5) % 2 === 0; });
            if (G.fright <= 0) { ghosts.forEach((g) => { g.frightened = false; g.flashing = false; }); }
        } else {
            G.modeTimer += dt;
            const sched = modeSchedule();
            if (G.modeTimer >= sched[G.modeIdx]) {
                G.modeTimer = 0; G.modeIdx = Math.min(G.modeIdx + 1, sched.length - 1);
                G.mode = G.modeIdx % 2 === 0 ? 'scatter' : 'chase';
                ghosts.forEach((g) => { if (g.state === 'active') g.reverse = true; });
            }
        }
        snd.sirenOn(G.fright > 0);

        // Pac-Man
        if (!same(pac.want, NONE) && same(pac.want, opposite(pac.dir))) { pac.dir = pac.want; pac.face = pac.want; pac.decidedAt = null; }
        const before = [pac.x, pac.y];
        step(pac, pacSpeed(), decidePac);
        if (pac.x !== before[0] || pac.y !== before[1]) pac.mouth += 0.32;
        eat();

        releaseGhosts(dt);
        ghosts.forEach(updateGhost);
        collide();

        if (G.fruit) {
            G.fruit.t -= dt;
            if (G.fruit.t <= 0) G.fruit = null;
            else if (Math.abs(pac.x - 14 * T) < T * 0.8 && Math.abs(pac.y - 17.5 * T) < T * 0.6) {
                addScore(G.fruit.points); snd.fruit();
                popup(14 * T, 17.5 * T, String(G.fruit.points), '#ff9ad6');
                G.fruit = null;
            }
        }

        if (G.dotsLeft === 0) {
            snd.sirenOff(); snd.clear();
            G.state = 'levelclear'; G.timer = 0;
            BS.fx.confetti(60);
        }
    }

    function eat() {
        const tx = ((Math.floor(pac.x / T) % COLS) + COLS) % COLS, ty = Math.floor(pac.y / T);
        const c = G.dots[ty]?.[tx];
        if (c !== '.' && c !== 'o') return;
        G.dots[ty][tx] = ' ';
        G.dotsLeft--; G.dotsEaten++; G.idleDots = 0;
        const house = ghosts.find((g) => g.state === 'house');
        if (house) house.dotCount++;
        if (c === '.') { addScore(10); snd.waka(); }
        else {
            addScore(50); snd.power();
            G.fright = frightTime(); G.combo = 0;
            ghosts.forEach((g) => {
                if (g.state === 'eyes' || g.state === 'entering') return;
                g.frightened = true; g.flashing = false;
                if (g.state === 'active') g.reverse = true;
            });
        }
        if ((G.dotsEaten === 70 || G.dotsEaten === 170) && !G.fruit) {
            const [icon, points] = FRUITS[Math.min(G.level - 1, FRUITS.length - 1)];
            G.fruit = { icon, points, t: 9.5 };
        }
    }

    function collide() {
        for (const g of ghosts) {
            if (g.state === 'eyes' || g.state === 'entering' || g.state === 'house') continue;
            if (Math.abs(g.x - pac.x) > T * 0.6 || Math.abs(g.y - pac.y) > T * 0.6) continue;
            if (g.frightened) {
                const pts = 200 * 2 ** G.combo;
                G.combo = Math.min(G.combo + 1, 3);
                g.frightened = false; g.state = 'eyes'; g.decidedAt = null;
                addScore(pts); snd.ghost();
                popup(g.x, g.y, String(pts));
                BS.fx.explosion(...pageXY(g.x, g.y), 0.5);
                G.freeze = 0.45;
            } else {
                die();
                return;
            }
        }
    }

    function die() {
        snd.sirenOff(); snd.death();
        G.state = 'dying'; pac.dying = 0.0001;
        BS.fx.shake && BS.fx.shake();
    }

    /* ---------------- Dibujo ---------------- */
    function draw() {
        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
        const color = PALETTES[(G.level - 1) % PALETTES.length];
        const flashing = G.state === 'levelclear' && G.timer > 0.6 && Math.floor(G.timer * 4) % 2 === 0;
        ctx.drawImage(mazeFor(flashing ? '#ffffff' : color), 0, 0, W, H);

        // Puntos y píldoras
        const pulse = 0.6 + 0.4 * Math.sin(performance.now() / 160);
        for (let y = 0; y < ROWS; y++) {
            for (let x = 0; x < COLS; x++) {
                const c = G.dots ? G.dots[y][x] : MAZE[y][x];
                if (c === '.') {
                    ctx.fillStyle = '#ffd9b0';
                    ctx.fillRect((x + 0.5) * T - 2, (y + 0.5) * T - 2, 4, 4);
                } else if (c === 'o' && (G.state !== 'playing' || pulse > 0.35)) {
                    ctx.save();
                    ctx.shadowColor = '#ffd23d'; ctx.shadowBlur = 14;
                    ctx.fillStyle = '#ffe7b0';
                    ctx.beginPath(); ctx.arc((x + 0.5) * T, (y + 0.5) * T, 4.5 + pulse * 2, 0, Math.PI * 2); ctx.fill();
                    ctx.restore();
                }
            }
        }

        if (G.fruit) {
            ctx.font = `${T * 1.4}px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif`;
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(G.fruit.icon, 14 * T, 17.5 * T + Math.sin(performance.now() / 200) * 1.5);
        }

        if (G.state !== 'title' && G.state !== 'levelclear') {
            if (G.state !== 'dying' || pac.dying < 0.6) ghosts.forEach(drawGhost);
            drawPac();
        } else if (G.state === 'levelclear') drawPac();

        // Textos
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        if (G.state === 'ready') {
            ctx.font = '15px "Black Ops One", Impact, sans-serif';
            ctx.fillStyle = '#ffd23d'; ctx.shadowColor = '#ffd23d'; ctx.shadowBlur = 10;
            ctx.fillText('¡LISTO!', 14 * T, 17.5 * T);
            if (G.level > 1 && G.timer < G.readyFor) { ctx.fillStyle = '#3ff2ff'; ctx.shadowColor = '#3ff2ff'; ctx.fillText('NIVEL ' + G.level, 14 * T, 13.5 * T + 2); }
            ctx.shadowBlur = 0;
        }
        if (G.state === 'gameover') {
            ctx.font = '15px "Black Ops One", Impact, sans-serif';
            ctx.fillStyle = '#ff3355'; ctx.shadowColor = '#ff3355'; ctx.shadowBlur = 10;
            ctx.fillText('FIN DEL JUEGO', 14 * T, 17.5 * T); ctx.shadowBlur = 0;
        }
        ctx.font = 'bold 12px Montserrat, sans-serif';
        G.popups.forEach((p) => {
            ctx.globalAlpha = Math.min(1, p.t * 2);
            ctx.fillStyle = p.color; ctx.shadowColor = p.color; ctx.shadowBlur = 8;
            ctx.fillText(p.text, p.x, p.y);
        });
        ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    }

    function drawPac() {
        const r = T * 0.78;
        const ang = Math.atan2(pac.face.y, pac.face.x);
        let mouth = 0.08 + Math.abs(Math.sin(pac.mouth)) * 0.62;
        if (G.state === 'ready' || G.state === 'levelclear') mouth = 0.35;
        ctx.save();
        ctx.translate(pac.x, pac.y);
        ctx.shadowColor = '#ffd23d'; ctx.shadowBlur = 16;
        const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.35, 1, 0, 0, r);
        grad.addColorStop(0, '#fff6b0'); grad.addColorStop(0.55, '#ffd23d'); grad.addColorStop(1, '#e09a00');
        ctx.fillStyle = grad;
        if (G.state === 'dying') {
            const k = Math.min(1, pac.dying / 1.4);
            if (k >= 1) { ctx.restore(); return; }
            ctx.rotate(-Math.PI / 2);
            const a = 0.1 + k * Math.PI;
            ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, r, a, Math.PI * 2 - a); ctx.closePath(); ctx.fill();
            ctx.restore();
            if (k > 0.97 && !pac.burst) { pac.burst = true; BS.fx.explosion(...pageXY(pac.x, pac.y), 0.7); }
            return;
        }
        ctx.rotate(ang);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, r, mouth * 1.1, Math.PI * 2 - mouth * 1.1); ctx.closePath(); ctx.fill();
        ctx.shadowBlur = 0; ctx.fillStyle = '#1a1200';
        ctx.beginPath(); ctx.arc(r * 0.1, -r * 0.5, r * 0.11, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }

    function drawGhost(g) {
        const s = T * 0.82;
        const now = performance.now() / 1000;
        ctx.save();
        ctx.translate(g.x, g.y);
        if (g.state !== 'eyes' && g.state !== 'entering') {
            const scared = g.frightened && !(g.state === 'house' && G.fright <= 0);
            const body = scared ? (g.flashing ? '#f4f4ff' : '#2a3dff') : g.color;
            ctx.shadowColor = body; ctx.shadowBlur = 14;
            const grad = ctx.createLinearGradient(0, -s, 0, s);
            grad.addColorStop(0, scared ? body : '#ffffff'); grad.addColorStop(0.18, body); grad.addColorStop(1, body);
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(0, -s * 0.15, s, Math.PI, 0);
            ctx.lineTo(s, s * 0.85);
            const waves = 4, phase = (now * 8) % 2;
            for (let i = 0; i <= waves * 2; i++) {
                const x = s - (i * (2 * s)) / (waves * 2);
                const up = (i + Math.floor(phase)) % 2 === 0;
                ctx.lineTo(x, up ? s * 0.85 : s * 0.55);
            }
            ctx.closePath(); ctx.fill();
            ctx.shadowBlur = 0;
            if (scared) {
                ctx.fillStyle = g.flashing ? '#ff3355' : '#ffd9b0';
                ctx.fillRect(-s * 0.4, -s * 0.35, s * 0.22, s * 0.22);
                ctx.fillRect(s * 0.18, -s * 0.35, s * 0.22, s * 0.22);
                ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 1.6;
                ctx.beginPath();
                for (let i = 0; i <= 6; i++) ctx.lineTo(-s * 0.6 + (i * 1.2 * s) / 6, s * 0.3 + (i % 2 ? -s * 0.12 : 0));
                ctx.stroke();
                ctx.restore();
                return;
            }
        }
        // Ojos que miran hacia donde va
        const d = g.dir;
        for (const ex of [-s * 0.38, s * 0.38]) {
            ctx.fillStyle = '#fff';
            ctx.beginPath(); ctx.ellipse(ex + d.x * s * 0.08, -s * 0.25 + d.y * s * 0.08, s * 0.28, s * 0.36, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#1b3cff';
            ctx.beginPath(); ctx.arc(ex + d.x * s * 0.2, -s * 0.25 + d.y * s * 0.22, s * 0.15, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
    }

    /* ---------------- HUD / ranking ---------------- */
    function hud() {
        $('#hud-score').textContent = G.score.toLocaleString('es-MX');
        $('#hud-best').textContent = G.best.toLocaleString('es-MX');
        $('#hud-level').textContent = G.level;
        $('#hud-lives').innerHTML = '<i></i>'.repeat(Math.max(0, G.lives));
    }

    function renderRanking(rows) {
        const t = $('#pac-ranking');
        if (!rows.length) { t.innerHTML = '<tr><td class="empty">Nadie ha jugado aún. ¡Sé el primero!</td></tr>'; return; }
        t.innerHTML = rows.map((r, i) => `<tr class="${r.user_id === BS.userId ? 'me' : ''}">
            <td class="pos">${i + 1}</td><td>${BS.esc(r.name)}<br><small style="color:var(--muted)">Nivel ${r.level} · ${BS.esc(r.date || '')}</small></td>
            <td class="pts">${r.score.toLocaleString('es-MX')}</td></tr>`).join('');
    }

    /* ---------------- Pantallas ---------------- */
    const overlay = $('#pac-overlay');
    function showOverlay(html, cls = '') { overlay.className = 'pac-overlay ' + cls; overlay.innerHTML = `<div>${html}</div>`; overlay.hidden = false; }

    function start() {
        overlay.hidden = true;
        G.score = 0; G.level = 1; G.lives = 3; G.extraGiven = false; G.playTime = 0;
        newDots(); resetActors(); hud();
        G.state = 'ready'; G.timer = 0; G.readyFor = 2.2;
        snd.start();
        canvas.focus && canvas.focus();
    }

    function pause() {
        if (G.state === 'paused') {
            overlay.hidden = true; G.state = G.lastPause; return;
        }
        if (!['playing', 'ready'].includes(G.state)) return;
        G.lastPause = G.state; G.state = 'paused'; snd.sirenOff();
        showOverlay(`<h2>PAUSA</h2><p class="press">Presiona P o toca para continuar</p>`);
        overlay.onclick = () => pause();
    }

    async function gameOver() {
        G.state = 'gameover'; snd.sirenOff();
        const score = G.score;
        showOverlay(`<h2>FIN DEL JUEGO</h2><div class="pac-final">${score.toLocaleString('es-MX')}</div><p id="go-msg">Guardando tu puntaje…</p>
            <div class="actions"><button class="btn" id="btn-again" style="--c1:#ffd23d;--c2:#d18a00;color:#04121f">↻ Jugar otra vez</button>
            <a class="btn ghost" href="${BS.base}/">🎮 Sala de juegos</a></div>`, 'go');
        overlay.onclick = null;
        $('#btn-again').onclick = (e) => { e.stopPropagation(); start(); };
        if (score <= 0) { $('#go-msg').textContent = '¡Inténtalo de nuevo!'; return; }
        try {
            const r = await BS.api('POST', '/pacman/scores', { score, level: G.level, duration: Math.max(1, Math.round(G.playTime)) });
            G.best = r.best; hud();
            renderRanking(r.leaderboard);
            const msg = $('#go-msg');
            if (msg) {
                msg.innerHTML = (r.new_best ? '<span class="new-best">★ ¡NUEVO RÉCORD PERSONAL! ★</span><br>' : '') + `Quedaste en el lugar <b>#${r.rank}</b> del salón de la fama.`;
            }
            if (r.new_best) { BS.sfx.victory(); BS.fx.confetti(); }
            if (r.rank === 1 && r.new_best) BS.fx.fireworks();
        } catch (e) { const msg = $('#go-msg'); if (msg) msg.textContent = 'No se pudo guardar el puntaje: ' + e.message; }
    }

    /* ---------------- Controles ---------------- */
    const KEYS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right', W: 'up', S: 'down', A: 'left', D: 'right' };
    window.addEventListener('keydown', (e) => {
        if (e.target.closest && e.target.closest('input, textarea')) return;
        if (KEYS[e.key]) {
            e.preventDefault();
            if (G.state === 'title' || G.state === 'gameover') return;
            pac.want = DIRS[KEYS[e.key]];
        } else if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
            pause();
        } else if ((e.key === 'Enter' || e.key === ' ') && (G.state === 'title' || G.state === 'gameover')) {
            e.preventDefault(); start();
        }
    });
    let touch = null;
    canvas.addEventListener('touchstart', (e) => { touch = [e.touches[0].clientX, e.touches[0].clientY]; }, { passive: true });
    canvas.addEventListener('touchmove', (e) => {
        if (!touch || !pac) return;
        const dx = e.touches[0].clientX - touch[0], dy = e.touches[0].clientY - touch[1];
        if (Math.hypot(dx, dy) < 18) return;
        pac.want = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? DIRS.right : DIRS.left) : (dy > 0 ? DIRS.down : DIRS.up);
        touch = [e.touches[0].clientX, e.touches[0].clientY];
        e.preventDefault();
    }, { passive: false });
    document.querySelectorAll('#pac-dpad button').forEach((b) => b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if (pac) pac.want = DIRS[b.dataset.dir];
    }));
    window.addEventListener('blur', () => { if (G.state === 'playing') pause(); });
    $('#btn-start').addEventListener('click', start);

    /* ---------------- Bucle principal ---------------- */
    let last = performance.now(), acc = 0;
    function frame(now) {
        acc += Math.min(0.1, (now - last) / 1000);
        last = now;
        while (acc >= 1 / FPS) { if (G.state !== 'paused') update(1 / FPS); acc -= 1 / FPS; }
        draw();
        requestAnimationFrame(frame);
    }

    newDots(); resetActors(); hud();
    renderRanking(CFG.leaderboard || []);
    requestAnimationFrame(frame);
})();
