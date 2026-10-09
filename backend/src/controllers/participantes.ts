import { Request, Response } from 'express';
import { Op, QueryTypes } from 'sequelize';
import { Readable } from 'stream';
import path from 'path';
import ExcelJS from 'exceljs';
import AdmZip from 'adm-zip';
import sequelize from '../database/cuestionariosConnection';
import Participante from '../models/participante';
import { borrarFoto, guardarFoto, indiceFotos, normalizarRfc, urlFoto } from '../services/fotos';
import { detenerDescarga, estadoDescarga, importarDesdeSaf, iniciarDescarga, probarSaf } from '../services/saf';
import { estadoImportSql, iniciarImportSql } from '../services/safSql';
import { getConfig } from '../models/config';
import fs from 'fs';

const csv = require('csv-parser');

const rfcsGanadores = async (): Promise<Set<string>> => {
    const filas: any[] = await sequelize.query(
        `SELECT DISTINCT rfc FROM rifa WHERE estatus <> 'cancelado' AND rfc IS NOT NULL`,
        { type: QueryTypes.SELECT }
    );
    return new Set(filas.map(f => f.rfc));
};

export const listarParticipantes = async (req: Request, res: Response): Promise<any> => {
    const q = String(req.query.q || '').trim();
    const limite = Math.min(Number(req.query.limite) || 50, 500);
    const pagina = Math.max(Number(req.query.pagina) || 1, 1);
    const filtroFoto = String(req.query.foto || '');
    const where = q ? {
        [Op.or]: [
            { rfc: { [Op.like]: `%${q}%` } },
            { nombre: { [Op.like]: `%${q}%` } },
            { area: { [Op.like]: `%${q}%` } },
            { direccion: { [Op.like]: `%${q}%` } },
        ],
    } : {};

    const indice = indiceFotos();
    const ganadores = await rfcsGanadores();
    let filas = (await Participante.findAll({ where, order: [['nombre', 'ASC']] })).map(p => ({
        ...p.toJSON(),
        fotoUrl: urlFoto(p.rfc, indice),
        gano: ganadores.has(p.rfc),
    }));
    if (filtroFoto === 'con') filas = filas.filter(f => f.fotoUrl);
    if (filtroFoto === 'sin') filas = filas.filter(f => !f.fotoUrl);

    const total = await Participante.count();
    const conFoto = (await Participante.findAll({ attributes: ['rfc'] })).filter(p => indice.has(p.rfc)).length;

    return res.json({
        total,
        conFoto,
        fotosSinParticipante: [...indice.keys()].length - conFoto,
        filtrados: filas.length,
        pagina,
        limite,
        datos: filas.slice((pagina - 1) * limite, pagina * limite),
    });
};

const leerDatos = (body: any) => {
    const rfc = normalizarRfc(body?.rfc);
    if (!rfc) throw new Error('El RFC es obligatorio');
    const texto = (v: any) => String(v ?? '').trim() || null;
    return { rfc, nombre: texto(body?.nombre), area: texto(body?.area), direccion: texto(body?.direccion) };
};

export const crearParticipante = async (req: Request, res: Response): Promise<any> => {
    try {
        const datos = leerDatos(req.body);
        if (await Participante.findOne({ where: { rfc: datos.rfc } })) {
            return res.status(409).json({ msg: 'Ya existe un participante con ese RFC' });
        }
        return res.json(await Participante.create(datos));
    } catch (e: any) {
        return res.status(400).json({ msg: e.message });
    }
};

export const actualizarParticipante = async (req: Request, res: Response): Promise<any> => {
    try {
        const participante = await Participante.findByPk(Number(req.params.id));
        if (!participante) return res.status(404).json({ msg: 'No existe ese participante' });
        const datos = leerDatos(req.body);
        const duplicado = await Participante.findOne({ where: { rfc: datos.rfc, id: { [Op.ne]: participante.id } } });
        if (duplicado) return res.status(409).json({ msg: 'Ya existe otro participante con ese RFC' });
        return res.json(await participante.update(datos));
    } catch (e: any) {
        return res.status(400).json({ msg: e.message });
    }
};

