/* ==========================================================================
   BATTLESHIPS · partida: despliegue de flota, combate, animaciones y chat
   ========================================================================== */
(function () {
    'use strict';
    const BS = window.BS;
    const CFG = window.BS_GAME;
    const N = 10;
    const FLEET = CFG.fleet; // [{type, name, size}]
    const SIZE = Object.fromEntries(FLEET.map((s) => [s.type, s.size]));
    const NAME = Object.fromEntries(FLEET.map((s) => [s.type, s.name]));
    const COLS = 'ABCDEFGHIJ';
    const $ = (s, r = document) => r.querySelector(s);

    const stage = $('#stage');
    const chat = BS.chat($('#game-chat'), { gameId: CFG.id });

    let S = null;            // último estado del servidor
    let view = null;         // 'invited' | 'placement' | 'battle' | 'closed'
    let boards = null;       // { mine, enemy }
    let applied = new Set(); // movimientos ya pintados
    let queue = Promise.resolve();
    let busy = false;        // animando o disparando
    let finishedShown = false;
    let lastTurn = null;

    const cellsOf = (s) => Array.from({ length: SIZE[s.type] }, (_, i) => s.dir === 'h' ? [s.x + i, s.y] : [s.x, s.y + i]);
    const me = () => S.me;
    const foe = () => 3 - S.me;

    /* ---------------- Tableros ---------------- */
    function createBoard(kind) {
        const frame = document.createElement('div');
        frame.className = 'board-frame';
        frame.innerHTML = `<div></div><div class="labels-x">${[...COLS].map((c) => `<span>${c}</span>`).join('')}</div>
            <div class="labels-y">${Array.from({ length: N }, (_, i) => `<span>${i + 1}</span>`).join('')}</div>
            <div class="board ${kind}"><div class="ships-layer"></div></div>`;
        const board = $('.board', frame);
        const cells = [];
        for (let y = 0; y < N; y++) {
            cells[y] = [];
            for (let x = 0; x < N; x++) {
                const c = document.createElement('div');
                c.className = 'cell'; c.dataset.x = x; c.dataset.y = y;
                c.title = COLS[x] + (y + 1);
                board.insertBefore(c, $('.ships-layer', board));
                cells[y][x] = c;
            }
        }
        return { frame, board, cells, layer: $('.ships-layer', board), ships: {} };
    }

    function shipEl(ship) {
        const len = SIZE[ship.type];
        const el = document.createElement('div');
        el.className = 'ship ' + ship.dir;
        el.dataset.type = ship.type;
        positionShip(el, ship);
        const inner = document.createElement('div');
        inner.style.width = `calc(var(--cell) * ${len})`;
        inner.style.height = 'var(--cell)';
        if (ship.dir === 'v') { inner.style.transformOrigin = '0 0'; inner.style.transform = 'translateX(var(--cell)) rotate(90deg)'; }
        inner.innerHTML = BS.shipSVG(ship.type, len);
        el.appendChild(inner);
        return el;
    }
    function positionShip(el, ship) {
        const len = SIZE[ship.type];
        el.style.left = `calc(var(--cell) * ${ship.x})`;
        el.style.top = `calc(var(--cell) * ${ship.y})`;
        el.style.width = `calc(var(--cell) * ${ship.dir === 'h' ? len : 1})`;
        el.style.height = `calc(var(--cell) * ${ship.dir === 'v' ? len : 1})`;
    }
    function drawShip(b, ship, cls = '') {
        b.ships[ship.type]?.remove();
        const el = shipEl(ship);
        if (cls) el.classList.add(...cls.split(' '));
        b.layer.appendChild(el);
        b.ships[ship.type] = el;
        return el;
    }

    function center(el) {
        const r = el.getBoundingClientRect();
        return [r.left + r.width / 2, r.top + r.height / 2];
    }

    function mark(cell, result) {
        if ($('.mark', cell)) $('.mark', cell).remove();
        const m = document.createElement('div');
        m.className = 'mark ' + (result === 'miss' ? 'miss' : 'hit');
        if (result !== 'miss') m.innerHTML = '<div class="flame"><span></span><span></span></div><div class="smoke"></div><div class="smoke"></div>';
        cell.appendChild(m);
    }

    /* ---------------- HUD ---------------- */
    function renderHud() {
        const p = S.players;
        const sunkMine = S.sunk_by_enemy || [], sunkTheirs = S.sunk_by_me || [];
        const fleetBars = (sunk) => `<div class="hud-fleet">${FLEET.map((s) => `<i class="${sunk.includes(s.type) ? 'sunk' : ''}" style="width:${s.size * 9}px" title="${s.name}"></i>`).join('')}</div>`;
        const playing = S.status === 'playing';
        const offline = S.mode === 'pvp' && S.opponent_online === false && ['placing', 'playing'].includes(S.status);

        $('#hud-me').className = 'hud-player' + (playing && S.turn === me() ? ' active' : '');
        $('#hud-me').innerHTML = `${BS.avatar(p[me()].name, p[me()].initials)}
            <div style="min-width:0"><div class="hud-name">${BS.esc(p[me()].name)}<small>Tu flota</small></div>${S.my_ships ? fleetBars(sunkMine) : ''}</div>`;
        $('#hud-enemy').className = 'hud-player right' + (playing && S.turn === foe() ? ' active' : '');
        $('#hud-enemy').innerHTML = `${BS.avatar(p[foe()].name, p[foe()].initials, null, S.mode === 'cpu' ? 'cpu' : '')}
            <div style="min-width:0"><div class="hud-name">${BS.esc(p[foe()].name)}<small style="${offline ? 'color:var(--red)' : ''}">${offline ? '⚠ Sin conexión' : (S.mode === 'cpu' ? 'Inteligencia artificial' : 'Flota enemiga')}</small></div>${S.my_ships ? fleetBars(sunkTheirs) : ''}</div>`;

        const banner = $('#turn-banner');
        banner.className = 'turn-banner';
        if (S.status === 'playing') {
            if (S.turn === me()) { banner.classList.add('mine'); banner.innerHTML = '¡TU TURNO!<small>Elige un objetivo en aguas enemigas</small>'; }
            else { banner.classList.add('theirs'); banner.innerHTML = `TURNO RIVAL<small>${BS.esc(p[foe()].name)} está apuntando…</small>`; }
        } else if (S.status === 'placing') {
            banner.innerHTML = 'DESPLIEGUE<small>Coloca tu flota en posición</small>';
        } else if (S.status === 'finished') {
            banner.innerHTML = S.winner === me() ? '🏆 VICTORIA' : '☠ DERROTA';
            banner.classList.add(S.winner === me() ? 'mine' : 'theirs');
        } else if (S.status === 'invited') {
            banner.innerHTML = 'DESAFÍO<small>Esperando respuesta</small>';
        } else {
            banner.innerHTML = 'SIN BATALLA';
        }

        if (S.stats) {
            const st = S.stats[me()];
            $('#st-shots').textContent = st.shots;
            $('#st-acc').textContent = st.accuracy + '%';
            $('#st-sunk').textContent = `${sunkTheirs.length}/${FLEET.length}`;
            $('#st-lost').textContent = `${sunkMine.length}/${FLEET.length}`;
        }
        const active = ['placing', 'playing'].includes(S.status);
        $('#btn-forfeit').hidden = !active;
        $('#btn-claim').hidden = !(active && S.can_claim);
    }

    /* ---------------- Invitación ---------------- */
    function renderInvited() {
        view = 'invited';
        const rival = S.players[foe()].name;
        if (S.me === 1) {
            stage.innerHTML = `<section class="panel modal" style="margin:30px auto">
                <div class="radar"><span class="blip" style="left:30%;top:35%"></span><span class="blip" style="left:65%;top:60%;animation-delay:1.2s"></span></div>
                <h2 style="font-size:30px">Desafío enviado</h2>
                <p>Esperando a que <b>${BS.esc(rival)}</b> acepte la batalla…<br><span id="countdown"></span></p>
                <div class="actions"><button class="btn ghost" id="btn-cancel">Cancelar desafío</button></div></section>`;
            $('#btn-cancel').onclick = async () => { await BS.api('POST', `/games/${S.id}/decline`).catch(BS.error); location.href = BS.base + '/'; };
        } else {
            stage.innerHTML = `<section class="panel modal" style="margin:30px auto">
                <div class="medal">⚔</div><h2 style="font-size:30px">¡Te desafían!</h2>
                <p><b>${BS.esc(rival)}</b> quiere enfrentarse a ti en batalla naval.<br><span id="countdown"></span></p>
                <div class="actions"><button class="btn green big pulse" id="btn-accept">Aceptar</button><button class="btn ghost" id="btn-decline">Rechazar</button></div></section>`;
            $('#btn-accept').onclick = async () => { try { apply(await BS.api('POST', `/games/${S.id}/accept`).then(() => BS.api('GET', `/games/${S.id}/state`))); } catch (e) { BS.error(e); } };
            $('#btn-decline').onclick = async () => { await BS.api('POST', `/games/${S.id}/decline`).catch(BS.error); location.href = BS.base + '/'; };
        }
        tickCountdown();
    }
    function tickCountdown() {
        const el = $('#countdown');
        if (!el || S.status !== 'invited') return;
        el.textContent = S.expires_in > 0 ? `La invitación expira en ${Math.ceil(S.expires_in)} s` : 'La invitación expiró.';
        if (S.expires_in <= 0) closedView('La invitación expiró', 'El desafío no fue respondido a tiempo.');
    }

    function closedView(title, text) {
        if (view === 'closed') return;
        view = 'closed';
        stage.innerHTML = `<section class="panel modal" style="margin:30px auto"><div class="medal">🌊</div><h2 style="font-size:30px">${BS.esc(title)}</h2>
            <p>${BS.esc(text)}</p><div class="actions"><a class="btn" href="${BS.base}/">Volver al puerto</a></div></section>`;
    }

    /* ---------------- Despliegue de flota ---------------- */
    let placed = {};
    let orient = 'h';

    function renderPlacement() {
        view = 'placement';
        placed = {};
        stage.innerHTML = `<div class="placement">
            <section class="panel dock">
                <h3>⚓ Despliega tu flota</h3>
                <p>Arrastra cada barco al mapa. Haz clic sobre un barco colocado para girarlo,
                   o pulsa <span class="kbd">R</span> / clic derecho mientras lo arrastras.</p>
                <div class="dock-ships" id="dock">${FLEET.map((s) => `
                    <div class="dock-ship" data-type="${s.type}">
                        <div class="art">${BS.shipSVG(s.type, s.size)}</div>
                        <div class="lbl">${BS.esc(s.name)}<small>${s.size} casillas</small></div>
                    </div>`).join('')}</div>
                <div class="dock-actions">
                    <button class="btn sm ghost" id="btn-orient">↻ Horizontal</button>
                    <button class="btn sm ghost" id="btn-random">🎲 Aleatorio</button>
                    <button class="btn sm ghost" id="btn-clear" style="grid-column:1/-1">🧹 Limpiar mapa</button>
                </div>
                <button class="btn fire big" id="btn-ready" disabled>¡Listos para el combate!</button>
            </section>
            <section class="panel board-card placing" id="place-card">
                <div class="board-title">🛳 Tu zona de despliegue <span class="meta" id="place-count">0/${FLEET.length} barcos</span></div>
            </section>
        </div>`;
        boards = { mine: createBoard('mine') };
        $('#place-card').appendChild(boards.mine.frame);

        document.querySelectorAll('.dock-ship').forEach((d) => d.addEventListener('pointerdown', (e) => {
            if (placed[d.dataset.type]) return;
            startDrag(e, { type: d.dataset.type, dir: orient }, 0, null);
        }));
        $('#btn-orient').onclick = () => { orient = orient === 'h' ? 'v' : 'h'; $('#btn-orient').textContent = orient === 'h' ? '↻ Horizontal' : '↻ Vertical'; BS.sfx.rotate(); };
        $('#btn-random').onclick = () => { randomFleet().forEach((s) => (placed[s.type] = s)); redrawPlaced(); BS.sfx.place(); };
        $('#btn-clear').onclick = () => { placed = {}; redrawPlaced(); BS.sfx.click(); };
        $('#btn-ready').onclick = submitFleet;
    }

    function fits(ship, ignoreType) {
        const taken = new Set();
        Object.values(placed).forEach((s) => { if (s.type !== ignoreType) cellsOf(s).forEach(([x, y]) => taken.add(x + ',' + y)); });
        return cellsOf(ship).every(([x, y]) => x >= 0 && y >= 0 && x < N && y < N && !taken.has(x + ',' + y));
    }

    function randomFleet() {
        for (;;) {
            const blocked = new Set(); const out = []; let ok = true;
            for (const s of FLEET) {
                let done = false;
                for (let t = 0; t < 200 && !done; t++) {
                    const dir = Math.random() < 0.5 ? 'h' : 'v';
                    const x = Math.floor(Math.random() * (dir === 'h' ? N - s.size + 1 : N));
                    const y = Math.floor(Math.random() * (dir === 'v' ? N - s.size + 1 : N));
                    const ship = { type: s.type, x, y, dir };
                    const cells = cellsOf(ship);
                    if (cells.some(([cx, cy]) => blocked.has(cx + ',' + cy))) continue;
                    cells.forEach(([cx, cy]) => { for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) blocked.add((cx + dx) + ',' + (cy + dy)); });
                    out.push(ship); done = true;
                }
                if (!done) { ok = false; break; }
            }
            if (ok) return out;
        }
    }

    function redrawPlaced() {
        const b = boards.mine;
        Object.values(b.ships).forEach((el) => el.remove());
        b.ships = {};
        Object.values(placed).forEach((s) => {
            const el = drawShip(b, s);
            el.addEventListener('pointerdown', (e) => {
                if (e.button !== 0) return;
                const cell = cellFromPoint(e.clientX, e.clientY);
                const idx = cell ? Math.max(0, s.dir === 'h' ? cell[0] - s.x : cell[1] - s.y) : 0;
                startDrag(e, { ...s }, idx, s.type);
            });
        });
        document.querySelectorAll('.dock-ship').forEach((d) => d.classList.toggle('placed', !!placed[d.dataset.type]));
        const count = Object.keys(placed).length;
        $('#place-count').textContent = `${count}/${FLEET.length} barcos`;
        $('#btn-ready').disabled = count !== FLEET.length;
        $('#btn-ready').classList.toggle('pulse', count === FLEET.length);
    }

    function cellFromPoint(px, py) {
        const r = boards.mine.board.getBoundingClientRect();
        const size = r.width / N;
        const x = Math.floor((px - r.left) / size), y = Math.floor((py - r.top) / size);
        return x >= -N && y >= -N && x < 2 * N && y < 2 * N ? [x, y] : null;
    }

    function startDrag(e, ship, grabIndex, existingType) {
        e.preventDefault();
        const b = boards.mine;
        const cellPx = b.board.getBoundingClientRect().width / N;
        const startX = e.clientX, startY = e.clientY;
        let moved = false;
        let target = null;
        const ghost = document.createElement('div');
        ghost.className = 'drag-ghost';
        const paintGhost = () => {
            const len = SIZE[ship.type];
            ghost.style.width = (ship.dir === 'h' ? len : 1) * cellPx + 'px';
            ghost.style.height = (ship.dir === 'v' ? len : 1) * cellPx + 'px';
            ghost.innerHTML = `<div style="width:${len * cellPx}px;height:${cellPx}px;${ship.dir === 'v' ? `transform-origin:0 0;transform:translateX(${cellPx}px) rotate(90deg)` : ''}">${BS.shipSVG(ship.type, len)}</div>`;
        };
        const clearPreview = () => b.board.querySelectorAll('.preview-ok,.preview-bad').forEach((c) => c.classList.remove('preview-ok', 'preview-bad'));
        const update = (px, py) => {
            ghost.style.left = px - (ship.dir === 'h' ? grabIndex + 0.5 : 0.5) * cellPx + 'px';
            ghost.style.top = py - (ship.dir === 'v' ? grabIndex + 0.5 : 0.5) * cellPx + 'px';
            clearPreview();
            const c = cellFromPoint(px, py);
            target = null;
            if (!c) return;
            const cand = { ...ship, x: c[0] - (ship.dir === 'h' ? grabIndex : 0), y: c[1] - (ship.dir === 'v' ? grabIndex : 0) };
            const r = b.board.getBoundingClientRect();
            const over = px >= r.left && px <= r.right && py >= r.top && py <= r.bottom;
            if (!over) return;
            const ok = fits(cand, existingType);
            cellsOf(cand).forEach(([x, y]) => b.cells[y]?.[x]?.classList.add(ok ? 'preview-ok' : 'preview-bad'));
            target = ok ? cand : null;
        };
        let lastPt = [e.clientX, e.clientY];
        const rotate = () => { ship.dir = ship.dir === 'h' ? 'v' : 'h'; grabIndex = 0; paintGhost(); update(...lastPt); BS.sfx.rotate(); };
        const onMove = (ev) => {
            lastPt = [ev.clientX, ev.clientY];
            if (!moved && Math.hypot(ev.clientX - startX, ev.clientY - startY) > 5) {
                moved = true;
                paintGhost(); document.body.appendChild(ghost);
                if (existingType) b.ships[existingType]?.classList.add('dragging');
            }
            if (moved) update(ev.clientX, ev.clientY);
        };
        const onKey = (ev) => { if (moved && (ev.key === 'r' || ev.key === 'R')) rotate(); };
        const onCtx = (ev) => { if (moved) { ev.preventDefault(); rotate(); } };
        const onUp = () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            window.removeEventListener('keydown', onKey);
            window.removeEventListener('contextmenu', onCtx);
            ghost.remove(); clearPreview();
            if (!moved) {
                if (existingType) { // clic = girar
                    const rotated = { ...placed[existingType], dir: placed[existingType].dir === 'h' ? 'v' : 'h' };
                    if (fits(rotated, existingType)) { placed[existingType] = rotated; BS.sfx.rotate(); } else BS.sfx.error();
                    redrawPlaced();
                }
                return;
            }
            if (target) { placed[ship.type] = target; BS.sfx.place(); }
            else if (existingType) BS.sfx.error();
            redrawPlaced();
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        window.addEventListener('keydown', onKey);
        window.addEventListener('contextmenu', onCtx);
    }

    async function submitFleet() {
        const btn = $('#btn-ready');
        btn.disabled = true;
        try {
            const st = await BS.api('POST', `/games/${CFG.id}/ships`, { ships: Object.values(placed), chat_after: chat.lastId });
            BS.sfx.sonar();
            apply(st);
        } catch (e) { BS.error(e); btn.disabled = false; }
    }

    /* ---------------- Combate ---------------- */
    function renderBattle() {
        view = 'battle';
        applied = new Set();
        stage.innerHTML = `<div class="boards">
            <section class="panel board-card" id="card-mine"><div class="board-title">🛳 Tu flota <span class="meta" id="meta-mine"></span></div></section>
            <section class="panel board-card" id="card-enemy" style="position:relative"><div class="board-title enemy">🎯 Aguas enemigas <span class="meta" id="meta-enemy"></span></div></section>
        </div>`;
        boards = { mine: createBoard('mine'), enemy: createBoard('enemy') };
        $('#card-mine').appendChild(boards.mine.frame);
        $('#card-enemy').appendChild(boards.enemy.frame);
        S.my_ships.forEach((s) => drawShip(boards.mine, s));

        boards.enemy.board.addEventListener('click', (e) => {
            const c = e.target.closest('.cell');
            if (c && c.classList.contains('can-fire')) fire(+c.dataset.x, +c.dataset.y);
        });
        syncBattle();
    }

    /** Pinta (sin animar) todo lo que falte según el estado actual. */
    function syncBattle() {
        S.moves.forEach((m) => { if (!applied.has(m.id)) paintMove(m); });
        const sunkMine = S.sunk_by_enemy || [];
        S.my_ships.forEach((s) => boards.mine.ships[s.type]?.classList.toggle('sunk', sunkMine.includes(s.type)));
        S.enemy_ships.forEach((s) => {
            const sunk = (S.sunk_by_me || []).includes(s.type);
            if (!boards.enemy.ships[s.type]) drawShip(boards.enemy, s, sunk ? 'sunk reveal' : 'enemy-left reveal');
        });
        refreshTargets();
    }

    function paintMove(m) {
        applied.add(m.id);
        const b = m.player === me() ? boards.enemy : boards.mine;
        mark(b.cells[m.y][m.x], m.result);
        b.board.querySelectorAll('.last-shot').forEach((c) => c.classList.remove('last-shot'));
        b.cells[m.y][m.x].classList.add('last-shot');
    }

    function refreshTargets() {
        if (view !== 'battle') return;
        const can = S.status === 'playing' && S.turn === me() && !busy;
        const shot = new Set(S.moves.filter((m) => m.player === me()).map((m) => m.x + ',' + m.y));
        boards.enemy.board.classList.toggle('locked', !can);
        boards.enemy.cells.flat().forEach((c) => c.classList.toggle('can-fire', can && !shot.has(c.dataset.x + ',' + c.dataset.y)));

        const card = $('#card-enemy');
        let ov = $('.waiting-overlay', card);
        const waiting = S.status === 'placing';
        if (waiting && !ov) {
            ov = document.createElement('div'); ov.className = 'waiting-overlay';
            ov.innerHTML = `<div><div class="radar" style="width:110px;height:110px"></div><b>Esperando al rival</b><span>${BS.esc(S.players[foe()].name)} está desplegando su flota…</span></div>`;
            card.appendChild(ov);
        } else if (!waiting && ov) ov.remove();

        $('#meta-mine').textContent = `${(S.sunk_by_enemy || []).length} perdidos`;
        $('#meta-enemy').textContent = `${(S.sunk_by_me || []).length}/${FLEET.length} hundidos`;
    }

    async function fire(x, y) {
        if (busy) return;
        busy = true; refreshTargets();
        BS.sfx.click();
        try {
            const st = await BS.api('POST', `/games/${CFG.id}/fire`, { x, y, chat_after: chat.lastId });
            apply(st);
        } catch (e) { BS.error(e); busy = false; refreshTargets(); }
    }

    async function animateMove(m) {
        const mineShot = m.player === me();
        const target = mineShot ? boards.enemy : boards.mine;
        const source = mineShot ? boards.mine : boards.enemy;
        const cell = target.cells[m.y][m.x];
        const [x0, y0] = center(source.board), [x1, y1] = center(cell);
        BS.sfx.launch();
        await BS.fx.shell(x0, y0, x1, y1, 620);
        paintMove(m);
        const who = mineShot ? '' : S.players[foe()].name + ' · ';
        if (m.result === 'miss') {
            BS.fx.splash(x1, y1); BS.sfx.splash();
            BS.fx.callout('AGUA', 'miss', who + COLS[m.x] + (m.y + 1));
        } else if (m.result === 'hit') {
            BS.fx.explosion(x1, y1, 1); BS.sfx.explosion(false); BS.fx.shake();
            BS.fx.callout('¡IMPACTO!', 'hit', who + COLS[m.x] + (m.y + 1));
        } else {
            BS.sfx.explosion(true); BS.fx.shake(true);
            const ship = mineShot ? S.enemy_ships.find((s) => s.type === m.ship) : S.my_ships.find((s) => s.type === m.ship);
            if (ship) {
                cellsOf(ship).forEach(([cx, cy], i) => setTimeout(() => BS.fx.explosion(...center(target.cells[cy][cx]), 0.9), i * 110));
                if (mineShot) drawShip(boards.enemy, ship, 'sunk reveal');
                else boards.mine.ships[ship.type]?.classList.add('sunk');
            } else BS.fx.explosion(x1, y1, 1.4);
            BS.fx.callout('¡HUNDIDO!', 'sunk', (mineShot ? '' : 'Perdiste tu ') + (NAME[m.ship] || ''));
        }
        await BS.sleep(m.result === 'sunk' ? 1100 : 650);
    }

    /* ---------------- Fin de partida ---------------- */
    function showFinish() {
        if (finishedShown) return;
        finishedShown = true;
        const won = S.winner === me();
        const rival = S.players[foe()].name;
        const st = S.stats[me()];
        let text;
        if (S.finish_reason === 'forfeit') text = won ? `${rival} se rindió. ¡La victoria es tuya!` : 'Te rendiste. Habrá otra oportunidad.';
        else if (S.finish_reason === 'abandon') text = won ? `${rival} abandonó la batalla.` : 'Abandonaste la batalla.';
        else text = won ? `Hundiste toda la flota de ${rival}. ¡Eres el terror de los mares!` : `${rival} hundió toda tu flota. Los peces te mandan saludos.`;

        const back = document.createElement('div');
        back.className = 'modal-back';
        back.innerHTML = `<div class="panel modal ${won ? 'victory' : 'defeat'}">
            <div class="medal">${won ? '🏆' : '☠'}</div>
            <h2>${won ? '¡VICTORIA!' : 'DERROTA'}</h2>
            <p>${BS.esc(text)}</p>
            <div class="modal-stats">
                <div><b>${st.shots}</b><span>Disparos</span></div>
                <div><b>${st.hits}</b><span>Aciertos</span></div>
                <div><b>${st.accuracy}%</b><span>Precisión</span></div>
            </div>
            <div class="actions">
                <button class="btn fire" id="btn-rematch">⚔ Revancha</button>
                <a class="btn" id="btn-accept-rematch" hidden>✅ Aceptar revancha</a>
                <button class="btn ghost" id="btn-board">Ver tableros</button>
                <a class="btn ghost" href="${BS.base}/">⚓ Puerto</a>
            </div></div>`;
        document.body.appendChild(back);
        $('#btn-board', back).onclick = () => back.remove();
        $('#btn-rematch', back).onclick = async (e) => {
            e.target.disabled = true;
            try { const r = await BS.api('POST', `/games/${CFG.id}/rematch`); location.href = r.url; } catch (err) { BS.error(err); e.target.disabled = false; }
        };
        updateRematch();

        if (won) { BS.sfx.victory(); BS.fx.confetti(); setTimeout(() => BS.fx.fireworks(), 600); }
        else { BS.sfx.defeat(); BS.fx.shake(true); }
    }
    function updateRematch() {
        const a = $('#btn-accept-rematch');
        if (!a) return;
        a.hidden = !S.rematch_url;
        if (S.rematch_url) { a.href = S.rematch_url; if (!a.dataset.alerted) { a.dataset.alerted = 1; BS.sfx.alarm(); BS.toast(`<b>${BS.esc(S.players[foe()].name)}</b> quiere la revancha ⚔`, { type: 'invite' }); } }
    }

    /* ---------------- Estado ---------------- */
    function apply(st) {
        queue = queue.then(() => process(st)).catch((e) => console.error(e));
        return queue;
    }

    async function process(st) {
        const prev = S;
        S = st;
        chat.push(st.chat);
        renderHud();

        if (st.status === 'declined') return closedView('Desafío rechazado', `${st.players[foe()].name} no aceptó la batalla esta vez.`);
        if (st.status === 'cancelled') return closedView('Desafío cancelado', 'La invitación fue cancelada.');
        if (st.status === 'invited') { if (view !== 'invited') renderInvited(); else tickCountdown(); return; }

        if (st.status === 'placing' && !st.ready[st.me]) {
            if (view !== 'placement') { renderPlacement(); if (prev && prev.status === 'invited') { BS.sfx.sonar(); BS.fx.callout('¡DESAFÍO ACEPTADO!', 'turn'); } }
            return;
        }

        if (view !== 'battle') {
            // Al cargar la página no se animan los disparos ya hechos.
            renderBattle();
            if (prev && prev.status !== 'playing' && st.status === 'playing') startBattleFx();
            lastTurn = st.turn;
            if (st.status === 'finished') showFinish();
            busy = false; refreshTargets();
            return;
        }

        if (prev && prev.status === 'placing' && st.status === 'playing') startBattleFx();

        const fresh = st.moves.filter((m) => !applied.has(m.id));
        if (fresh.length) {
            busy = true; refreshTargets();
            for (const m of fresh) {
                if (st.mode === 'cpu' && m.player !== st.me) {
                    $('#turn-banner').className = 'turn-banner theirs';
                    $('#turn-banner').innerHTML = 'TURNO RIVAL<small>La IA calcula su disparo…</small>';
                    await BS.sleep(700);
                }
                await animateMove(m);
                // Actualiza las barras de flota tras cada disparo.
                renderHud();
            }
        }
        syncBattle();
        busy = false;
        renderHud();
        refreshTargets();

        if (st.status === 'playing' && st.turn === st.me && lastTurn !== st.me && st.mode === 'pvp') {
            BS.sfx.sonar(); BS.fx.callout('¡TU TURNO!', 'turn');
        }
        lastTurn = st.turn;
        if (st.status === 'finished') { await BS.sleep(400); showFinish(); }
        updateRematch();
    }

    function startBattleFx() {
        BS.sfx.alarm();
        BS.fx.callout('¡FUEGO A DISCRECIÓN!', 'turn', S.turn === S.me ? 'Abres tú' : 'Abre ' + S.players[foe()].name);
    }

    /* ---------------- Botones laterales ---------------- */
    $('#btn-forfeit').onclick = async () => {
        if (!confirm('¿Seguro que quieres rendirte? Contará como derrota.')) return;
        try { apply(await BS.api('POST', `/games/${CFG.id}/forfeit`, { chat_after: chat.lastId })); } catch (e) { BS.error(e); }
    };
    $('#btn-claim').onclick = async () => {
        try { apply(await BS.api('POST', `/games/${CFG.id}/claim`, { chat_after: chat.lastId })); } catch (e) { BS.error(e); }
    };

    /* ---------------- Sondeo ---------------- */
    let polling = false;
    async function poll() {
        if (polling || busy) return;
        polling = true;
        try { await apply(await BS.api('GET', `/games/${CFG.id}/state?chat_after=${chat.lastId}`)); } catch (e) { /* reintenta */ }
        polling = false;
    }
    function interval() {
        if (!S) return 1200;
        if (S.status === 'finished') return S.mode === 'cpu' ? 6000 : 2500;
        return S.mode === 'cpu' ? 4000 : 1200;
    }
    (async function loop() {
        await poll();
        setTimeout(loop, interval());
    })();
})();
