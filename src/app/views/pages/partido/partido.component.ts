import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Subscription } from 'rxjs';
import Swal from 'sweetalert2';
import { PartidoService } from '../../../service/partido.service';
import { PartidoStateService, Ganador } from '../../../service/partido-state.service';

@Component({
  selector: 'app-partido',
  imports: [CommonModule, RouterModule],
  templateUrl: './partido.component.html',
  styleUrl: './partido.component.scss'
})
export class PartidoComponent implements OnInit, OnDestroy {

  public _partido = inject(PartidoService);
  public partidoState = inject(PartidoStateService);

  tipo: number = 0;
  ganadores: Ganador[] = [];
  cargando: boolean = false;
  totalParticipantes: number = 0;

  private subscriptions: Subscription[] = [];

  readonly MAX_GANADORES = 12;

  constructor(private aRouter: ActivatedRoute) {}

  ngOnInit() {
    this.aRouter.paramMap.subscribe(params => {
      this.tipo = Number(params.get('tipo'));
    });

    // Sincroniza el array de ganadores desde el state (BroadcastChannel / localStorage)
    const ganSub = this.partidoState.ganadores$.subscribe(ganadores => {
      this.ganadores = ganadores;
    });
    this.subscriptions.push(ganSub);

    // Admin: cargar datos iniciales desde la BD (por si ya había sorteos previos)
    if (this.tipo === 1) {
      this.cargarParticipantesCount();
      this.sincronizarDesdeDB();
    }
  }

  ngOnDestroy() {
    this.subscriptions.forEach(s => s.unsubscribe());
  }

  private cargarParticipantesCount() {
    this._partido.getParticipantes().subscribe({
      next: (res: any) => { this.totalParticipantes = res.total; },
      error: () => {}
    });
  }

  // Carga ganadores existentes de la BD al iniciar (para recuperar estado tras refresco)
  private sincronizarDesdeDB() {
    this._partido.getGanadores().subscribe({
      next: (res: any) => {
        if (res.data && res.data.length > 0) {
          const stateActual = this.partidoState.getGanadores();
          if (res.data.length > stateActual.length) {
            this.partidoState.setGanadores(res.data);
          }
        }
      },
      error: () => {}
    });
  }

  sorteo() {
    if (this.cargando || this.ganadores.length >= this.MAX_GANADORES) return;

    this.cargando = true;
    this._partido.realizarSorteo().subscribe({
      next: (res: any) => {
        this.cargando = false;
        const nuevoGanador: Ganador = res.data;
        this.partidoState.agregarGanador(nuevoGanador);
      },
      error: (e: HttpErrorResponse) => {
        this.cargando = false;
        const msg = e.error?.message || 'No se pudo realizar el sorteo.';
        Swal.fire({ icon: 'error', title: 'Error', text: msg });
      }
    });
  }

  resetSorteo() {
    Swal.fire({
      title: '¿Reiniciar sorteo?',
      text: 'Se borrarán todos los ganadores de la BD.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sí, reiniciar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (!result.isConfirmed) return;

      this._partido.resetSorteo().subscribe({
        next: () => {
          this.partidoState.limpiar();
          Swal.fire({
            icon: 'success',
            title: 'Sorteo reiniciado',
            timer: 1500,
            showConfirmButton: false
          });
        },
        error: () => {
          Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo reiniciar el sorteo.' });
        }
      });
    });
  }

  // Lista invertida para la vista pública (el más reciente aparece primero)
  get ganadoresInvertidos(): Ganador[] {
    return [...this.ganadores].reverse();
  }

  quitarGanador(ganador: Ganador) {
    Swal.fire({
      title: '¿Quitar este boleto?',
      html: `<b>${ganador.nombre_completo}</b><br><small>${ganador.adscripcion}</small>`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sí, quitar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (!result.isConfirmed) return;

      this._partido.removerGanador(ganador.id).subscribe({
        next: () => {
          this.partidoState.quitarGanador(ganador.id);
        },
        error: () => {
          Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo quitar el ganador.' });
        }
      });
    });
  }

  trackById(_: number, g: Ganador) {
    return g.id;
  }
}
