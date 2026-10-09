import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { Readable, Transform } from 'stream';
import AdmZip from 'adm-zip';
import { QueryTypes, Sequelize } from 'sequelize';
import Config from '../models/config';
import { importarDesdeSaf } from './saf';

// Reemplaza la copia local de la base de usuarios (adminplem_saf) con un .sql exportado de SAF.
// Se carga primero en una base temporal y solo si trae s_usuario se cambia por la anterior.

const BASE_SAF = () => process.env.SAF_DB_NAME || 'adminplem_saf';
const BASE_TEMPORAL = 'saf_importacion_tmp';

export interface EstadoImportSql {
    activo: boolean;
    etapa: string;
    mensaje: string;
    error: boolean;
    usuarios: number;
    inicio: Date | null;
    fin: Date | null;
}

let estado: EstadoImportSql = { activo: false, etapa: '', mensaje: '', error: false, usuarios: 0, inicio: null, fin: null };
export const estadoImportSql = () => estado;

const conexionRaiz = () => new Sequelize('mysql', process.env.SAF_DB_USER || 'root', process.env.SAF_DB_PASSWORD || '', {
    host: process.env.SAF_DB_HOST,
    port: Number(process.env.SAF_DB_PORT || 3306),
    dialect: 'mysql',
    logging: false,
    pool: { max: 1, min: 0 }, // una sola conexión: SET FOREIGN_KEY_CHECKS aplica a la misma sesión
});

// Quita "CREATE DATABASE" y "USE ..." del respaldo para que todo caiga en la base temporal
const filtroLineas = () => {
    let resto = '';
    const util = (linea: string) => !/^\s*(CREATE\s+DATABASE|USE\s+)/i.test(linea);
    return new Transform({
        transform(trozo, _enc, listo) {
            const texto = resto + trozo.toString('utf8');
            const lineas = texto.split('\n');
            resto = lineas.pop() ?? '';
            listo(null, lineas.filter(util).map(l => l + '\n').join(''));
        },
        flush(listo) { listo(null, util(resto) ? resto : ''); },
    });
};

const abrirRespaldo = (archivo: string, nombreOriginal: string): Readable => {
    const nombre = nombreOriginal.toLowerCase();
    if (nombre.endsWith('.zip')) {
        const entrada = new AdmZip(archivo).getEntries().find(e => !e.isDirectory && e.entryName.toLowerCase().endsWith('.sql'));
        if (!entrada) throw new Error('El .zip no contiene ningún archivo .sql');
        return Readable.from([entrada.getData()]);
    }
    const flujo = fs.createReadStream(archivo);
    return nombre.endsWith('.gz') ? flujo.pipe(zlib.createGunzip()) : flujo;
};

const cargarEnTemporal = (origen: Readable) => new Promise<void>((resolve, reject) => {
    const cliente = spawn('mariadb', [
        '-h', process.env.SAF_DB_HOST || 'db',
        '-P', String(process.env.SAF_DB_PORT || 3306),
        '-u', process.env.SAF_DB_USER || 'root',
        '--default-character-set=utf8mb4',
        '--max-allowed-packet=1G',
        '--skip-ssl',
        BASE_TEMPORAL,
    ], { env: { ...process.env, MYSQL_PWD: process.env.SAF_DB_PASSWORD || '' } });
    let errores = '';
    cliente.stderr.on('data', d => { errores += d.toString(); });
    cliente.on('error', reject);
    cliente.on('close', codigo => {
        if (codigo === 0) resolve();
        else reject(new Error(errores.trim().split('\n').slice(-3).join(' ') || `El cliente terminó con código ${codigo}`));
    });
    origen.on('error', reject);
    origen.pipe(filtroLineas()).pipe(cliente.stdin);
});

