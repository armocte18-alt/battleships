# 🎮 SIOS Arcade · Sala de juegos

Sala de juegos para los usuarios de **SIOS**, hecha en Laravel 13. Al entrar, cada usuario elige el juego:

| Juego | Modo | Ruta |
|---|---|---|
| ⚓ **Battleships** | 1 o 2 jugadores (contra la CPU o contra un compañero), con chat | `/battleships` |
| 🟡 **Pac-Man** | 1 jugador, salón de la fama con los mejores puntajes | `/pacman` |
| 💣 **Buscaminas** | 1 jugador, 3 dificultades con récords de tiempo | `/buscaminas` |
| ☄️ **Asteroides** | 1 a 3 jugadores en equipo (cada quien en su PC) | `/asteroides` |
| 🏓 **Ping Pong** | contra la CPU (3 dificultades) o contra un compañero, cada quien en su PC | `/pingpong` |
| 🐍 **Serpiente** | 1 jugador, modos Clásico y Sin bordes | `/serpiente` |

La sala (`/`) muestra las tarjetas de los juegos con tus estadísticas, los jugadores en línea (a los que puedes retar
a Battleships con un clic) y un chat general. Los desafíos de Battleships te llegan estés donde estés.

**Agregar un juego nuevo:** se registra en `config/arcade.php` (nombre, descripción, color, ruta). Con
`'enabled' => false` aparece como *Próximamente*.

## 🟡 Pac-Man

- Laberinto clásico de 28×31 con paredes de neón (cambian de color en cada nivel) y efecto de pantalla CRT.
- Los 4 fantasmas con su personalidad: Rojo persigue, Rosa embosca, Cian trabaja en equipo con Rojo y Naranja se acerca y huye.
  Alternan entre dispersión y persecución, se vuelven azules con las píldoras de poder y regresan a casa como ojos.
- Frutas (🍒 100 → 🔑 5000), combos de fantasmas (200 → 1600), vida extra a los 10,000 puntos y niveles cada vez más rápidos.
- Controles: flechas o WASD, <kbd>P</kbd> para pausar; en celular, deslizar el dedo o la cruceta en pantalla.
- Al terminar se guarda el puntaje y se muestra tu lugar en el salón de la fama (el servidor rechaza puntajes imposibles).

## ☄️ Asteroides (1 a 3 jugadores)

- Gráficos vectoriales de neón: naves de colores por jugador, asteroides con cráteres, platillo volador, estelas y explosiones.
- **Solo** o en **sala cooperativa**: un jugador crea la sala (se avisa en el chat general), hasta dos compañeros se unen
  desde la lista de salas abiertas y el anfitrión pulsa *¡Despegar!*. Todos combaten juntos; cada quien suma su puntaje.
- Controles: ← → girar, ↑ impulso, Espacio disparar (mantener = ráfaga), ↓/H hiperespacio. En pantallas táctiles hay botones.
- Cada jugador tiene 3 vidas (+1 cada 10,000 puntos); la partida termina cuando el escuadrón completo se queda sin vidas.
- **Cómo funciona en red:** el navegador del anfitrión simula el mundo y cada piloto controla su nave en su propia PC
  (sin retraso al mover o disparar). Los navegadores intercambian su estado ~10 veces por segundo a través de
  `/asteroides/salas/{id}/sync`, que solo lo retransmite usando la caché de Laravel (no requiere websockets).
  Con 3 jugadores son ~30 peticiones por segundo muy ligeras; Apache las atiende sin problema en la red de la oficina.

## 🏓 Ping Pong

- Mesa de neón con paletas brillantes, estela de la pelota que cambia de color con la velocidad, chispas y sacudida en cada punto.
- **Contra la CPU** en Fácil, Normal o Difícil, o **contra un compañero**: uno abre una mesa (se avisa en el chat
  general), el otro se une desde la lista y el anfitrión pulsa *¡A jugar!*. Gana quien llegue primero a 7 puntos.
- Se juega con el mouse (o arrastrando el dedo) o con W/S y flechas. Pegar con la orilla da más ángulo y mover la
  paleta al golpear le da efecto; la pelota acelera en cada golpe.
