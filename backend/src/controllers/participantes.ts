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
import { DatosSaf, buscadorSaf, claveBoleto, esClaveBoleto, leerBoleto } from '../services/boletos';
import Rifa from '../models/rifa';
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
            ...(/^\d{1,9}$/.test(q) ? [{ boleto: Number(q) }] : []),
            { rfc: { [Op.like]: `%${q}%` } },
            { nombre: { [Op.like]: `%${q}%` } },
            { area: { [Op.like]: `%${q}%` } },
            { direccion: { [Op.like]: `%${q}%` } },
        ],
    } : {};

    const indice = indiceFotos();
    const ganadores = await rfcsGanadores();
    let filas = (await Participante.findAll({ where, order: [['boleto', 'ASC'], ['nombre', 'ASC']] })).map(p => ({
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
    const boleto = leerBoleto(body?.boleto);
    if (Number.isNaN(boleto)) throw new Error('El boleto debe ser un número mayor a 0');
    const rfc = normalizarRfc(body?.rfc) || (boleto ? claveBoleto(boleto) : '');
    if (!rfc) throw new Error('Captura el boleto o el RFC');
    const texto = (v: any) => String(v ?? '').trim() || null;
    return { rfc, boleto, nombre: texto(body?.nombre), area: texto(body?.area), direccion: texto(body?.direccion) };
};

export const crearParticipante = async (req: Request, res: Response): Promise<any> => {
    try {
        const datos = leerDatos(req.body);
        if (await Participante.findOne({ where: { rfc: datos.rfc } })) {
            return res.status(409).json({ msg: 'Ya existe un participante con ese RFC' });
        }
        if (datos.boleto && await Participante.findOne({ where: { boleto: datos.boleto } })) {
            return res.status(409).json({ msg: `El boleto ${datos.boleto} ya está asignado` });
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
        if (datos.boleto && await Participante.findOne({ where: { boleto: datos.boleto, id: { [Op.ne]: participante.id } } })) {
            return res.status(409).json({ msg: `El boleto ${datos.boleto} ya está asignado` });
        }
        await sequelize.transaction(async (transaction) => {
            // Si cambia el RFC, sus premios ganados se van con la persona
            if (datos.rfc !== participante.rfc) {
                await Rifa.update({ rfc: datos.rfc }, { where: { rfc: participante.rfc }, transaction });
            }
            // El nombre de pila se recalcula si cambió el nombre
            await participante.update(datos.nombre !== participante.nombre ? { ...datos, nombre_pila: null } : datos, { transaction });
        });
        return res.json(participante);
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
    const iDireccion = enc.findIndex((h, i) => i !== iArea && /direccion|adscripcion/.test(h));
    const iBoleto = [/boleto/, /^folio$/, /^(no|num|numero|#)\.?$/].map(r => columna(enc, r)).find(i => i >= 0) ?? -1;
    if (iRfc < 0 && iBoleto < 0) throw new Error('No encontré una columna "Boleto" (o "No.") ni "RFC" en el archivo');
    const texto = (f: string[], i: number) => i >= 0 ? String(f[i] ?? '').trim() || null : null;
    return filas.filter(f => f.some(v => String(v ?? '').trim())).map(f => ({
        rfc: iRfc >= 0 ? normalizarRfc(f[iRfc]) : '',
        boleto: iBoleto >= 0 ? leerBoleto(f[iBoleto]) : null,
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

type FilaImport = { rfc: string; boleto: number | null; nombre: string | null; area: string | null; direccion: string | null };

const leerCsv = (buffer: Buffer): Promise<FilaImport[]> => {
    // Excel en español suele guardar el CSV en Windows-1252: si no es UTF-8 válido se lee así (para no perder Ñ y acentos)
    let texto: string;
    try { texto = new TextDecoder('utf-8', { fatal: true }).decode(buffer); }
    catch { texto = new TextDecoder('windows-1252').decode(buffer); }
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

        const invalidos = filas.filter(f => Number.isNaN(f.boleto)).length;
        if (invalidos) throw new Error(`${invalidos} fila(s) traen un número de boleto que no es válido`);

        const conBoleto = filas.filter(f => f.boleto !== null);
        const vistos = new Set<number>();
        const repetidos = new Set<number>();
        conBoleto.forEach(f => vistos.has(f.boleto!) ? repetidos.add(f.boleto!) : vistos.add(f.boleto!));
        if (repetidos.size) throw new Error(`Hay boletos repetidos en el archivo: ${[...repetidos].slice(0, 10).join(', ')}`);
        if (modo === 'reemplazar' && !conBoleto.length && await Participante.count({ where: { boleto: { [Op.ne]: null } } })) {
            throw new Error('El archivo no trae columna de boleto y reemplazaría la lista de boletos actual');
        }

        // Sin RFC en el archivo: se busca en SAF por nombre; quien no aparezca participa con su boleto
        let buscar: (nombre: string | null) => DatosSaf | null = () => null;
        let avisoSaf = '';
        if (conBoleto.some(f => !f.rfc)) {
            try { buscar = await buscadorSaf(); }
            catch { avisoSaf = 'No se pudo consultar SAF: se importó sin RFC'; }
        }
        const unicos = new Map<string, FilaImport & { nombre_pila: string | null }>();
        let sinRfc = 0, duplicadosEnArchivo = 0, vinculados = 0, sinVincular = 0;
        for (const f of filas) {
            let rfc = f.rfc, pila: string | null = null;
            if (!rfc && f.boleto) {
                const saf = buscar(f.nombre);
                if (saf && !unicos.has(saf.rfc)) { rfc = saf.rfc; pila = saf.nombrePila; vinculados++; }
                else { rfc = claveBoleto(f.boleto); sinVincular++; }
            }
            if (!rfc) { sinRfc++; continue; }
            if (unicos.has(rfc)) {
                if (f.boleto) throw new Error(`El RFC ${rfc} aparece con más de un boleto`);
                duplicadosEnArchivo++;
                continue;
            }
            unicos.set(rfc, { ...f, rfc, nombre_pila: pila });
        }

        await sequelize.transaction(async (transaction) => {
            if (modo === 'reemplazar') await Participante.destroy({ where: {}, transaction });
            // Libera los boletos del archivo para que no choquen con sus dueños anteriores
            else if (vistos.size) await Participante.update({ boleto: null }, { where: { boleto: [...vistos] }, transaction });
            const lista = [...unicos.values()];
            for (let i = 0; i < lista.length; i += 500) {
                await Participante.bulkCreate(lista.slice(i, i + 500), {
                    updateOnDuplicate: [
                        'nombre', 'nombre_pila', 'area', 'direccion', 'updatedAt',
                        ...(conBoleto.length ? ['boleto' as const] : []),
                    ],
                    transaction,
                });
            }
            // Claves internas que se quedaron sin boleto (la persona ya tiene RFC o cambió de número)
            if (vistos.size) {
                const huerfanos = (await Participante.findAll({ where: { boleto: null }, transaction })).filter(p => esClaveBoleto(p.rfc));
                await Participante.destroy({ where: { id: huerfanos.map(p => p.id) }, transaction });
            }
        });

        return res.json({
            msg: `Importación completa (${modo})`,
            importados: unicos.size,
            conBoleto: conBoleto.length,
            vinculados,
            sinVincular,
            avisoSaf,
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
        return res.json({
            msg: r.soloVinculados
                ? `La lista de boletos se conservó; ${r.importados} RFC completados desde SAF`
                : `${r.importados} servidores públicos importados desde SAF (${modo})`,
            ...r,
        });
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
