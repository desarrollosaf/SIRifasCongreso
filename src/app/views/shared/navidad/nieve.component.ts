import { AfterViewInit, Component, ElementRef, Input, NgZone, OnDestroy, ViewChild, inject } from '@angular/core';

interface Copo { x: number; y: number; r: number; vy: number; vx: number; fase: number; oro: boolean; }

// Nieve cayendo con algunos destellos dorados (canvas: ligero aun en un proyector)
@Component({
  selector: 'nv-nieve',
  standalone: true,
  template: `<canvas #lienzo></canvas>`,
  styles: [`:host { position: absolute; inset: 0; pointer-events: none; z-index: 1; } canvas { width: 100%; height: 100%; display: block; }`],
})
export class NieveComponent implements AfterViewInit, OnDestroy {
  @Input() cantidad = 140;
  @ViewChild('lienzo', { static: true }) lienzo!: ElementRef<HTMLCanvasElement>;
  private zone = inject(NgZone);
  private copos: Copo[] = [];
  private frame = 0;
  private observador?: ResizeObserver;

  ngAfterViewInit() {
    const canvas = this.lienzo.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const reducir = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const ajustar = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    ajustar();
    this.observador = new ResizeObserver(ajustar);
    this.observador.observe(canvas);

    const w = () => canvas.clientWidth;
    const h = () => canvas.clientHeight;
    const nuevo = (arriba: boolean): Copo => ({
      x: Math.random() * w(),
      y: arriba ? -10 : Math.random() * h(),
      r: Math.random() * 2.6 + .8,
      vy: Math.random() * .7 + .35,
      vx: Math.random() * .4 - .2,
      fase: Math.random() * Math.PI * 2,
      oro: Math.random() < .12,
    });
    this.copos = Array.from({ length: this.cantidad }, () => nuevo(false));

    const dibujar = (t: number) => {
      ctx.clearRect(0, 0, w(), h());
      for (const c of this.copos) {
        if (!reducir) {
          c.y += c.vy;
          c.x += c.vx + Math.sin(t / 1400 + c.fase) * .35;
          if (c.y > h() + 10) Object.assign(c, nuevo(true));
        }
        ctx.beginPath();
        if (c.oro) {
          const brillo = .55 + Math.sin(t / 300 + c.fase) * .45;
          ctx.fillStyle = `rgba(255, 223, 150, ${brillo})`;
          ctx.shadowColor = 'rgba(255, 215, 130, .9)';
          ctx.shadowBlur = 8;
        } else {
          ctx.fillStyle = 'rgba(255, 255, 255, .85)';
          ctx.shadowBlur = 0;
        }
        ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
        ctx.fill();
      }
      if (!reducir) this.frame = requestAnimationFrame(dibujar);
    };
    this.zone.runOutsideAngular(() => { this.frame = requestAnimationFrame(dibujar); });
  }

  ngOnDestroy() {
    cancelAnimationFrame(this.frame);
    this.observador?.disconnect();
  }
}
