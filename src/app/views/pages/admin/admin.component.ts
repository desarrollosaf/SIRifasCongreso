import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AdminApiService } from '../../../service/admin-api.service';
import { SorteoEnVivoService } from '../../../service/sorteo-en-vivo.service';
import { VersionService } from '../../../service/version.service';
import { NieveComponent } from '../../shared/navidad/nieve.component';
import { GuirnaldaComponent } from '../../shared/navidad/guirnalda.component';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, NieveComponent, GuirnaldaComponent],
  template: `
    @let estado = vivo.estado();
    <div class="adm nv-admin">
      <header class="adm-header nv nv-fondo-noche">
        <nv-nieve [cantidad]="70" />
        <nv-guirnalda [cantidad]="34" />
        <div class="adm-header-fila">
          <div class="adm-fila">
            <div class="adm-logos"><img src="images/navidad/web/logos.png" alt="Congreso del Estado de México" /></div>
            <div>
              <span class="nv-pill">Panel de administración</span>
              <h1><span class="nv-titulo-oro">{{ estado.evento['evento_titulo'] || 'Gran Sorteo Navideño' }} {{ estado.evento['evento_anio'] }}</span></h1>
              <div class="adm-sub">
                <span class="punto" [class.ok]="vivo.conectado()"></span>
                Pantalla: <b>{{ textoFase[estado.fase] }}</b> · {{ estado.restantes }} premios por entregar
              </div>
            </div>
          </div>
          <div class="adm-fila">
            <a class="nv-btn nv-btn-fantasma nv-btn-sm" href="/pantalla" target="sorteo-pantalla">📺 Abrir pantalla pública</a>
            <button class="nv-btn nv-btn-fantasma nv-btn-sm" (click)="salir()">Salir</button>
          </div>
        </div>
      </header>

      <nav class="adm-tabs">
        <a routerLink="sorteo" routerLinkActive="activo">🎁 Sorteo</a>
        <a routerLink="premios" routerLinkActive="activo">🏆 Premios</a>
        <a routerLink="participantes" routerLinkActive="activo">👥 Participantes</a>
        <a routerLink="ganadores" routerLinkActive="activo">📋 Ganadores</a>
        <a routerLink="base-datos" routerLinkActive="activo">🗄️ Base de datos</a>
      </nav>

      <main class="adm-contenido">
        @if (version.hayNueva()) {
          <div class="adm-aviso info adm-fila" style="justify-content:space-between">
            <span>🎁 Hay una versión nueva del sistema.</span>
            <button class="nv-btn nv-btn-oro nv-btn-sm" (click)="version.recargar()">Recargar</button>
          </div>
        }
        <router-outlet />
      </main>
    </div>
  `,
  styles: [`
    .punto { display: inline-block; width: 9px; height: 9px; border-radius: 50%; background: #e0314b; margin-right: .3rem;
             box-shadow: 0 0 8px currentColor; vertical-align: middle; }
    .punto.ok { background: #3ddc97; }
  `],
})
export class AdminComponent implements OnInit, OnDestroy {
  readonly vivo = inject(SorteoEnVivoService);
  readonly version = inject(VersionService);
  private api = inject(AdminApiService);
  private router = inject(Router);

  readonly textoFase: Record<string, string> = { espera: 'en espera', sorteando: 'sorteando…', premio: 'premio en espera de ganador', revelado: 'mostrando ganador' };

  ngOnInit() { this.vivo.conectar(); this.version.vigilar(); }
  ngOnDestroy() { this.vivo.desconectar(); }

  salir() {
    this.api.logout().subscribe({ complete: () => this.router.navigate(['/admin/login']) });
  }
}
