import { Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild, effect, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { enviroment } from '../../../../enviroments/enviroment';
import { SorteoEnVivoService } from '../../../service/sorteo-en-vivo.service';
import { VersionService } from '../../../service/version.service';
import { AdminApiService, PremioRef } from '../../../service/admin-api.service';
import { NieveComponent } from '../../shared/navidad/nieve.component';
import { GuirnaldaComponent } from '../../shared/navidad/guirnalda.component';
import { AvatarComponent } from '../../shared/navidad/avatar.component';
import { lanzarConfeti } from '../../shared/navidad/confeti';

interface PremioCarrusel extends PremioRef { cantidad: number; }

@Component({
  selector: 'app-pantalla',
  standalone: true,
  imports: [NieveComponent, GuirnaldaComponent, AvatarComponent],
  templateUrl: './pantalla.component.html',
  styleUrl: './pantalla.component.scss',
})
export class PantallaComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  readonly vivo = inject(SorteoEnVivoService);
  private version = inject(VersionService);
  readonly recurso = AdminApiService.recurso;

  @ViewChild('confeti', { static: true }) confeti!: ElementRef<HTMLCanvasElement>;

  premios = signal<PremioCarrusel[]>([]);
  indiceCarrusel = signal(0);
  indiceRuleta = signal(0);
  inactivo = signal(false);

  readonly bokeh = Array.from({ length: 16 }, (_, i) => ({
    x: (i * 61) % 100,
    y: (i * 37) % 100,
    t: 60 + (i * 47) % 140,
    c: ['rgba(255,214,140,.45)', 'rgba(255,90,100,.35)', 'rgba(120,230,170,.25)'][i % 3],
    d: 7 + (i % 5) * 2,
    delay: -(i % 7),
  }));

  readonly esferas = [
    { x: 14, largo: 70, t: 38, c: '#c8102e', d: 5, delay: 0 },
    { x: 22, largo: 120, t: 30, c: '#bb945c', d: 6, delay: -1.2 },
    { x: 78, largo: 105, t: 34, c: '#1f8a5b', d: 5.5, delay: -2 },
    { x: 86, largo: 60, t: 40, c: '#c8102e', d: 6.5, delay: -.6 },
  ];

  private timerCarrusel?: ReturnType<typeof setInterval>;
  private timerRuleta?: ReturnType<typeof setTimeout>;
  private timerInactivo?: ReturnType<typeof setTimeout>;
  private faseAnterior = '';
  private restantesAnterior = -1;

  constructor() {
    // Si hay una versión nueva, se recarga sola pero solo en espera (nunca a media revelación)
    effect(() => {
      if (this.version.hayNueva() && this.vivo.estado().fase === 'espera') this.version.recargar();
    });
    effect(() => {
      const estado = this.vivo.estado();
      if (estado.fase !== this.faseAnterior) {
        this.faseAnterior = estado.fase;
        if (estado.fase === 'sorteando') this.girarRuleta();
        if (estado.fase === 'premio') clearTimeout(this.timerRuleta);
        if (estado.fase === 'revelado') {
          clearTimeout(this.timerRuleta);
          setTimeout(() => lanzarConfeti(this.confeti.nativeElement), 150);
        }
      }
      if (estado.restantes !== this.restantesAnterior) {
        this.restantesAnterior = estado.restantes;
        this.cargarPremios();
      }
    });
  }

  ngOnInit() {
    this.vivo.conectar();
    this.version.vigilar();
    this.timerCarrusel = setInterval(() => {
      const total = this.premios().length;
      if (total > 0) this.indiceCarrusel.update(i => (i + 1) % total);
    }, 3800);
    this.moverRaton();
  }

  ngOnDestroy() {
    clearInterval(this.timerCarrusel);
    clearTimeout(this.timerRuleta);
    clearTimeout(this.timerInactivo);
    this.vivo.desconectar();
  }

  private cargarPremios() {
    this.http.get<PremioCarrusel[]>(`${enviroment.endpoint}api/sorteo/premios`).subscribe({
      next: premios => this.premios.set(premios),
      error: () => {},
    });
  }

  // Las imágenes de premios pasan cada vez más lento, como una ruleta
  private girarRuleta() {
    clearTimeout(this.timerRuleta);
    let espera = 70;
    const paso = () => {
      const total = Math.max(this.premios().length, 1);
      this.indiceRuleta.update(i => (i + 1) % total);
      espera = Math.min(espera * 1.09, 520);
      if (this.vivo.estado().fase === 'sorteando') this.timerRuleta = setTimeout(paso, espera);
    };
    paso();
  }

  // Oculta el cursor y el botón de pantalla completa si no se mueve el ratón
  @HostListener('document:mousemove')
  moverRaton() {
    this.inactivo.set(false);
    clearTimeout(this.timerInactivo);
    this.timerInactivo = setTimeout(() => this.inactivo.set(true), 3000);
  }

  @HostListener('document:keydown.f')
  pantallaCompleta() {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen().catch(() => {});
  }

  // Nombre de pila calculado en el servidor (en SAF el nombre suele venir como "APELLIDOS NOMBRES")
  saludo(ganador: { nombrePila?: string | null; nombre: string | null } | null): string {
    return ganador?.nombrePila || (ganador?.nombre || '').trim().split(/\s+/)[0] || '';
  }
}
