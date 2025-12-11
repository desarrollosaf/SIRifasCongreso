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
    const pageBottom = doc.page.height - 40;
    let y = 120;
    const drawHeader = () => {
        doc.fontSize(12).font("Helvetica-Bold");
        doc.text("#", 50, y, { width: 30 });
        doc.text("Regalo", 75, y, { width: 350 });
        doc.text("Fecha", 420, y, { width: 120 });
        y += 25;
        doc.font("Helvetica");
    };
    drawHeader();
    reporte.forEach((item, index) => {
        var _a, _b;
        if (y > pageBottom - 100) {
            doc.addPage();
            y = 50;
            drawHeader();
        }
        const fecha = item.createdAt
            ? new Date(item.createdAt).toLocaleString("es-MX", { hour12: false })
            : 'Sin fecha';
        doc.text(index + 1, 50, y, { width: 30 });
        const regaloHeight = doc.heightOfString((_a = item.m_regalo) === null || _a === void 0 ? void 0 : _a.premio, { width: 350 });
        doc.text((_b = item.m_regalo) === null || _b === void 0 ? void 0 : _b.premio, 75, y, {
            width: 350,
            continued: false
        });
        doc.text(fecha, 420, y, { width: 120 });
        y += regaloHeight + 10;
    });
    doc.end();
});
exports.reporte = reporte;
