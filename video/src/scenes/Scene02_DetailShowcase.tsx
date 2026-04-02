import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  spring,
  useVideoConfig,
} from 'remotion';
import { COLORS, MODULES } from '../constants';

export const Scene02_DetailShowcase: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const panX = interpolate(frame, [0, 140], [20, -20], {
    extrapolateRight: 'clamp',
  });

  const headlineOpacity = interpolate(frame, [8, 24], [0, 1], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
  });

  const headlineY = spring({
    frame: frame - 8,
    fps,
    config: { damping: 18, stiffness: 80 },
  });

  const subOpacity = interpolate(frame, [20, 36], [0, 1], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.dark,
        overflow: 'hidden',
      }}
    >
      {/* Parallax background grid */}
      <div
        style={{
          position: 'absolute',
          inset: -100,
          transform: `translateX(${panX}px)`,
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gridTemplateRows: 'repeat(2, 1fr)',
          gap: 24,
          padding: 60,
        }}
      >
        {MODULES.map((mod, i) => {
          const cardSpring = spring({
            frame: frame - 5 - i * 6,
            fps,
            config: { damping: 14, stiffness: 60 },
          });
          const scale = interpolate(cardSpring, [0, 1], [0.85, 1]);
          const opacity = interpolate(cardSpring, [0, 1], [0, 1]);

          return (
            <div
              key={mod.name}
              style={{
                background: `linear-gradient(135deg, ${COLORS.warmGray}, #2a2520)`,
                borderRadius: 20,
                padding: 32,
                border: `1px solid ${COLORS.gold}25`,
                transform: `scale(${scale})`,
                opacity,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
              }}
            >
              <div style={{ fontSize: 48, marginBottom: 12 }}>{mod.icon}</div>
              <div
                style={{
                  color: COLORS.cream,
                  fontSize: 22,
                  fontWeight: 600,
                  marginBottom: 8,
                }}
              >
                {mod.name}
              </div>
              <div style={{ color: `${COLORS.gold}cc`, fontSize: 14, lineHeight: 1.5 }}>
                {mod.desc}
              </div>
            </div>
          );
        })}
      </div>

      {/* Highlight sweep */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(90deg, ${COLORS.dark} 0%, transparent 20%, transparent 80%, ${COLORS.dark} 100%)`,
          pointerEvents: 'none',
        }}
      />

      {/* Text overlay */}
      <div
        style={{
          position: 'absolute',
          bottom: 100,
          width: '100%',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontFamily: 'system-ui, sans-serif',
            fontSize: 42,
            fontWeight: 600,
            color: COLORS.cream,
            letterSpacing: 3,
            opacity: headlineOpacity,
            transform: `translateY(${interpolate(headlineY, [0, 1], [24, 0])}px)`,
          }}
        >
          Design. Qualidade. Presenca.
        </div>
        <div
          style={{
            fontFamily: 'system-ui, sans-serif',
            fontSize: 18,
            fontWeight: 300,
            color: COLORS.gold,
            marginTop: 12,
            letterSpacing: 1.5,
            opacity: subOpacity,
          }}
        >
          feito para encantar no primeiro olhar
        </div>
      </div>
    </AbsoluteFill>
  );
};
