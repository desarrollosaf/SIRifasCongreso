import { Request, Response } from 'express';
import { Op } from 'sequelize';
import sequelize from '../database/cuestionariosConnection';
import Regalos from '../models/regalos';
import Rifa from '../models/rifa';
import Participante from '../models/participante';
import { getConfig } from '../models/config';
import { premiosRestantes } from '../database/setup';
import { indiceFotos, normalizarRfc, urlFoto } from '../services/fotos';
import { crearRespaldo } from '../services/backups';
import { nombrePila } from '../services/nombres';
import {
    GanadorPantalla, actualizarEstado, iniciarSorteoEnPantalla, limpiarPantalla, obtenerEstado, suscribir,
} from '../services/sorteoEstado';

// Flujo: 1) se sortea el premio  2) sale el boleto de la tómbola y se elige a la persona
//        3) se confirma la entrega (o "no se presentó" y se saca otro boleto para el mismo premio)

class ErrorSorteo extends Error {
    constructor(public status: number, msg: string, public extra: any = {}) { super(msg); }
}

// Las operaciones que mueven stock se ejecutan una a la vez (además del bloqueo en BD)
let cola: Promise<any> = Promise.resolve();
const enSerie = <T>(fn: () => Promise<T>): Promise<T> => {
    const resultado = cola.then(fn, fn);
    cola = resultado.catch(() => undefined);
    return resultado;
};

const responderError = (res: Response, e: any) => {
    if (e instanceof ErrorSorteo) return res.status(e.status).json({ msg: e.message, ...e.extra });
    console.error(e);
    return res.status(500).json({ msg: 'Error interno', detalle: e?.message });
};

export const aPantalla = (r: Rifa): GanadorPantalla => ({
    id: r.id,
    rfc: r.rfc,
    nombre: r.nombre,
    // Registros viejos sin nombre_pila: se calcula del nombre completo (orden SAF)
    nombrePila: r.nombre_pila || nombrePila(r.nombre),
    area: r.area,
    fotoUrl: urlFoto(r.rfc),
    estatus: r.estatus,
    premio: r.m_regalo ? { id: r.m_regalo.id, premio: r.m_regalo.premio, path: r.m_regalo.path } : null,
});

const conPremio = { include: [{ model: Regalos, as: 'm_regalo' }] };

const premiosGanados = (rfc: string, excluirId?: number) => Rifa.findAll({
    where: { rfc, estatus: { [Op.ne]: 'cancelado' }, ...(excluirId ? { id: { [Op.ne]: excluirId } } : {}) },
    ...conPremio,
    order: [['createdAt', 'DESC']],
});

// --- Público (pantalla) ---

export const estadoPantalla = (req: Request, res: Response): any => res.json(obtenerEstado());

export const streamPantalla = (req: Request, res: Response): any => suscribir(res);

export const refrescarEstadoBase = async () => {
    actualizarEstado({ restantes: await premiosRestantes(), evento: await getConfig() });
};

// Premios con unidades disponibles, para el carrusel de la pantalla pública
export const premiosPantalla = async (req: Request, res: Response): Promise<any> => {
    const premios = await Regalos.findAll({
        where: { activo: true, cantidad: { [Op.gt]: 0 } },
        attributes: ['id', 'premio', 'path', 'cantidad'],
        order: [['id', 'ASC']],
    });
    return res.json(premios);
};

// --- Admin: buscador de personas (select por nombre) ---

export const buscarPersonas = async (req: Request, res: Response): Promise<any> => {
    const q = String(req.query.q || '').trim();
    if (q.length < 2) return res.json([]);
    // Cada palabra debe aparecer en el nombre, la dependencia, la dirección o el RFC
    const palabras = q.split(/\s+/).slice(0, 5);
    const personas = await Participante.findAll({
        where: {
            [Op.and]: palabras.map(p => ({
                [Op.or]: [
                    { nombre: { [Op.like]: `%${p}%` } },
                    { rfc: { [Op.like]: `%${p}%` } },
                    { area: { [Op.like]: `%${p}%` } },
                    { direccion: { [Op.like]: `%${p}%` } },
                ],
            })),
        },
        order: [['nombre', 'ASC']],
        limit: 30,
    });
    const indice = indiceFotos();
    const ganadores = new Set((await Rifa.findAll({
        where: { rfc: personas.map(p => p.rfc), estatus: { [Op.ne]: 'cancelado' } },
        attributes: ['rfc'],
    })).map(r => r.rfc));
    return res.json(personas.map(p => ({
        rfc: p.rfc,
        nombre: p.nombre,
        area: p.area,
        direccion: p.direccion,
        fotoUrl: urlFoto(p.rfc, indice),
        gano: ganadores.has(p.rfc),
    })));
};

