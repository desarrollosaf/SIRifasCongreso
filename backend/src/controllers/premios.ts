import { Request, Response } from 'express';
import { QueryTypes } from 'sequelize';
import fs from 'fs';
import path from 'path';
import sequelize from '../database/cuestionariosConnection';
import Regalos from '../models/regalos';
import Rifa from '../models/rifa';
import { premiosRestantes, recalcularStock } from '../database/setup';
import { EXTENSIONES_FOTO, PREMIOS_DIR } from '../services/fotos';
import { actualizarEstado } from '../services/sorteoEstado';

const refrescarPantalla = async () => actualizarEstado({ restantes: await premiosRestantes() });

const usadosPorPremio = async (): Promise<Record<number, { entregados: number; pendientes: number }>> => {
    const filas: any[] = await sequelize.query(
        `SELECT id_premio,
                SUM(estatus = 'entregado') AS entregados,
                SUM(estatus = 'pendiente') AS pendientes
           FROM rifa GROUP BY id_premio`,
        { type: QueryTypes.SELECT }
    );
    const mapa: Record<number, { entregados: number; pendientes: number }> = {};
    filas.forEach(f => { mapa[f.id_premio] = { entregados: Number(f.entregados), pendientes: Number(f.pendientes) }; });
    return mapa;
};

export const listarPremios = async (req: Request, res: Response): Promise<any> => {
    const premios = await Regalos.findAll({ order: [['id', 'ASC']] });
    const usados = await usadosPorPremio();
    return res.json(premios.map(p => ({
        ...p.toJSON(),
        entregados: usados[p.id]?.entregados || 0,
        pendientes: usados[p.id]?.pendientes || 0,
    })));
};

const leerDatos = (body: any) => {
    const premio = String(body?.premio ?? '').trim();
    const stock = Number(body?.stock_inicial);
    if (!premio) throw new Error('El nombre del premio es obligatorio');
    if (!Number.isInteger(stock) || stock < 0) throw new Error('El stock debe ser un número entero mayor o igual a 0');
    return { premio, stock_inicial: stock, activo: body?.activo !== false };
};

export const crearPremio = async (req: Request, res: Response): Promise<any> => {
    try {
        const datos = leerDatos(req.body);
        const premio = await Regalos.create({ ...datos, cantidad: datos.stock_inicial, path: null });
        await refrescarPantalla();
        return res.json(premio);
    } catch (e: any) {
        return res.status(400).json({ msg: e.message });
    }
};

export const actualizarPremio = async (req: Request, res: Response): Promise<any> => {
    try {
        const datos = leerDatos(req.body);
        const premio = await Regalos.findByPk(Number(req.params.id));
        if (!premio) return res.status(404).json({ msg: 'No existe ese premio' });
        const usados = await Rifa.count({ where: { id_premio: premio.id, estatus: ['entregado', 'pendiente'] } });
        if (datos.stock_inicial < usados) {
            return res.status(400).json({ msg: `Ya se sortearon ${usados} unidades; el stock no puede ser menor` });
        }
        await premio.update({ ...datos, cantidad: datos.stock_inicial - usados });
        await refrescarPantalla();
        return res.json(premio);
    } catch (e: any) {
        return res.status(400).json({ msg: e.message });
    }
};

export const eliminarPremio = async (req: Request, res: Response): Promise<any> => {
    const premio = await Regalos.findByPk(Number(req.params.id));
    if (!premio) return res.status(404).json({ msg: 'No existe ese premio' });
    const sorteados = await Rifa.count({ where: { id_premio: premio.id } });
    if (sorteados > 0) {
        await premio.update({ activo: false });
        await refrescarPantalla();
        return res.json({ msg: 'El premio tiene historial, así que se desactivó en lugar de borrarse', desactivado: true });
    }
    await premio.destroy();
    await refrescarPantalla();
    return res.json({ msg: 'Premio eliminado' });
};

export const subirImagenPremio = async (req: Request, res: Response): Promise<any> => {
    const premio = await Regalos.findByPk(Number(req.params.id));
    const archivo = (req as any).file as Express.Multer.File | undefined;
    if (!premio) return res.status(404).json({ msg: 'No existe ese premio' });
    if (!archivo) return res.status(400).json({ msg: 'Selecciona una imagen' });
    const ext = path.extname(archivo.originalname).toLowerCase();
    if (!EXTENSIONES_FOTO.includes(ext)) return res.status(400).json({ msg: 'Formato no permitido (jpg, png o webp)' });
    const nombre = `premio-${premio.id}-${Date.now()}${ext}`;
    fs.writeFileSync(path.join(PREMIOS_DIR, nombre), archivo.buffer);
    if (premio.path?.startsWith('storage/premios/')) {
        const anterior = path.join(PREMIOS_DIR, path.basename(premio.path));
        if (fs.existsSync(anterior)) fs.unlinkSync(anterior);
    }
    await premio.update({ path: `storage/premios/${nombre}` });
    return res.json(premio);
};

export const recalcular = async (req: Request, res: Response): Promise<any> => {
    await recalcularStock();
    await refrescarPantalla();
    return res.json({ msg: 'Stock recalculado a partir de los ganadores registrados' });
};
