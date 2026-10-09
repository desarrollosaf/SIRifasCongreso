// Explosión de confeti dorado y rojo sobre un canvas a pantalla completa
export const lanzarConfeti = (canvas: HTMLCanvasElement, duracionMs = 4500) => {
  const ctx = canvas.getContext('2d');
  if (!ctx || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const colores = ['#e9cf96', '#bb945c', '#ffe7a8', '#c8102e', '#ff4d5e', '#1f8a5b', '#ffffff'];
  const piezas = Array.from({ length: 220 }, (_, i) => {
    const desdeIzq = i % 2 === 0;
    const angulo = (desdeIzq ? -60 : -120) * Math.PI / 180 + (Math.random() - .5) * .9;
    const v = Math.random() * 14 + 9;
    return {
      x: desdeIzq ? w * .08 : w * .92,
      y: h * .85,
      vx: Math.cos(angulo) * v,
      vy: Math.sin(angulo) * v,
      giro: Math.random() * Math.PI,
      vgiro: (Math.random() - .5) * .3,
      ancho: Math.random() * 8 + 5,
      alto: Math.random() * 5 + 3,
      color: colores[Math.floor(Math.random() * colores.length)],
      circulo: Math.random() < .25,
    };
  });

  const inicio = performance.now();
  const paso = (t: number) => {
    const transcurrido = t - inicio;
    ctx.clearRect(0, 0, w, h);
    ctx.globalAlpha = Math.max(0, 1 - Math.max(0, transcurrido - duracionMs * .65) / (duracionMs * .35));
    for (const p of piezas) {
      p.vy += .28;
      p.vx *= .985;
      p.vy *= .985;
      p.x += p.vx;
      p.y += p.vy;
      p.giro += p.vgiro;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.giro);
      ctx.fillStyle = p.color;
      if (p.circulo) {
        ctx.beginPath();
        ctx.arc(0, 0, p.alto, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(-p.ancho / 2, -p.alto / 2, p.ancho, p.alto * Math.abs(Math.cos(p.giro * 2)) + 1);
      }
      ctx.restore();
    }
    if (transcurrido < duracionMs) requestAnimationFrame(paso);
    else ctx.clearRect(0, 0, w, h);
  };
  requestAnimationFrame(paso);
};