- **En línea:** la pelota la decide la PC del jugador hacia quien va (golpe o punto), así cada quien juega con su
  paleta real sin retraso; los navegadores se sincronizan ~20 veces por segundo por las mismas salas que Asteroides.
- Ranking por victorias: CPU fácil 1 punto, normal 2, difícil 3 y contra un compañero 4. Una partida en línea solo
  cuenta si ambos estaban en la misma mesa, y una sola vez.

## 🐍 Serpiente

- Movimiento fluido (interpolado), cuerpo de neón con degradado, ojos y lengua, partículas al comer.
- Modos **Clásico** (los bordes son muros) y **Sin bordes** (atraviesas de un lado al otro); récords separados por modo.
- Power-ups: ⭐ estrella (+50), ×2 puntos dobles, ❄ cámara lenta; aparecen rocas conforme creces y la velocidad aumenta.

## 💣 Buscaminas

- Estilo moderno: casillas de cristal con relieve, números de neón, banderas que ondean y minas que brillan.
- Tres niveles: Principiante (9×9, 10 minas), Intermedio (16×16, 40) y Experto (30×16, 99; en celular se gira a lo alto).
- El primer clic nunca es mina y siempre abre una zona; el despeje en cascada se anima desde donde hiciste clic.
- Clic derecho o mantener presionado = bandera; clic sobre un número con sus banderas completas despeja alrededor;
  botón ⛏/🚩 para alternar en pantallas táctiles; <kbd>R</kbd> reinicia.
- Al perder, las minas detonan en cadena; al ganar, se guarda tu tiempo y ves tu lugar por dificultad.

## ⚓ Battleships

- 🔐 Inicio de sesión con el **usuario (o correo) y contraseña de SIOS** — no hay que crear cuentas.
- 🤖 **Contra la CPU** con 3 dificultades: *Recluta*, *Capitán* y *Almirante* (este último calcula probabilidades).
- 👥 **Jugador contra jugador**: desafía a cualquier compañero conectado; acepta o rechaza desde una notificación.
- 💬 **Chat** general del puerto (todos los conectados) y chat privado en cada partida (la IA también presume 😎).
- 🎨 Gráficos animados: océano en movimiento, barcos dibujados en SVG, proyectiles en arco, explosiones,
  salpicaduras, fuego y humo, sacudida de pantalla, radar, confeti y fuegos artificiales al ganar.
- 🔊 Efectos de sonido sintetizados en el navegador (sin archivos de audio), con botón para silenciar.
- 🏆 Ranking de almirantes, estadísticas de precisión, revancha, rendición y "reclamar victoria" si el rival se desconecta.

El servidor es la autoridad del juego: valida la flota y cada disparo, y nunca envía al navegador
la posición de los barcos enemigos que siguen a flote (no se puede hacer trampa con F12).

---

## Requisitos

- PHP **8.3+** con extensiones `pdo_mysql`, `mbstring`, `openssl`, `fileinfo`, `ctype`, `tokenizer`, `xml`
  (las mismas que ya usa SIOS).
- Composer.
- MySQL / MariaDB (el mismo servidor donde vive la base de datos de SIOS).
- Apache con `mod_rewrite` (WAMP, Laragon o XAMPP).

No necesita Node, npm, Vite, websockets ni colas: todo el CSS/JS ya está listo en `public/assets`.

## Instalación en `C:\Servidor\www\battle_ships`

1. **Descargar el código**

   ```bat
   cd C:\Servidor\www
   git clone https://github.com/armocte18-alt/battleships.git battle_ships
   cd battle_ships
   composer install --no-dev --optimize-autoloader
   ```

2. **Crear la base de datos del juego** (partidas, chat y presencia; los usuarios se leen de SIOS):

   ```sql
   CREATE DATABASE battle_ships CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```

