import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface Ganador {
  id: number;
  folio: string;
  nombre_completo: string;
  adscripcion: string;
  ganador: boolean;
  createdAt: string;
  updatedAt: string;
}

interface PartidoMessage {
  type: 'ganadores' | 'limpiar';
  data?: any;
  timestamp?: number;
}

@Injectable({
  providedIn: 'root'
})
export class PartidoStateService {

  private ganadoresSubject = new BehaviorSubject<Ganador[]>([]);
  ganadores$: Observable<Ganador[]> = this.ganadoresSubject.asObservable();

  private channel: BroadcastChannel | null = null;
  private lastStorageCheck: string = '';

  constructor() {
    try {
      this.channel = new BroadcastChannel('partido-channel');
      this.channel.onmessage = (event: MessageEvent<PartidoMessage>) => {
        this.handleMessage(event.data);
      };
    } catch (e) {
      console.warn('BroadcastChannel no soportado, usando localStorage');
    }

    window.addEventListener('storage', (event) => {
      if (event.key === 'partido-state' && event.newValue) {
        try {
          const state = JSON.parse(event.newValue);
          this.applyState(state);
        } catch (e) {
          console.error('Error parseando partido-state:', e);
        }
      }
    });

    this.loadFromStorage();

    setInterval(() => this.checkStorageChanges(), 500);
  }

  private checkStorageChanges() {
    const current = localStorage.getItem('partido-state');
    if (current && current !== this.lastStorageCheck) {
      this.lastStorageCheck = current;
      try {
        const state = JSON.parse(current);
        this.applyState(state);
      } catch (e) {}
    }
  }

  private applyState(state: any) {
    if (state.ganadores !== undefined) {
      const current = this.ganadoresSubject.value;
      if (JSON.stringify(current) !== JSON.stringify(state.ganadores)) {
        this.ganadoresSubject.next(state.ganadores);
      }
    }
  }

  private handleMessage(message: PartidoMessage) {
    switch (message.type) {
      case 'ganadores':
        this.ganadoresSubject.next(message.data);
        break;
      case 'limpiar':
        this.ganadoresSubject.next([]);
        break;
    }
  }

  private broadcast(message: PartidoMessage) {
    message.timestamp = Date.now();
    if (this.channel) {
      try { this.channel.postMessage(message); } catch (e) {}
    }
  }

  private saveToStorage() {
    const state = { ganadores: this.ganadoresSubject.value, timestamp: Date.now() };
    const stateStr = JSON.stringify(state);
    localStorage.setItem('partido-state', stateStr);
    this.lastStorageCheck = stateStr;
  }

  private loadFromStorage() {
    const saved = localStorage.getItem('partido-state');
    if (saved) {
      try {
        const state = JSON.parse(saved);
        this.applyState(state);
      } catch (e) {}
    }
  }

  setGanadores(ganadores: Ganador[]) {
    this.ganadoresSubject.next(ganadores);
    this.broadcast({ type: 'ganadores', data: ganadores });
    this.saveToStorage();
  }

  agregarGanador(ganador: Ganador) {
    const actuales = this.ganadoresSubject.value;
    const nuevos = [...actuales, ganador];
    this.ganadoresSubject.next(nuevos);
    this.broadcast({ type: 'ganadores', data: nuevos });
    this.saveToStorage();
  }

  quitarGanador(id: number) {
    const nuevos = this.ganadoresSubject.value.filter(g => g.id !== id);
    this.ganadoresSubject.next(nuevos);
    this.broadcast({ type: 'ganadores', data: nuevos });
    this.saveToStorage();
  }

  limpiar() {
    this.ganadoresSubject.next([]);
    this.broadcast({ type: 'limpiar' });
    this.saveToStorage();
  }

  getGanadores(): Ganador[] {
    return this.ganadoresSubject.value;
  }
}
