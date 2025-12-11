import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface Resultado {
  id: number;
  premio: string;
  cantidad: number;
  createdAt: string;
  updatedAt: string;
  ganador?: string;
}

interface SorteoMessage {
  type: 'resultado' | 'mostrando' | 'historial' | 'limpiar' | 'limpiarHistorial'  | 'totalPremios';
  data?: any;
  timestamp?: number;
}

@Injectable({
  providedIn: 'root'
})
export class SorteoStateService {
  
  private resultadoActualSubject = new BehaviorSubject<Resultado | null>(null);
  private mostrandoResultadoSubject = new BehaviorSubject<boolean>(false);
  private historialSubject = new BehaviorSubject<Resultado[]>([]);

  private totalPremiosSubject = new BehaviorSubject<number>(100);
  totalPremios$ = this.totalPremiosSubject.asObservable();

  resultadoActual$: Observable<Resultado | null> = this.resultadoActualSubject.asObservable();
  mostrandoResultado$: Observable<boolean> = this.mostrandoResultadoSubject.asObservable();
  historial$: Observable<Resultado[]> = this.historialSubject.asObservable();

  private channel: BroadcastChannel | null = null;

  constructor() {
    // console.log('🎄 SorteoStateService inicializado');
    
    // Intentar crear BroadcastChannel (no todos los navegadores lo soportan)
    try {
      this.channel = new BroadcastChannel('sorteo-channel');
      // console.log('✅ BroadcastChannel creado');
      
      this.channel.onmessage = (event: MessageEvent<SorteoMessage>) => {
        // console.log('📨 Mensaje recibido via BroadcastChannel:', event.data);
        this.handleMessage(event.data);
      };
    } catch (e) {
      console.warn('⚠️ BroadcastChannel no soportado, usando solo localStorage');
    }

    // Escuchar cambios en localStorage (funciona en todos los navegadores)
    window.addEventListener('storage', (event) => {
      // console.log('📦 Storage event detectado:', event.key);
      
      if (event.key === 'sorteo-state' && event.newValue) {
        // console.log('📦 Nuevo valor en storage:', event.newValue);
        try {
          const state = JSON.parse(event.newValue);
          this.applyState(state);
        } catch (e) {
          console.error('❌ Error parseando storage:', e);
        }
      }
    });

    // Cargar estado inicial
    this.loadFromStorage();
    
    // Poll cada 500ms como fallback (temporal para debug)
    setInterval(() => {
      this.checkStorageChanges();
    }, 500);
  }

  private lastStorageCheck: string = '';
  
  private checkStorageChanges() {
    const current = localStorage.getItem('sorteo-state');
    if (current && current !== this.lastStorageCheck) {
      // console.log('🔄 Cambio detectado en storage (poll)');
      this.lastStorageCheck = current;
      try {
        const state = JSON.parse(current);
        this.applyState(state);
      } catch (e) {
        console.error('❌ Error en checkStorageChanges:', e);
      }
    }
  }

  private applyState(state: any) {
    // console.log('🎯 Aplicando estado:', state);
    
    if (state.resultado !== undefined) {
      const currentResultado = this.resultadoActualSubject.value;
      if (JSON.stringify(currentResultado) !== JSON.stringify(state.resultado)) {
        // console.log('📝 Actualizando resultado');
        this.resultadoActualSubject.next(state.resultado);
      }
    }

    if (state.totalPremios !== undefined) {
      const current = this.totalPremiosSubject.value;
      if (current !== state.totalPremios) {
        this.totalPremiosSubject.next(state.totalPremios);
      }
    }
    
    if (state.mostrando !== undefined) {
      const currentMostrando = this.mostrandoResultadoSubject.value;
      if (currentMostrando !== state.mostrando) {
        // console.log('👁️ Actualizando mostrando:', state.mostrando);
        this.mostrandoResultadoSubject.next(state.mostrando);
      }
    }
    
    if (state.historial) {
      const currentHistorial = this.historialSubject.value;
      if (JSON.stringify(currentHistorial) !== JSON.stringify(state.historial)) {
        // console.log('📋 Actualizando historial');
        this.historialSubject.next(state.historial);
      }
    }
  }