3. **Configurar** — copia `.env.example` a `.env` y ajusta:

   ```bat
   copy .env.example .env
   php artisan key:generate
   ```

   | Variable | Qué es |
   |---|---|
   | `APP_URL` | URL con la que se abre el juego, p. ej. `http://localhost/battle_ships` o `http://IP-DEL-SERVIDOR/battle_ships` |
   | `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD` | Base de datos **del juego** (`battle_ships`) |
   | `SIOS_DB_DATABASE` | Nombre de la base de datos de SIOS (`sios_app_web`). Host, usuario y contraseña se toman de `DB_*` salvo que definas `SIOS_DB_HOST`, `SIOS_DB_USERNAME`, `SIOS_DB_PASSWORD` |
   | `SIOS_URL` | (Opcional) URL de SIOS para mostrar los avatares, p. ej. `http://localhost/sios_app_web/public` |
   | `BATTLESHIPS_ALLOWED_ROLES` | (Opcional) roles de SIOS que pueden jugar, separados por comas. Vacío = todos los usuarios |

   > Recomendado: crear en MySQL un usuario con permiso **solo de lectura** sobre `sios_app_web.users`
   > (y `roles`/`model_has_roles` si usas `BATTLESHIPS_ALLOWED_ROLES`) y ponerlo en `SIOS_DB_USERNAME` / `SIOS_DB_PASSWORD`.
   > El juego nunca escribe en la base de SIOS (ni siquiera re-encripta contraseñas al iniciar sesión).

4. **Crear las tablas y optimizar**

   ```bat
   php artisan migrate --force
   php artisan config:cache
   php artisan route:cache
   php artisan view:cache
   ```

5. **Abrir** `http://localhost/battle_ships` (abre la Sala de juegos) (o con la IP del servidor desde las otras PCs de la oficina).

   El `.htaccess` de la raíz manda todo a `public/`, así que no hace falta escribir `/public`
   (y bloquea el acceso a `.env`, `vendor`, `storage`, etc.).
   Si Apache no tiene `mod_rewrite`, usa `http://localhost/battle_ships/public` y pon esa misma URL en `APP_URL`.

> Después de cambiar algo en `.env` vuelve a ejecutar `php artisan config:cache`.

### Permisos de escritura

