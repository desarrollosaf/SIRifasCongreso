import { Component, Input, OnInit } from '@angular/core';

// Guirnalda de foquitos que se mece (equivalente navideño del papel picado de ofrendas)
@Component({
  selector: 'nv-guirnalda',
  standalone: true,
  template: `
    <svg class="cable" viewBox="0 0 1000 60" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0,8 Q125,58 250,14 T500,14 T750,14 T1000,8" />
    </svg>
    <div class="focos">
      @for (f of focos; track $index) {
        <span class="foco" [style.left.%]="f.x" [style.top.px]="f.y"
              [style.--c]="f.color" [style.--delay]="f.delay + 's'"></span>
      }
    </div>
  `,
  styles: [`
    :host { position: absolute; left: 0; right: 0; top: 0; height: 70px; z-index: 3; pointer-events: none;
            transform-origin: top center; animation: nv-sway 6s ease-in-out infinite; }
    .cable { position: absolute; inset: 0; width: 100%; height: 60px; }
    .cable path { fill: none; stroke: #2c3b2f; stroke-width: 2.5; }
    .foco { position: absolute; width: 12px; height: 20px; margin-left: -6px; border-radius: 45% 45% 50% 50%;
            background: var(--c); box-shadow: 0 0 14px 3px var(--c), 0 0 32px 6px color-mix(in srgb, var(--c) 40%, transparent);
            animation: nv-twinkle 1.8s ease-in-out infinite; animation-delay: var(--delay); }
    .foco::before { content: ''; position: absolute; top: -6px; left: 2px; width: 8px; height: 7px; border-radius: 2px; background: #3d4a3f; }
  `],
})
export class GuirnaldaComponent implements OnInit {
  @Input() cantidad = 28;
  focos: { x: number; y: number; color: string; delay: number }[] = [];

  private colores = ['#ff4d5e', '#ffd36b', '#58e0a0', '#6bc4ff', '#ff9a3c', '#f2f2f2'];

  ngOnInit() {
    // Sigue la curva del cable (cuatro ondas)
    this.focos = Array.from({ length: this.cantidad }, (_, i) => {
      const x = (i + .5) / this.cantidad * 100;
      const onda = Math.sin((x / 100) * Math.PI * 4 - Math.PI / 2);
      return {
        x,
        y: 18 + (onda + 1) * 13,
        color: this.colores[i % this.colores.length],
        delay: (i % 6) * .3,
      };
    });
  }
}
