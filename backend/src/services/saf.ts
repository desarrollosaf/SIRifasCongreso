import { QueryTypes, Sequelize } from 'sequelize';
import fs from 'fs';
import path from 'path';
import sequelize from '../database/cuestionariosConnection';
import Participante from '../models/participante';
import { FOTOS_DIR, indiceFotos, normalizarRfc } from './fotos';
import { nombreCompleto, nombrePila } from './nombres';

// Copia local de los servidores públicos activos de SAF (adminplem_saf) y de sus fotos de credencial,
// para que el día del sorteo no se dependa de internet ni de la red interna.

const PLANTILLA_FOTO = process.env.FOTOS_URL_PLANTILLA
    || 'https://documentacionsaf.gob.mx/credenciales/storage/credenciales/{rfc}.jpg';

let conexion: Sequelize | null = null;
const conexionSaf = () => {
    if (!process.env.SAF_DB_HOST) throw new Error('Falta configurar SAF_DB_HOST en el archivo .env');
    if (!conexion) {
        conexion = new Sequelize(
            process.env.SAF_DB_NAME || 'adminplem_saf',
            process.env.SAF_DB_USER || 'root',
            process.env.SAF_DB_PASSWORD || '',
            {
                host: process.env.SAF_DB_HOST,
                port: Number(process.env.SAF_DB_PORT || 3306),
                dialect: 'mysql',
                logging: false,
                dialectOptions: { connectTimeout: 8000 },
            }
        );
    }
    return conexion;
};

const CONSULTA_USUARIOS = `
    SELECT u.N_Usuario AS rfc,
           u.Nombre AS nombre, u.A_Paterno AS paterno, u.A_Materno AS materno,
           dep.nombre_completo AS dependencia,
           dir.nombre_completo AS direccion
      FROM s_usuario u
      LEFT JOIN t_dependencia dep ON dep.id_Dependencia = u.id_Dependencia
      LEFT JOIN t_direccion dir ON dir.id_Direccion = u.id_Direccion
     WHERE u.Estado = 1 AND u.N_Usuario IS NOT NULL AND u.N_Usuario <> ''`;

export const probarSaf = async () => {
    const [fila]: any[] = await conexionSaf().query(
        `SELECT COUNT(*) AS activos FROM s_usuario WHERE Estado = 1`, { type: QueryTypes.SELECT });
    return { ok: true, activos: Number(fila?.activos || 0), host: process.env.SAF_DB_HOST, base: process.env.SAF_DB_NAME || 'adminplem_saf' };
};

export const importarDesdeSaf = async (modo: 'agregar' | 'reemplazar') => {
    const filas: any[] = await conexionSaf().query(CONSULTA_USUARIOS, { type: QueryTypes.SELECT });
    const unicos = new Map<string, { rfc: string; nombre: string | null; nombre_pila: string | null; area: string | null; direccion: string | null }>();
    for (const f of filas) {
        const rfc = normalizarRfc(f.rfc);
        if (!rfc || unicos.has(rfc)) continue;
        unicos.set(rfc, {
            rfc,
            nombre: nombreCompleto(f.nombre, f.paterno, f.materno) || null,
            nombre_pila: nombrePila(f.nombre, f.paterno, f.materno),
            area: f.dependencia ? String(f.dependencia).trim() : null,
            direccion: f.direccion ? String(f.direccion).trim() : null,
        });
    }
    if (unicos.size === 0) throw new Error('La consulta a SAF no devolvió usuarios activos');

    await sequelize.transaction(async (transaction) => {
        if (modo === 'reemplazar') await Participante.destroy({ where: {}, transaction });
        const lista = [...unicos.values()];
        for (let i = 0; i < lista.length; i += 500) {
            await Participante.bulkCreate(lista.slice(i, i + 500), {
                updateOnDuplicate: ['nombre', 'nombre_pila', 'area', 'direccion', 'updatedAt'],
                transaction,
            });
        }
    });
    return { importados: unicos.size, total: await Participante.count() };
};

// --- Descarga de fotos en segundo plano ---

export interface EstadoDescarga {
    activo: boolean;
    total: number;
    procesadas: number;
    descargadas: number;
    sinFoto: number;
    errores: number;
    inicio: Date | null;
    fin: Date | null;
    mensaje: string;
}

let descarga: EstadoDescarga = {
    activo: false, total: 0, procesadas: 0, descargadas: 0, sinFoto: 0, errores: 0, inicio: null, fin: null, mensaje: '',
};
let detener = false;

export const estadoDescarga = () => descarga;
export const detenerDescarga = () => { detener = true; };

type Resultado = 'ok' | 'sin-foto' | 'error';

const bajarUna = async (rfc: string): Promise<Resultado> => {
    // Las credenciales usan el RFC de 10 caracteres; si el guardado trae homoclave se intenta también sin ella
    const candidatos = [...new Set([rfc, rfc.slice(0, 10)])];
    let huboError = false;
    for (const c of candidatos) {
        try {
            const resp = await fetch(PLANTILLA_FOTO.replace('{rfc}', encodeURIComponent(c)), { signal: AbortSignal.timeout(12000) });
            if (resp.status === 404) continue;
            const tipo = resp.headers.get('content-type') || '';
            if (!resp.ok || !tipo.startsWith('image/')) { huboError = !resp.ok && resp.status >= 500; continue; }
            const datos = Buffer.from(await resp.arrayBuffer());
            if (datos.length < 1024) continue;
            const ext = tipo.includes('png') ? '.png' : tipo.includes('webp') ? '.webp' : '.jpg';
            fs.writeFileSync(path.join(FOTOS_DIR, rfc + ext), datos);
            return 'ok';
        } catch {
            huboError = true;
        }
    }
    return huboError ? 'error' : 'sin-foto';
};

export const iniciarDescarga = async (todas: boolean) => {
    if (descarga.activo) throw new Error('Ya hay una descarga en curso');
    const indice = indiceFotos();
    const rfcs = (await Participante.findAll({ attributes: ['rfc'], order: [['nombre', 'ASC']] }))
        .map(p => p.rfc)
        .filter(rfc => todas || !indice.has(rfc));

    detener = false;
    descarga = {
        activo: true, total: rfcs.length, procesadas: 0, descargadas: 0, sinFoto: 0, errores: 0,
        inicio: new Date(), fin: null, mensaje: rfcs.length ? 'Descargando…' : 'Todas las personas ya tienen foto',
    };
    if (rfcs.length === 0) { descarga.activo = false; descarga.fin = new Date(); return descarga; }

    // 6 descargas a la vez: rápido sin saturar el servidor de credenciales
    let siguiente = 0;
    const trabajador = async () => {
        while (!detener && siguiente < rfcs.length) {
            const rfc = rfcs[siguiente++];
            const r = await bajarUna(rfc);
            if (r === 'ok') descarga.descargadas++;
            else if (r === 'sin-foto') descarga.sinFoto++;
            else descarga.errores++;
            descarga.procesadas++;
        }
    };
    Promise.all(Array.from({ length: 6 }, trabajador)).finally(() => {
        descarga.activo = false;
        descarga.fin = new Date();
        descarga.mensaje = detener ? 'Descarga detenida' : 'Descarga terminada';
    });
    return descarga;
};
