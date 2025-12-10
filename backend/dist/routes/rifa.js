"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const rifa_1 = require("../controllers/rifa");
const router = (0, express_1.Router)();
router.get("/api/rifa", rifa_1.rifa);
exports.default = router;
