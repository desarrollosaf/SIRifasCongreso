import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime } from 'rxjs';
import { HttpEventType } from '@angular/common/http';
import { AdminApiService, EstadoDescarga, EstadoImportSql, Participante, mensajeError } from '../../../../service/admin-api.service';
import { AvatarComponent } from '../../../shared/navidad/avatar.component';
import { swalNavidad, toast } from '../sorteo/admin-sorteo.component';

@Component({
  selector: 'app-admin-participantes',
  standalone: true,
  imports: [FormsModule, AvatarComponent],
  templateUrl: './admin-participantes.component.html',
})
export class AdminParticipantesComponent implements OnInit, OnDestroy {
  private api = inject(AdminApiService);

  datos = signal<Participante[]>([]);
  stats = signal({ total: 0, conFoto: 0, fotosSinParticipante: 0, filtrados: 0 });
  q = '';
  foto = '';
  pagina = 1;
  readonly limite = 50;
  private busqueda$ = new Subject<void>();

  archivoLista: File | null = null;
  modo: 'agregar' | 'reemplazar' = 'agregar';
  resultadoImport = signal('');
  resultadoFotos = signal<{ msg: string; sinParticipante: string[]; rechazadas: string[] } | null>(null);
  subiendo = signal(false);
  encima = signal(false);

  editando = signal<number | null>(null);
  form = { rfc: '', nombre: '', area: '', direccion: '' };

  // Sincronización con SAF
  modoSaf: 'agregar' | 'reemplazar' = 'reemplazar';
  infoSaf = signal<{ ok: boolean; texto: string } | null>(null);
  archivoSql: File | null = null;
  importandoSql = signal(false);
  progresoSubida = signal(0);
  estadoSql = signal<EstadoImportSql | null>(null);
  private timerSql?: ReturnType<typeof setInterval>;
  safMensaje = signal<{ tipo: 'ok' | 'error' | 'info'; texto: string } | null>(null);
  sincronizando = signal(false);
  descarga = signal<EstadoDescarga | null>(null);
  private timerDescarga?: ReturnType<typeof setInterval>;

  ngOnInit() {
    this.busqueda$.pipe(debounceTime(300)).subscribe(() => { this.pagina = 1; this.cargar(); });
    this.cargar();
    this.api.estadoDescarga().subscribe(d => { if (d.total) this.descarga.set(d); if (d.activo) this.seguirDescarga(); });
    this.probarSaf();
    this.api.estadoSqlSaf().subscribe(e => { if (e.activo) { this.progresoSubida.set(100); this.importandoSql.set(true); this.estadoSql.set(e); this.seguirSql(); } });
  }

  ngOnDestroy() { clearInterval(this.timerDescarga); clearInterval(this.timerSql); }

  probarSaf() {
    this.api.safProbar().subscribe({
      next: r => this.infoSaf.set({
        ok: true,
        texto: `Base de usuarios cargada: ${r.activos} servidores públicos activos` +
          (r.actualizado ? ` · actualizada el ${new Date(r.actualizado).toLocaleString('es-MX')}` : '') +
          (r.archivo ? ` con ${r.archivo}` : ''),
      }),
      error: () => this.infoSaf.set({ ok: false, texto: 'Todavía no hay base de usuarios cargada. Sube el respaldo .sql de SAF.' }),
    });
  }

  elegirSql(evento: Event) { this.archivoSql = (evento.target as HTMLInputElement).files?.[0] || null; }

  async subirSql() {
    if (!this.archivoSql) return;
    const r = await swalNavidad.fire({
      icon: 'question', title: '¿Actualizar la base de usuarios?',
      html: `Se reemplazará la base de usuarios con <b>${this.archivoSql.name}</b> y se actualizará la lista del sorteo.<br>El historial de ganadores no se toca.`,
      showCancelButton: true, confirmButtonText: 'Sí, actualizar', cancelButtonText: 'Cancelar',
    });
    if (!r.isConfirmed) return;
    this.importandoSql.set(true);
    this.progresoSubida.set(0);
    this.estadoSql.set(null);
    this.safMensaje.set(null);
    this.api.subirSqlSaf(this.archivoSql, this.modoSaf).subscribe({
      next: ev => {
        if (ev.type === HttpEventType.UploadProgress && ev.total) this.progresoSubida.set(Math.round(ev.loaded / ev.total * 100));
        if (ev.type === HttpEventType.Response) { this.progresoSubida.set(100); this.estadoSql.set(ev.body); this.seguirSql(); }
      },
      error: e => { this.importandoSql.set(false); this.progresoSubida.set(0); this.safMensaje.set({ tipo: 'error', texto: mensajeError(e) }); },
    });
  }

  private seguirSql() {
    clearInterval(this.timerSql);
    this.timerSql = setInterval(() => {
      this.api.estadoSqlSaf().subscribe(e => {
        this.estadoSql.set(e);
        if (!e.activo) {
          clearInterval(this.timerSql);
          this.importandoSql.set(false);
          this.safMensaje.set({ tipo: e.error ? 'error' : 'ok', texto: e.mensaje });
          this.probarSaf();
          this.cargar();
        }
      });
    }, 1500);
  }

  importarSaf() {
    this.sincronizando.set(true);
    this.safMensaje.set({ tipo: 'info', texto: 'Importando servidores públicos desde SAF…' });
    this.api.safImportar(this.modoSaf).subscribe({
      next: r => { this.sincronizando.set(false); this.safMensaje.set({ tipo: 'ok', texto: `${r.msg}. Total en el sorteo: ${r.total}.` }); this.cargar(); },
      error: e => { this.sincronizando.set(false); this.safMensaje.set({ tipo: 'error', texto: mensajeError(e) }); },
    });
  }