export const buscarParticipante = async (req: Request, res: Response): Promise<any> => {
    const rfc = normalizarRfc(req.params.rfc);
    const participante = await Participante.findOne({ where: { rfc } });
    const ganados = await premiosGanados(rfc);
    return res.json({
        rfc,
        encontrado: !!participante,
        nombre: participante?.nombre ?? null,
        area: participante?.area ?? null,
        direccion: participante?.direccion ?? null,
        fotoUrl: urlFoto(rfc),
        ganados: ganados.map(g => ({ id: g.id, estatus: g.estatus, premio: g.m_regalo?.premio, fecha: g.createdAt })),
    });
};

// --- Admin: paso 1, sortear el premio ---

const ejecutarSorteoPremio = async () => {
    const registro = await sequelize.transaction(async (transaction) => {
        // Bloquea los premios disponibles: nadie más puede descontar hasta que termine esta transacción
        const disponibles = await Regalos.findAll({
            where: { activo: true, cantidad: { [Op.gt]: 0 } },
            lock: transaction.LOCK.UPDATE,
            transaction,
        });

        const pendiente = await Rifa.findOne({ where: { estatus: 'pendiente' }, transaction });
        if (pendiente) {
            throw new ErrorSorteo(409, 'Hay un premio pendiente: termina de entregarlo o cancélalo antes de sortear otro', {
                codigo: 'PENDIENTE', pendienteId: pendiente.id,
            });
        }
        if (disponibles.length === 0) throw new ErrorSorteo(410, '¡Ya no quedan premios!', { codigo: 'SIN_PREMIOS' });

        // Cada unidad física tiene la misma probabilidad (premio con más unidades = más probable)
        const total = disponibles.reduce((s, p) => s + (p.cantidad || 0), 0);
        let boleto = Math.floor(Math.random() * total);
        const premio = disponibles.find(p => (boleto -= p.cantidad || 0) < 0)!;

        await premio.update({ cantidad: (premio.cantidad || 0) - 1 }, { transaction });
        const nuevo = await Rifa.create({
            id_premio: premio.id, rfc: null, nombre: null, nombre_pila: null, area: null, estatus: 'pendiente', confirmadoAt: null,
        }, { transaction });
        nuevo.m_regalo = premio;
        return nuevo;
    });

    const pantalla = aPantalla(registro);
    iniciarSorteoEnPantalla(pantalla, await premiosRestantes());
    return pantalla;
};

export const sortear = async (req: Request, res: Response): Promise<any> => {
    try {
        return res.json(await enSerie(ejecutarSorteoPremio));
    } catch (e) {
        return responderError(res, e);
    }
};

// --- Admin: paso 2, asignar a la persona del boleto ---

export const asignarGanador = async (req: Request, res: Response): Promise<any> => {
    try {
        const resultado = await enSerie(async () => {
            const registro = await Rifa.findByPk(Number(req.params.id), conPremio);
            if (!registro) throw new ErrorSorteo(404, 'No existe ese registro');
            if (registro.estatus !== 'pendiente') throw new ErrorSorteo(400, `El premio ya está ${registro.estatus}`);

            const rfc = normalizarRfc(req.body?.rfc);
            if (!rfc) throw new ErrorSorteo(400, 'Selecciona a la persona ganadora');
            const previos = await premiosGanados(rfc, registro.id);
            if (previos.length > 0 && !req.body?.forzar) {
                throw new ErrorSorteo(409, 'Esta persona ya ganó un premio', {
                    codigo: 'YA_GANO',
                    ganados: previos.map(g => ({ id: g.id, premio: g.m_regalo?.premio, estatus: g.estatus })),
                });
            }
            const participante = await Participante.findOne({ where: { rfc } });
            const nombreElegido = String(req.body?.nombre || '').trim() || participante?.nombre || null;
            await registro.update({
                rfc,
                nombre: nombreElegido,
                nombre_pila: participante?.nombre && participante.nombre === nombreElegido
                    ? (participante.nombre_pila || nombrePila(nombreElegido))
                    : nombrePila(nombreElegido),
                area: String(req.body?.area || '').trim() || participante?.area || null,
            });
            const pantalla = aPantalla(registro);
            actualizarEstado({ fase: 'revelado', ganador: pantalla });
            return pantalla;
        });
        return res.json(resultado);
    } catch (e) {
        return responderError(res, e);
    }
};

