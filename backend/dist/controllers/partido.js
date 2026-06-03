"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetSorteo = exports.realizarSorteo = exports.getParticipantes = exports.getGanadores = void 0;
const participantePartido_1 = __importDefault(require("../models/participantePartido"));
const sequelize_1 = require("sequelize");
const getGanadores = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const ganadores = yield participantePartido_1.default.findAll({
            where: { ganador: true },
            order: [['updatedAt', 'ASC']],
        });
        return res.json({ data: ganadores, total: ganadores.length });
    }
    catch (error) {
        return res.status(500).json({ message: 'Error al obtener ganadores', error });
    }
});
exports.getGanadores = getGanadores;
const getParticipantes = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const participantes = yield participantePartido_1.default.findAll({
            order: [['folio', 'ASC']],
        });
        return res.json({ data: participantes, total: participantes.length });
    }
    catch (error) {
        return res.status(500).json({ message: 'Error al obtener participantes', error });
    }
});
exports.getParticipantes = getParticipantes;
const realizarSorteo = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const yaGanadores = yield participantePartido_1.default.count({ where: { ganador: true } });
        if (yaGanadores >= 10) {
            return res.status(400).json({ message: 'Ya se seleccionaron los 10 boletos ganadores.' });
        }
        const seleccionado = yield participantePartido_1.default.findOne({
            where: { ganador: false },
            order: sequelize_1.Sequelize.literal('RAND()'),
        });
        if (!seleccionado) {
            return res.status(400).json({ message: 'No hay participantes disponibles.' });
        }
        yield seleccionado.update({ ganador: true });
        return res.json({ data: seleccionado, totalGanadores: yaGanadores + 1 });
    }
    catch (error) {
        return res.status(500).json({ message: 'Error al realizar el sorteo', error });
    }
});
exports.realizarSorteo = realizarSorteo;
const resetSorteo = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield participantePartido_1.default.update({ ganador: false }, { where: { ganador: true } });
        return res.json({ message: 'Sorteo reiniciado correctamente' });
    }
    catch (error) {
        return res.status(500).json({ message: 'Error al reiniciar el sorteo', error });
    }
});
exports.resetSorteo = resetSorteo;
