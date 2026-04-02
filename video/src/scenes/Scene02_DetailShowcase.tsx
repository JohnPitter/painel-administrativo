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
 * Scene 2 — "A Virada" (90 frames = 3s)
 * White flash fades to reveal the FULL dashboard with all 8 cards cascading in.
 * Bigger cards, richer design. Ends stable and complete.
 */
export const Scene02_DetailShowcase: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const flashOpacity = interpolate(frame, [0, 18], [1, 0], { extrapolateRight: 'clamp' });
  const revealScale = interpolate(frame, [0, 30], [1.12, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });

  const headerSpring = spring({ frame: frame - 6, fps, config: { damping: 14, stiffness: 60 } });

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.background, overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute', inset: 0,
          background: `
            radial-gradient(circle at 20% 20%, rgba(0, 146, 63, 0.1), transparent 50%),
            radial-gradient(circle at 80% 80%, rgba(0, 39, 118, 0.12), transparent 50%),
            linear-gradient(180deg, #f8f9fd, #eef1f8)
          `,
        }}
      />

      <div style={{ transform: `scale(${revealScale})`, width: '100%', height: '100%' }}>
        {/* Header — big and clear */}
        <div
          style={{
            padding: '52px 72px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            opacity: interpolate(headerSpring, [0, 1], [0, 1]),
            transform: `translateY(${interpolate(headerSpring, [0, 1], [24, 0])}px)`,
          }}
        >
          <div>
            <div style={{ display: 'inline-flex', padding: '8px 20px', borderRadius: 999, background: 'rgba(0, 39, 118, 0.1)', fontSize: 14, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: COLORS.accent, fontFamily: 'Inter, system-ui, sans-serif', marginBottom: 12 }}>
              Painel Administrativo
            </div>
            <div style={{ fontSize: 42, fontWeight: 700, color: COLORS.textPrimary, fontFamily: 'Inter, system-ui, sans-serif', letterSpacing: -0.5 }}>
              Seus apps, seu controle
            </div>
          </div>

          {/* User avatar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 20px', background: 'rgba(255,255,255,0.9)', borderRadius: 20, boxShadow: '0 8px 24px rgba(0, 39, 118, 0.1)' }}>
            <div style={{ width: 52, height: 52, borderRadius: 16, background: 'linear-gradient(135deg, #002776, #001e57)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 22, fontWeight: 700, fontFamily: 'Inter, system-ui, sans-serif' }}>J</div>
            <div>
              <div style={{ fontWeight: 700, color: COLORS.textPrimary, fontSize: 16, fontFamily: 'Inter, system-ui, sans-serif' }}>Joao Pedro</div>
              <div style={{ fontSize: 13, color: COLORS.primary, fontWeight: 600, fontFamily: 'Inter, system-ui, sans-serif' }}>Assinante Ativo</div>
            </div>
          </div>
        </div>

        {/* 8 app cards — 2 rows of 4 */}
        <div style={{ padding: '12px 72px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
          {APP_SHORTCUTS.map((app, i) => {
            const s = spring({ frame: frame - 12 - i * 3, fps, config: { damping: 10, stiffness: 45 } });
            const scale = interpolate(s, [0, 1], [0.6, 1]);
            const opacity = interpolate(s, [0, 1], [0, 1]);
            const yOff = interpolate(s, [0, 1], [50, 0]);

            return (
              <div
                key={app.name}
                style={{
                  padding: '28px 24px',
                  borderRadius: 22,
                  background: 'rgba(255, 255, 255, 0.95)',
                  border: '1px solid rgba(0, 39, 118, 0.06)',
                  boxShadow: '0 8px 32px rgba(0, 39, 118, 0.1)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 16,
                  transform: `scale(${scale}) translateY(${yOff}px)`,
                  opacity,
                }}
              >
                <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                  <div style={{ width: 56, height: 56, borderRadius: 16, background: `linear-gradient(135deg, ${app.color}, rgba(0, 39, 118, 0.85))`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 700, color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', boxShadow: `0 4px 16px ${app.color}30` }}>
                    {app.icon}
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.textPrimary, fontFamily: 'Inter, system-ui, sans-serif' }}>
                    {app.name}
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <div style={{ padding: '8px 18px', borderRadius: 999, background: `${app.color}12`, color: app.color, fontWeight: 700, fontSize: 13, fontFamily: 'Inter, system-ui, sans-serif' }}>
                    Abrir
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Flash overlay */}
      <div style={{ position: 'absolute', inset: 0, backgroundColor: '#fff', opacity: flashOpacity, pointerEvents: 'none' }} />
    </AbsoluteFill>
  );
};