export const eliminarParticipante = async (req: Request, res: Response): Promise<any> => {
    const participante = await Participante.findByPk(Number(req.params.id));
    if (!participante) return res.status(404).json({ msg: 'No existe ese participante' });
    await participante.destroy();
    return res.json({ msg: 'Participante eliminado' });
};

// --- Importar Excel / CSV ---

const columna = (encabezados: string[], opciones: RegExp) => encabezados.findIndex(h => opciones.test(h));

const quitarAcentos = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

const aFilas = (encabezados: string[], filas: string[][]) => {
    const enc = encabezados.map(h => quitarAcentos(String(h || '').trim().toLowerCase()));
    const iRfc = columna(enc, /rfc/);
    const iNombre = columna(enc, /nombre|name/);
    const iArea = columna(enc, /dependencia|area|adscripcion|departamento|unidad/);
    const iDireccion = enc.findIndex((h, i) => i !== iArea && /direccion/.test(h));
    if (iRfc < 0) throw new Error('No encontré una columna "RFC" en el archivo');
    const texto = (f: string[], i: number) => i >= 0 ? String(f[i] ?? '').trim() || null : null;
    return filas.map(f => ({
        rfc: normalizarRfc(f[iRfc]),
        nombre: texto(f, iNombre),
        area: texto(f, iArea),
        direccion: texto(f, iDireccion),
    }));
};

const leerExcel = async (buffer: Buffer) => {
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(buffer as any);
    const hoja = libro.worksheets[0];
    if (!hoja) throw new Error('El archivo de Excel no tiene hojas');
    const filas: string[][] = [];
    hoja.eachRow({ includeEmpty: false }, fila => {
        const valores: string[] = [];
        for (let i = 1; i <= hoja.columnCount; i++) valores.push(fila.getCell(i).text ?? '');
        filas.push(valores);
    });
    if (filas.length === 0) throw new Error('El archivo está vacío');
    return aFilas(filas[0], filas.slice(1));
};

type FilaImport = { rfc: string; nombre: string | null; area: string | null; direccion: string | null };

const leerCsv = (buffer: Buffer): Promise<FilaImport[]> => {
    const texto = buffer.toString('utf8').replace(/^﻿/, '');
    const primeraLinea = texto.split(/\r?\n/)[0] || '';
    const separador = (primeraLinea.match(/;/g) || []).length > (primeraLinea.match(/,/g) || []).length ? ';' : ',';
    return new Promise((resolve, reject) => {
        let encabezados: string[] = [];
        const filas: string[][] = [];
        Readable.from([texto])
            .pipe(csv({ separator: separador, headers: false }))
            .on('data', (fila: Record<string, string>) => {
                const valores = Object.values(fila);
                if (encabezados.length === 0) encabezados = valores;
                else filas.push(valores);
            })
            .on('end', () => {
                try { resolve(aFilas(encabezados, filas)); } catch (e) { reject(e); }
            })
            .on('error', reject);
    });
};

export const importarParticipantes = async (req: Request, res: Response): Promise<any> => {
    const archivo = (req as any).file as Express.Multer.File | undefined;
    const modo = req.body?.modo === 'reemplazar' ? 'reemplazar' : 'agregar';
    if (!archivo) return res.status(400).json({ msg: 'Selecciona un archivo Excel o CSV' });
    try {
        const ext = path.extname(archivo.originalname).toLowerCase();
        const filas = ext === '.csv' || ext === '.txt' ? await leerCsv(archivo.buffer) : await leerExcel(archivo.buffer);

        const unicos = new Map<string, FilaImport>();
        let sinRfc = 0;
        filas.forEach(f => { if (!f.rfc) sinRfc++; else if (!unicos.has(f.rfc)) unicos.set(f.rfc, f); });
        const duplicadosEnArchivo = filas.length - sinRfc - unicos.size;

        await sequelize.transaction(async (transaction) => {
            if (modo === 'reemplazar') await Participante.destroy({ where: {}, transaction });
            const lista = [...unicos.values()];
            for (let i = 0; i < lista.length; i += 500) {
                await Participante.bulkCreate(lista.slice(i, i + 500), {
                    updateOnDuplicate: ['nombre', 'area', 'direccion', 'updatedAt'],
                    transaction,
                });
            }
        });

        return res.json({
            msg: `Importación completa (${modo})`,
            importados: unicos.size,
            sinRfc,
            duplicadosEnArchivo,
            total: await Participante.count(),
        });
    } catch (e: any) {
        return res.status(400).json({ msg: e.message || 'No se pudo leer el archivo' });
    }
};

