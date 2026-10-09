import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AdminApiService, mensajeError } from '../../../../service/admin-api.service';
import { NieveComponent } from '../../../shared/navidad/nieve.component';
import { GuirnaldaComponent } from '../../../shared/navidad/guirnalda.component';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [FormsModule, NieveComponent, GuirnaldaComponent],
  template: `
    <div class="login nv nv-fondo-noche">
      <nv-nieve [cantidad]="110" />
      <nv-guirnalda />
      <span class="nv-esfera" style="left:12%;height:90px;--c:#c8102e"></span>
      <span class="nv-esfera" style="left:20%;height:140px;--c:#bb945c;--delay:-1.4s;--t:28px"></span>
      <span class="nv-esfera" style="left:84%;height:110px;--c:#1f8a5b;--delay:-.7s"></span>

      <form class="tarjeta nv-rise" (ngSubmit)="entrar()">
        <div class="logos"><img src="images/navidad/web/logos.png" alt="Congreso del Estado de México" /></div>
        <span class="nv-pill">Panel de administración</span>
        <h1><span class="nv-titulo-oro">Sorteo Navideño</span></h1>

        @if (error()) { <div class="adm-aviso error">{{ error() }}</div> }

        <label>Usuario</label>
        <input class="adm-input" name="usuario" [(ngModel)]="usuario" autocomplete="username" required />
        <label>Contraseña</label>
        <input class="adm-input" name="password" type="password" [(ngModel)]="password" autocomplete="current-password" required />

        <button class="nv-btn nv-btn-oro nv-btn-lg" type="submit" [disabled]="cargando()">
          {{ cargando() ? 'Entrando…' : '🎄 Entrar' }}
        </button>
      </form>
    </div>
  `,
  styles: [`
    .login { position: fixed; inset: 0; display: grid; place-items: center; overflow: hidden; padding: 1rem; }
    .tarjeta { position: relative; z-index: 4; width: min(420px, 100%); display: flex; flex-direction: column; gap: .6rem;
               text-align: center; align-items: stretch; padding: 2rem 2rem 2.2rem; border-radius: 26px;
               background: rgba(11, 35, 30, .72); border: 1px solid rgba(233, 207, 150, .35); backdrop-filter: blur(10px);
               box-shadow: 0 30px 80px rgba(0, 0, 0, .5); }
    .logos { background: #fff; border-radius: 16px; padding: .5rem 1rem; margin-bottom: .4rem; }
    .logos img { width: 100%; display: block; }
    .nv-pill { align-self: center; }
    h1 { font-size: 2.4rem; margin: .3rem 0 .6rem; font-weight: 800; }
    label { text-align: left; font-size: .85rem; color: rgba(247, 243, 234, .75); margin-top: .3rem; }
    .nv-btn { margin-top: 1rem; }
  `],
})
export class AdminLoginComponent {
  private api = inject(AdminApiService);
  private router = inject(Router);
  usuario = 'admin';
  password = '';
  cargando = signal(false);
  error = signal('');

  entrar() {
    this.cargando.set(true);
    this.error.set('');
    this.api.login(this.usuario, this.password).subscribe({
      next: () => this.router.navigate(['/admin']),
      error: (e) => { this.error.set(mensajeError(e, 'No se pudo iniciar sesión')); this.cargando.set(false); },
    });
  }
}
