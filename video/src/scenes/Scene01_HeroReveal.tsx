import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  spring,
  useVideoConfig,
} from 'remotion';

/**
 * Scene 1 — "O Problema" (120 frames = 4s)
 * Starts IMMEDIATELY with visible content. Pain points slam in one by one,
 * large and centered. Each one pushes the previous away. Ends with them
 * shattering and a flash to Scene 2.
 */
export const Scene01_HeroReveal: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const painPoints = [
    { text: 'Planilhas perdidas', delay: 0 },
    { text: 'Contas esquecidas', delay: 18 },
    { text: 'Tarefas sem controle', delay: 36 },
    { text: 'Tempo desperdicado', delay: 54 },
  ];

  // Background pulse — red tint intensifies
  const bgPulse = interpolate(frame, [0, 70], [0, 0.15], { extrapolateRight: 'clamp' });

  // Shake before dissolve
  const shakePhase = frame > 72 ? Math.sin(frame * 3) * interpolate(frame, [72, 85], [0, 8], { extrapolateRight: 'clamp' }) : 0;

  // "E se..." text
  const questionOpacity = interpolate(frame, [85, 95, 108, 115], [0, 1, 1, 0], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
  });
  const questionSpring = spring({ frame: frame - 85, fps, config: { damping: 14, stiffness: 60 } });

  // Flash out
  const flashOut = interpolate(frame, [112, 120], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });

  return (
    <AbsoluteFill style={{ backgroundColor: '#080810', overflow: 'hidden', transform: `translateX(${shakePhase}px)` }}>
      {/* Dark gradient with red tint */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse 80% 70% at 50% 50%, #1a1020 0%, #080810 70%)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(circle at 50% 50%, rgba(217, 48, 37, ${bgPulse}), transparent 60%)`,
        }}
      />

      {/* Scan lines for texture */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.08) 3px, rgba(0,0,0,0.08) 4px)',
          pointerEvents: 'none',
        }}
      />

      {/* Pain points — each one LARGE, centered, slams in and fades as next arrives */}
      {painPoints.map((pain, i) => {
        const isLast = i === painPoints.length - 1;
        const nextDelay = isLast ? 72 : painPoints[i + 1].delay;

        const slamSpring = spring({
          frame: frame - pain.delay,
          fps,
          config: { damping: 10, stiffness: 120 },
        });

        const opacity = interpolate(
          frame,
          [pain.delay, pain.delay + 6, nextDelay - 6, nextDelay],
          [0, 1, 1, isLast ? 0.8 : 0],
          { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' }
        );

        // After shake starts, all dissolve
        const dissolve = frame > 72
          ? interpolate(frame, [72, 85], [1, 0], { extrapolateRight: 'clamp' })
          : 1;

        const scale = interpolate(slamSpring, [0, 1], [1.5, 1]);

        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: `translate(-50%, -50%) scale(${scale}) translateY(${(i - 1.5) * 12}px)`,
              opacity: opacity * dissolve,
              textAlign: 'center',
            }}
          >
            <div
              style={{
                fontFamily: 'Inter, system-ui, sans-serif',
                fontSize: 64,
                fontWeight: 700,
                color: '#ff6b6b',
                letterSpacing: -1,
                textShadow: '0 0 40px rgba(217, 48, 37, 0.4)',
              }}
            >
              {pain.text}
            </div>
          </div>
        );
      })}

      {/* "E se existisse uma solucao?" */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: `translate(-50%, -50%) translateY(${interpolate(questionSpring, [0, 1], [30, 0])}px)`,
          opacity: questionOpacity,
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: 48,
            fontWeight: 300,
            color: 'rgba(255, 255, 255, 0.85)',
            letterSpacing: 1,
          }}
        >
          E se existisse uma solucao?
        </div>
      </div>

      {/* Flash to white */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: '#ffffff',
          opacity: flashOut,
          pointerEvents: 'none',
        }}
      />
    </AbsoluteFill>
  );
};
