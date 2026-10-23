/* Sala de juegos: tarjetas, jugadores en línea, desafíos y chat general. */
(function () {
    'use strict';
    const BS = window.BS;
    const $ = (s) => document.querySelector(s);

    $('#hub-ship').innerHTML = BS.shipSVG('battleship', 4);
    document.querySelectorAll('.art-ship').forEach((el) => { el.innerHTML = BS.shipSVG(el.dataset.ship, 5); });

    const chat = BS.chat($('#hub-chat'));
    const initials = (n) => String(n || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

    function renderPlayers(list) {
        $('#online-count').textContent = `${list.length + 1} en línea`;
        const box = $('#players');
        if (!list.length) { box.innerHTML = '<div class="empty">Solo estás tú por aquí.<br>¡Invita a tus compañeros! 🎮</div>'; return; }
        box.innerHTML = list.map((p) => `
            <div class="player-row">
                ${BS.avatar(p.name, initials(p.name), p.avatar)}
                <div class="name">${BS.esc(p.name)}<small class="${p.busy ? 'busy' : ''}">${p.busy ? '⚔ En batalla' : '● En la sala'}</small></div>
                <button class="btn sm fire" data-id="${p.id}" title="Retar a Battleships">⚓ Retar</button>
            </div>`).join('');
        box.querySelectorAll('button[data-id]').forEach((b) => b.addEventListener('click', async () => {
            b.disabled = true;
            try { const r = await BS.api('POST', '/games/invite', { user_id: +b.dataset.id }); BS.sfx.sonar(); location.href = r.url; }
            catch (err) { BS.error(err); b.disabled = false; }
        }));
    }

    let polling = false;
    async function poll() {
        if (polling) return;
        polling = true;
        try {
            const d = await BS.api('GET', `/lobby/poll?chat_after=${chat.lastId}`);
            renderPlayers(d.online);
            BS.showInvites(d.invites);
            chat.push(d.chat);
        } catch (e) { /* reintenta */ }
        polling = false;
    }
    poll();
    setInterval(poll, 3000);
})();
