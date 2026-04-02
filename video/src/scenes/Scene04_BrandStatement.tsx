import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  spring,
  useVideoConfig,
} from 'remotion';
import { COLORS, APP_SHORTCUTS } from '../constants';

/**
 * Scene 4 — "Impacto" (120 frames = 4s)
 * BIG animated stats. Scrolling module ribbon. Social proof.
 * No emojis as stats icons — uses bold numbers/symbols.
 */
export const Scene04_BrandStatement: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const countUp = (target: number, start: number, dur: number) =>
    Math.round(interpolate(frame, [start, start + dur], [0, target], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' }));

  const stats = [
    { number: countUp(8, 8, 30), suffix: '', label: 'Modulos\nintegrados' },
    { number: countUp(1, 12, 30), suffix: '', label: 'Unico\npainel' },
    { number: countUp(100, 16, 35), suffix: '%', label: 'Controle\ntotal' },
    { number: countUp(0, 20, 35), suffix: '', label: 'Planilhas\nnecessarias' },
  ];

  const headlineSpring = spring({ frame: frame - 5, fps, config: { damping: 14, stiffness: 60 } });

  const ribbonX = interpolate(frame, [0, 120], [80, -180], { extrapolateRight: 'clamp' });

  const socialOpacity = interpolate(frame, [65, 80], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });

  return (
    <AbsoluteFill style={{ backgroundColor: '#f0f2f9', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 30%, rgba(0,146,63,0.08), transparent 45%), radial-gradient(circle at 50% 70%, rgba(0,39,118,0.06), transparent 45%)' }} />

      {/* Headline */}
      <div
        style={{
          textAlign: 'center',
          paddingTop: 80,
          opacity: interpolate(headlineSpring, [0, 1], [0, 1]),
          transform: `translateY(${interpolate(headlineSpring, [0, 1], [24, 0])}px)`,
        }}
      >
        <div style={{ fontSize: 48, fontWeight: 700, color: COLORS.textPrimary, fontFamily: 'Inter, system-ui, sans-serif', lineHeight: 1.2, letterSpacing: -1 }}>
          Tudo que voce precisa.
        </div>
        <div style={{ fontSize: 48, fontWeight: 700, color: COLORS.primary, fontFamily: 'Inter, system-ui, sans-serif', lineHeight: 1.2, letterSpacing: -1 }}>
          Nada que voce nao precisa.
        </div>
      </div>

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 28, padding: '52px 100px 0' }}>
        {stats.map((stat, i) => {
          const s = spring({ frame: frame - 10 - i * 5, fps, config: { damping: 10, stiffness: 45 } });
          return (
            <div
              key={stat.label}
              style={{
                padding: '36px 28px',
                borderRadius: 24,
                background: 'rgba(255,255,255,0.95)',
                border: '1px solid rgba(0,39,118,0.06)',
                boxShadow: '0 8px 32px rgba(0,39,118,0.1)',
                textAlign: 'center',
                opacity: interpolate(s, [0, 1], [0, 1]),
                transform: `scale(${interpolate(s, [0, 1], [0.7, 1])}) translateY(${interpolate(s, [0, 1], [40, 0])}px)`,
              }}
            >
              <div style={{ fontSize: 64, fontWeight: 800, color: COLORS.accent, fontFamily: 'Inter, system-ui, sans-serif', lineHeight: 1 }}>
                {stat.number}{stat.suffix}
              </div>
              <div style={{ fontSize: 16, color: COLORS.textSecondary, marginTop: 12, fontFamily: 'Inter, system-ui, sans-serif', fontWeight: 500, whiteSpace: 'pre-line', lineHeight: 1.3 }}>
                {stat.label}
              </div>
            </div>
          );
        })}
      </div>

      {/* Module ribbon */}
      <div style={{ position: 'absolute', bottom: 120, left: 0, width: '250%', display: 'flex', gap: 16, transform: `translateX(${ribbonX}px)` }}>
        {[...APP_SHORTCUTS, ...APP_SHORTCUTS, ...APP_SHORTCUTS].map((app, i) => (
          <div key={`${app.name}-${i}`} style={{ padding: '12px 22px', borderRadius: 16, background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(0,39,118,0.06)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, boxShadow: '0 4px 16px rgba(0,39,118,0.06)' }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: `linear-gradient(135deg, ${app.color}, rgba(0, 39, 118, 0.85))`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: '#fff', fontFamily: 'Inter, system-ui, sans-serif' }}>{app.icon}</div>
            <span style={{ fontSize: 15, fontWeight: 600, color: COLORS.textPrimary, fontFamily: 'Inter, system-ui, sans-serif', whiteSpace: 'nowrap' }}>{app.name}</span>
          </div>
        ))}
      </div>

      {/* Social proof */}
      <div style={{ position: 'absolute', bottom: 50, width: '100%', textAlign: 'center', opacity: socialOpacity }}>
        <div style={{ fontSize: 18, color: COLORS.textSecondary, fontFamily: 'Inter, system-ui, sans-serif', fontWeight: 500 }}>
          Junte-se a quem ja organizou a vida com o Painel Admin
        </div>
      </div>
    </AbsoluteFill>
  );
};
