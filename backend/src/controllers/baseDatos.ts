import { Request, Response } from 'express';
import path from 'path';
import sequelize from '../database/cuestionariosConnection';
import Regalos from '../models/regalos';
import Rifa from '../models/rifa';
import Participante from '../models/participante';
import Config, { getConfig } from '../models/config';
import { premiosSeedRows } from '../database/seedPremios';
import { premiosRestantes, recalcularStock } from '../database/setup';
import {
    BACKUPS_DIR, crearRespaldo, guardarRespaldoSubido, listarRespaldos, nombreValido, restaurarRespaldo,
} from '../services/backups';
import { actualizarEstado, limpiarPantalla } from '../services/sorteoEstado';
import fs from 'fs';

const archivoValido = (req: Request, res: Response): string | null => {
    const archivo = path.basename(String(req.params.archivo || ''));
    if (!nombreValido(archivo) || !fs.existsSync(path.join(BACKUPS_DIR, archivo))) {
        res.status(404).json({ msg: 'No existe ese respaldo' });
        return null;
    }
    return archivo;
};

export const resumen = async (req: Request, res: Response): Promise<any> => {
    const [premios, participantes, entregados, pendientes, cancelados] = await Promise.all([
        Regalos.count({ where: { activo: true } }),
        Participante.count(),
        Rifa.count({ where: { estatus: 'entregado' } }),
        Rifa.count({ where: { estatus: 'pendiente' } }),
        Rifa.count({ where: { estatus: 'cancelado' } }),
    ]);
    const stockTotal = (await Regalos.sum('stock_inicial', { where: { activo: true } })) || 0;
    return res.json({
        premios, participantes, entregados, pendientes, cancelados, stockTotal,
        restantes: await premiosRestantes(),
        respaldos: listarRespaldos().length,
        carpetaRespaldos: process.env.BACKUPS_DIR_HOST || BACKUPS_DIR,
    });
};

export const listar = (req: Request, res: Response): any => res.json(listarRespaldos());

export const crear = async (req: Request, res: Response): Promise<any> => {
    const archivo = await crearRespaldo('manual');
    return res.json({ msg: 'Respaldo creado', archivo });
};

export const descargar = (req: Request, res: Response): any => {
    const archivo = archivoValido(req, res);
    if (archivo) res.download(path.join(BACKUPS_DIR, archivo), archivo);
};

export const subir = (req: Request, res: Response): any => {
    const archivo = (req as any).file as Express.Multer.File | undefined;
    if (!archivo) return res.status(400).json({ msg: 'Selecciona un archivo .json de respaldo' });
    try {
        return res.json({ msg: 'Respaldo subido', archivo: guardarRespaldoSubido(archivo.buffer) });
    } catch (e: any) {
        return res.status(400).json({ msg: e.message || 'Archivo inválido' });
    }
};

export const restaurar = async (req: Request, res: Response): Promise<any> => {
    const archivo = archivoValido(req, res);
    if (!archivo) return;
    if (req.body?.confirmacion !== 'RESTAURAR') return res.status(400).json({ msg: 'Escribe RESTAURAR para confirmar' });
    try {
        await restaurarRespaldo(archivo);
        limpiarPantalla(await premiosRestantes());
        actualizarEstado({ evento: await getConfig() });
        return res.json({ msg: `Base de datos restaurada desde ${archivo}` });
    } catch (e: any) {
        return res.status(400).json({ msg: e.message || 'No se pudo restaurar' });
    }
};

export const eliminar = (req: Request, res: Response): any => {
    const archivo = archivoValido(req, res);
    if (!archivo) return;
    fs.unlinkSync(path.join(BACKUPS_DIR, archivo));
    return res.json({ msg: 'Respaldo eliminado' });
};

const REINICIOS: Record<string, { descripcion: string; ejecutar: () => Promise<void> }> = {
    sorteo: {
        descripcion: 'Se borraron todos los ganadores y el stock volvió al inicial',
        ejecutar: () => sequelize.transaction(async (transaction) => {
            await Rifa.destroy({ where: {}, transaction });
            await recalcularStock(transaction);
        }),
    },
    stock: {
        descripcion: 'Stock recalculado a partir de los ganadores registrados',
        ejecutar: () => recalcularStock(),
    },
    participantes: {
        descripcion: 'Se vació la lista de participantes (las fotos se conservan)',
        ejecutar: async () => { await Participante.destroy({ where: {} }); },
    },
    fabrica: {
        descripcion: 'Todo volvió a como estaba al instalar: premios originales, sin ganadores ni participantes',
        ejecutar: () => sequelize.transaction(async (transaction) => {
            await Rifa.destroy({ where: {}, transaction });
            await Participante.destroy({ where: {}, transaction });
            await Regalos.destroy({ where: {}, transaction });
            await Config.destroy({ where: {}, transaction });
            await Regalos.bulkCreate(premiosSeedRows(), { transaction });
        }),
    },
};

export const reiniciar = async (req: Request, res: Response): Promise<any> => {
    const tipo = String(req.body?.tipo || '');
    const reinicio = REINICIOS[tipo];
    if (!reinicio) return res.status(400).json({ msg: 'Tipo de reinicio no válido' });
    if (req.body?.confirmacion !== 'REINICIAR') return res.status(400).json({ msg: 'Escribe REINICIAR para confirmar' });
    const respaldo = await crearRespaldo('pre-reinicio');
    await reinicio.ejecutar();
    limpiarPantalla(await premiosRestantes());
    actualizarEstado({ evento: await getConfig() });
    return res.json({ msg: reinicio.descripcion, respaldo });
};

export const obtenerConfig = async (req: Request, res: Response): Promise<any> => res.json(await getConfig());

export const guardarConfig = async (req: Request, res: Response): Promise<any> => {
    const permitidas = ['evento_titulo', 'evento_anio'];
    for (const clave of permitidas) {
        if (req.body?.[clave] !== undefined) await Config.upsert({ clave, valor: String(req.body[clave]).trim() });
    }
    const config = await getConfig();
    actualizarEstado({ evento: config });
    return res.json(config);
};