// --- Fotos ---

export const subirFotos = async (req: Request, res: Response): Promise<any> => {
    const archivos = ((req as any).files || []) as Express.Multer.File[];
    if (archivos.length === 0) return res.status(400).json({ msg: 'Selecciona fotos (RFC.jpg) o un .zip' });
    const guardadas: string[] = [];
    const rechazadas: string[] = [];
    const procesar = (nombre: string, contenido: Buffer) => {
        const rfc = guardarFoto(nombre, contenido);
        if (rfc) guardadas.push(rfc); else rechazadas.push(path.basename(nombre));
    };
    for (const archivo of archivos) {
        if (path.extname(archivo.originalname).toLowerCase() === '.zip') {
            try {
                new AdmZip(archivo.buffer).getEntries()
                    .filter(e => !e.isDirectory && !e.entryName.startsWith('__MACOSX'))
                    .forEach(e => procesar(e.entryName, e.getData()));
            } catch {
                rechazadas.push(archivo.originalname);
            }
        } else {
            procesar(archivo.originalname, archivo.buffer);
        }
    }
    const registrados = new Set((await Participante.findAll({ attributes: ['rfc'] })).map(p => p.rfc));
    return res.json({
        msg: `${guardadas.length} foto(s) guardada(s)`,
        guardadas: guardadas.length,
        sinParticipante: guardadas.filter(r => !registrados.has(r)),
        rechazadas,
    });
};

export const eliminarFoto = async (req: Request, res: Response): Promise<any> => {
    borrarFoto(String(req.params.rfc));
    return res.json({ msg: 'Foto eliminada' });
};

// --- Sincronización con SAF (usuarios y fotos de credencial) ---

export const safProbar = async (req: Request, res: Response): Promise<any> => {
    try {
        const config = await getConfig();
        return res.json({ ...(await probarSaf()), actualizado: config['saf_actualizado'] || null, archivo: config['saf_archivo'] || null });
    } catch (e: any) {
        return res.status(502).json({ msg: `La base de usuarios todavía no está cargada: ${e?.message || e}` });
    }
};

export const safImportar = async (req: Request, res: Response): Promise<any> => {
    const modo = req.body?.modo === 'reemplazar' ? 'reemplazar' : 'agregar';
    try {
        const r = await importarDesdeSaf(modo);
        return res.json({ msg: `${r.importados} servidores públicos importados desde SAF (${modo})`, ...r });
    } catch (e: any) {
        return res.status(502).json({ msg: `No se pudo importar desde SAF: ${e?.message || e}` });
    }
};

export const fotosDescargar = async (req: Request, res: Response): Promise<any> => {
    try {
        return res.json(await iniciarDescarga(req.body?.todas === true));
    } catch (e: any) {
        return res.status(409).json({ msg: e.message });
    }
};

export const fotosEstado = (req: Request, res: Response): any => res.json(estadoDescarga());

export const fotosDetener = (req: Request, res: Response): any => {
    detenerDescarga();
    return res.json(estadoDescarga());
};

export const safSubirSql = async (req: Request, res: Response): Promise<any> => {
    const archivo = (req as any).file as Express.Multer.File | undefined;
    if (!archivo) return res.status(400).json({ msg: 'Selecciona el archivo .sql (también .sql.gz o .zip)' });
    if (!/\.(sql|gz|zip)$/i.test(archivo.originalname)) {
        fs.unlink(archivo.path, () => undefined);
        return res.status(400).json({ msg: 'El archivo debe ser .sql, .sql.gz o .zip' });
    }
    const modo = req.body?.modo === 'agregar' ? 'agregar' : 'reemplazar';
    try {
        return res.json(await iniciarImportSql(archivo.path, archivo.originalname, modo));
    } catch (e: any) {
        fs.unlink(archivo.path, () => undefined);
        return res.status(409).json({ msg: e.message });
    }
};

export const safEstadoSql = (req: Request, res: Response): any => res.json(estadoImportSql());