export const iniciarImportSql = async (archivo: string, nombreOriginal: string, modo: 'agregar' | 'reemplazar') => {
    if (estado.activo) throw new Error('Ya hay una importación en curso');
    if (!process.env.SAF_DB_HOST) throw new Error('Falta configurar SAF_DB_HOST');
    estado = { activo: true, etapa: 'preparando', mensaje: 'Preparando…', error: false, usuarios: 0, inicio: new Date(), fin: null };

    const ejecutar = async () => {
        const raiz = conexionRaiz();
        try {
            await raiz.query(`DROP DATABASE IF EXISTS \`${BASE_TEMPORAL}\``);
            await raiz.query(`CREATE DATABASE \`${BASE_TEMPORAL}\` CHARACTER SET utf8mb4`);

            estado.etapa = 'importando';
            estado.mensaje = `Cargando ${nombreOriginal}… (puede tardar unos minutos)`;
            await cargarEnTemporal(abrirRespaldo(archivo, nombreOriginal));

            estado.etapa = 'validando';
            estado.mensaje = 'Validando que el respaldo traiga s_usuario…';
            const tablas: any[] = await raiz.query(
                `SELECT TABLE_NAME AS t FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'`,
                { replacements: [BASE_TEMPORAL], type: QueryTypes.SELECT });
            const nombres = tablas.map(t => t.t);
            if (!nombres.includes('s_usuario')) {
                throw new Error('El archivo no trae la tabla s_usuario. Exporta la base adminplem_saf (o al menos s_usuario, t_dependencia y t_direccion).');
            }
            const [cuenta]: any[] = await raiz.query(
                `SELECT COUNT(*) AS n FROM \`${BASE_TEMPORAL}\`.s_usuario WHERE Estado = 1`, { type: QueryTypes.SELECT });
            if (!Number(cuenta?.n)) throw new Error('s_usuario no tiene usuarios activos (Estado = 1)');

            estado.etapa = 'reemplazando';
            estado.mensaje = 'Reemplazando la base de usuarios…';
            const base = BASE_SAF();
            await raiz.query(`CREATE DATABASE IF NOT EXISTS \`${base}\` CHARACTER SET utf8mb4`);
            const anteriores: any[] = await raiz.query(
                `SELECT TABLE_NAME AS t, TABLE_TYPE AS tipo FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?`,
                { replacements: [base], type: QueryTypes.SELECT });
            await raiz.query('SET FOREIGN_KEY_CHECKS = 0');
            for (const a of anteriores) {
                await raiz.query(`DROP ${a.tipo === 'VIEW' ? 'VIEW' : 'TABLE'} IF EXISTS \`${base}\`.\`${a.t}\``);
            }
            await raiz.query('RENAME TABLE ' + nombres.map(n => `\`${BASE_TEMPORAL}\`.\`${n}\` TO \`${base}\`.\`${n}\``).join(', '));
            await raiz.query('SET FOREIGN_KEY_CHECKS = 1');
            await raiz.query(`DROP DATABASE IF EXISTS \`${BASE_TEMPORAL}\``);

            estado.etapa = 'participantes';
            estado.mensaje = 'Actualizando la lista de participantes del sorteo…';
            const r = await importarDesdeSaf(modo);
            estado.usuarios = r.importados;

            await Config.upsert({ clave: 'saf_actualizado', valor: new Date().toISOString() });
            await Config.upsert({ clave: 'saf_archivo', valor: nombreOriginal });
            estado.etapa = 'listo';
            estado.mensaje = `Listo: base de usuarios actualizada con ${nombreOriginal}. ${r.importados} servidores públicos activos en el sorteo (total ${r.total}).`;
        } catch (e: any) {
            estado.error = true;
            estado.mensaje = `No se pudo importar: ${e?.message || e}`;
            await raiz.query(`DROP DATABASE IF EXISTS \`${BASE_TEMPORAL}\``).catch(() => undefined);
        } finally {
            await raiz.close().catch(() => undefined);
            fs.unlink(archivo, () => undefined);
            estado.activo = false;
            estado.fin = new Date();
        }
    };
    ejecutar();
    return estado;
};

export const carpetaSubidas = () => {
    const dir = path.join(process.env.BACKUPS_DIR || path.join(process.cwd(), 'backups'), 'subidas-sql');
    fs.mkdirSync(dir, { recursive: true });
    return dir;
};
