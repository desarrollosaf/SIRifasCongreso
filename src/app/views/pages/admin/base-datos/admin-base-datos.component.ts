import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { AdminApiService, Respaldo, descargarBlob, mensajeError } from '../../../../service/admin-api.service';
import { swalNavidad, toast } from '../sorteo/admin-sorteo.component';

interface OpcionReinicio { tipo: string; titulo: string; detalle: string; peligro: boolean; }

@Component({
  selector: 'app-admin-base-datos',
  standalone: true,
  imports: [FormsModule, DatePipe],
  template: `
    @if (resumen(); as r) {
      <div class="adm-stats">
        <div class="adm-stat"><div class="num">{{ r.restantes }}/{{ r.stockTotal }}</div><div class="lbl">Premios por entregar</div></div>
        <div class="adm-stat"><div class="num">{{ r.entregados }}</div><div class="lbl">Entregados</div></div>
        <div class="adm-stat"><div class="num">{{ r.pendientes }}</div><div class="lbl">Pendientes</div></div>
        <div class="adm-stat"><div class="num">{{ r.cancelados }}</div><div class="lbl">Cancelados</div></div>
        <div class="adm-stat"><div class="num">{{ r.participantes }}</div><div class="lbl">Participantes</div></div>
      </div>
    }

    <div class="adm-grid adm-grid-2">
      <!-- Respaldos -->
      <section class="adm-card">
        <div class="adm-card-titulo">
          <span>💾 Respaldos</span>
          <div class="adm-fila">
            <label class="nv-btn nv-btn-claro nv-btn-sm">⬆ Subir<input type="file" accept=".json" hidden (change)="subir($event)" /></label>
            <button class="nv-btn nv-btn-oro nv-btn-sm" (click)="crear()">＋ Crear respaldo</button>
          </div>
        </div>
        <p class="adm-ayuda">
          Son archivos <b>.json</b> en la carpeta <b>backups/</b> de tu proyecto: puedes verlos, copiarlos o guardarlos en una USB.
          Se crea uno automático después de cada entrega confirmada y antes de cada reinicio o restauración.
        </p>
        @if (respaldos().length === 0) {
          <div class="adm-vacio">Aún no hay respaldos.</div>
        } @else {
          <div class="adm-tabla-wrap" style="max-height:440px;overflow:auto">
            <table class="adm-tabla">
              <thead><tr><th>Fecha</th><th>Tipo</th><th class="num">Tamaño</th><th></th></tr></thead>
              <tbody>
                @for (b of respaldos(); track b.archivo) {
                  <tr>
                    <td [title]="b.archivo">{{ b.fecha | date:'d/MM/yy HH:mm:ss' }}</td>
                    <td><span class="adm-tag no">{{ tipos[b.tipo] || b.tipo }}</span></td>
                    <td class="num">{{ (b.bytes / 1024).toFixed(1) }} KB</td>
                    <td>
                      <div class="acciones">
                        <button class="nv-btn nv-btn-claro nv-btn-sm" title="Descargar" (click)="descargar(b)">⬇</button>
                        <button class="nv-btn nv-btn-claro nv-btn-sm" title="Restaurar" (click)="restaurar(b)">♻️</button>
                        <button class="nv-btn nv-btn-claro nv-btn-sm" title="Eliminar" (click)="eliminar(b)">🗑️</button>
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </section>

      <div class="adm-grid" style="align-content:start">
        <!-- Evento -->
        <section class="adm-card">
          <h3>🎄 Datos del evento</h3>
          <div class="adm-fila">
            <div class="adm-campo crece"><label>Título</label><input class="adm-input" [(ngModel)]="config.evento_titulo" /></div>
            <div class="adm-campo" style="width:110px"><label>Año</label><input class="adm-input" [(ngModel)]="config.evento_anio" /></div>
          </div>
          <button class="nv-btn nv-btn-verde nv-btn-sm" (click)="guardarConfig()">Guardar</button>
        </section>

        <!-- Reinicios -->
        <section class="adm-card">
          <h3>⚠️ Reiniciar</h3>
          <p class="adm-ayuda">Antes de cualquier reinicio se crea un respaldo automático, así que siempre puedes regresar.</p>
          @for (o of opciones; track o.tipo) {
            <div class="adm-fila" style="justify-content:space-between;padding:.7rem 0;border-top:1px solid #f0e8da">
              <div style="flex:1 1 220px"><b>{{ o.titulo }}</b><br /><small style="color:var(--nv-tinta-suave)">{{ o.detalle }}</small></div>
              <button class="nv-btn nv-btn-sm" [class.nv-btn-rojo]="o.peligro" [class.nv-btn-claro]="!o.peligro" (click)="reiniciar(o)">{{ o.peligro ? 'Reiniciar' : 'Ejecutar' }}</button>
            </div>
          }
        </section>
      </div>
    </div>
  `,
})
export class AdminBaseDatosComponent implements OnInit {
  private api = inject(AdminApiService);
  resumen = signal<any>(null);
  respaldos = signal<Respaldo[]>([]);
  config: Record<string, string> = { evento_titulo: '', evento_anio: '' };

