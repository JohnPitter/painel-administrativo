import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  spring,
  useVideoConfig,
} from 'remotion';
import { COLORS } from '../constants';

/**
 * Scene 3 — "Tour Guiado" (180 frames = 6s)
 * Finance LEFT + Tasks RIGHT — everything alive, numbers ticking, bars growing.
 * Bigger fonts. Tighter layouts. No wasted space.
 */
export const Scene03_Lifestyle: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrySpring = spring({ frame: frame - 3, fps, config: { damping: 14, stiffness: 50 } });

  const countUp = (target: number, start: number, dur: number) =>
    Math.round(interpolate(frame, [start, start + dur], [0, target], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' }));

  const revenue = countUp(8450, 10, 45);
  const expenses = countUp(3210, 15, 45);
  const balance = countUp(5240, 20, 45);

  const chartBars = [65, 80, 45, 90, 70, 55, 85, 40, 75, 60, 50, 88];

  const tasks = [
    { text: 'Revisar relatorio mensal', done: true, delay: 20 },
    { text: 'Reuniao com equipe', done: true, delay: 30 },
    { text: 'Planejar sprint semanal', done: false, delay: 40 },
    { text: 'Enviar proposta comercial', done: false, delay: 50 },
    { text: 'Atualizar documentacao', done: false, delay: 60 },
  ];

  // Task 3 completes at frame 105
  const checkFrame = 105;
  const task3Done = frame > checkFrame;
  const checkBounce = spring({ frame: frame - checkFrame, fps, config: { damping: 8, stiffness: 120 } });

  const pomSec = 47 - Math.floor(interpolate(frame, [50, 180], [0, 15], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' }));
  const pomProgress = interpolate(frame, [30, 170], [66, 82], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });

  const xp = countUp(1250, 25, 60);

  const cardStyle: React.CSSProperties = {
    borderRadius: 22,
    background: 'rgba(255, 255, 255, 0.95)',
    border: '1px solid rgba(0, 39, 118, 0.06)',
    boxShadow: '0 8px 32px rgba(0, 39, 118, 0.1)',
  };

  return (
    <AbsoluteFill style={{ backgroundColor: '#eef1f8', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 30% 40%, rgba(0, 146, 63, 0.06), transparent 50%), radial-gradient(circle at 70% 60%, rgba(0, 39, 118, 0.08), transparent 50%)' }} />

      <div
        style={{
          padding: '28px 48px',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 28,
          height: '100%',
          opacity: interpolate(entrySpring, [0, 1], [0, 1]),
          transform: `translateY(${interpolate(entrySpring, [0, 1], [20, 0])}px)`,
        }}
      >
        {/* ===== LEFT: FINANCE ===== */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: `linear-gradient(135deg, ${COLORS.primary}, rgba(0, 39, 118, 0.85))`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', boxShadow: `0 4px 16px ${COLORS.primary}30` }}>F</div>
            <div>
              <div style={{ fontSize: 26, fontWeight: 700, color: COLORS.textPrimary, fontFamily: 'Inter, system-ui, sans-serif' }}>Financas</div>
              <div style={{ fontSize: 14, color: COLORS.textSecondary, fontFamily: 'Inter, system-ui, sans-serif' }}>Abril 2026</div>
            </div>
          </div>

          {/* 3 metric cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            {[
              { label: 'Receitas', val: revenue, color: COLORS.primary },
              { label: 'Gastos', val: expenses, color: COLORS.red },
              { label: 'Saldo', val: balance, color: COLORS.accent },
            ].map((m) => (
              <div key={m.label} style={{ ...cardStyle, padding: '18px 20px' }}>
                <div style={{ fontSize: 13, color: COLORS.textSecondary, fontFamily: 'Inter, system-ui, sans-serif', marginBottom: 4 }}>{m.label}</div>
                <div style={{ fontSize: 26, fontWeight: 700, color: m.color, fontFamily: 'Inter, system-ui, sans-serif' }}>
                  R$ {m.val.toLocaleString('pt-BR')}
                </div>
              </div>
            ))}
          </div>

          {/* Chart */}
          <div style={{ ...cardStyle, padding: '20px 24px', flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.textPrimary, fontFamily: 'Inter, system-ui, sans-serif' }}>Fluxo de Caixa</div>
            <div style={{ fontSize: 12, color: COLORS.textSecondary, fontFamily: 'Inter, system-ui, sans-serif', marginBottom: 14 }}>Receitas vs Gastos — 2026</div>

            <div style={{ display: 'flex', alignItems: 'end', gap: 7, flex: 1 }}>
              {chartBars.map((h, i) => {
                const d = 15 + i * 4;
                const incH = interpolate(frame, [d, d + 25], [0, h * 3.2], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });
                const expH = interpolate(frame, [d + 5, d + 30], [0, h * 1.6], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });
                return (
                  <div key={i} style={{ flex: 1, display: 'flex', gap: 2, alignItems: 'end' }}>
                    <div style={{ flex: 1, height: incH, borderRadius: '4px 4px 0 0', background: COLORS.primary }} />
                    <div style={{ flex: 1, height: expH, borderRadius: '4px 4px 0 0', background: COLORS.red, opacity: 0.75 }} />
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', gap: 20, marginTop: 10 }}>
              {[{ l: 'Receitas', c: COLORS.primary }, { l: 'Gastos', c: COLORS.red }].map((x) => (
                <div key={x.l} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 999, background: x.c }} />
                  <span style={{ fontSize: 12, color: COLORS.textSecondary, fontFamily: 'Inter, system-ui, sans-serif' }}>{x.l}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ===== RIGHT: TASKS ===== */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: 'linear-gradient(135deg, #ffd500, rgba(0, 39, 118, 0.85))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', boxShadow: '0 4px 16px rgba(255, 213, 0, 0.3)' }}>T</div>
            <div>
              <div style={{ fontSize: 26, fontWeight: 700, color: COLORS.textPrimary, fontFamily: 'Inter, system-ui, sans-serif' }}>Tarefas & Foco</div>
              <div style={{ fontSize: 14, color: COLORS.textSecondary, fontFamily: 'Inter, system-ui, sans-serif' }}>5 tarefas hoje</div>
            </div>
          </div>

          {/* Task list */}
          <div style={{ ...cardStyle, padding: '18px 22px' }}>
            {tasks.map((t, i) => {
              const op = interpolate(frame, [t.delay, t.delay + 10], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });
              const isDone = i === 2 ? task3Done : t.done;
              const cScale = i === 2 ? interpolate(checkBounce, [0, 1], [0.3, 1]) : 1;
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: i < tasks.length - 1 ? '1px solid rgba(0,39,118,0.06)' : 'none', opacity: op }}>
                  <div style={{ width: 24, height: 24, borderRadius: 7, border: `2.5px solid ${isDone ? COLORS.primary : 'rgba(0,39,118,0.2)'}`, background: isDone ? 'rgba(0,146,63,0.15)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: COLORS.primary, flexShrink: 0, transform: i === 2 ? `scale(${cScale})` : undefined }}>
                    {isDone ? '✓' : ''}
                  </div>
                  <div style={{ flex: 1, fontSize: 16, color: isDone ? COLORS.textSecondary : COLORS.textPrimary, textDecoration: isDone ? 'line-through' : 'none', fontFamily: 'Inter, system-ui, sans-serif', fontWeight: 500 }}>
                    {t.text}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pomodoro */}
          <div style={{ ...cardStyle, padding: '20px 24px', textAlign: 'center' as const }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.primary, letterSpacing: 2, textTransform: 'uppercase' as const, fontFamily: 'Inter, system-ui, sans-serif' }}>Pomodoro Ativo</div>
            <div style={{ fontSize: 56, fontWeight: 700, color: COLORS.accent, letterSpacing: 2, fontFamily: 'Inter, system-ui, sans-serif', marginTop: 4 }}>
              23:{pomSec.toString().padStart(2, '0')}
            </div>
            <div style={{ width: '100%', height: 8, borderRadius: 999, background: 'rgba(0,39,118,0.06)', marginTop: 12, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pomProgress}%`, borderRadius: 999, background: `linear-gradient(90deg, ${COLORS.primary}, ${COLORS.accent})` }} />
            </div>
          </div>

          {/* Gamification strip */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10 }}>
            {[
              { label: 'Nivel', value: '7' },
              { label: 'Streak', value: '5d' },
              { label: 'XP', value: xp.toLocaleString('pt-BR') },
              { label: 'Meta', value: '1.500' },
            ].map((g) => (
              <div key={g.label} style={{ ...cardStyle, padding: '12px 14px', textAlign: 'center' as const }}>
                <div style={{ fontSize: 10, color: COLORS.textSecondary, fontFamily: 'Inter, system-ui, sans-serif', marginBottom: 2 }}>{g.label}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: COLORS.accent, fontFamily: 'Inter, system-ui, sans-serif' }}>{g.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* XP popup */}
      {frame > checkFrame && frame < checkFrame + 45 && (
        <div style={{
          position: 'absolute', right: 180, top: 320,
          opacity: interpolate(frame, [checkFrame, checkFrame + 8, checkFrame + 35, checkFrame + 45], [0, 1, 1, 0], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' }),
          transform: `translateY(${interpolate(frame, [checkFrame, checkFrame + 45], [0, -40], { extrapolateRight: 'clamp' })}px) scale(${interpolate(frame, [checkFrame, checkFrame + 10], [0.5, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' })})`,
        }}>
          <div style={{ padding: '10px 24px', borderRadius: 999, background: 'rgba(0,146,63,0.15)', border: '2px solid rgba(0,146,63,0.4)', color: COLORS.primary, fontSize: 20, fontWeight: 700, fontFamily: 'Inter, system-ui, sans-serif', boxShadow: '0 4px 20px rgba(0,146,63,0.2)' }}>
            +20 XP!
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
