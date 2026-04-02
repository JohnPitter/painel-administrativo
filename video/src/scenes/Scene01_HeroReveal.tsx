import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  spring,
  useVideoConfig,
} from 'remotion';
import { COLORS } from '../constants';

export const Scene01_HeroReveal: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, 20], [0, 1], {
    extrapolateRight: 'clamp',
  });

  const lightSweep = interpolate(frame, [10, 60], [-100, 120], {
    extrapolateRight: 'clamp',
  });

  const pushIn = interpolate(frame, [0, 120], [1.08, 1], {
    extrapolateRight: 'clamp',
  });

  const textY = spring({
    frame: frame - 12,
    fps,
    config: { damping: 20, stiffness: 80 },
  });

  const textOpacity = interpolate(frame, [12, 30], [0, 1], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
  });

  const glowOpacity = interpolate(frame, [0, 40, 100, 120], [0, 0.6, 0.6, 0.3], {
    extrapolateRight: 'clamp',
  });

  const particleCount = 20;
  const particles = Array.from({ length: particleCount }, (_, i) => {
    const x = (i * 137.508) % 100;
    const baseY = (i * 97.31) % 100;
    const y = baseY - (frame * (0.1 + (i % 5) * 0.05)) % 120;
    const size = 2 + (i % 3);
    const opacity = interpolate(
      frame,
      [0, 20, 100, 120],
      [0, 0.3 + (i % 3) * 0.15, 0.3 + (i % 3) * 0.15, 0],
      { extrapolateRight: 'clamp' }
    );
    return { x, y, size, opacity };
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.dark,
        opacity: fadeIn,
        overflow: 'hidden',
      }}
    >
      {/* Gradient background */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse 80% 60% at 50% 50%, ${COLORS.warmGray}88 0%, ${COLORS.dark} 70%)`,
        }}
      />

      {/* Particles */}
      {particles.map((p, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            borderRadius: '50%',
            backgroundColor: COLORS.gold,
            opacity: p.opacity,
          }}
        />
      ))}

      {/* Light sweep */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: `${lightSweep}%`,
          width: '8%',
          height: '100%',
          background: `linear-gradient(90deg, transparent, ${COLORS.gold}30, transparent)`,
          filter: 'blur(40px)',
        }}
      />

      {/* Product hero — app mockup */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: `translate(-50%, -50%) scale(${pushIn})`,
          width: 700,
          height: 440,
          borderRadius: 24,
          background: `linear-gradient(145deg, ${COLORS.warmGray}, #2a2520)`,
          border: `1px solid ${COLORS.gold}40`,
          boxShadow: `0 0 80px ${COLORS.orange}20, 0 0 160px ${COLORS.dark}`,
          overflow: 'hidden',
        }}
      >
        {/* Simulated app header */}
        <div
          style={{
            height: 48,
            background: COLORS.warmGray,
            display: 'flex',
            alignItems: 'center',
            padding: '0 20px',
            gap: 8,
          }}
        >
          <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#ff5f57' }} />
          <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#febc2e' }} />
          <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#28c840' }} />
          <div
            style={{
              marginLeft: 16,
              color: COLORS.gold,
              fontSize: 14,
              fontFamily: 'monospace',
              letterSpacing: 1,
            }}
          >
            Painel Admin
          </div>
        </div>

        {/* Simulated dashboard grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: 16,
            padding: 24,
          }}
        >
          {['Receitas', 'Gastos', 'Saldo'].map((label, idx) => {
            const colors = ['#22c55e', '#ef4444', COLORS.orange];
            const values = ['R$ 8.450', 'R$ 3.210', 'R$ 5.240'];
            const cardOpacity = interpolate(
              frame,
              [20 + idx * 8, 35 + idx * 8],
              [0, 1],
              { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' }
            );
            return (
              <div
                key={label}
                style={{
                  background: `${COLORS.dark}cc`,
                  borderRadius: 12,
                  padding: 16,
                  border: `1px solid ${colors[idx]}30`,
                  opacity: cardOpacity,
                }}
              >
                <div style={{ color: '#999', fontSize: 12, marginBottom: 4 }}>{label}</div>
                <div style={{ color: colors[idx], fontSize: 22, fontWeight: 700 }}>{values[idx]}</div>
              </div>
            );
          })}
        </div>

        {/* Chart bars */}
        <div style={{ display: 'flex', alignItems: 'end', gap: 8, padding: '0 24px', height: 120 }}>
          {[60, 80, 45, 90, 70, 55, 85, 40, 75, 65, 50, 88].map((h, i) => {
            const barHeight = interpolate(frame, [30 + i * 3, 50 + i * 3], [0, h], {
              extrapolateRight: 'clamp',
              extrapolateLeft: 'clamp',
            });
            return (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: barHeight,
                  borderRadius: '4px 4px 0 0',
                  background: `linear-gradient(to top, ${COLORS.orange}, ${COLORS.gold})`,
                  opacity: 0.8,
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Glow behind product */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 800,
          height: 500,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${COLORS.orange}15 0%, transparent 70%)`,
          opacity: glowOpacity,
          filter: 'blur(60px)',
          pointerEvents: 'none',
        }}
      />

      {/* Headline */}
      <div
        style={{
          position: 'absolute',
          bottom: 80,
          width: '100%',
          textAlign: 'center',
          opacity: textOpacity,
          transform: `translateY(${interpolate(textY, [0, 1], [30, 0])}px)`,
        }}
      >
        <div
          style={{
            fontFamily: 'system-ui, sans-serif',
            fontSize: 36,
            fontWeight: 300,
            color: COLORS.cream,
            letterSpacing: 2,
          }}
        >
          Chegou o detalhe que transforma tudo
        </div>
      </div>
    </AbsoluteFill>
  );
};
