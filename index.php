<?php

/*
 * Permite abrir el juego directamente en http://servidor/battle_ships/
 * (sin escribir /public) cuando la carpeta vive dentro de C:\Servidor\www.
 * El archivo .htaccess de esta carpeta envía todas las peticiones aquí.
 */
require __DIR__.'/public/index.php';
