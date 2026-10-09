import { Routes } from '@angular/router';
import { BaseComponent } from './views/layout/base/base.component';
import { authGuard } from './core/guards/auth.guard';
import { UserAccessGuard } from './views/pages/auth/user-access.guard';
import { RedirectComponent } from './views/pages/auth/redirect.component';
import { adminGuard } from './views/pages/admin/admin.guard';
export const routes: Routes = [
  { path: 'auth', loadChildren: () => import('./views/pages/auth/auth.routes')},

  {
    path: '',
    redirectTo: 'admin',
    pathMatch: 'full'
  },
  // Pantalla pública del sorteo (para proyector)
  {
    path: 'pantalla',
    loadComponent: () =>
      import('./views/pages/pantalla/pantalla.component').then((c) => c.PantallaComponent)
  },
  // Panel de administración del sorteo
  {
    path: 'admin/login',
    loadComponent: () =>
      import('./views/pages/admin/login/admin-login.component').then((c) => c.AdminLoginComponent)
  },
  {
    path: 'admin',
    canActivate: [adminGuard],
    loadComponent: () => import('./views/pages/admin/admin.component').then((c) => c.AdminComponent),
    children: [
      { path: '', redirectTo: 'sorteo', pathMatch: 'full' },
      { path: 'sorteo', loadComponent: () => import('./views/pages/admin/sorteo/admin-sorteo.component').then(c => c.AdminSorteoComponent) },
      { path: 'premios', loadComponent: () => import('./views/pages/admin/premios/admin-premios.component').then(c => c.AdminPremiosComponent) },
      { path: 'participantes', loadComponent: () => import('./views/pages/admin/participantes/admin-participantes.component').then(c => c.AdminParticipantesComponent) },
      { path: 'ganadores', loadComponent: () => import('./views/pages/admin/ganadores/admin-ganadores.component').then(c => c.AdminGanadoresComponent) },
      { path: 'base-datos', loadComponent: () => import('./views/pages/admin/base-datos/admin-base-datos.component').then(c => c.AdminBaseDatosComponent) },
    ]
  },
  // Rutas anteriores
  { path: 'sorteo', redirectTo: 'pantalla', pathMatch: 'full' },
  { path: 'home/:tipo', redirectTo: 'admin', pathMatch: 'full' },
  {
    path: 'partido/:tipo',
    loadComponent: () =>
      import('./views/pages/partido/partido.component').then((c) => c.PartidoComponent)
  },
  {
    path: '',
    component: BaseComponent,
    canActivateChild: [authGuard],
    children: [
      { path: '',  component: RedirectComponent,
      },
      {
        path: 'citas',
        loadComponent: () => import('./views/pages/citas/citas.component').then(c => c.CitasComponent)
      },
      {
        path: 'reportes',
        canActivateChild: [UserAccessGuard],
        loadChildren: () => import('./views/pages/reportes/reportes.route')
      }
    ]
  },
  {
    path: 'error',
    loadComponent: () => import('./views/pages/error/error.component').then(c => c.ErrorComponent),
  },
  {
    path: 'error/:type',
    loadComponent: () => import('./views/pages/error/error.component').then(c => c.ErrorComponent)
  },
  { path: '**', redirectTo: 'error/404', pathMatch: 'full' }
];
