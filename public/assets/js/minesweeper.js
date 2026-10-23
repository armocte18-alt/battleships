/* ==========================================================================
   SIOS ARCADE · BUSCAMINAS
   Primer clic siempre seguro, despeje en cascada animado, banderas,
   "acorde" sobre números, modo bandera para pantallas táctiles y récords.
   ========================================================================== */
(function () {
    'use strict';
    const BS = window.BS;
    const CFG = window.MS;
    const $ = (s) => document.querySelector(s);

    const boardEl = $('#ms-board');
    const FLAG_SVG = '<svg class="flagsvg" viewBox="0 0 24 24"><rect x="6" y="3" width="2" height="18" rx="1" fill="#e2e8f0"/><path class="cloth" d="M8 3 L19 7.5 L8 12 Z" fill="#ff5c74"/><ellipse cx="7" cy="21" rx="5" ry="1.5" fill="rgba(0,0,0,.4)"/></svg>';
    const MINE_SVG = '<svg class="minesvg" viewBox="0 0 24 24"><g stroke="#ff8a9b" stroke-width="2" stroke-linecap="round"><path d="M12 2v4M12 18v4M2 12h4M18 12h4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8"/></g><circle cx="12" cy="12" r="6.5" fill="url(#mg)"/><defs><radialGradient id="mg" cx=".35" cy=".35"><stop offset="0" stop-color="#ffd1d8"/><stop offset=".45" stop-color="#ff3355"/><stop offset="1" stop-color="#5a0012"/></radialGradient></defs></svg>';

    let level = 'easy';
    try { level = localStorage.getItem('ms-level') || 'easy'; } catch (e) { /* */ }
    if (!CFG.levels[level]) level = 'easy';
    let tab = level;

    let R, C, M, cells, els, started, over, opened, flags, t0, tick, flagMode = false, pressTimer = null, suppressClick = false;

    /* ---------------- Sonidos ---------------- */
    const tone = (...a) => BS.sfx.tone(...a);
    const snd = {
        dig() { tone(420 + Math.random() * 120, 0.06, { type: 'triangle', vol: 0.08, slide: 260 }); },
        cascade(n) { const k = Math.min(8, 2 + Math.floor(n / 8)); for (let i = 0; i < k; i++) tone(440 * 2 ** (i / 5), 0.12, { type: 'sine', vol: 0.06, delay: i * 0.045 }); },
        flag() { tone(700, 0.08, { type: 'square', vol: 0.05, slide: 1300 }); },
        unflag() { tone(900, 0.08, { type: 'square', vol: 0.04, slide: 400 }); },
        nope() { tone(160, 0.12, { type: 'square', vol: 0.05 }); },
    };

    /* ---------------- Utilidades ---------------- */
    const idx = (r, c) => r * C + c;
    function neighbours(i) {
        const r = Math.floor(i / C), c = i % C, out = [];
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
            if (!dr && !dc) continue;
            const nr = r + dr, nc = c + dc;
            if (nr >= 0 && nc >= 0 && nr < R && nc < C) out.push(idx(nr, nc));
        }
        return out;
    }
    const fmt = (ms) => (ms / 1000).toFixed(1);

    /* ---------------- Partida ---------------- */
    function newGame() {
        const L = CFG.levels[level];
        // En pantallas angostas el tablero Experto se gira para que quepa.
        const narrow = window.innerWidth < 760 && L.cols > L.rows;
        R = narrow ? L.cols : L.rows; C = narrow ? L.rows : L.cols; M = L.mines;
        cells = Array.from({ length: R * C }, () => ({ mine: false, n: 0, open: false, flag: false }));
        started = false; over = false; opened = 0; flags = 0;
        clearInterval(tick); t0 = 0;
        $('#ms-time').textContent = '0.0';
        face('🙂');
        boardEl.className = 'ms-board';
        boardEl.style.gridTemplateColumns = `repeat(${C}, var(--ms-c))`;
        boardEl.innerHTML = '';
        els = cells.map((_, i) => {
            const d = document.createElement('div');
            d.className = 'ms-cell'; d.dataset.i = i;
            boardEl.appendChild(d);
            return d;
        });
        document.querySelectorAll('#ms-levels button').forEach((b) => b.classList.toggle('on', b.dataset.level === level));
        updateMines();
        fit();
        document.querySelector('.modal-back')?.remove();
    }

    function placeMines(safe) {
        const banned = new Set([safe, ...neighbours(safe)]);
        const pool = [];
        for (let i = 0; i < R * C; i++) if (!banned.has(i)) pool.push(i);
        for (let k = 0; k < M; k++) {
            const j = k + Math.floor(Math.random() * (pool.length - k));
            [pool[k], pool[j]] = [pool[j], pool[k]];
            cells[pool[k]].mine = true;
        }
        cells.forEach((cell, i) => { cell.n = neighbours(i).filter((j) => cells[j].mine).length; });
    }

    function start() {
        started = true; t0 = performance.now();
        tick = setInterval(() => { $('#ms-time').textContent = fmt(performance.now() - t0); }, 100);
    }

    function face(e) { $('#ms-face').textContent = e; }
    function updateMines() { $('#ms-mines').textContent = String(M - flags).padStart(3, '0'); }

    function paint(i) {
        const cell = cells[i], el = els[i];
        el.className = 'ms-cell';
        el.innerHTML = '';
        if (cell.open) {
            el.classList.add('open');
            if (cell.n) { el.classList.add('n', 'n' + cell.n); el.textContent = cell.n; }
        } else if (cell.flag) {
            el.classList.add('flag'); el.innerHTML = FLAG_SVG;
        }
    }

    /** Abre la casilla y, si es 0, su zona en cascada (animada por distancia). */
    function reveal(i) {
        if (over || cells[i].open || cells[i].flag) return;
        if (!started) { placeMines(i); start(); }
        if (cells[i].mine) return lose(i);

        const queue = [[i, 0]], seen = new Set([i]), order = [];
        while (queue.length) {
            const [j, d] = queue.shift();
            const cell = cells[j];
            if (cell.open || cell.flag) continue;
            cell.open = true; opened++;
            order.push([j, d]);
            if (cell.n === 0) neighbours(j).forEach((k) => { if (!seen.has(k) && !cells[k].mine) { seen.add(k); queue.push([k, d + 1]); } });
        }
        order.forEach(([j, d]) => (d === 0 ? paint(j) : setTimeout(() => paint(j), Math.min(d * 22, 700))));
        order.length > 3 ? snd.cascade(order.length) : snd.dig();
        if (opened === R * C - M) win();
    }

    /** Clic en un número con todas sus banderas: abre el resto de vecinos. */
    function chord(i) {
        const cell = cells[i];
        if (!cell.open || !cell.n || over) return;
        const around = neighbours(i);
        const flagged = around.filter((j) => cells[j].flag).length;
        if (flagged !== cell.n) {
            snd.nope();
            around.filter((j) => !cells[j].open && !cells[j].flag).forEach((j) => { els[j].classList.add('hint-hl'); setTimeout(() => els[j].classList.remove('hint-hl'), 220); });
            return;
        }
        const mine = around.find((j) => !cells[j].open && !cells[j].flag && cells[j].mine);
        if (mine !== undefined) return lose(mine);
        around.forEach((j) => reveal(j));
    }

    function toggleFlag(i) {
        const cell = cells[i];
        if (over || cell.open) return;
        cell.flag = !cell.flag;
        flags += cell.flag ? 1 : -1;
        cell.flag ? snd.flag() : snd.unflag();
        paint(i); updateMines();
    }

    function center(el) {
        const r = el.getBoundingClientRect();
        return [r.left + r.width / 2, r.top + r.height / 2];
    }

    function lose(i) {
        over = true; clearInterval(tick);
        face('💀');
        const elapsed = performance.now() - t0;
        cells[i].open = true;
        els[i].className = 'ms-cell mine boom'; els[i].innerHTML = MINE_SVG;
        BS.sfx.explosion(true);
        BS.fx.explosion(...center(els[i]), 1.3);
        boardEl.classList.add('lost');

        // Detona el resto de minas en orden de cercanía.
        const r0 = Math.floor(i / C), c0 = i % C;
        const mines = cells.map((c, j) => j).filter((j) => cells[j].mine && j !== i && !cells[j].flag)
            .sort((a, b) => Math.hypot(Math.floor(a / C) - r0, a % C - c0) - Math.hypot(Math.floor(b / C) - r0, b % C - c0));
        const step = Math.max(18, Math.min(70, 1400 / Math.max(1, mines.length)));
        mines.forEach((j, k) => setTimeout(() => {
            els[j].className = 'ms-cell mine'; els[j].innerHTML = MINE_SVG;
            if (k < 10) { BS.fx.explosion(...center(els[j]), 0.45); if (k % 3 === 0) BS.sfx.explosion(false); }
        }, 250 + k * step));
        cells.forEach((c, j) => { if (c.flag && !c.mine) els[j].classList.add('wrong'); });

        setTimeout(() => modal(false, elapsed), 600 + mines.length * step);
    }

    async function win() {
        over = true; clearInterval(tick);
        const ms = Math.round(performance.now() - t0);
        $('#ms-time').textContent = fmt(ms);
        face('😎');
        cells.forEach((c, j) => { if (c.mine && !c.flag) { c.flag = true; paint(j); els[j].classList.add('safe-flag'); } });
        flags = M; updateMines();
        boardEl.classList.add('won');
        BS.sfx.victory(); BS.fx.confetti();

        const m = modal(true, ms);
        try {
            const r = await BS.api('POST', '/buscaminas/scores', { difficulty: level, time_ms: ms });
            CFG.leaderboards[level] = r.leaderboard; CFG.best[level] = r.best;
            tab = level; renderRanking();
            const p = m.querySelector('#ms-result');
            if (p) p.innerHTML = (r.new_best ? '<span class="new-best">★ ¡NUEVO RÉCORD PERSONAL! ★</span><br>' : `Tu mejor tiempo: <b>${fmt(r.best)} s</b><br>`)
                + `Lugar <b>#${r.rank}</b> en ${BS.esc(CFG.levels[level].name)}.`;
            if (r.new_best && r.rank === 1) BS.fx.fireworks();
        } catch (e) {
            const p = m.querySelector('#ms-result');
            if (p) p.textContent = 'No se pudo guardar el tiempo: ' + e.message;
        }
    }

    function modal(won, ms) {
        const back = document.createElement('div');
        back.className = 'modal-back';
        const L = CFG.levels[level];
        const progress = Math.round((opened / (R * C - M)) * 100);
        back.innerHTML = `<div class="panel modal ${won ? 'victory' : 'defeat'}">
            <div class="medal">${won ? '🏆' : '💥'}</div>
            <h2>${won ? '¡CAMPO LIMPIO!' : '¡BOOM!'}</h2>
            <p id="ms-result">${won ? 'Guardando tu tiempo…' : 'Pisaste una mina. ¡La próxima será!'}</p>
            <div class="modal-stats">
                <div><b>${fmt(ms)}</b><span>Segundos</span></div>
                <div><b>${won ? 100 : progress}%</b><span>Despejado</span></div>
                <div><b>${M}</b><span>Minas · ${BS.esc(L.name)}</span></div>
            </div>
            <div class="actions">
                <button class="btn" id="ms-again" style="--c1:#8b5cf6;--c2:#5b3fd6">↻ Otra partida</button>
                <button class="btn ghost" id="ms-look">Ver tablero</button>
                <a class="btn ghost" href="${BS.base}/">🎮 Sala de juegos</a>
            </div></div>`;
        document.body.appendChild(back);
        back.querySelector('#ms-again').onclick = newGame;
        back.querySelector('#ms-look').onclick = () => back.remove();
        if (!won) BS.sfx.defeat();
        return back;
    }

    /* ---------------- Tamaño de casilla ---------------- */
    function fit() {
        const avail = $('.ms-stage').clientWidth - (window.innerWidth < 760 ? 18 : 30);
        const gap = window.innerWidth < 760 ? 2 : 3;
        const byW = Math.floor((avail - (C - 1) * gap) / C);
        const byH = Math.floor((window.innerHeight - 290 - (R - 1) * gap) / R);
        const size = Math.max(16, Math.min(42, byW, Math.max(26, byH)));
        document.documentElement.style.setProperty('--ms-c', size + 'px');
    }
    window.addEventListener('resize', fit);

    /* ---------------- Ranking ---------------- */
    function renderRanking() {
        document.querySelectorAll('#ms-tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
        const rows = CFG.leaderboards[tab] || [];
        const best = CFG.best[tab];
        $('#ms-mybest').innerHTML = best ? `Tu mejor tiempo: <b>${fmt(best)} s</b>` : 'Aún no tienes tiempo en este nivel.';
        $('#ms-ranking').innerHTML = rows.length
            ? rows.map((r, i) => `<tr class="${r.user_id === BS.userId ? 'me' : ''}"><td class="pos">${i + 1}</td>
                <td>${BS.esc(r.name)}<br><small style="color:var(--muted)">${BS.esc(r.date || '')}</small></td>
                <td class="pts">${fmt(r.time_ms)} s</td></tr>`).join('')
            : '<tr><td class="empty">Nadie ha ganado en este nivel. ¡Estrénalo!</td></tr>';
    }

    /* ---------------- Controles ---------------- */
    const cellOf = (e) => e.target.closest('.ms-cell');
    boardEl.addEventListener('click', (e) => {
        const el = cellOf(e);
        if (!el || suppressClick) { suppressClick = false; return; }
        const i = +el.dataset.i;
        if (cells[i].open) return chord(i);
        flagMode ? toggleFlag(i) : reveal(i);
    });
    boardEl.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const el = cellOf(e);
        if (!el) return;
        const i = +el.dataset.i;
        cells[i].open ? chord(i) : toggleFlag(i);
    });
    // Mantener presionado (táctil) = bandera.
    boardEl.addEventListener('pointerdown', (e) => {
        const el = cellOf(e);
        if (!el || over) return;
        if (e.button === 0 && !cells[+el.dataset.i].open) face('😮');
        if (e.pointerType !== 'mouse') {
            clearTimeout(pressTimer);
            pressTimer = setTimeout(() => {
                suppressClick = true;
                const i = +el.dataset.i;
                if (!cells[i].open) { toggleFlag(i); navigator.vibrate && navigator.vibrate(30); }
            }, 380);
        }
    });
    const release = () => { clearTimeout(pressTimer); if (!over) face('🙂'); };
    window.addEventListener('pointerup', release);
    boardEl.addEventListener('pointerleave', () => clearTimeout(pressTimer));
    boardEl.addEventListener('pointermove', (e) => { if (e.pointerType !== 'mouse' && Math.abs(e.movementX) + Math.abs(e.movementY) > 6) clearTimeout(pressTimer); });

    $('#ms-face').addEventListener('click', () => { BS.sfx.click(); newGame(); });
    $('#ms-mode').addEventListener('click', () => {
        flagMode = !flagMode;
        $('#ms-mode').classList.toggle('flag', flagMode);
        $('#ms-mode').textContent = flagMode ? '🚩 Marcar' : '⛏ Excavar';
        BS.sfx.click();
    });
    document.querySelectorAll('#ms-levels button').forEach((b) => b.addEventListener('click', () => {
        level = b.dataset.level; tab = level;
        try { localStorage.setItem('ms-level', level); } catch (e) { /* */ }
        BS.sfx.click(); newGame(); renderRanking();
    }));
    document.querySelectorAll('#ms-tabs button').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab; renderRanking(); }));
    window.addEventListener('keydown', (e) => {
        if (e.target.closest && e.target.closest('input, textarea')) return;
        if (e.key === 'r' || e.key === 'R' || e.key === 'F2') { e.preventDefault(); newGame(); }
        if (e.key === 'f' || e.key === 'F') $('#ms-mode').click();
    });

    newGame();
    renderRanking();
})();
