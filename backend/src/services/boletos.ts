import { QueryTypes } from 'sequelize';
import { conexionSaf } from './saf';
import { nombrePila } from './nombres';

// Quien no aparece en SAF no tiene RFC: se identifica con una clave interna hecha con su boleto.
// Sin guiones para que también sirva como nombre de archivo de la foto (BOLETO0007.jpg).
export const claveBoleto = (boleto: number) => `BOLETO${String(boleto).padStart(4, '0')}`;
export const esClaveBoleto = (rfc: string | null | undefined) => /^BOLETO\d+$/.test(rfc || '');
export const rfcVisible = (rfc: string | null | undefined) => (!rfc || esClaveBoleto(rfc) ? '' : rfc);

// null = vacío; NaN = no es un número de boleto válido
export const leerBoleto = (v: any): number | null => {
    const t = String(v ?? '').trim();
    if (!t) return null;
    return /^\d{1,9}$/.test(t) && Number(t) > 0 ? Number(t) : NaN;
};

const normalizar = (s: any) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase().replace(/[^A-Z ]/g, ' ').replace(/\s+/g, ' ').trim();

export interface DatosSaf { rfc: string; nombrePila: string | null }

// Devuelve una función que busca en SAF por nombre completo. El orden de las palabras debe coincidir
// (GARCIA LOPEZ JUAN no es LOPEZ GARCIA JUAN) y, si hay homónimos, no se elige a nadie.
export const buscadorSaf = async () => {
    const filas: any[] = await conexionSaf().query(
        `SELECT N_Usuario AS rfc, Nombre AS nombre, A_Paterno AS paterno, A_Materno AS materno, Estado AS estado
           FROM s_usuario WHERE N_Usuario IS NOT NULL AND N_Usuario <> ''`, { type: QueryTypes.SELECT });
    const indice = new Map<string, Map<string, { activo: boolean; pila: string | null }>>();
    for (const f of filas) {
        const n = normalizar(f.nombre), p = normalizar(f.paterno), m = normalizar(f.materno);
        const claves = new Set([`${p} ${m} ${n}`, `${n} ${p} ${m}`].map(normalizar));
        if (p && n.startsWith(p + ' ')) claves.add(n); // "Nombre" ya trae los apellidos
        const rfc = String(f.rfc).trim().toUpperCase().replace(/\s+/g, '');
        for (const c of claves) {
            if (!c) continue;
            if (!indice.has(c)) indice.set(c, new Map());
            indice.get(c)!.set(rfc, { activo: Number(f.estado) === 1, pila: nombrePila(f.nombre, f.paterno, f.materno) });
        }
    }
    return (nombre: string | null): DatosSaf | null => {
        const todos = [...(indice.get(normalizar(nombre)) || [])];
        const activos = todos.filter(([, d]) => d.activo);
        const candidatos = activos.length ? activos : todos;
        return candidatos.length === 1 ? { rfc: candidatos[0][0], nombrePila: candidatos[0][1].pila } : null;
    };
};
