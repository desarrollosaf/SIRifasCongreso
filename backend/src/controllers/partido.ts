import { Request, Response } from 'express';
import ParticipantePartido from '../models/participantePartido';
import { Sequelize } from 'sequelize';

export const getGanadores = async (req: Request, res: Response): Promise<any> => {
  try {
    const ganadores = await ParticipantePartido.findAll({
      where: { ganador: true },
      order: [['updatedAt', 'ASC']],
    });
    return res.json({ data: ganadores, total: ganadores.length });
  } catch (error) {
    return res.status(500).json({ message: 'Error al obtener ganadores', error });
  }
};

export const getParticipantes = async (req: Request, res: Response): Promise<any> => {
  try {
    const participantes = await ParticipantePartido.findAll({
      order: [['folio', 'ASC']],
    });
    return res.json({ data: participantes, total: participantes.length });
  } catch (error) {
    return res.status(500).json({ message: 'Error al obtener participantes', error });
  }
};

export const realizarSorteo = async (req: Request, res: Response): Promise<any> => {
  try {
    const yaGanadores = await ParticipantePartido.count({ where: { ganador: true } });
    if (yaGanadores >= 12) {
      return res.status(400).json({ message: 'Ya se seleccionaron los 12 boletos ganadores.' });
    }

    const seleccionado = await ParticipantePartido.findOne({
      where: { ganador: false },
      order: Sequelize.literal('RAND()'),
    });

    if (!seleccionado) {
      return res.status(400).json({ message: 'No hay participantes disponibles.' });
    }

    await seleccionado.update({ ganador: true });

    return res.json({ data: seleccionado, totalGanadores: yaGanadores + 1 });
  } catch (error) {
    return res.status(500).json({ message: 'Error al realizar el sorteo', error });
  }
};

export const reportePDF = async (req: Request, res: Response): Promise<any> => {
  try {
    const ganadores = await ParticipantePartido.findAll({
      where: { ganador: true },
      order: [['updatedAt', 'ASC']],
    });

    const PDFDocument = require('pdfkit');
    const path = require('path');
    const doc = new PDFDocument({ size: 'A4', margin: 50 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=boletos_ganadores.pdf');
    doc.pipe(res);

    const marginBottom = 60;
    const tableWidth = 520;
    const col1X = 50;   // #
    const col2X = 85;   // folio
    const col3X = 205;  // nombre completo
    const col4X = 420;  // adscripcion

    const bgPath = path.join(__dirname, '../assets/membretesecretariaejecutiva4.jpg');

    const drawHeader = () => {
      doc.image(bgPath, 0, 0, { width: doc.page.width, height: doc.page.height });
      doc.y = 106;

      doc.font('Helvetica-Bold').fontSize(18).fillColor('#006847')
        .text('Boletos Ganadores — México vs Serbia', { align: 'center' });

      doc.font('Helvetica').fontSize(11).fillColor('black');
      const hora = new Date().toLocaleString('es-MX', { hour12: false });
      doc.text(`Generado: ${hora}`, { align: 'center' });
      doc.moveDown(0.5);

      const tableTop = doc.y;
      doc.rect(col1X - 5, tableTop - 5, tableWidth, 20).fill('#006847');
      doc.fillColor('white').font('Helvetica-Bold').fontSize(10);
      doc.text('#', col1X, tableTop, { width: 30 });
      doc.text('Folio', col2X, tableTop, { width: 115 });
      doc.text('Nombre Completo', col3X, tableTop, { width: 210 });
      doc.text('Adscripción', col4X, tableTop, { width: 145 });
      doc.fillColor('black');
      doc.moveDown(0.5);
    };

    drawHeader();

    ganadores.forEach((item, index) => {
      const nombreWidth = 210;
      const textHeight = doc.heightOfString(item.nombre_completo, { width: nombreWidth });
      const rowHeight = textHeight + 6;

      if (doc.y + rowHeight + marginBottom > doc.page.height) {
        doc.addPage();
        drawHeader();
      }

      const rowY = doc.y;

      if (index % 2 === 0) {
        doc.rect(col1X - 5, rowY - 2, tableWidth, rowHeight)
          .fillOpacity(0.06).fill('#bdc3c7').fillOpacity(1);
      }

      doc.fillColor('#006847').font('Helvetica-Bold').fontSize(10);
      doc.text(index + 1, col1X, rowY + 2, { width: 30 });

      doc.fillColor('black').font('Helvetica').fontSize(9);
      doc.text(item.folio, col2X, rowY + 2, { width: 115 });
      doc.text(item.nombre_completo, col3X, rowY + 2, { width: nombreWidth });
      doc.text(item.adscripcion, col4X, rowY + 2, { width: 145 });

      doc.y = rowY + rowHeight + 1;
    });

    doc.moveDown(1);
    doc.fontSize(9).font('Helvetica-Oblique').fillColor('#7f8c8d')
      .text(`Total: ${ganadores.length} boletos ganadores`, { align: 'right' });

    doc.end();
  } catch (error) {
    return res.status(500).json({ message: 'Error al generar el PDF', error });
  }
};

export const removerGanador = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const participante = await ParticipantePartido.findOne({ where: { id, ganador: true } });
    if (!participante) {
      return res.status(404).json({ message: 'Ganador no encontrado.' });
    }
    await participante.update({ ganador: false });
    return res.json({ message: 'Ganador removido correctamente' });
  } catch (error) {
    return res.status(500).json({ message: 'Error al remover ganador', error });
  }
};

export const resetSorteo = async (req: Request, res: Response): Promise<any> => {
  try {
    await ParticipantePartido.update({ ganador: false }, { where: { ganador: true } });
    return res.json({ message: 'Sorteo reiniciado correctamente' });
  } catch (error) {
    return res.status(500).json({ message: 'Error al reiniciar el sorteo', error });
  }
};
