import { Router } from "express";
import { rifa } from "../controllers/rifa";

const router = Router();

router.get("/api/rifa/rifas", rifa)


export default router