  private handleMessage(message: SorteoMessage) {
    // console.log('⚙️ Procesando mensaje:', message);
    
    switch (message.type) {
      case 'resultado':
        this.resultadoActualSubject.next(message.data);
        break;
      case 'mostrando':
        // console.log('⚙️ Actualizando mostrando desde mensaje:', message.data);
        this.mostrandoResultadoSubject.next(message.data);
        break;
      case 'historial':
        this.historialSubject.next(message.data);
        break;
      case 'limpiar':
        this.resultadoActualSubject.next(null);
        this.mostrandoResultadoSubject.next(false);
        break;
      case 'totalPremios':
        this.totalPremiosSubject.next(message.data);
        break;
      case 'limpiarHistorial':
        this.historialSubject.next([]);
        break;
    }
  }

  private broadcast(message: SorteoMessage) {
    message.timestamp = Date.now();
    // console.log('📡 Enviando broadcast:', message);
    
    if (this.channel) {
      try {
        this.channel.postMessage(message);
        // console.log('✅ Mensaje enviado via BroadcastChannel');
      } catch (e) {
        console.error('❌ Error enviando via BroadcastChannel:', e);
      }
    }
  }

  private saveToStorage() {
    const state = {
      resultado: this.resultadoActualSubject.value,
      mostrando: this.mostrandoResultadoSubject.value,
      historial: this.historialSubject.value,
      totalPremios: this.totalPremiosSubject.value,
      timestamp: Date.now()
    };
    
    const stateStr = JSON.stringify(state);
    localStorage.setItem('sorteo-state', stateStr);
    this.lastStorageCheck = stateStr;
    // console.log('💾 Estado guardado en localStorage:', state);
  }

  private loadFromStorage() {
    const savedState = localStorage.getItem('sorteo-state');
    if (savedState) {
      try {
        const state = JSON.parse(savedState);
        // console.log('📂 Estado cargado desde localStorage:', state);
        this.applyState(state);
      } catch (e) {
        console.error('❌ Error al cargar estado:', e);
      }
    } else {
      // console.log('📭 No hay estado guardado en localStorage');
    }
  }

  // Métodos públicos
  setResultado(resultado: Resultado | null) {
    // console.log('🎁 setResultado llamado:', resultado);
    this.resultadoActualSubject.next(resultado);
    this.broadcast({ type: 'resultado', data: resultado });
    this.saveToStorage();
  }

  setTotalPremios(total: number) {
    this.totalPremiosSubject.next(total);

    this.broadcast({ type: 'totalPremios', data: total });
    this.saveToStorage();
  }


  setMostrandoResultado(mostrando: boolean) {
    // console.log('👁️ setMostrandoResultado llamado:', mostrando);
    this.mostrandoResultadoSubject.next(mostrando);
    this.broadcast({ type: 'mostrando', data: mostrando });
    this.saveToStorage();
  }

  agregarAlHistorial(resultado: Resultado) {
    // console.log('📋 agregarAlHistorial llamado:', resultado);
    const historialActual = this.historialSubject.value;
    const nuevoHistorial = [resultado, ...historialActual];
    this.historialSubject.next(nuevoHistorial);
    this.broadcast({ type: 'historial', data: nuevoHistorial });
    this.saveToStorage();
  }

  limpiarResultado() {
    // console.log('🧹 limpiarResultado llamado');
    this.resultadoActualSubject.next(null);
    this.mostrandoResultadoSubject.next(false);
    this.broadcast({ type: 'limpiar' });
    this.saveToStorage();
  }

  limpiarHistorial() {
    // console.log('🗑️ limpiarHistorial llamado');
    this.historialSubject.next([]);
    this.broadcast({ type: 'limpiarHistorial' });
    this.saveToStorage();
  }

  getResultadoActual(): Resultado | null {
    return this.resultadoActualSubject.value;
  }

  getMostrandoResultado(): boolean {
    return this.mostrandoResultadoSubject.value;
  }

  getHistorial(): Resultado[] {
    return this.historialSubject.value;
  }
}