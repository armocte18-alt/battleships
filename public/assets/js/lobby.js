/* Lobby: jugadores en línea, invitaciones, ranking y chat general. */
(function () {
    'use strict';
    const BS = window.BS;
    const $ = (s) => document.querySelector(s);

    $('#hero-ship').innerHTML = BS.shipSVG('battleship', 4);

    const chat = BS.chat($('#lobby-chat'));

    $('#cpu-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button[type=submit]');
        btn.disabled = true;
        BS.sfx.launch();
        try {
            const r = await BS.api('POST', '/games/cpu', { difficulty: new FormData(e.target).get('difficulty') });
            location.href = r.url;
        } catch (err) { BS.error(err); btn.disabled = false; }
    });

    async function challenge(id, btn) {
        btn.disabled = true;
        try {
            const r = await BS.api('POST', '/games/invite', { user_id: id });
            BS.sfx.sonar();
            location.href = r.url;
        } catch (err) { BS.error(err); btn.disabled = false; }
    }

    function renderPlayers(list) {
        $('#online-count').textContent = `${list.length + 1} en línea`;
        const box = $('#players');
        if (!list.length) {
            box.innerHTML = '<div class="empty">No hay más marineros conectados.<br>Comparte el enlace del juego con tus compañeros 😉</div>';
            return;
        }
        box.innerHTML = list.map((p) => `
            <div class="player-row">
                ${BS.avatar(p.name, initials(p.name), p.avatar)}
                <div class="name">${BS.esc(p.name)}<small class="${p.busy ? 'busy' : ''}">${p.busy ? '⚔ En batalla' : '● En el puerto'}</small></div>
                <button class="btn sm fire" data-id="${p.id}">Desafiar</button>
            </div>`).join('');
        box.querySelectorAll('button[data-id]').forEach((b) => b.addEventListener('click', () => challenge(+b.dataset.id, b)));
    }

    function initials(name) {
        return String(name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
    }

    function renderActive(list) {
        $('#active-games-wrap').hidden = !list.length;
        $('#active-games').innerHTML = list.map((g) => `
            <a class="active-game" href="${BS.esc(g.url)}">⚓ Contra ${BS.esc(g.vs)}
                <span class="turn">${g.status === 'placing' ? 'Desplegando flota' : (g.my_turn ? '¡Tu turno!' : 'Turno rival')}</span></a>`).join('');
    }

    function renderRanking(rows, mine) {
        const t = $('#ranking');
        if (!rows.length) { t.innerHTML = '<tr><td class="empty">Sin batallas registradas todavía.</td></tr>'; }
        else {
            t.innerHTML = rows.map((r, i) => `<tr class="${r.id === BS.userId ? 'me' : ''}">
                <td class="pos">${i + 1}</td><td>${BS.esc(r.name)}</td>
                <td class="wl">${r.wins}V · ${r.losses}D</td><td class="pts">${r.points}</td></tr>`).join('');
        }
        const s = mine || { wins: 0, losses: 0, points: 0 };
        $('#my-stats').innerHTML = `<div class="stat-pill"><b>${s.wins}</b> victorias</div><div class="stat-pill"><b>${s.losses}</b> derrotas</div><div class="stat-pill"><b>${s.points}</b> puntos</div>`;
    }

    let polling = false;
    async function poll() {
        if (polling) return;
        polling = true;
        try {
            const d = await BS.api('GET', `/lobby/poll?chat_after=${chat.lastId}`);
            renderPlayers(d.online);
            BS.showInvites(d.invites);
            renderActive(d.active);
            renderRanking(d.ranking, d.my_stats);
            chat.push(d.chat);
        } catch (e) { /* reintenta en el siguiente ciclo */ }
        polling = false;
    }
    poll();
    setInterval(poll, 2500);
})();
