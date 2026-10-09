import { Component, Input } from '@angular/core';
import { AdminApiService } from '../../../service/admin-api.service';

// Foto de credencial en documentacionsaf (respaldo cuando no se descargó la foto local y hay internet)
const FOTO_REMOTA = (rfc: string) => `https://documentacionsaf.gob.mx/credenciales/storage/credenciales/${encodeURIComponent(rfc)}.jpg`;

// Foto del participante (ligada a su RFC) o sus iniciales si no hay foto
@Component({
  selector: 'nv-avatar',
  standalone: true,
  template: `
    <div class="nv-avatar" [style.width.px]="tamano" [style.height.px]="tamano" [style.font-size.px]="tamano * .36">
      @if (fuente(); as src) {
        <img [src]="src" [alt]="nombre || rfc || 'Foto'" (error)="intento = intento + 1" />
      } @else {
        <span>{{ iniciales }}</span>
      }
    </div>
  `,
  styles: [`:host { display: inline-block; line-height: 0; } span { line-height: 1; }`],
})
export class AvatarComponent {
  @Input() tamano = 48;
  @Input() nombre: string | null = null;
  @Input() remota = true;
  intento = 0;
  private local: string | null = null;
  private _rfc: string | null = null;

  @Input() set rfc(valor: string | null) { this._rfc = valor; this.intento = 0; }
  get rfc() { return this._rfc; }

  @Input() set fotoUrl(valor: string | null | undefined) {
    this.intento = 0;
    this.local = AdminApiService.recurso(valor);
  }

  // Orden: foto local → foto de credencial en línea → iniciales
  fuente(): string | null {
    const opciones = [this.local, this.remota && this._rfc ? FOTO_REMOTA(this._rfc) : null].filter(Boolean) as string[];
    return opciones[this.intento] ?? null;
  }

  get iniciales(): string {
    const base = (this.nombre || this.rfc || '?').trim();
    const partes = base.split(/\s+/).filter(Boolean);
    return (partes.length > 1 ? partes[0][0] + partes[1][0] : base.slice(0, 2)).toUpperCase();
  }
}
