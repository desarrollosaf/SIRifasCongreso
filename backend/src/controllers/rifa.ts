import { Request, Response } from "express"
import Regalos from "../models/regalos";
import Rifa from "../models/rifa";
import { Sequelize } from "sequelize";

export const rifa = async (req: Request, res: Response): Promise<any> => {
    const { Op } = require('sequelize');
    let regalo = null;

    regalo = await Regalos.findOne({
        where:{
            cantidad: {
                [Op.gt]: 0
            }
        },
        order: Sequelize.literal('RAND()')
    });

    if(regalo != null){
        await regalo?.update({
            cantidad: regalo.cantidad! - 1
        });

        await Rifa.create({
            id_premio: regalo?.id,
        })
    }

    const totalRegalos = await Regalos.sum('cantidad');
    return res.json({
        data: regalo,
        total: totalRegalos
    });
}

export const reporte = async (req: Request, res: Response): Promise<any> => {
    const reporte = await Rifa.findAll({
        include: [
            {
                model: Regalos,
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

        if (y > pageBottom - 100) {
            doc.addPage();
            y = 50;
            drawHeader();
        }

        const fecha = item.createdAt
        ? new Date(item.createdAt).toLocaleString("es-MX", { hour12: false })
        : 'Sin fecha';

        doc.text(index + 1, 50, y, { width: 30 });
        const regaloHeight = doc.heightOfString(item.m_regalo?.premio, { width: 350 });
         doc.text(item.m_regalo?.premio, 75, y, {
            width: 350,
            continued: false
        });
        doc.text(fecha, 420, y, { width: 120 });
        y += regaloHeight + 10;
    });

    doc.end();
};