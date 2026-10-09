import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { enviroment } from '../../enviroments/enviroment';

export interface PremioRef { id: number; premio: string | null; path: string | null; }

export interface Ganador {
  id: number;
  rfc: string | null;
  nombre: string | null;
  nombrePila?: string | null;
  area: string | null;
  fotoUrl: string | null;
  estatus: 'pendiente' | 'entregado' | 'cancelado';
  premio: PremioRef | null;
  createdAt?: string;
  confirmadoAt?: string | null;
}

export interface Premio extends PremioRef {
  cantidad: number;
  stock_inicial: number;
  activo: boolean;
  entregados: number;
  pendientes: number;
}

export interface Participante {
  id: number;
  rfc: string;
  nombre: string | null;
  area: string | null;
  direccion?: string | null;
  fotoUrl: string | null;
  gano: boolean;
}

export interface BusquedaParticipante {
  rfc: string;
  encontrado: boolean;
  nombre: string | null;
  area: string | null;
  fotoUrl: string | null;
  ganados: { id: number; estatus: string; premio: string; fecha: string }[];
}

// Resultado del buscador por nombre (select del sorteo)
export interface Persona {
  rfc: string;
  nombre: string | null;
  area: string | null;
  direccion: string | null;
  fotoUrl: string | null;
  gano: boolean;
}

export interface EstadoDescarga {
  activo: boolean; total: number; procesadas: number; descargadas: number;
  sinFoto: number; errores: number; mensaje: string;
}

export interface EstadoImportSql {
  activo: boolean; etapa: string; mensaje: string; error: boolean; usuarios: number;
}

export interface Respaldo { archivo: string; tipo: string; bytes: number; fecha: string; }

@Injectable({ providedIn: 'root' })
export class AdminApiService {
  private http = inject(HttpClient);
  private base = `${enviroment.endpoint}api/admin`;

  // Rutas "storage/..." viven en el backend; las demás son imágenes del frontend (public/)
  static recurso(ruta: string | null | undefined): string | null {
    if (!ruta) return null;
    return ruta.startsWith('storage/') ? `${enviroment.endpoint}${ruta}` : ruta;
  }

  login(usuario: string, password: string) { return this.http.post<{ usuario: string }>(`${this.base}/login`, { usuario, password }); }
  logout() { return this.http.post(`${this.base}/logout`, {}); }
  me() { return this.http.get<{ usuario: string }>(`${this.base}/me`); }

  // Sorteo
  buscarParticipante(rfc: string) { return this.http.get<BusquedaParticipante>(`${this.base}/sorteo/participante/${encodeURIComponent(rfc)}`); }
  pendiente() { return this.http.get<Ganador | null>(`${this.base}/sorteo/pendiente`); }
  sortear() { return this.http.post<Ganador>(`${this.base}/sorteo/sortear`, {}); }
  buscarPersonas(q: string) { return this.http.get<Persona[]>(`${this.base}/sorteo/personas`, { params: { q } }); }
  asignarGanador(id: number, datos: { rfc: string; nombre?: string; area?: string; forzar?: boolean }) {
    return this.http.post<Ganador>(`${this.base}/sorteo/${id}/ganador`, datos);
  }
  quitarGanador(id: number) { return this.http.delete<Ganador>(`${this.base}/sorteo/${id}/ganador`); }
  confirmar(id: number) { return this.http.post<{ msg: string }>(`${this.base}/sorteo/${id}/confirmar`, {}); }
  cancelar(id: number) { return this.http.post<{ msg: string }>(`${this.base}/sorteo/${id}/cancelar`, {}); }
  mostrar(id: number) { return this.http.post(`${this.base}/sorteo/${id}/mostrar`, {}); }
  limpiarPantalla() { return this.http.post(`${this.base}/pantalla/limpiar`, {}); }

  // Premios
  premios() { return this.http.get<Premio[]>(`${this.base}/premios`); }
  crearPremio(datos: Partial<Premio>) { return this.http.post<Premio>(`${this.base}/premios`, datos); }
  actualizarPremio(id: number, datos: Partial<Premio>) { return this.http.put<Premio>(`${this.base}/premios/${id}`, datos); }
  eliminarPremio(id: number) { return this.http.delete<{ msg: string }>(`${this.base}/premios/${id}`); }
  recalcularStock() { return this.http.post<{ msg: string }>(`${this.base}/premios/recalcular`, {}); }
  subirImagenPremio(id: number, archivo: File) {
    const form = new FormData();
    form.append('imagen', archivo);
    return this.http.post<Premio>(`${this.base}/premios/${id}/imagen`, form);
  }

