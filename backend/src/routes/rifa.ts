import { Router } from "express";
import multer from "multer";
import { carpetaSubidas } from "../services/safSql";
import { verifyAdmin, loginAdmin, logoutAdmin, adminActual } from "../middlewares/adminAuth";
import * as sorteo from "../controllers/sorteo";
import * as premios from "../controllers/premios";
import * as participantes from "../controllers/participantes";
import * as bd from "../controllers/baseDatos";
import { listarGanadores, reporte, reporteExcel } from "../controllers/rifa";

const router = Router();
const subida = multer({ storage: multer.memoryStorage(), limits: { fileSize: 300 * 1024 * 1024 } });
// Los respaldos .sql pueden ser grandes: se guardan en disco mientras se importan
const subidaSql = multer({ dest: carpetaSubidas(), limits: { fileSize: 4 * 1024 * 1024 * 1024 } });

// --- Público: pantalla del sorteo ---
router.get("/api/sorteo/estado", sorteo.estadoPantalla)
router.get("/api/sorteo/stream", sorteo.streamPantalla)
router.get("/api/sorteo/premios", sorteo.premiosPantalla)

// --- Sesión de administrador ---
router.post("/api/admin/login", loginAdmin)
router.post("/api/admin/logout", logoutAdmin)

// --- Todo lo demás de /api/admin requiere sesión ---
const admin = Router();
admin.use(verifyAdmin);

admin.get("/me", adminActual)

admin.get("/sorteo/personas", sorteo.buscarPersonas)
admin.get("/sorteo/participante/:rfc", sorteo.buscarParticipante)
admin.get("/sorteo/pendiente", sorteo.pendienteActual)
admin.post("/sorteo/sortear", sorteo.sortear)
admin.post("/sorteo/:id/confirmar", sorteo.confirmar)
admin.post("/sorteo/:id/cancelar", sorteo.cancelar)
admin.post("/sorteo/:id/ganador", sorteo.asignarGanador)
admin.delete("/sorteo/:id/ganador", sorteo.quitarGanador)
admin.post("/sorteo/:id/mostrar", sorteo.mostrarEnPantalla)
admin.post("/pantalla/limpiar", sorteo.limpiar)

admin.get("/premios", premios.listarPremios)
admin.post("/premios", premios.crearPremio)
admin.post("/premios/recalcular", premios.recalcular)
admin.put("/premios/:id", premios.actualizarPremio)
admin.delete("/premios/:id", premios.eliminarPremio)
admin.post("/premios/:id/imagen", subida.single("imagen"), premios.subirImagenPremio)

admin.get("/participantes", participantes.listarParticipantes)
admin.post("/participantes", participantes.crearParticipante)
admin.post("/participantes/importar", subida.single("archivo"), participantes.importarParticipantes)
admin.post("/participantes/fotos", subida.array("fotos", 5000), participantes.subirFotos)
admin.delete("/participantes/fotos/:rfc", participantes.eliminarFoto)
admin.post("/participantes/saf/probar", participantes.safProbar)
admin.post("/participantes/saf/importar", participantes.safImportar)
admin.post("/participantes/saf/sql", subidaSql.single("archivo"), participantes.safSubirSql)
admin.get("/participantes/saf/sql/estado", participantes.safEstadoSql)
admin.post("/participantes/fotos/descargar", participantes.fotosDescargar)
admin.get("/participantes/fotos/descarga", participantes.fotosEstado)
admin.post("/participantes/fotos/descarga/detener", participantes.fotosDetener)
admin.put("/participantes/:id", participantes.actualizarParticipante)
admin.delete("/participantes/:id", participantes.eliminarParticipante)

admin.get("/ganadores", listarGanadores)
admin.get("/ganadores/reporte.pdf", reporte)
admin.get("/ganadores/reporte.xlsx", reporteExcel)

admin.get("/bd/resumen", bd.resumen)
admin.get("/bd/respaldos", bd.listar)
admin.post("/bd/respaldos", bd.crear)
admin.post("/bd/respaldos/subir", subida.single("archivo"), bd.subir)
admin.get("/bd/respaldos/:archivo", bd.descargar)
admin.post("/bd/respaldos/:archivo/restaurar", bd.restaurar)
admin.delete("/bd/respaldos/:archivo", bd.eliminar)
admin.post("/bd/reiniciar", bd.reiniciar)
admin.get("/config", bd.obtenerConfig)
admin.put("/config", bd.guardarConfig)

router.use("/api/admin", admin);

export default router
