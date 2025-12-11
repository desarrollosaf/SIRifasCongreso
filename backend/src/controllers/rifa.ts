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
// app.get('/api/reporte', async (req: Request, res: Response) => {
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
    doc.fontSize(12).text(`Hora del reporte: ${horaGenerada}`);
    doc.moveDown();

    reporte.forEach((item, index) => {
        doc.text(`Registro #${index + 1}`);
        doc.text(`ID: ${item.id}`);
        // doc.text(`Regalo: ${item.m_regalo?.premio}`);
        doc.text(`Hora generado: ${item.createdAt}`);
        doc.moveDown();
    });

    doc.end();
};