  descargarFotos(todas: boolean) {
    this.api.descargarFotos(todas).subscribe({
      next: d => { this.descarga.set(d); if (d.activo) this.seguirDescarga(); },
      error: e => toast('error', mensajeError(e)),
    });
  }

  detenerFotos() { this.api.detenerDescarga().subscribe(d => this.descarga.set(d)); }

  private seguirDescarga() {
    clearInterval(this.timerDescarga);
    this.timerDescarga = setInterval(() => {
      this.api.estadoDescarga().subscribe(d => {
        this.descarga.set(d);
        if (!d.activo) { clearInterval(this.timerDescarga); this.cargar(); }
      });
    }, 1500);
  }

  porcentaje(d: EstadoDescarga) { return d.total ? Math.round(d.procesadas / d.total * 100) : 100; }

  get paginas() { return Math.max(1, Math.ceil(this.stats().filtrados / this.limite)); }

  buscar() { this.busqueda$.next(); }

  cargar() {
    this.api.participantes({ q: this.q, foto: this.foto, pagina: this.pagina, limite: this.limite }).subscribe(r => {
      this.datos.set(r.datos);
      this.stats.set({ total: r.total, conFoto: r.conFoto, fotosSinParticipante: r.fotosSinParticipante, filtrados: r.filtrados });
    });
  }

  irA(pagina: number) { this.pagina = Math.min(Math.max(1, pagina), this.paginas); this.cargar(); }

  elegirLista(evento: Event) { this.archivoLista = (evento.target as HTMLInputElement).files?.[0] || null; }

  async importar() {
    if (!this.archivoLista) return;
    if (this.modo === 'reemplazar') {
      const r = await swalNavidad.fire({
        icon: 'warning', title: '¿Reemplazar toda la lista?',
        text: 'Se borrarán los participantes actuales y se cargarán los del archivo. (Se conserva el historial de ganadores.)',
        showCancelButton: true, confirmButtonText: 'Reemplazar', cancelButtonText: 'Cancelar',
      });
      if (!r.isConfirmed) return;
    }
    this.subiendo.set(true);
    this.api.importarParticipantes(this.archivoLista, this.modo).subscribe({
      next: r => {
        this.subiendo.set(false);
        this.resultadoImport.set(`${r.msg}: ${r.importados} participantes importados` +
          (r.sinRfc ? ` · ${r.sinRfc} filas sin RFC omitidas` : '') +
          (r.duplicadosEnArchivo ? ` · ${r.duplicadosEnArchivo} RFC repetidos en el archivo (se tomó la primera fila)` : '') +
          ` · Total: ${r.total}`);
        this.cargar();
      },
      error: e => { this.subiendo.set(false); toast('error', mensajeError(e)); },
    });
  }

  soltarFotos(evento: DragEvent) {
    evento.preventDefault();
    this.encima.set(false);
    const archivos = Array.from(evento.dataTransfer?.files || []);
    if (archivos.length) this.subirFotos(archivos);
  }

  elegirFotos(evento: Event) {
    const input = evento.target as HTMLInputElement;
    const archivos = Array.from(input.files || []);
    if (archivos.length) this.subirFotos(archivos);
    input.value = '';
  }

  private subirFotos(archivos: File[]) {
    this.subiendo.set(true);
    this.api.subirFotos(archivos).subscribe({
      next: r => { this.subiendo.set(false); this.resultadoFotos.set(r); this.cargar(); },
      error: e => { this.subiendo.set(false); toast('error', mensajeError(e)); },
    });
  }

  subirFotoDe(p: Participante, evento: Event) {
    const archivo = (evento.target as HTMLInputElement).files?.[0];
    if (!archivo) return;
    const ext = archivo.name.substring(archivo.name.lastIndexOf('.'));
    const renombrado = new File([archivo], p.rfc + ext, { type: archivo.type });
    this.api.subirFotos([renombrado]).subscribe({
      next: () => { toast('success', 'Foto actualizada'); this.cargar(); },
      error: e => toast('error', mensajeError(e)),
    });
  }

  async quitarFoto(p: Participante) {
    const r = await swalNavidad.fire({ icon: 'warning', title: `¿Quitar la foto de ${p.nombre || p.rfc}?`, showCancelButton: true, confirmButtonText: 'Quitar', cancelButtonText: 'Cancelar' });
    if (!r.isConfirmed) return;
    this.api.eliminarFoto(p.rfc).subscribe(() => { toast('info', 'Foto eliminada'); this.cargar(); });
  }

  nuevo() { this.form = { rfc: '', nombre: '', area: '', direccion: '' }; this.editando.set(0); }

  editar(p: Participante) { this.form = { rfc: p.rfc, nombre: p.nombre || '', area: p.area || '', direccion: p.direccion || '' }; this.editando.set(p.id); }

  guardar() {
    const id = this.editando();
    const peticion = id ? this.api.actualizarParticipante(id, this.form) : this.api.crearParticipante(this.form);
    peticion.subscribe({
      next: () => { toast('success', 'Participante guardado'); this.editando.set(null); this.cargar(); },
      error: e => toast('error', mensajeError(e)),
    });
  }

  async eliminar(p: Participante) {
    const r = await swalNavidad.fire({ icon: 'warning', title: `¿Eliminar a ${p.nombre || p.rfc}?`, showCancelButton: true, confirmButtonText: 'Eliminar', cancelButtonText: 'Cancelar' });
    if (!r.isConfirmed) return;
    this.api.eliminarParticipante(p.id).subscribe(() => { toast('info', 'Participante eliminado'); this.cargar(); });
  }
}
