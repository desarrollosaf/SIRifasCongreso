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
