import { Router } from "express";
import { reporte, rifa } from "../controllers/rifa";

const router = Router();

router.get("/api/rifa/rifas", rifa)
router.get("/api/rifa/reporte", reporte)


export default router