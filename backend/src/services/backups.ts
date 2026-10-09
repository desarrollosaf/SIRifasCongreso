import fs from 'fs';
import path from 'path';
import sequelize from '../database/cuestionariosConnection';
import Regalos from '../models/regalos';
import Rifa from '../models/rifa';
import Participante from '../models/participante';
import Config from '../models/config';

export const BACKUPS_DIR = process.env.BACKUPS_DIR || path.join(process.cwd(), 'backups');
const MAX_AUTOMATICOS = Number(process.env.MAX_RESPALDOS_AUTO || 30);

fs.mkdirSync(BACKUPS_DIR, { recursive: true });

export type TipoRespaldo = 'manual' | 'auto' | 'pre-reinicio' | 'pre-restauracion' | 'subido';

const marcaTiempo = () => {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`;
};

export const nombreValido = (archivo: string) => /^respaldo_[\w-]+\.json$/.test(archivo);

const nombreLibre = (tipo: TipoRespaldo) => {
    let archivo = `respaldo_${tipo}_${marcaTiempo()}.json`;
    let n = 1;
    while (fs.existsSync(path.join(BACKUPS_DIR, archivo))) archivo = `respaldo_${tipo}_${marcaTiempo()}_${n++}.json`;
    return archivo;
};

export const crearRespaldo = async (tipo: TipoRespaldo = 'manual') => {
    const contenido = {
        version: 1,
        creado: new Date().toISOString(),
        tipo,
        premios: await Regalos.findAll({ raw: true }),
        participantes: await Participante.findAll({ raw: true }),
        ganadores: await Rifa.findAll({ raw: true }),
        config: await Config.findAll({ raw: true }),
    };
    const archivo = nombreLibre(tipo);
    fs.writeFileSync(path.join(BACKUPS_DIR, archivo), JSON.stringify(contenido, null, 2));
    if (tipo === 'auto') podarAutomaticos();
    return archivo;
};

const podarAutomaticos = () => {
    const autos = listarRespaldos().filter(r => r.tipo === 'auto');
    autos.slice(MAX_AUTOMATICOS).forEach(r => fs.unlinkSync(path.join(BACKUPS_DIR, r.archivo)));
};

export const listarRespaldos = () => fs.readdirSync(BACKUPS_DIR)
    .filter(nombreValido)
    .map(archivo => {
        const stat = fs.statSync(path.join(BACKUPS_DIR, archivo));
        const tipo = archivo.replace(/^respaldo_/, '').split('_')[0];
        return { archivo, tipo, bytes: stat.size, fecha: stat.mtime };
    })
    .sort((a, b) => b.fecha.getTime() - a.fecha.getTime());

const validar = (datos: any) => {
    if (!datos || !Array.isArray(datos.premios) || !Array.isArray(datos.ganadores)) {
        throw new Error('El archivo no es un respaldo válido');
    }
    return datos;
};

export const leerRespaldo = (archivo: string) =>
    validar(JSON.parse(fs.readFileSync(path.join(BACKUPS_DIR, archivo), 'utf8')));

// Guarda un respaldo subido desde el admin (se valida antes de aceptarlo)
export const guardarRespaldoSubido = (contenido: Buffer) => {
    validar(JSON.parse(contenido.toString('utf8')));
    const archivo = nombreLibre('subido');
    fs.writeFileSync(path.join(BACKUPS_DIR, archivo), contenido);
    return archivo;
};

const conFechas = (filas: any[], campos: string[]) => filas.map(f => {
    const fila = { ...f };
    campos.forEach(c => { if (fila[c]) fila[c] = new Date(fila[c]); });
    return fila;
});

// Reemplaza todo el contenido por el del respaldo (en una transacción)
export const restaurarRespaldo = async (archivo: string) => {
    const datos = leerRespaldo(archivo);
    await crearRespaldo('pre-restauracion');
    await sequelize.transaction(async (transaction) => {
        await Rifa.destroy({ where: {}, transaction });
        await Participante.destroy({ where: {}, transaction });
        await Regalos.destroy({ where: {}, transaction });
        await Config.destroy({ where: {}, transaction });
        await Regalos.bulkCreate(conFechas(datos.premios, ['createdAt', 'updatedAt']), { transaction });
        await Participante.bulkCreate(conFechas(datos.participantes || [], ['createdAt', 'updatedAt']), { transaction });
        await Rifa.bulkCreate(conFechas(datos.ganadores, ['createdAt', 'updatedAt', 'confirmadoAt']), { transaction });
        if (Array.isArray(datos.config)) await Config.bulkCreate(datos.config, { transaction });
    });
};
