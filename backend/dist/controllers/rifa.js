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
exports.reporte = exports.rifa = void 0;
const regalos_1 = __importDefault(require("../models/regalos"));
const rifa_1 = __importDefault(require("../models/rifa"));
const sequelize_1 = require("sequelize");
const rifa = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { Op } = require('sequelize');
    let regalo = null;
    regalo = yield regalos_1.default.findOne({
        where: {
            cantidad: {
                [Op.gt]: 0
            }
        },
        order: sequelize_1.Sequelize.literal('RAND()')
    });
    if (regalo != null) {
        yield (regalo === null || regalo === void 0 ? void 0 : regalo.update({
            cantidad: regalo.cantidad - 1
        }));
        yield rifa_1.default.create({
            id_premio: regalo === null || regalo === void 0 ? void 0 : regalo.id,
        });
    }
    const totalRegalos = yield regalos_1.default.sum('cantidad');
    return res.json({
        data: regalo,
        total: totalRegalos
    });
});
exports.rifa = rifa;
const reporte = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const reporte = yield rifa_1.default.findAll({
        include: [
            {
                model: regalos_1.default,
                as: "m_regalo",
            }
        ]
    });
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=reporte.pdf');
    doc.pipe(res);
    const horaGenerada = new Date().toLocaleString("es-MX", { hour12: false });
    doc.fontSize(18).text('Reporte de Rifa', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Hora del reporte: ${horaGenerada}`);
    doc.moveDown();
    const tableTop = 140;
    const col1 = 50; // #
    const col2 = 100; // Nombre del regalo
    const col3 = 350; // Fecha creación.
    // Encabezados
    doc.fontSize(12).font('Helvetica-Bold');
    doc.text('#', col1, tableTop);
    doc.text('Regalo', col2, tableTop);
    doc.text('Fecha', col3, tableTop);
    doc.moveTo(40, tableTop + 15)
        .lineTo(560, tableTop + 15)
        .stroke();
    // Filas
    doc.font('Helvetica');
    let y = tableTop + 25;
    reporte.forEach((item, index) => {
        var _a;
        doc.text(index + 1, col1, y);
        doc.text((_a = item.m_regalo) === null || _a === void 0 ? void 0 : _a.premio, col2, y);
        doc.text(item.createdAt, col3, y);
        y += 20; // espacio entre filas
    });
    doc.end();
});
exports.reporte = reporte;
