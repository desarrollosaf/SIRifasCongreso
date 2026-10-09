import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { Subject, debounceTime } from 'rxjs';
import { AdminApiService, Ganador, descargarBlob, mensajeError } from '../../../../service/admin-api.service';
import { AvatarComponent } from '../../../shared/navidad/avatar.component';
import { swalNavidad, toast } from '../sorteo/admin-sorteo.component';

@Component({
  selector: 'app-admin-ganadores',
  standalone: true,
  imports: [FormsModule, DatePipe, AvatarComponent],
  template: `
    <section class="adm-card">
      <div class="adm-card-titulo">
        <span>📋 Ganadores</span>
        <div class="adm-fila">
          <button class="nv-btn nv-btn-claro nv-btn-sm" (click)="exportar('pdf')">⬇ PDF</button>
          <button class="nv-btn nv-btn-claro nv-btn-sm" (click)="exportar('xlsx')">⬇ Excel</button>
        </div>
      </div>
      <p class="adm-ayuda">Cancelar un premio (aunque ya esté entregado) lo regresa al stock. Los reportes usan el filtro seleccionado.</p>

      <div class="adm-fila" style="margin-bottom:1rem">
        <select class="adm-select" style="width:auto" [(ngModel)]="estatus" (ngModelChange)="cargar()">
          <option value="">Vigentes (entregados + pendientes)</option>
          <option value="entregado">Entregados</option>
          <option value="pendiente">Pendientes</option>
          <option value="cancelado">Cancelados</option>
          <option value="todos">Todos</option>
        </select>
        <input class="adm-input crece" placeholder="Buscar por RFC o nombre…" [(ngModel)]="q" (ngModelChange)="buscar$.next()" />
      </div>

      @if (lista().length === 0) {
        <div class="adm-vacio">No hay registros con este filtro 🎄</div>
      } @else {
        <div class="adm-tabla-wrap">
          <table class="adm-tabla">
            <thead><tr><th>#</th><th>Ganador</th><th>Premio</th><th>Estatus</th><th>Sorteado</th><th>Entregado</th><th></th></tr></thead>
            <tbody>
              @for (g of lista(); track g.id; let i = $index) {
                <tr>
                  <td>{{ lista().length - i }}</td>
                  <td>
                    <div class="adm-fila" style="flex-wrap:nowrap">
                      <nv-avatar [tamano]="40" [fotoUrl]="g.fotoUrl" [nombre]="g.nombre" [rfc]="g.rfc" />
                      <div><b>{{ g.nombre || 'Sin nombre' }}</b><br /><small>{{ g.rfc }} · {{ g.area }}</small></div>
                    </div>
                  </td>
                  <td>{{ g.premio?.premio }}</td>
                  <td><span class="adm-tag" [class]="g.estatus">{{ g.estatus }}</span></td>
                  <td>{{ g.createdAt | date:'d/MM/yy HH:mm' }}</td>
                  <td>{{ g.confirmadoAt ? (g.confirmadoAt | date:'d/MM/yy HH:mm') : '' }}</td>
                  <td>
                    <div class="acciones">
                      @if (g.estatus === 'pendiente') { <button class="nv-btn nv-btn-verde nv-btn-sm" (click)="confirmar(g)">✅</button> }
                      @if (g.estatus !== 'cancelado') {
                        <button class="nv-btn nv-btn-claro nv-btn-sm" title="Mostrar en pantalla" (click)="mostrar(g)">📺</button>
                        <button class="nv-btn nv-btn-claro nv-btn-sm" title="Cancelar y devolver al stock" (click)="cancelar(g)">↩️</button>
                      }
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>
  `,
})
export class AdminGanadoresComponent implements OnInit {
  private api = inject(AdminApiService);
  lista = signal<Ganador[]>([]);
  estatus = '';
  q = '';
  buscar$ = new Subject<void>();

  ngOnInit() {
    this.buscar$.pipe(debounceTime(300)).subscribe(() => this.cargar());
    this.cargar();
  }

  cargar() { this.api.ganadores(this.estatus, this.q).subscribe(l => this.lista.set(l)); }

  confirmar(g: Ganador) {
    this.api.confirmar(g.id).subscribe({
      next: () => { toast('success', 'Entrega confirmada'); this.cargar(); },
      error: e => toast('error', mensajeError(e)),
    });
  }

  async cancelar(g: Ganador) {
    const r = await swalNavidad.fire({
      icon: 'warning', title: '¿Cancelar este premio?',
      html: `<b>${g.premio?.premio}</b> de <b>${g.nombre || g.rfc}</b> regresará al stock.`,
      showCancelButton: true, confirmButtonText: 'Sí, cancelar', cancelButtonText: 'No',
    });
    if (!r.isConfirmed) return;
    this.api.cancelar(g.id).subscribe({
      next: () => { toast('info', 'Cancelado: el premio regresó al stock'); this.cargar(); },
      error: e => toast('error', mensajeError(e)),
    });
  }

  mostrar(g: Ganador) { this.api.mostrar(g.id).subscribe(() => toast('info', 'Mostrando en la pantalla pública')); }

  exportar(tipo: 'pdf' | 'xlsx') {
    this.api.reporte(tipo, this.estatus).subscribe({
      next: blob => descargarBlob(blob, `ganadores.${tipo}`),
      error: () => toast('error', 'No se pudo generar el reporte'),
    });
  }
}
