import { Injectable, OnDestroy, signal } from '@angular/core';

// Detecta cuando se publicó una versión nueva del frontend (cambia el main-XXXX.js de index.html).
// Útil para la pantalla del proyector, que puede quedarse abierta horas con código viejo.
@Injectable({ providedIn: 'root' })
export class VersionService implements OnDestroy {
  readonly hayNueva = signal(false);
  private actual = VersionService.mainDe(document.documentElement.outerHTML);
  private timer?: ReturnType<typeof setInterval>;

  private static mainDe(html: string): string | null {
    return html.match(/main-[A-Za-z0-9]+\.js/)?.[0] ?? null;
  }

  vigilar(cadaMs = 60000) {
    if (this.timer || !this.actual) return;
    this.timer = setInterval(async () => {
      try {
        const resp = await fetch(`/index.html?v=${Date.now()}`, { cache: 'no-store' });
        const nuevo = VersionService.mainDe(await resp.text());
        if (nuevo && nuevo !== this.actual) this.hayNueva.set(true);
      } catch { /* sin conexión: se reintenta en el siguiente ciclo */ }
    }, cadaMs);
  }

  recargar() { location.reload(); }

  ngOnDestroy() { clearInterval(this.timer); }
}
