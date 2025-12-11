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
    doc.fontSize(12).text(`Hora del reporte: ${horaGenerada}`);
    doc.moveDown();

    const tableTop = 140;
    const col1 = 50;     // #
    const col2 = 100;    // Nombre del regalo
    const col3 = 350;    // Fecha creación.

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
        doc.text(index + 1, col1, y);
        doc.text(item.m_regalo?.premio, col2, y);
        doc.text(item.createdAt, col3, y);
        y += 20; // espacio entre filas
    });

    doc.end();
};