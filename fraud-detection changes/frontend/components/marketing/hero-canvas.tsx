'use client';

import { useEffect, useRef } from 'react';

export function HeroCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let w = 0;
    let h = 0;
    const nodes: { x: number; y: number; z: number; fraud: boolean; pulse: number }[] = [];
    const N = 280;

    const resize = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * devicePixelRatio;
      canvas.height = h * devicePixelRatio;
      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    };

    const init = () => {
      nodes.length = 0;
      for (let i = 0; i < N; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const r = 0.35 + Math.random() * 0.55;
        nodes.push({
          x: r * Math.sin(phi) * Math.cos(theta),
          y: r * Math.sin(phi) * Math.sin(theta),
          z: r * Math.cos(phi),
          fraud: Math.random() < 0.04,
          pulse: Math.random(),
        });
      }
    };

    let rot = 0;
    let mx = 0;
    let my = 0;

    const onMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mx = (e.clientX - rect.left) / rect.width - 0.5;
      my = (e.clientY - rect.top) / rect.height - 0.5;
    };

    const draw = () => {
      rot += 0.0012;
      ctx.fillStyle = '#0a0a0f';
      ctx.fillRect(0, 0, w, h);

      const cx = w / 2 + mx * 24;
      const cy = h / 2 + my * 24;
      const scale = Math.min(w, h) * 0.42;

      const projected: { x: number; y: number; z: number; i: number }[] = [];

      nodes.forEach((n, i) => {
        const x1 = n.x * Math.cos(rot) - n.z * Math.sin(rot);
        const z1 = n.x * Math.sin(rot) + n.z * Math.cos(rot);
        const y1 = n.y;
        const f = 1 / (1.8 - z1);
        projected.push({ x: cx + x1 * scale * f, y: cy + y1 * scale * f, z: z1, i });
      });

      projected.sort((a, b) => a.z - b.z);

      ctx.strokeStyle = 'rgba(99,102,241,0.12)';
      ctx.lineWidth = 0.5;
      for (let i = 0; i < projected.length; i++) {
        for (let j = i + 1; j < projected.length && j < i + 4; j++) {
          const a = projected[i]!;
          const b = projected[j]!;
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          if (dx * dx + dy * dy < 3600) {
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      projected.forEach((p) => {
        const n = nodes[p.i]!;
        if (Math.random() < 0.002) n.fraud = !n.fraud;
        const r = 1.2 + (p.z + 1) * 1.2 + (n.fraud ? Math.sin(Date.now() / 200 + n.pulse * 10) * 0.8 : 0);
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fillStyle = n.fraud ? '#ef4444' : '#6366f1';
        ctx.globalAlpha = 0.35 + (p.z + 1) * 0.35;
        ctx.fill();
        ctx.globalAlpha = 1;
      });

      raf = requestAnimationFrame(draw);
    };

    resize();
    init();
    window.addEventListener('resize', resize);
    canvas.addEventListener('mousemove', onMove);
    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('mousemove', onMove);
    };
  }, []);

  return <canvas ref={ref} className="absolute inset-0 h-full w-full" aria-hidden />;
}
