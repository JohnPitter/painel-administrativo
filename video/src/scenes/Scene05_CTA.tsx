import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  spring,
  useVideoConfig,
} from 'remotion';
import { COLORS, BRAND } from '../constants';

export const Scene05_CTA: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const pushIn = interpolate(frame, [0, 90], [1.04, 1], {
    extrapolateRight: 'clamp',
  });

  const logoOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
  });

  const headlineSpring = spring({
    frame: frame - 8,
    fps,
    config: { damping: 16, stiffness: 70 },
  });

  const subSpring = spring({
    frame: frame - 20,
    fps,
    config: { damping: 16, stiffness: 70 },
  });

  const ctaSpring = spring({
    frame: frame - 35,
    fps,
    config: { damping: 12, stiffness: 60 },
  });

  const ctaGlow = interpolate(frame, [35, 50, 60, 75, 85, 90], [0, 0.8, 0.5, 0.8, 0.5, 0.8], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
  });

  const fadeOut = interpolate(frame, [75, 90], [1, 0], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.dark,
        overflow: 'hidden',
        transform: `scale(${pushIn})`,
      }}
    >
      {/* Background gradient */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse 70% 70% at 50% 45%, #2a231a 0%, ${COLORS.dark} 70%)`,
        }}
      />

      {/* Subtle particles */}
      {Array.from({ length: 12 }, (_, i) => {
        const x = (i * 137.508 + 23) % 100;
        const y = (i * 97.31 + 11) % 100 - (frame * 0.15) % 110;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${x}%`,
              top: `${y}%`,
              width: 2,
              height: 2,
              borderRadius: '50%',
              backgroundColor: COLORS.gold,
              opacity: 0.25,
            }}
          />
        );
      })}

      {/* Center content */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
          opacity: fadeOut,
        }}
      >
        {/* Logo / Brand */}
        <div
          style={{
            fontFamily: 'system-ui, sans-serif',
            fontSize: 20,
            fontWeight: 600,
            color: COLORS.orange,
            letterSpacing: 4,
            textTransform: 'uppercase',
            marginBottom: 32,
            opacity: logoOpacity,
          }}
        >
          {BRAND.name}
        </div>

        {/* Headline */}
        <div
          style={{
            fontFamily: 'system-ui, sans-serif',
            fontSize: 52,
            fontWeight: 700,
            color: COLORS.cream,
            letterSpacing: 2,
            lineHeight: 1.2,
            opacity: interpolate(headlineSpring, [0, 1], [0, 1]),
            transform: `translateY(${interpolate(headlineSpring, [0, 1], [30, 0])}px)`,
          }}
        >
          Descubra agora
        </div>

        {/* Subheadline */}
        <div
          style={{
            fontFamily: 'system-ui, sans-serif',
            fontSize: 22,
            fontWeight: 300,
            color: COLORS.gold,
            letterSpacing: 1.5,
            marginTop: 16,
            opacity: interpolate(subSpring, [0, 1], [0, 1]),
            transform: `translateY(${interpolate(subSpring, [0, 1], [20, 0])}px)`,
          }}
        >
          Seu proximo desejo comeca aqui
        </div>

        {/* CTA Button */}
        <div
          style={{
            marginTop: 48,
            display: 'inline-block',
            opacity: interpolate(ctaSpring, [0, 1], [0, 1]),
            transform: `scale(${interpolate(ctaSpring, [0, 1], [0.8, 1])})`,
          }}
        >
          <div
            style={{
              padding: '18px 56px',
              borderRadius: 14,
              background: `linear-gradient(135deg, ${COLORS.orange}, ${COLORS.accent ?? COLORS.orange})`,
              color: COLORS.white,
              fontSize: 20,
              fontWeight: 700,
              letterSpacing: 2,
              textTransform: 'uppercase',
              position: 'relative',
            }}
          >
            {BRAND.cta}
            {/* Button glow */}
            <div
              style={{
                position: 'absolute',
                inset: -8,
                borderRadius: 22,
                background: `${COLORS.orange}40`,
                filter: 'blur(20px)',
                opacity: ctaGlow,
                zIndex: -1,
              }}
            />
          </div>
        </div>

        {/* URL */}
        <div
          style={{
            marginTop: 24,
            color: `${COLORS.gold}80`,
            fontSize: 14,
            fontFamily: 'monospace',
            letterSpacing: 2,
            opacity: interpolate(ctaSpring, [0, 1], [0, 1]),
          }}
        >
          {BRAND.url}
        </div>
      </div>

      {/* Final fade to brand color */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: COLORS.dark,
          opacity: interpolate(frame, [78, 90], [0, 1], {
            extrapolateRight: 'clamp',
            extrapolateLeft: 'clamp',
          }),
          pointerEvents: 'none',
        }}
      />
    </AbsoluteFill>
  );
};
