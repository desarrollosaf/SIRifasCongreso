import { Router } from 'express';
import { getGanadores, getParticipantes, realizarSorteo, resetSorteo, removerGanador, reportePDF } from '../controllers/partido';

const router = Router();

router.get('/api/partido/ganadores', getGanadores);
router.get('/api/partido/participantes', getParticipantes);
router.post('/api/partido/sorteo', realizarSorteo);
router.post('/api/partido/reset', resetSorteo);
router.post('/api/partido/remover/:id', removerGanador);
router.get('/api/partido/reporte', reportePDF);

export default router;
