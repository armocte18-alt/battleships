# ⚓ Battleships · SIOS

Batalla naval para los usuarios de **SIOS**, hecha en Laravel 13.

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

5. **Abrir** `http://localhost/battle_ships` (o con la IP del servidor desde las otras PCs de la oficina).

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
- `public/assets/js/core.js` — sonido, partículas, barcos SVG y chat · `game.js` — la partida · `lobby.js` — el puerto.

La comunicación en tiempo real se hace con consultas periódicas (cada ~1 s en partida), suficiente para la red de la
oficina y sin instalar servidores extra.