  readonly tipos: Record<string, string> = {
    manual: 'Manual', auto: 'Automático', 'pre-reinicio': 'Antes de reiniciar', 'pre-restauracion': 'Antes de restaurar', subido: 'Subido',
  };

  readonly opciones: OpcionReinicio[] = [
    { tipo: 'stock', titulo: 'Recalcular stock', detalle: 'Corrige las cantidades disponibles según los ganadores registrados. No borra nada.', peligro: false },
    { tipo: 'sorteo', titulo: 'Reiniciar sorteo', detalle: 'Borra todos los ganadores y regresa el stock al total. Conserva premios y participantes.', peligro: true },
    { tipo: 'participantes', titulo: 'Vaciar participantes', detalle: 'Borra la lista de participantes (las fotos se conservan).', peligro: true },
    { tipo: 'fabrica', titulo: 'Reinicio de fábrica', detalle: 'Premios originales, sin ganadores, sin participantes y sin configuración.', peligro: true },
  ];

  ngOnInit() {
    this.cargar();
    this.api.config().subscribe(c => this.config = { ...c });
  }

  cargar() {
    this.api.resumen().subscribe(r => this.resumen.set(r));
    this.api.respaldos().subscribe(r => this.respaldos.set(r));
  }

  crear() {
    this.api.crearRespaldo().subscribe({
      next: r => { toast('success', `Respaldo creado: ${r.archivo}`); this.cargar(); },
      error: e => toast('error', mensajeError(e)),
    });
  }

  descargar(b: Respaldo) { this.api.descargarRespaldo(b.archivo).subscribe(blob => descargarBlob(blob, b.archivo)); }

  subir(evento: Event) {
    const input = evento.target as HTMLInputElement;
    const archivo = input.files?.[0];
    input.value = '';
    if (!archivo) return;
    this.api.subirRespaldo(archivo).subscribe({
      next: () => { toast('success', 'Respaldo subido. Ya puedes restaurarlo.'); this.cargar(); },
      error: e => toast('error', mensajeError(e)),
    });
  }

  private async confirmarEscribiendo(titulo: string, html: string, palabra: string) {
    const r = await swalNavidad.fire({
      icon: 'warning', title: titulo,
      html: `${html}<br><br>Escribe <b>${palabra}</b> para confirmar:`,
      input: 'text',
      showCancelButton: true, confirmButtonText: 'Confirmar', cancelButtonText: 'Cancelar',
      inputValidator: v => v === palabra ? null : `Escribe ${palabra} exactamente`,
    });
    return r.isConfirmed;
  }

  async restaurar(b: Respaldo) {
    const fecha = new Date(b.fecha).toLocaleString('es-MX');
    if (!await this.confirmarEscribiendo('¿Restaurar este respaldo?', `Todo se reemplazará por el contenido del respaldo del <b>${fecha}</b>. Antes se guardará un respaldo del estado actual.`, 'RESTAURAR')) return;
    this.api.restaurarRespaldo(b.archivo).subscribe({
      next: r => { toast('success', r.msg); this.cargar(); },
      error: e => toast('error', mensajeError(e)),
    });
  }

  async eliminar(b: Respaldo) {
    const r = await swalNavidad.fire({ icon: 'warning', title: '¿Eliminar este respaldo?', text: b.archivo, showCancelButton: true, confirmButtonText: 'Eliminar', cancelButtonText: 'Cancelar' });
    if (!r.isConfirmed) return;
    this.api.eliminarRespaldo(b.archivo).subscribe(() => { toast('info', 'Respaldo eliminado'); this.cargar(); });
  }

  async reiniciar(o: OpcionReinicio) {
    if (o.peligro && !await this.confirmarEscribiendo(`${o.titulo}`, o.detalle, 'REINICIAR')) return;
    this.api.reiniciar(o.tipo).subscribe({
      next: r => { toast('success', r.msg); this.cargar(); },
      error: e => toast('error', mensajeError(e)),
    });
  }

  guardarConfig() {
    this.api.guardarConfig(this.config).subscribe({
      next: c => { this.config = { ...c }; toast('success', 'Datos del evento guardados'); },
      error: e => toast('error', mensajeError(e)),
    });
  }
}
