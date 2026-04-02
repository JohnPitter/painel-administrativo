import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  spring,
  useVideoConfig,
} from 'remotion';
import { COLORS, BRAND } from '../constants';

/**
 * Scene 5 — "CTA Urgente" (120 frames = 4s)
 * Big headline, pulsing button, "7 dias gratis" badge.
 * Elegant close: content stays visible while background gently shifts.
 * Final 20 frames: brand logo on gradient — satisfying close, not cut.
 */
export const Scene05_CTA: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const chipSpring = spring({ frame: frame - 3, fps, config: { damping: 14, stiffness: 60 } });
  const headSpring = spring({ frame: frame - 8, fps, config: { damping: 12, stiffness: 55 } });
  const subSpring = spring({ frame: frame - 20, fps, config: { damping: 14, stiffness: 60 } });
  const ctaSpring = spring({ frame: frame - 32, fps, config: { damping: 10, stiffness: 45 } });
  const badgeSpring = spring({ frame: frame - 48, fps, config: { damping: 12, stiffness: 55 } });
  const urlSpring = spring({ frame: frame - 55, fps, config: { damping: 14, stiffness: 60 } });

  // Button pulse — breathe effect
  const pulse = 1 + Math.sin(frame * 0.12) * 0.03;
  const glowPulse = 0.3 + Math.sin(frame * 0.12) * 0.3;

  // Closing: everything fades, brand appears
  const contentFade = interpolate(frame, [92, 105], [1, 0], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });
  const brandFade = interpolate(frame, [98, 112], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });
  const bgGradient = interpolate(frame, [90, 110], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });

  return (
    <AbsoluteFill style={{ backgroundColor: '#eef1f8', overflow: 'hidden' }}>
      {/* Base gradient */}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 40%, rgba(0,146,63,0.08), transparent 40%), radial-gradient(circle at 50% 60%, rgba(0,39,118,0.06), transparent 40%)' }} />

      {/* Closing gradient overlay */}
      <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.accent})`, opacity: bgGradient, pointerEvents: 'none' }} />

      {/* Main content */}
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', width: '85%', opacity: contentFade }}>
        {/* Chip */}
        <div style={{
          display: 'inline-flex', padding: '10px 28px', borderRadius: 999,
          background: 'rgba(0,39,118,0.1)', fontSize: 15, fontWeight: 700,
          letterSpacing: '0.1em', textTransform: 'uppercase' as const,
          color: COLORS.accent, fontFamily: 'Inter, system-ui, sans-serif',
          marginBottom: 32,
          opacity: interpolate(chipSpring, [0, 1], [0, 1]),
          transform: `scale(${interpolate(chipSpring, [0, 1], [0.9, 1])})`,
        }}>
          {BRAND.name}
        </div>

        {/* Headline */}
        <div style={{
          fontSize: 62, fontWeight: 700, color: COLORS.textPrimary,
          fontFamily: 'Inter, system-ui, sans-serif', letterSpacing: -1.5, lineHeight: 1.1,
          opacity: interpolate(headSpring, [0, 1], [0, 1]),
          transform: `translateY(${interpolate(headSpring, [0, 1], [30, 0])}px)`,
        }}>
          Comece a organizar
          <br />
          <span style={{ color: COLORS.primary }}>sua vida hoje</span>
        </div>

        {/* Sub */}
        <div style={{
          fontSize: 22, fontWeight: 400, color: COLORS.textSecondary,
          fontFamily: 'Inter, system-ui, sans-serif', marginTop: 20, letterSpacing: 0.3,
          opacity: interpolate(subSpring, [0, 1], [0, 1]),
          transform: `translateY(${interpolate(subSpring, [0, 1], [16, 0])}px)`,
        }}>
          Financas, tarefas, calendario e mais — tudo em um unico lugar.
        </div>

        {/* CTA + Badge */}
        <div style={{
          marginTop: 44, display: 'inline-flex', flexDirection: 'column',
          alignItems: 'center', gap: 16,
          opacity: interpolate(ctaSpring, [0, 1], [0, 1]),
          transform: `scale(${interpolate(ctaSpring, [0, 1], [0.7, 1])})`,
        }}>
          <div style={{ position: 'relative', transform: `scale(${pulse})` }}>
            <div style={{
              padding: '20px 64px', borderRadius: 18,
              background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.accent})`,
              color: '#fff', fontSize: 24, fontWeight: 700, letterSpacing: 0.5,
              fontFamily: 'Inter, system-ui, sans-serif',
              boxShadow: `0 12px 40px rgba(0,39,118,0.25)`,
            }}>
              {BRAND.cta}
            </div>
            {/* Glow */}
            <div style={{
              position: 'absolute', inset: -14, borderRadius: 32,
              background: `linear-gradient(135deg, ${COLORS.primary}50, ${COLORS.accent}50)`,
              filter: 'blur(28px)', opacity: glowPulse, zIndex: -1,
            }} />
          </div>

          {/* Badge */}
          <div style={{
            padding: '8px 24px', borderRadius: 999,
            background: 'rgba(0,146,63,0.1)', border: '1.5px solid rgba(0,146,63,0.25)',
            color: COLORS.primary, fontSize: 15, fontWeight: 600,
            fontFamily: 'Inter, system-ui, sans-serif',
            opacity: interpolate(badgeSpring, [0, 1], [0, 1]),
            transform: `translateY(${interpolate(badgeSpring, [0, 1], [10, 0])}px)`,
          }}>
            Teste gratis por 7 dias
          </div>
        </div>

        {/* URL */}
        <div style={{
          marginTop: 28, color: COLORS.textSecondary, fontSize: 16,
          fontFamily: 'Inter, system-ui, sans-serif', letterSpacing: 2,
          opacity: interpolate(urlSpring, [0, 1], [0, 1]),
        }}>
          {BRAND.url}
        </div>
      </div>

      {/* Brand close */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: `translate(-50%, -50%) scale(${interpolate(brandFade, [0, 1], [0.8, 1])})`,
        opacity: brandFade, textAlign: 'center',
      }}>
        <div style={{
          fontSize: 36, fontWeight: 700, color: '#fff',
          fontFamily: 'Inter, system-ui, sans-serif',
          letterSpacing: 6, textTransform: 'uppercase' as const,
        }}>
          Painel Admin
        </div>
        <div style={{
          fontSize: 16, fontWeight: 400, color: 'rgba(255,255,255,0.7)',
          fontFamily: 'Inter, system-ui, sans-serif', marginTop: 8, letterSpacing: 2,
        }}>
          {BRAND.url}
        </div>
      </div>
    </AbsoluteFill>
  );
};