Apache debe poder escribir en `storage\` y `bootstrap\cache\` (sesiones, caché y logs).

## Cómo se juega

1. Entra con tu usuario de SIOS.
2. En el **puerto** (lobby) elige *Contra la CPU* (con dificultad) o pulsa **Desafiar** junto a un compañero conectado.
3. **Despliega tu flota** arrastrando los barcos al mapa (clic para girar, <kbd>R</kbd> o clic derecho mientras arrastras),
   o usa **🎲 Aleatorio**.
4. Por turnos, haz clic en una casilla de *Aguas enemigas* para disparar: 💦 agua, 💥 impacto, ☠ hundido.
5. Gana quien hunda primero los 5 barcos del rival: Portaaviones (5), Acorazado (4), Crucero (3), Submarino (3) y Destructor (2).

**Puntos del ranking:** victoria contra un compañero = 3 · contra la CPU = 1 (Recluta), 2 (Capitán), 3 (Almirante).

## 🔒 Seguridad (revisar antes de publicar en la oficina)

Lo que ya trae el sitio:

- **Credenciales de SIOS de solo lectura:** el juego nunca escribe en la base de SIOS (ni re-encripta contraseñas).
- **Inicio de sesión protegido:** máx. 5 intentos por usuario+IP y 20 por IP cada 5 minutos; la sesión se regenera al entrar.
  Si se usa `BATTLESHIPS_ALLOWED_ROLES`, el permiso se vuelve a verificar cada 10 minutos.
- **CSRF** en todos los formularios y peticiones; cookies `HttpOnly` y `SameSite=Lax`.
- **Content-Security-Policy** estricta (solo scripts propios con *nonce*, sin manejadores en línea), `X-Frame-Options`,
  `nosniff`, `Referrer-Policy` y `Permissions-Policy`.
- **XSS:** todo texto de usuarios (nombres, chat) se escapa; los datos que llegan de otros jugadores en Asteroides se
  convierten a números antes de usarse.
- **Permisos:** cada partida/sala valida que participes; solo el anfitrión inicia o cierra una sala de Asteroides;
  solo se puede retar a jugadores conectados.
- **Límites de uso** por usuario (navegación, chat, desafíos, creación de salas, envío de puntajes).
- **Puntajes:** el servidor rechaza puntajes imposibles. Como los juegos de un jugador corren en el navegador, un usuario
  con conocimientos técnicos podría enviar un puntaje inventado pero creíble; para un juego interno es aceptable.

Lista de verificación al instalar:

1. En `.env`: `APP_ENV=production`, `APP_DEBUG=false` y `APP_KEY` generado (`php artisan key:generate`).
2. Para leer SIOS, usa un usuario de MySQL **solo con `SELECT`** sobre `sios_app_web.users` (y `roles`,
   `model_has_roles` si usas roles):
   ```sql
   CREATE USER 'arcade_ro'@'localhost' IDENTIFIED BY 'una-contraseña-larga';
   GRANT SELECT ON sios_app_web.users TO 'arcade_ro'@'localhost';
   GRANT SELECT ON sios_app_web.roles TO 'arcade_ro'@'localhost';
   GRANT SELECT ON sios_app_web.model_has_roles TO 'arcade_ro'@'localhost';
   ```
   y ponlo en `SIOS_DB_USERNAME` / `SIOS_DB_PASSWORD`. Para la base `battle_ships` usa otro usuario (no `root`).
3. **Lo más seguro:** que Apache sirva solo la carpeta `public`. En `httpd.conf` (o `httpd-vhosts.conf`) de WAMP:
   ```apache
   Alias /battle_ships "C:/Servidor/www/battle_ships/public"
   <Directory "C:/Servidor/www/battle_ships/public">
       AllowOverride All
       Require all granted
   </Directory>
   ```
   Si no puedes editar Apache, el `.htaccess` de la raíz ya bloquea los archivos internos, **siempre que** Apache
   tenga `mod_rewrite` y `AllowOverride All` para `C:\Servidor\www`.
4. **Comprueba** desde otra PC que estas direcciones respondan *403* o *404* (nunca el contenido):
   `http://SERVIDOR/battle_ships/.env`, `/battle_ships/composer.json`, `/battle_ships/storage/logs/laravel.log`,
   `/battle_ships/vendor/autoload.php`.
5. Opcional en Apache: `ServerTokens Prod` y `ServerSignature Off` para no anunciar la versión del servidor.
6. Si el sitio se publica con HTTPS, agrega `SESSION_SECURE_COOKIE=true` al `.env`.

## Desarrollo

```bash
php artisan test   # pruebas (usan SQLite en memoria, también para la tabla users de SIOS)
php artisan serve  # servidor local
```

Estructura principal:

- `app/Services/GameEngine.php` — reglas de la partida (despliegue, disparos, turnos, fin).
- `app/Services/CpuPlayer.php` — IA de la CPU (aleatoria, caza y blanco, mapa de probabilidad).
- `app/Services/Fleet.php` — flota, validación y colocación aleatoria.
- `app/Models/SiosUser.php` — usuarios de SIOS (conexión `sios`, solo lectura).
- `config/arcade.php` — catálogo de juegos de la sala y reglas de puntajes.
- `app/Http/Controllers/AsteroidsController.php` — salas y relevo en tiempo real de Asteroides · `ArcadeScoreController.php` — puntajes de Asteroides y Serpiente.
- `app/Http/Controllers/HubController.php` / `PacmanController.php` — sala de juegos y puntajes de Pac-Man.
- `public/assets/js/core.js` — sonido, partículas, barcos SVG, chat y desafíos · `hub.js` — la sala · `pacman.js` — Pac-Man · `minesweeper.js` — Buscaminas · `asteroids.js` — Asteroides · `snake.js` — Serpiente · `pong.js` — Ping Pong · `game.js` — partida de Battleships · `lobby.js` — el puerto.

La comunicación en tiempo real se hace con consultas periódicas (cada ~1 s en partida), suficiente para la red de la
oficina y sin instalar servidores extra.
