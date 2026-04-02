import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  spring,
  useVideoConfig,
} from 'remotion';
import { COLORS, BRAND, MODULES } from '../constants';

export const Scene04_BrandStatement: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const floatY = Math.sin(frame * 0.04) * 6;

  const logoScale = spring({
    frame: frame - 5,
    fps,
    config: { damping: 12, stiffness: 60 },
  });

  const logoOpacity = interpolate(frame, [5, 20], [0, 1], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
  });

  const taglineOpacity = interpolate(frame, [25, 40], [0, 1], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
  });

  const taglineY = spring({
    frame: frame - 25,
    fps,
    config: { damping: 18, stiffness: 80 },
  });

  const shineX = interpolate(frame, [15, 80], [-200, 200], {
    extrapolateRight: 'clamp',
  });

  const vignetteOpacity = interpolate(frame, [0, 30], [0, 0.6], {
    extrapolateRight: 'clamp',
  });

  const featureRows = [
    MODULES.slice(0, 4),
    MODULES.slice(4, 8),
  ];

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.dark,
        overflow: 'hidden',
      }}
    >
      {/* Radial glow */}
      <div
        style={{
          position: 'absolute',
          top: '30%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 800,
          height: 800,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${COLORS.orange}12 0%, transparent 60%)`,
          filter: 'blur(80px)',
        }}
      />

      {/* Feature icons ring */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: `translate(-50%, -50%) translateY(${floatY}px)`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 20,
        }}
      >
        {featureRows.map((row, rowIdx) => (
          <div key={rowIdx} style={{ display: 'flex', gap: 20 }}>
            {row.map((mod, i) => {
              const idx = rowIdx * 4 + i;
              const itemSpring = spring({
                frame: frame - 10 - idx * 4,
                fps,
                config: { damping: 14, stiffness: 60 },
              });
              return (
                <div
                  key={mod.name}
                  style={{
                    width: 100,
                    height: 100,
                    borderRadius: 20,
                    background: `linear-gradient(135deg, ${COLORS.warmGray}, #252017)`,
                    border: `1px solid ${COLORS.gold}20`,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    opacity: interpolate(itemSpring, [0, 1], [0, 1]),
                    transform: `scale(${interpolate(itemSpring, [0, 1], [0.8, 1])})`,
                  }}
                >
                  <div style={{ fontSize: 28 }}>{mod.icon}</div>
                  <div
                    style={{
                      color: COLORS.cream,
                      fontSize: 11,
                      fontWeight: 500,
                      letterSpacing: 0.5,
                    }}
                  >
                    {mod.name}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Brand name */}
      <div
        style={{
          position: 'absolute',
          top: 100,
          width: '100%',
          textAlign: 'center',
          opacity: logoOpacity,
          transform: `scale(${interpolate(logoScale, [0, 1], [0.9, 1])})`,
        }}
      >
        <div
          style={{
            fontFamily: 'system-ui, sans-serif',
            fontSize: 56,
            fontWeight: 700,
            color: COLORS.cream,
            letterSpacing: 6,
            textTransform: 'uppercase',
            position: 'relative',
            display: 'inline-block',
          }}
        >
          {BRAND.name}
          {/* Shine accent */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: shineX,
              width: 60,
              height: '100%',
              background: `linear-gradient(90deg, transparent, ${COLORS.gold}40, transparent)`,
              filter: 'blur(8px)',
              pointerEvents: 'none',
            }}
          />
        </div>
      </div>

      {/* Tagline */}
      <div
        style={{
          position: 'absolute',
          bottom: 100,
          width: '100%',
          textAlign: 'center',
          opacity: taglineOpacity,
          transform: `translateY(${interpolate(taglineY, [0, 1], [20, 0])}px)`,
        }}
      >
        <div
          style={{
            fontFamily: 'system-ui, sans-serif',
            fontSize: 22,
            fontWeight: 300,
            color: COLORS.gold,
            letterSpacing: 3,
          }}
        >
          para quem escolhe o extraordinario
        </div>
      </div>

      {/* Vignette */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse 80% 80% at 50% 50%, transparent 50%, ${COLORS.dark} 100%)`,
          opacity: vignetteOpacity,
          pointerEvents: 'none',
        }}
      />
    </AbsoluteFill>
  );
};
