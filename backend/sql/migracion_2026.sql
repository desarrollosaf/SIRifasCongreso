-- =====================================================================
--  Migración del sorteo navideño 2026 (BD congresoedomex_rifas)
--  Agrega lo necesario para: ganador con RFC, estatus pendiente/entregado/
--  cancelado, stock inicial, participantes y configuración.
--
--  NO borra datos. Los registros existentes de "rifa" quedan como "entregado".
--  Nota: el backend hace estos mismos cambios solo al arrancar (database/setup.ts);
--  este script es por si prefieres aplicarlos a mano antes de desplegar.
--  Haz un respaldo de la BD antes de ejecutarlo. Ejecútalo UNA sola vez
--  (si una columna ya existe, MySQL marcará error en ese ALTER).
-- =====================================================================

ALTER TABLE premios
  ADD COLUMN stock_inicial INT NULL AFTER cantidad,
  ADD COLUMN activo TINYINT(1) NOT NULL DEFAULT 1 AFTER path;

ALTER TABLE rifa
  ADD COLUMN rfc VARCHAR(20) NULL AFTER id_premio,
  ADD COLUMN nombre VARCHAR(255) NULL AFTER rfc,
  ADD COLUMN area VARCHAR(255) NULL AFTER nombre,
  ADD COLUMN estatus ENUM('pendiente','entregado','cancelado') NOT NULL DEFAULT 'entregado' AFTER area,
  ADD COLUMN confirmadoAt DATETIME NULL AFTER estatus;

-- Stock inicial = lo que queda + lo ya sorteado
UPDATE premios p
   SET p.stock_inicial = COALESCE(p.cantidad, 0) +
       (SELECT COUNT(*) FROM rifa r WHERE r.id_premio = p.id AND r.estatus <> 'cancelado')
 WHERE p.stock_inicial IS NULL;

CREATE TABLE IF NOT EXISTS participantes (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  rfc VARCHAR(20) NOT NULL UNIQUE,
  nombre VARCHAR(255) NULL,
  area VARCHAR(255) NULL,
  createdAt DATETIME NOT NULL,
  updatedAt DATETIME NULL
);

CREATE TABLE IF NOT EXISTS config (
  clave VARCHAR(64) NOT NULL PRIMARY KEY,
  valor TEXT NULL
);

-- Las imágenes de los premios se llaman 1.jpg, 2.jpg... (no 01.jpg)
UPDATE premios SET path = CONCAT('images/navidad/regalos/', id, '.jpg')
 WHERE path REGEXP '^images/navidad/regalos/0[0-9]+\\.jpg$';
