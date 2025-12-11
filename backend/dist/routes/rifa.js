"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const rifa_1 = require("../controllers/rifa");
const router = (0, express_1.Router)();
router.get("/api/rifa/rifas", rifa_1.rifa);
router.get("/api/rifa/reporte", rifa_1.reporte);
exports.default = router;
