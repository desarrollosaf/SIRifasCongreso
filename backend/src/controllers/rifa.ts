import { Request, Response } from "express"
import { Op } from "sequelize";
import path from 'path';
import ExcelJS from 'exceljs';
import Regalos from "../models/regalos";
import Rifa from "../models/rifa";
import { urlFoto, indiceFotos } from "../services/fotos";

const PDFDocument = require('pdfkit');

const filtroGanadores = (req: Request) => {
    const estatus = String(req.query.estatus || '');
    const q = String(req.query.q || '').trim();
    const where: any = {};
    if (['pendiente', 'entregado', 'cancelado'].includes(estatus)) where.estatus = estatus;
    else if (estatus !== 'todos') where.estatus = { [Op.ne]: 'cancelado' };
    if (q) where[Op.or] = [{ rfc: { [Op.like]: `%${q}%` } }, { nombre: { [Op.like]: `%${q}%` } }];
    return where;
};

const buscarGanadores = (req: Request) => Rifa.findAll({
    where: filtroGanadores(req),
    include: [{ model: Regalos, as: "m_regalo" }],
    order: [['createdAt', 'ASC']],
});

const fechaMx = (fecha?: Date | null) => fecha ? new Date(fecha).toLocaleString("es-MX", { hour12: false }) : 'Sin fecha';

export const listarGanadores = async (req: Request, res: Response): Promise<any> => {
    const ganadores = await buscarGanadores(req);
    const indice = indiceFotos();
    return res.json(ganadores.reverse().map(g => ({
        id: g.id,
        rfc: g.rfc,
        nombre: g.nombre,
        area: g.area,
        estatus: g.estatus,
        createdAt: g.createdAt,
        confirmadoAt: g.confirmadoAt,
        fotoUrl: urlFoto(g.rfc, indice),
        premio: g.m_regalo ? { id: g.m_regalo.id, premio: g.m_regalo.premio, path: g.m_regalo.path } : null,
    })));
};

export const reporteExcel = async (req: Request, res: Response): Promise<any> => {
    const ganadores = await buscarGanadores(req);
    const libro = new ExcelJS.Workbook();
    const hoja = libro.addWorksheet('Ganadores');
    hoja.columns = [
        { header: '#', key: 'n', width: 6 },
        { header: 'RFC', key: 'rfc', width: 16 },
        { header: 'Nombre', key: 'nombre', width: 36 },
        { header: 'Área', key: 'area', width: 30 },
        { header: 'Premio', key: 'premio', width: 44 },
        { header: 'Estatus', key: 'estatus', width: 12 },
        { header: 'Sorteado', key: 'fecha', width: 20 },
        { header: 'Entregado', key: 'confirmado', width: 20 },
    ];
    hoja.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    hoja.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7D0037' } };
    ganadores.forEach((g, i) => hoja.addRow({
        n: i + 1,
        rfc: g.rfc,
        nombre: g.nombre,
        area: g.area,
        premio: g.m_regalo?.premio,
        estatus: g.estatus,
        fecha: fechaMx(g.createdAt),
        confirmado: g.confirmadoAt ? fechaMx(g.confirmadoAt) : '',
    }));
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=ganadores.xlsx');
    await libro.xlsx.write(res);
    res.end();
};

export const reporte = async (req: Request, res: Response): Promise<any> => {
    const reporte = await buscarGanadores(req);

    const doc = new PDFDocument({ size: "A4", margin: 50 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=reporte.pdf');
    doc.pipe(res);

    const marginBottom = 60;
    const col1X = 50;
    const col2X = 75;
    const col3X = 265;
    const col4X = 440;
    const tableWidth = 520;

    const bgPath = path.join(__dirname, "../assets/membretesecretariaejecutiva4.jpg");

    const drawHeader = () => {
        doc.image(bgPath, 0, 0, {
            width: doc.page.width,
            height: doc.page.height,
        });

        doc.y = 106; // Fijar posición inicial en cada página

        doc.font("Helvetica-Bold").fontSize(20).fillColor("#7d0037")
            .text("Reporte de Ganadores", { align: "center" });

        doc.font("Helvetica").fontSize(12).fillColor("black");
        doc.text(`Generado: ${fechaMx(new Date())}`, { align: "center" });
        doc.moveDown(0.5);

        const tableTop = doc.y;
        doc.rect(col1X - 5, tableTop - 5, tableWidth, 20).fill("#7d0037");
        doc.fillColor("white").font("Helvetica-Bold").fontSize(11);
        doc.text("#", col1X, tableTop);
        doc.text("Ganador", col2X, tableTop);
        doc.text("Premio", col3X, tableTop);
        doc.text("Fecha", col4X, tableTop);
        doc.fillColor("black");
        doc.moveDown(0.5);
    };

    drawHeader();

    reporte.forEach((item, index) => {
        const fecha = fechaMx(item.createdAt) + (item.estatus === 'pendiente' ? '\n(pendiente)' : '');
        const premio = item.m_regalo?.premio || 'Sin premio';
        const ganador = `${item.nombre || 'Sin nombre'}\n${item.rfc || ''}`;

        const textHeight = Math.max(
            doc.heightOfString(premio, { width: 165 }),
            doc.heightOfString(ganador, { width: 180 }),
            doc.heightOfString(fecha, { width: 120 }),
        );
        const padding = 4;
        const rowHeight = textHeight + padding;

        if (doc.y + rowHeight + marginBottom > doc.page.height) {
            doc.addPage();
            drawHeader();
        }

        const rowY = doc.y;

        doc.rect(col1X - 5, rowY - 2, tableWidth, rowHeight)
            .fillOpacity(0.05)
            .fill("#bdc3c7")
            .fillOpacity(1);

        doc.fillColor("#000000").font("Helvetica-Bold").fontSize(10);
        doc.text(index + 1, col1X, rowY + 2);

        doc.fillColor("black").font("Helvetica").fontSize(9);
        doc.text(ganador, col2X, rowY + 2, { width: 180 });
        doc.text(premio, col3X, rowY + 2, { width: 165 });
        doc.text(fecha, col4X, rowY + 2, { width: 120 });

        doc.y = rowY + rowHeight + 1;
    });

    doc.moveDown(1);
    doc.fontSize(9).font("Helvetica-Oblique").fillColor("#7f8c8d")
        .text(`Total: ${reporte.length} ganador(es) · Generado el ${fechaMx(new Date())}`, { align: "right" });

    doc.end();
};