  // Participantes
  participantes(filtros: { q?: string; pagina?: number; limite?: number; foto?: string }) {
    let params = new HttpParams();
    Object.entries(filtros).forEach(([k, v]) => { if (v !== undefined && v !== '') params = params.set(k, String(v)); });
    return this.http.get<{ total: number; conFoto: number; fotosSinParticipante: number; filtrados: number; datos: Participante[] }>(
      `${this.base}/participantes`, { params });
  }
  crearParticipante(datos: Partial<Participante>) { return this.http.post(`${this.base}/participantes`, datos); }
  actualizarParticipante(id: number, datos: Partial<Participante>) { return this.http.put(`${this.base}/participantes/${id}`, datos); }
  eliminarParticipante(id: number) { return this.http.delete(`${this.base}/participantes/${id}`); }
  eliminarFoto(rfc: string) { return this.http.delete(`${this.base}/participantes/fotos/${encodeURIComponent(rfc)}`); }
  importarParticipantes(archivo: File, modo: 'agregar' | 'reemplazar') {
    const form = new FormData();
    form.append('archivo', archivo);
    form.append('modo', modo);
    return this.http.post<{ msg: string; importados: number; sinRfc: number; duplicadosEnArchivo: number; total: number }>(
      `${this.base}/participantes/importar`, form);
  }
  subirFotos(archivos: File[]) {
    const form = new FormData();
    archivos.forEach(a => form.append('fotos', a));
    return this.http.post<{ msg: string; guardadas: number; sinParticipante: string[]; rechazadas: string[] }>(
      `${this.base}/participantes/fotos`, form);
  }

  // Sincronización con SAF
  safProbar() {
    return this.http.post<{ ok: boolean; activos: number; host: string; base: string; actualizado: string | null; archivo: string | null }>(
      `${this.base}/participantes/saf/probar`, {});
  }
  subirSqlSaf(archivo: File, modo: 'agregar' | 'reemplazar') {
    const form = new FormData();
    form.append('modo', modo);
    form.append('archivo', archivo);
    return this.http.post<EstadoImportSql>(`${this.base}/participantes/saf/sql`, form, { reportProgress: true, observe: 'events' });
  }
  estadoSqlSaf() { return this.http.get<EstadoImportSql>(`${this.base}/participantes/saf/sql/estado`); }
  safImportar(modo: 'agregar' | 'reemplazar') {
    return this.http.post<{ msg: string; importados: number; total: number }>(`${this.base}/participantes/saf/importar`, { modo });
  }
  descargarFotos(todas: boolean) { return this.http.post<EstadoDescarga>(`${this.base}/participantes/fotos/descargar`, { todas }); }
  estadoDescarga() { return this.http.get<EstadoDescarga>(`${this.base}/participantes/fotos/descarga`); }
  detenerDescarga() { return this.http.post<EstadoDescarga>(`${this.base}/participantes/fotos/descarga/detener`, {}); }

  // Ganadores
  ganadores(estatus: string, q = '') {
    return this.http.get<Ganador[]>(`${this.base}/ganadores`, { params: { estatus, q } });
  }
  reporte(tipo: 'pdf' | 'xlsx', estatus: string): Observable<Blob> {
    return this.http.get(`${this.base}/ganadores/reporte.${tipo}`, { params: { estatus }, responseType: 'blob' });
  }

  // Base de datos
  resumen() { return this.http.get<any>(`${this.base}/bd/resumen`); }
  respaldos() { return this.http.get<Respaldo[]>(`${this.base}/bd/respaldos`); }
  crearRespaldo() { return this.http.post<{ msg: string; archivo: string }>(`${this.base}/bd/respaldos`, {}); }
  descargarRespaldo(archivo: string) { return this.http.get(`${this.base}/bd/respaldos/${archivo}`, { responseType: 'blob' }); }
  subirRespaldo(archivo: File) {
    const form = new FormData();
    form.append('archivo', archivo);
    return this.http.post<{ msg: string; archivo: string }>(`${this.base}/bd/respaldos/subir`, form);
  }
  restaurarRespaldo(archivo: string) { return this.http.post<{ msg: string }>(`${this.base}/bd/respaldos/${archivo}/restaurar`, { confirmacion: 'RESTAURAR' }); }
  eliminarRespaldo(archivo: string) { return this.http.delete(`${this.base}/bd/respaldos/${archivo}`); }
  reiniciar(tipo: string) { return this.http.post<{ msg: string; respaldo: string }>(`${this.base}/bd/reiniciar`, { tipo, confirmacion: 'REINICIAR' }); }
  config() { return this.http.get<Record<string, string>>(`${this.base}/config`); }
  guardarConfig(datos: Record<string, string>) { return this.http.put<Record<string, string>>(`${this.base}/config`, datos); }
}

export const descargarBlob = (blob: Blob, nombre: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
};

export const mensajeError = (e: any, porDefecto = 'Ocurrió un error') => e?.error?.msg || e?.message || porDefecto;
