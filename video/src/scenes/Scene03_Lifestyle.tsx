import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  spring,
  useVideoConfig,
} from 'remotion';
import { COLORS } from '../constants';

export const Scene03_Lifestyle: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const trackX = interpolate(frame, [0, 140], [40, -40], {
    extrapolateRight: 'clamp',
  });

  const bloomOpacity = interpolate(frame, [0, 30, 110, 140], [0, 0.4, 0.4, 0], {
    extrapolateRight: 'clamp',
  });

  const headlineOpacity = interpolate(frame, [10, 26], [0, 1], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
  });

  const headlineY = spring({
    frame: frame - 10,
    fps,
    config: { damping: 18, stiffness: 80 },
  });

  const subOpacity = interpolate(frame, [24, 40], [0, 1], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
  });

  const taskItems = [
    { text: 'Revisar relatorio mensal', done: true, points: '+15 XP' },
    { text: 'Reuniao com equipe', done: true, points: '+10 XP' },
    { text: 'Planejar sprint semanal', done: false, points: '+20 XP' },
    { text: 'Enviar proposta comercial', done: false, points: '+25 XP' },
  ];

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.dark,
        overflow: 'hidden',
      }}
    >
      {/* Warm ambient gradient */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse 90% 70% at 60% 40%, #2a231a 0%, ${COLORS.dark} 70%)`,
        }}
      />

      {/* Light bloom */}
      <div
        style={{
          position: 'absolute',
          top: '20%',
          right: '10%',
          width: 400,
          height: 400,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${COLORS.orange}30 0%, transparent 70%)`,
          opacity: bloomOpacity,
          filter: 'blur(80px)',
        }}
      />

      {/* App in context — side tracking */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: `translate(calc(-50% + ${trackX}px), -50%)`,
          display: 'flex',
          gap: 40,
          alignItems: 'center',
        }}
      >
        {/* Phone mockup */}
        <div
          style={{
            width: 360,
            height: 640,
            borderRadius: 36,
            background: `linear-gradient(160deg, #2a2520, ${COLORS.warmGray})`,
            border: `2px solid ${COLORS.gold}30`,
            boxShadow: `0 20px 80px ${COLORS.dark}cc`,
            overflow: 'hidden',
            flexShrink: 0,
          }}
        >
          {/* Status bar */}
          <div
            style={{
              height: 44,
              background: COLORS.warmGray,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <div
              style={{
                width: 80,
                height: 6,
                borderRadius: 3,
                backgroundColor: COLORS.dark,
              }}
            />
          </div>

          {/* Task list */}
          <div style={{ padding: 20 }}>
            <div
              style={{
                color: COLORS.orange,
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: 2,
                textTransform: 'uppercase',
                marginBottom: 8,
              }}
            >
              Tarefas Hoje
            </div>
            <div
              style={{
                color: COLORS.cream,
                fontSize: 20,
                fontWeight: 700,
                marginBottom: 20,
              }}
            >
              4 tarefas pendentes
            </div>

            {taskItems.map((task, i) => {
              const itemOpacity = interpolate(
                frame,
                [15 + i * 10, 30 + i * 10],
                [0, 1],
                { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' }
              );
              const itemX = interpolate(
                frame,
                [15 + i * 10, 30 + i * 10],
                [20, 0],
                { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' }
              );
              return (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 0',
                    borderBottom: `1px solid ${COLORS.gold}15`,
                    opacity: itemOpacity,
                    transform: `translateX(${itemX}px)`,
                  }}
                >
                  <div
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 6,
                      border: `2px solid ${task.done ? '#22c55e' : COLORS.gold + '50'}`,
                      backgroundColor: task.done ? '#22c55e20' : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 12,
                      color: '#22c55e',
                      flexShrink: 0,
                    }}
                  >
                    {task.done ? '✓' : ''}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        color: task.done ? '#999' : COLORS.cream,
                        fontSize: 14,
                        textDecoration: task.done ? 'line-through' : 'none',
                      }}
                    >
                      {task.text}
                    </div>
                  </div>
                  <div
                    style={{
                      color: COLORS.orange,
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  >
                    {task.points}
                  </div>
                </div>
              );
            })}

            {/* Pomodoro widget */}
            <div
              style={{
                marginTop: 24,
                padding: 16,
                borderRadius: 16,
                background: `${COLORS.orange}15`,
                border: `1px solid ${COLORS.orange}30`,
                textAlign: 'center',
                opacity: interpolate(frame, [60, 80], [0, 1], {
                  extrapolateRight: 'clamp',
                  extrapolateLeft: 'clamp',
                }),
              }}
            >
              <div style={{ color: COLORS.orange, fontSize: 11, fontWeight: 600, letterSpacing: 1.5 }}>
                POMODORO ATIVO
              </div>
              <div style={{ color: COLORS.cream, fontSize: 32, fontWeight: 700, marginTop: 4 }}>
                23:47
              </div>
              <div style={{ color: '#999', fontSize: 12, marginTop: 4 }}>
                Foco total — 15 XP ao concluir
              </div>
            </div>
          </div>
        </div>

        {/* Desktop mockup alongside */}
        <div
          style={{
            width: 600,
            height: 400,
            borderRadius: 16,
            background: `linear-gradient(145deg, ${COLORS.warmGray}, #2a2520)`,
            border: `1px solid ${COLORS.gold}20`,
            boxShadow: `0 20px 80px ${COLORS.dark}cc`,
            overflow: 'hidden',
            opacity: interpolate(frame, [20, 45], [0, 1], {
              extrapolateRight: 'clamp',
              extrapolateLeft: 'clamp',
            }),
          }}
        >
          {/* Sidebar */}
          <div style={{ display: 'flex', height: '100%' }}>
            <div
              style={{
                width: 60,
                backgroundColor: '#151210',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '16px 0',
                gap: 16,
              }}
            >
              {['💰', '✅', '📅', '📝', '🤖'].map((icon, i) => (
                <div
                  key={i}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 18,
                    backgroundColor: i === 0 ? `${COLORS.orange}20` : 'transparent',
                  }}
                >
                  {icon}
                </div>
              ))}
            </div>

            {/* Dashboard content */}
            <div style={{ flex: 1, padding: 20 }}>
              <div style={{ color: COLORS.gold, fontSize: 11, letterSpacing: 1.5, fontWeight: 600 }}>
                FINANCAS
              </div>
              <div style={{ color: COLORS.cream, fontSize: 18, fontWeight: 700, marginTop: 4, marginBottom: 16 }}>
                Abril 2026
              </div>
              <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                {[
                  { label: 'Receitas', value: 'R$ 8.4k', color: '#22c55e' },
                  { label: 'Gastos', value: 'R$ 3.2k', color: '#ef4444' },
                  { label: 'Saldo', value: 'R$ 5.2k', color: COLORS.orange },
                ].map((card) => (
                  <div
                    key={card.label}
                    style={{
                      flex: 1,
                      padding: '10px 12px',
                      borderRadius: 10,
                      background: `${card.color}10`,
                      border: `1px solid ${card.color}25`,
                    }}
                  >
                    <div style={{ color: '#888', fontSize: 10 }}>{card.label}</div>
                    <div style={{ color: card.color, fontSize: 16, fontWeight: 700 }}>{card.value}</div>
                  </div>
                ))}
              </div>

              {/* Mini chart */}
              <div style={{ display: 'flex', alignItems: 'end', gap: 4, height: 80 }}>
                {[40, 65, 50, 80, 55, 70, 90, 45, 75, 60, 85, 50].map((h, i) => (
                  <div
                    key={i}
                    style={{
                      flex: 1,
                      height: interpolate(frame, [40 + i * 2, 60 + i * 2], [0, h], {
                        extrapolateRight: 'clamp',
                        extrapolateLeft: 'clamp',
                      }),
                      borderRadius: '3px 3px 0 0',
                      background: `linear-gradient(to top, ${COLORS.orange}cc, ${COLORS.gold}cc)`,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Text */}
      <div
        style={{
          position: 'absolute',
          bottom: 80,
          width: '100%',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontFamily: 'system-ui, sans-serif',
            fontSize: 38,
            fontWeight: 500,
            color: COLORS.cream,
            letterSpacing: 2,
            opacity: headlineOpacity,
            transform: `translateY(${interpolate(headlineY, [0, 1], [24, 0])}px)`,
          }}
        >
          Mais do que um produto
        </div>
        <div
          style={{
            fontFamily: 'system-ui, sans-serif',
            fontSize: 18,
            fontWeight: 300,
            color: COLORS.gold,
            marginTop: 10,
            letterSpacing: 1.5,
            opacity: subOpacity,
          }}
        >
          uma experiencia para sentir e lembrar
        </div>
      </div>
    </AbsoluteFill>
  );
};
