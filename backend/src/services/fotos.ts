import fs from 'fs';
import path from 'path';

export const FOTOS_DIR = process.env.FOTOS_DIR || path.join(process.cwd(), 'storage', 'fotos');
export const PREMIOS_DIR = process.env.PREMIOS_DIR || path.join(process.cwd(), 'storage', 'premios');
export const EXTENSIONES_FOTO = ['.jpg', '.jpeg', '.png', '.webp'];

export const normalizarRfc = (rfc: any): string => String(rfc ?? '').trim().toUpperCase().replace(/\s+/g, '');

fs.mkdirSync(FOTOS_DIR, { recursive: true });
fs.mkdirSync(PREMIOS_DIR, { recursive: true });

// Mapa RFC -> nombre de archivo (las fotos se llaman RFC.jpg, sin importar mayúsculas)
export const indiceFotos = (): Map<string, string> => {
    const indice = new Map<string, string>();
    for (const archivo of fs.readdirSync(FOTOS_DIR)) {
        const ext = path.extname(archivo).toLowerCase();
        if (!EXTENSIONES_FOTO.includes(ext)) continue;
        indice.set(normalizarRfc(path.basename(archivo, path.extname(archivo))), archivo);
    }
    return indice;
};

// URL relativa al backend (el frontend le antepone el endpoint)
export const urlFoto = (rfc: string | null, indice: Map<string, string> = indiceFotos()): string | null => {
    const archivo = indice.get(normalizarRfc(rfc));
    if (!archivo) return null;
    const v = Math.floor(fs.statSync(path.join(FOTOS_DIR, archivo)).mtimeMs);
    return `storage/fotos/${encodeURIComponent(archivo)}?v=${v}`;
};

// Guarda una foto como RFC.ext (el RFC sale del nombre del archivo), reemplazando otras extensiones
export const guardarFoto = (nombreOriginal: string, contenido: Buffer): string | null => {
    const base = path.basename(nombreOriginal);
    const ext = path.extname(base).toLowerCase();
    if (!EXTENSIONES_FOTO.includes(ext)) return null;
    const rfc = normalizarRfc(path.basename(base, path.extname(base)));
    if (!rfc || !/^[A-ZÑ&0-9]+$/.test(rfc)) return null;
    for (const e of EXTENSIONES_FOTO) {
        const previo = path.join(FOTOS_DIR, rfc + e);
        if (fs.existsSync(previo)) fs.unlinkSync(previo);
    }
    fs.writeFileSync(path.join(FOTOS_DIR, rfc + (ext === '.jpeg' ? '.jpg' : ext)), contenido);
    return rfc;
};

export const borrarFoto = (rfc: string) => {
    for (const e of EXTENSIONES_FOTO) {
        const archivo = path.join(FOTOS_DIR, normalizarRfc(rfc) + e);
        if (fs.existsSync(archivo)) fs.unlinkSync(archivo);
    }
};
