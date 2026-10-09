import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminApiService, Premio, mensajeError } from '../../../../service/admin-api.service';
import { swalNavidad, toast } from '../sorteo/admin-sorteo.component';

@Component({
  selector: 'app-admin-premios',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="adm-stats">
      <div class="adm-stat"><div class="num">{{ totales().tipos }}</div><div class="lbl">Premios activos</div></div>
      <div class="adm-stat"><div class="num">{{ totales().stock }}</div><div class="lbl">Unidades totales</div></div>
      <div class="adm-stat"><div class="num">{{ totales().disponibles }}</div><div class="lbl">Por entregar</div></div>
      <div class="adm-stat"><div class="num">{{ totales().entregados }}</div><div class="lbl">Entregados</div></div>
    </div>

    <section class="adm-card">
      <div class="adm-card-titulo">
        <span>🏆 Premios</span>
        <div class="adm-fila">
          <button class="nv-btn nv-btn-claro nv-btn-sm" (click)="recalcular()" title="Corrige el stock con base en los ganadores registrados">🔄 Recalcular stock</button>
          <button class="nv-btn nv-btn-oro nv-btn-sm" (click)="nuevo()">＋ Nuevo premio</button>
        </div>
      </div>
      <p class="adm-ayuda">"Por entregar" se calcula solo: stock total − (entregados + pendientes). Si cancelas un ganador, la unidad regresa automáticamente.</p>

      <div class="adm-tabla-wrap">
        <table class="adm-tabla">
          <thead>
            <tr><th>Imagen</th><th>Premio</th><th class="num">Stock total</th><th class="num">Por entregar</th><th class="num">Entregados</th><th class="num">Pendientes</th><th>Activo</th><th></th></tr>
          </thead>
          <tbody>
            @for (p of premios(); track p.id) {
              <tr [style.opacity]="p.activo ? 1 : .5">
                <td>
                  <label style="cursor:pointer" title="Cambiar imagen">
                    @if (recurso(p.path)) { <img class="adm-thumb" [src]="recurso(p.path)" alt="" /> }
                    @else { <span class="adm-thumb" style="display:grid;place-items:center">🎁</span> }
                    <input type="file" accept="image/*" hidden (change)="subirImagen(p, $event)" />
                  </label>
                </td>
                @if (editando() === p.id) {
                  <td><input class="adm-input" [(ngModel)]="form.premio" /></td>
                  <td class="num"><input class="adm-input" type="number" min="0" style="width:96px" [(ngModel)]="form.stock_inicial" /></td>
                } @else {
                  <td><b>{{ p.premio }}</b></td>
                  <td class="num">{{ p.stock_inicial }}</td>
                }
                <td class="num"><b>{{ p.cantidad }}</b></td>
                <td class="num">{{ p.entregados }}</td>
                <td class="num">{{ p.pendientes }}</td>
                <td>
                  @if (editando() === p.id) { <input type="checkbox" [(ngModel)]="form.activo" /> }
                  @else { <span class="adm-tag" [class]="p.activo ? 'si' : 'no'">{{ p.activo ? 'Sí' : 'No' }}</span> }
                </td>
                <td>
                  <div class="acciones">
                    @if (editando() === p.id) {
                      <button class="nv-btn nv-btn-verde nv-btn-sm" (click)="guardar(p)">Guardar</button>
                      <button class="nv-btn nv-btn-claro nv-btn-sm" (click)="editando.set(null)">Cancelar</button>
                    } @else {
                      <button class="nv-btn nv-btn-claro nv-btn-sm" (click)="editar(p)">✏️</button>
                      <button class="nv-btn nv-btn-claro nv-btn-sm" (click)="eliminar(p)">🗑️</button>
                    }
                  </div>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </section>
  `,
})
export class AdminPremiosComponent implements OnInit {
  private api = inject(AdminApiService);
  readonly recurso = AdminApiService.recurso;
  premios = signal<Premio[]>([]);
  editando = signal<number | null>(null);
  form: { premio: string; stock_inicial: number; activo: boolean } = { premio: '', stock_inicial: 0, activo: true };

  totales = signal({ tipos: 0, stock: 0, disponibles: 0, entregados: 0 });

  ngOnInit() { this.cargar(); }

  cargar() {
    this.api.premios().subscribe(lista => {
      this.premios.set(lista);
      const activos = lista.filter(p => p.activo);
      this.totales.set({
        tipos: activos.length,
        stock: activos.reduce((s, p) => s + (p.stock_inicial || 0), 0),
        disponibles: activos.reduce((s, p) => s + (p.cantidad || 0), 0),
        entregados: lista.reduce((s, p) => s + p.entregados, 0),
      });
    });
  }

  editar(p: Premio) {
    this.form = { premio: p.premio || '', stock_inicial: p.stock_inicial, activo: p.activo };
    this.editando.set(p.id);
  }

  guardar(p: Premio) {
    this.api.actualizarPremio(p.id, this.form).subscribe({
      next: () => { toast('success', 'Premio actualizado'); this.editando.set(null); this.cargar(); },
      error: e => toast('error', mensajeError(e)),
    });
  }

  async nuevo() {
    const r = await swalNavidad.fire({
      title: 'Nuevo premio',
      html: `<input id="np-nombre" class="swal2-input" placeholder="Nombre del premio">
             <input id="np-stock" class="swal2-input" type="number" min="0" placeholder="Unidades">`,
      showCancelButton: true,
      confirmButtonText: 'Agregar',
      cancelButtonText: 'Cancelar',
      preConfirm: () => ({
        premio: (document.getElementById('np-nombre') as HTMLInputElement).value,
        stock_inicial: Number((document.getElementById('np-stock') as HTMLInputElement).value),
      }),
    });
    if (!r.isConfirmed) return;
    this.api.crearPremio({ ...r.value, activo: true }).subscribe({
      next: () => { toast('success', 'Premio agregado. Puedes subirle una imagen.'); this.cargar(); },
      error: e => toast('error', mensajeError(e)),
    });
  }

  async eliminar(p: Premio) {
    const r = await swalNavidad.fire({
      icon: 'warning', title: `¿Eliminar "${p.premio}"?`,
      text: 'Si ya tiene ganadores, solo se desactivará para conservar el historial.',
      showCancelButton: true, confirmButtonText: 'Eliminar', cancelButtonText: 'Cancelar',
    });
    if (!r.isConfirmed) return;
    this.api.eliminarPremio(p.id).subscribe({
      next: res => { toast('info', res.msg); this.cargar(); },
      error: e => toast('error', mensajeError(e)),
    });
  }

  subirImagen(p: Premio, evento: Event) {
    const archivo = (evento.target as HTMLInputElement).files?.[0];
    if (!archivo) return;
    this.api.subirImagenPremio(p.id, archivo).subscribe({
      next: () => { toast('success', 'Imagen actualizada'); this.cargar(); },
      error: e => toast('error', mensajeError(e)),
    });
  }

  recalcular() {
    this.api.recalcularStock().subscribe({
      next: r => { toast('success', r.msg); this.cargar(); },
      error: e => toast('error', mensajeError(e)),
    });
  }
}
