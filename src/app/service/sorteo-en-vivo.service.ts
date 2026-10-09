import { Injectable, NgZone, OnDestroy, inject, signal } from '@angular/core';
import { enviroment } from '../../enviroments/enviroment';
import { Ganador } from './admin-api.service';

export type Fase = 'espera' | 'sorteando' | 'premio' | 'revelado';

export interface EstadoSorteo {
  fase: Fase;
  ganador: Ganador | null;
  restantes: number;
  evento: Record<string, string>;
  ts: number;
}

// Estado del sorteo en tiempo real (Server-Sent Events). El backend es la fuente de verdad,
// así la pantalla pública puede estar en otra computadora o proyector.
@Injectable({ providedIn: 'root' })
export class SorteoEnVivoService implements OnDestroy {
  private zone = inject(NgZone);
  private fuente: EventSource | null = null;

  readonly estado = signal<EstadoSorteo>({ fase: 'espera', ganador: null, restantes: 0, evento: {}, ts: 0 });
  readonly conectado = signal(false);

  conectar() {
    if (this.fuente) return;
    this.fuente = new EventSource(`${enviroment.endpoint}api/sorteo/stream`);
    this.fuente.onopen = () => this.zone.run(() => this.conectado.set(true));
    this.fuente.onerror = () => this.zone.run(() => this.conectado.set(false)); // EventSource reintenta solo
    this.fuente.onmessage = (evento) => this.zone.run(() => {
      try { this.estado.set(JSON.parse(evento.data)); } catch { /* latido o mensaje inválido */ }
    });
  }

  desconectar() {
    this.fuente?.close();
    this.fuente = null;
    this.conectado.set(false);
  }

  ngOnDestroy() { this.desconectar(); }
}
