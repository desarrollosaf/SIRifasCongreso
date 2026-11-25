import { Component, ElementRef, OnDestroy, OnInit, ViewChild, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { Subject, Subscription, catchError, debounceTime, distinctUntilChanged, of, switchMap, tap } from 'rxjs';
import Swal from 'sweetalert2';
import { AdminApiService, Ganador, Persona, mensajeError, rfcVisible } from '../../../../service/admin-api.service';
import { SorteoEnVivoService } from '../../../../service/sorteo-en-vivo.service';
import { AvatarComponent } from '../../../shared/navidad/avatar.component';

export const swalNavidad = Swal.mixin({
  confirmButtonColor: '#7d0037',
  cancelButtonColor: '#8a9a94',
  reverseButtons: true,
});

export const toast = (icon: 'success' | 'error' | 'info' | 'warning', title: string) =>
  Swal.fire({ toast: true, position: 'top-end', icon, title, timer: 3200, showConfirmButton: false, timerProgressBar: true });

// Flujo: 1) Sortear premio  2) sale el boleto y se captura su número  3) confirmar entrega
@Component({
  selector: 'app-admin-sorteo',
  standalone: true,
  imports: [FormsModule, NgSelectModule, AvatarComponent],
  templateUrl: './admin-sorteo.component.html',
  styleUrl: './admin-sorteo.component.scss',
})
export class AdminSorteoComponent implements OnInit, OnDestroy {
  private api = inject(AdminApiService);
  readonly vivo = inject(SorteoEnVivoService);
  readonly recurso = AdminApiService.recurso;

  pendiente = signal<Ganador | null>(null);
  ultimos = signal<Ganador[]>([]);
  ocupado = signal(false);
  error = signal('');

  // Captura del número de boleto
  readonly rfcVisible = rfcVisible;
  numeroBoleto = '';
  porNombre = signal(false);
  private campo?: ElementRef<HTMLInputElement>;
  @ViewChild('campoBoleto') set campoBoleto(c: ElementRef<HTMLInputElement> | undefined) {
    // Al aparecer el campo queda listo para teclear
    if (c && c !== this.campo) setTimeout(() => c.nativeElement.focus());
    this.campo = c;
  }
  private peticionBoleto?: Subscription;

  // Buscador de personas por nombre (si el boleto no se lee)
  personas = signal<Persona[]>([]);
  buscando = signal(false);
  busqueda$ = new Subject<string>();
  seleccion: Persona | null = null;
  forzar = false;
  private sub?: Subscription;

  ngOnInit() {
    this.api.pendiente().subscribe(p => this.pendiente.set(p));
    this.cargarUltimos();
    this.sub = this.busqueda$.pipe(
      debounceTime(250),
      distinctUntilChanged(),
      tap(() => this.buscando.set(true)),
      switchMap(q => (q && q.trim().length >= 2 ? this.api.buscarPersonas(q) : of([])).pipe(catchError(() => of([])))),
    ).subscribe(lista => { this.personas.set(lista); this.buscando.set(false); });
  }

  ngOnDestroy() { this.sub?.unsubscribe(); this.peticionBoleto?.unsubscribe(); }

  // Al corregir el número se quita a la persona anterior, para no premiar al boleto equivocado
  cambiarBoleto(valor: string) {
    this.numeroBoleto = (valor || '').replace(/\D/g, '').slice(0, 9);
    if (this.campo) this.campo.nativeElement.value = this.numeroBoleto;
    this.peticionBoleto?.unsubscribe();
    this.buscando.set(false);
    this.elegir(null);
  }

  buscarBoleto() {
    const numero = Number(this.numeroBoleto);
    if (!numero) return;
    this.peticionBoleto?.unsubscribe();
    this.elegir(null);
    this.buscando.set(true);
    this.peticionBoleto = this.api.buscarBoleto(numero).subscribe({
      next: p => { this.buscando.set(false); this.elegir(p); },
      error: e => { this.buscando.set(false); this.error.set(mensajeError(e)); this.campo?.nativeElement.select(); },
    });
  }

  alternarBusqueda() {
    this.porNombre.set(!this.porNombre());
    this.limpiarBusqueda();
    this.error.set('');
  }

  private cargarUltimos() {
    this.api.ganadores('todos').subscribe(g => this.ultimos.set(g.slice(0, 8)));
  }

  // Busca en nombre, dependencia, dirección y RFC (ng-select ya filtró en el servidor)
  sinFiltroLocal = () => true;

  elegir(persona: Persona | null) {
    this.seleccion = persona;
    this.forzar = false;
    this.error.set('');
  }

  // Paso 1
  sortearPremio() {
    this.ocupado.set(true);
    this.error.set('');
    this.api.sortear().subscribe({
      next: g => { this.pendiente.set(g); this.ocupado.set(false); this.cargarUltimos(); },
      error: e => {
        this.ocupado.set(false);
        this.error.set(mensajeError(e));
        if (e?.error?.codigo === 'PENDIENTE') this.api.pendiente().subscribe(p => this.pendiente.set(p));
      },
    });
  }

  // Paso 2
  asignar() {
    const p = this.pendiente();
    const s = this.seleccion;
    if (!p || !s) return;
    this.ocupado.set(true);
    this.error.set('');
    this.api.asignarGanador(p.id, { rfc: s.rfc, boleto: s.boleto ?? undefined, nombre: s.nombre ?? undefined, area: s.area ?? undefined, forzar: this.forzar }).subscribe({
      next: g => { this.pendiente.set(g); this.ocupado.set(false); this.limpiarBusqueda(); this.cargarUltimos(); },
      error: e => {
        this.ocupado.set(false);
        this.error.set(mensajeError(e));
        if (e?.error?.codigo === 'YA_GANO' && this.seleccion) this.seleccion = { ...this.seleccion, gano: true };
      },
    });
  }

  // "No se presentó": el premio sigue en juego, se saca otro boleto
  async noSePresento() {
    const p = this.pendiente();
    if (!p) return;
    const r = await swalNavidad.fire({
      icon: 'question',
      title: '¿No se presentó?',
      html: `Se quita a <b>${p.nombre || p.rfc}</b> y <b>${p.premio?.premio}</b> sigue en juego para el siguiente boleto.`,
      showCancelButton: true,
      confirmButtonText: 'Sí, sacar otro boleto',
      cancelButtonText: 'No',
    });
    if (!r.isConfirmed) return;
    this.ocupado.set(true);
    this.api.quitarGanador(p.id).subscribe({
      next: g => { this.pendiente.set(g); this.ocupado.set(false); this.cargarUltimos(); },
      error: e => { this.ocupado.set(false); this.error.set(mensajeError(e)); },
    });
  }

  // Paso 3
  confirmar() {
    const p = this.pendiente();
    if (!p) return;
    this.ocupado.set(true);
    this.api.confirmar(p.id).subscribe({
      next: () => { toast('success', `Entregado a ${p.nombre || p.rfc}`); this.terminar(); },
      error: e => { this.ocupado.set(false); this.error.set(mensajeError(e)); },
    });
  }

  async cancelarPremio() {
    const p = this.pendiente();
    if (!p) return;
    const r = await swalNavidad.fire({
      icon: 'warning',
      title: '¿Cancelar este premio?',
      html: `<b>${p.premio?.premio}</b> <b>regresará al stock</b> y se podrá volver a sortear.`,
      showCancelButton: true,
      confirmButtonText: 'Sí, cancelar y devolver',
      cancelButtonText: 'No',
    });
    if (!r.isConfirmed) return;
    this.ocupado.set(true);
    this.api.cancelar(p.id).subscribe({
      next: () => { toast('info', 'Cancelado: el premio regresó al stock'); this.terminar(); },
      error: e => { this.ocupado.set(false); this.error.set(mensajeError(e)); },
    });
  }

  limpiarPantalla() { this.api.limpiarPantalla().subscribe(); }

  mostrar(g: Ganador) { this.api.mostrar(g.id).subscribe(); }

  private limpiarBusqueda() {
    this.peticionBoleto?.unsubscribe();
    this.buscando.set(false);
    this.numeroBoleto = '';
    this.seleccion = null;
    this.forzar = false;
    this.personas.set([]);
  }

  private terminar() {
    this.pendiente.set(null);
    this.porNombre.set(false);
    this.limpiarBusqueda();
    this.error.set('');
    this.ocupado.set(false);
    this.cargarUltimos();
  }
}