// "No se presentó": se quita a la persona y el premio sigue en juego para el siguiente boleto
export const quitarGanador = async (req: Request, res: Response): Promise<any> => {
    try {
        const resultado = await enSerie(async () => {
            const registro = await Rifa.findByPk(Number(req.params.id), conPremio);
            if (!registro) throw new ErrorSorteo(404, 'No existe ese registro');
            if (registro.estatus !== 'pendiente') throw new ErrorSorteo(400, `El premio ya está ${registro.estatus}`);
            await registro.update({ rfc: null, nombre: null, nombre_pila: null, area: null });
            const pantalla = aPantalla(registro);
            actualizarEstado({ fase: 'premio', ganador: pantalla });
            return pantalla;
        });
        return res.json(resultado);
    } catch (e) {
        return responderError(res, e);
    }
};

// --- Admin: paso 3, confirmar o cancelar ---

const ejecutarCancelacion = async (id: number) => {
    await sequelize.transaction(async (transaction) => {
        const registro = await Rifa.findByPk(id, { lock: transaction.LOCK.UPDATE, transaction });
        if (!registro) throw new ErrorSorteo(404, 'No existe ese registro');
        if (registro.estatus === 'cancelado') throw new ErrorSorteo(400, 'Ya estaba cancelado');
        const premio = await Regalos.findByPk(registro.id_premio!, { lock: transaction.LOCK.UPDATE, transaction });
        if (premio) {
            const tope = premio.stock_inicial ?? Number.MAX_SAFE_INTEGER;
            await premio.update({ cantidad: Math.min(tope, (premio.cantidad || 0) + 1) }, { transaction });
        }
        await registro.update({ estatus: 'cancelado' }, { transaction });
    });
    const restantes = await premiosRestantes();
    if (obtenerEstado().ganador?.id === id) limpiarPantalla(restantes);
    else actualizarEstado({ restantes });
};

export const cancelar = async (req: Request, res: Response): Promise<any> => {
    try {
        await enSerie(() => ejecutarCancelacion(Number(req.params.id)));
        return res.json({ msg: 'Cancelado: el premio regresó al stock', restantes: obtenerEstado().restantes });
    } catch (e) {
        return responderError(res, e);
    }
};

export const confirmar = async (req: Request, res: Response): Promise<any> => {
    try {
        const registro = await Rifa.findByPk(Number(req.params.id), conPremio);
        if (!registro) throw new ErrorSorteo(404, 'No existe ese registro');
        if (registro.estatus !== 'pendiente') throw new ErrorSorteo(400, `El registro está ${registro.estatus}`);
        if (!registro.rfc) throw new ErrorSorteo(400, 'Primero selecciona a la persona ganadora');
        await registro.update({ estatus: 'entregado', confirmadoAt: new Date() });
        if (obtenerEstado().ganador?.id === registro.id) actualizarEstado({ ganador: aPantalla(registro) });
        crearRespaldo('auto').catch(err => console.error('Respaldo automático falló', err));
        return res.json({ msg: 'Entrega confirmada', ganador: aPantalla(registro) });
    } catch (e) {
        return responderError(res, e);
    }
};

export const pendienteActual = async (req: Request, res: Response): Promise<any> => {
    const registro = await Rifa.findOne({ where: { estatus: 'pendiente' }, ...conPremio });
    return res.json(registro ? aPantalla(registro) : null);
};

export const limpiar = async (req: Request, res: Response): Promise<any> => {
    limpiarPantalla(await premiosRestantes());
    return res.json(obtenerEstado());
};

// Vuelve a mostrar en la pantalla a un ganador (sin animación de sorteo)
export const mostrarEnPantalla = async (req: Request, res: Response): Promise<any> => {
    const registro = await Rifa.findByPk(Number(req.params.id), conPremio);
    if (!registro) return res.status(404).json({ msg: 'No existe ese registro' });
    actualizarEstado({ fase: registro.rfc ? 'revelado' : 'premio', ganador: aPantalla(registro) });
    return res.json(obtenerEstado());
};
