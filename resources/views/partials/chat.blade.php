<div class="chat" id="{{ $id }}">
    <div class="chat-log">
        <div class="empty">{{ $empty ?? 'Aún no hay mensajes. ¡Rompe el hielo, marinero!' }}</div>
    </div>
    <div class="chat-emojis">
        @foreach (['😀', '😂', '👍', '💥', '🔥', '🎯', '😱', '🏴‍☠️', '⚓', '🫡'] as $emoji)
            <button type="button">{{ $emoji }}</button>
        @endforeach
    </div>
    <form class="chat-form" autocomplete="off">
        <input class="input" maxlength="500" placeholder="{{ $placeholder ?? 'Escribe un mensaje…' }}">
        <button class="btn sm" type="submit" title="Enviar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
        </button>
    </form>
</div>
