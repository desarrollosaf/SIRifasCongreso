import { Response } from 'express';

// espera → sorteando (gira la ruleta) → premio (salió el premio, falta el ganador) → revelado (ganador con foto)
export type Fase = 'espera' | 'sorteando' | 'premio' | 'revelado';

export interface GanadorPantalla {
    id: number;
    rfc: string | null;
    nombre: string | null;
    nombrePila: string | null;
    area: string | null;
    fotoUrl: string | null;
    estatus: string;
    premio: { id: number; premio: string | null; path: string | null } | null;
}

export interface EstadoSorteo {
    fase: Fase;
    ganador: GanadorPantalla | null;
    restantes: number;
    evento: Record<string, string>;
    ts: number;
}

// Duración de la animación de "sorteando" antes de revelar al ganador
export const DURACION_SORTEO_MS = Number(process.env.DURACION_SORTEO_MS || 3000);

let estado: EstadoSorteo = { fase: 'espera', ganador: null, restantes: 0, evento: {}, ts: Date.now() };
const clientes = new Set<Response>();
let temporizador: NodeJS.Timeout | null = null;

export const obtenerEstado = () => estado;

const emitir = () => {
    const datos = `data: ${JSON.stringify(estado)}\n\n`;
    clientes.forEach(c => c.write(datos));
};

export const actualizarEstado = (cambios: Partial<EstadoSorteo>) => {
    estado = { ...estado, ...cambios, ts: Date.now() };
    emitir();
};

// La pantalla pública anima "sorteando" y el servidor decide cuándo revelar,
// así todas las pantallas conectadas quedan sincronizadas
export const iniciarSorteoEnPantalla = (ganador: GanadorPantalla, restantes: number) => {
    if (temporizador) clearTimeout(temporizador);
    actualizarEstado({ fase: 'sorteando', ganador, restantes });
    temporizador = setTimeout(() => {
        temporizador = null;
        if (estado.ganador?.id === ganador.id) actualizarEstado({ fase: ganador.rfc ? 'revelado' : 'premio' });
    }, DURACION_SORTEO_MS);
};

export const limpiarPantalla = (restantes?: number) => {
    if (temporizador) clearTimeout(temporizador);
    temporizador = null;
    actualizarEstado({ fase: 'espera', ganador: null, ...(restantes !== undefined ? { restantes } : {}) });
};

export const suscribir = (res: Response) => {
    res.set({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();
    res.write(`data: ${JSON.stringify(estado)}\n\n`);
    clientes.add(res);
    const latido = setInterval(() => res.write(': ping\n\n'), 20000);
    res.on('close', () => {
        clearInterval(latido);
        clientes.delete(res);
    });
};
