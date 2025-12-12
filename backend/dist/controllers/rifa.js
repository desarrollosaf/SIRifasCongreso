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
// export const reporte = async (req: Request, res: Response): Promise<any> => {
//     const reporte = await Rifa.findAll({
//         include: [
//             {
//                 model: Regalos,
//                 as: "m_regalo",
//             }
//         ]
//     });
//     const PDFDocument = require('pdfkit');
//     const doc = new PDFDocument();
//     res.setHeader('Content-Type', 'application/pdf');
//     res.setHeader('Content-Disposition', 'attachment; filename=reporte.pdf');
//     doc.pipe(res);
//     const horaGenerada = new Date().toLocaleString("es-MX", { hour12: false });
//     doc.fontSize(18).text('Reporte de Rifa', { align: 'center' });
//     doc.moveDown();
//     const pageBottom = doc.page.height - 40; 
//     let y = 120;
//     const drawHeader = () => {
//         doc.fontSize(12).font("Helvetica-Bold");
//         doc.text("#", 50, y, { width: 30 });
//         doc.text("Regalo", 75, y, { width: 350 });
//         doc.text("Fecha", 420, y, { width: 120 });
//         y += 25;
//         doc.font("Helvetica");
//     };
//     drawHeader();
//     reporte.forEach((item, index) => {
//         if (y > pageBottom - 100) {
//             doc.addPage();
//             y = 50;
//             drawHeader();
//         }
//         const fecha = item.createdAt
//         ? new Date(item.createdAt).toLocaleString("es-MX", { hour12: false })
//         : 'Sin fecha';
//         doc.text(index + 1, 50, y, { width: 30 });
//         const regaloHeight = doc.heightOfString(item.m_regalo?.premio, { width: 350 });
//          doc.text(item.m_regalo?.premio, 75, y, {
//             width: 350,
//             continued: false
//         });
//         doc.text(fecha, 420, y, { width: 120 });
//         y += regaloHeight + 10;
//     });
//     doc.end();
// };
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
    const path = require('path');
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=reporte.pdf');
    doc.pipe(res);
    const marginBottom = 60;
    const col1X = 50;
    const col2X = 90;
    const col3X = 440;
    const tableWidth = 520;
    // Ruta de la imagen de fondo (ajusta según tu estructura de carpetas)
    const bgPath = path.join(__dirname, "../assets/membretesecretariaejecutiva4.jpg");
    const drawHeader = () => {
        // Fondo de página
        doc.image(bgPath, 0, 0, {
            width: doc.page.width,
            height: doc.page.height,
        });
        doc.y = 106; // Fijar posición inicial en cada página
        // Título
        doc.font("Helvetica-Bold").fontSize(20).fillColor("#7d0037")
            .text("Reporte de Rifas", { align: "center" });
        doc.font("Helvetica").fontSize(12).fillColor("black");
        const horaGenerada = new Date().toLocaleString("es-MX", { hour12: false });
        doc.text(`Generado: ${horaGenerada}`, { align: "center" });
        doc.moveDown(1);
        // Encabezado de tabla
        const tableTop = doc.y;
        doc.rect(col1X - 5, tableTop - 5, tableWidth, 20).fill("#7d0037");
        doc.fillColor("white").font("Helvetica-Bold").fontSize(11);
        doc.text("#", col1X, tableTop);
        doc.text("Regalo", col2X, tableTop);
        doc.text("Fecha", col3X, tableTop);
        doc.fillColor("black");
        doc.moveDown(1);
    };
    // Primera página
    drawHeader();
    // Dibujar filas
    reporte.forEach((item, index) => {
        var _a;
        const fecha = item.createdAt
            ? new Date(item.createdAt).toLocaleString("es-MX", { hour12: false })
            : 'Sin fecha';
        const premio = ((_a = item.m_regalo) === null || _a === void 0 ? void 0 : _a.premio) || 'Sin premio';
        // Calcular altura de la fila
        const premioWidth = 340;
        const textHeight = doc.heightOfString(premio, { width: premioWidth, align: "left" });
        const padding = 2;
        const rowHeight = Math.max(20, textHeight + padding);
        // Verificar si necesita nueva página
        if (doc.y + rowHeight + marginBottom > doc.page.height) {
            doc.addPage();
            drawHeader();
        }
        const rowY = doc.y;
        // Fondo de fila
        doc.rect(col1X - 5, rowY - 2, tableWidth, rowHeight)
            .fillOpacity(0.05)
            .fill("#bdc3c7")
            .fillOpacity(1);
        // Escribir número
        doc.fillColor("#000000").font("Helvetica-Bold").fontSize(10);
        doc.text(index + 1, col1X, rowY + 3);
        // Escribir premio
        doc.fillColor("black").font("Helvetica").fontSize(9);
        doc.text(premio, col2X, rowY + 3, { width: premioWidth });
        // Escribir fecha
        doc.text(fecha, col3X, rowY + 3, { width: 120 });
        // Avanzar a la siguiente fila
        doc.y = rowY + rowHeight + 3;
    });
    // Pie de página
    doc.moveDown(2);
    doc.fontSize(9).font("Helvetica-Oblique").fillColor("#7f8c8d")
        .text(`Generado el ${new Date().toLocaleString("es-MX", { hour12: false })}`, { align: "right" });
    doc.end();
});
exports.reporte = reporte;
