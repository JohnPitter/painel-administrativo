import React from 'react';
import { AbsoluteFill, Sequence, useCurrentFrame } from 'remotion';
import { Scene01_HeroReveal } from './scenes/Scene01_HeroReveal';
import { Scene02_DetailShowcase } from './scenes/Scene02_DetailShowcase';
import { Scene03_Lifestyle } from './scenes/Scene03_Lifestyle';
import { Scene04_BrandStatement } from './scenes/Scene04_BrandStatement';
import { Scene05_CTA } from './scenes/Scene05_CTA';
import { Music } from './Music';
import { COLORS } from './constants';

/**
 * 21-second promo video at 30fps = 630 frames
 *
 * Narrative: "Caos → Ordem → Prova → Impacto → Ação"
 *
 * Scene 1: O Problema        — 0-119     (4s)   — Pain points + "E se existisse uma solução?"
 * Scene 2: A Virada           — 120-209   (3s)   — Flash → dashboard reveal with cascade
 * Scene 3: Tour Guiado        — 210-389   (6s)   — Finance + Tasks side-by-side, everything alive
 * Scene 4: Impacto            — 390-509   (4s)   — Big numbers + module ribbon + social proof
 * Scene 5: CTA Urgente        — 510-629   (4s)   — Headline + pulsing button + elegant brand close
 *
 * Each scene has its own COMPLETE visual arc (intro → content → desfecho).
 * Transitions are MOTIVATED: Scene1 ends with flash → Scene2 starts from flash.
 */

const SCENES = [
  { start: 0, duration: 120, Component: Scene01_HeroReveal },
  { start: 120, duration: 90, Component: Scene02_DetailShowcase },
  { start: 210, duration: 180, Component: Scene03_Lifestyle },
  { start: 390, duration: 120, Component: Scene04_BrandStatement },
  { start: 510, duration: 120, Component: Scene05_CTA },
] as const;

export const PromoVideo: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.background }}>
      {SCENES.map(({ start, duration, Component }, idx) => {
        // No crossfade — each scene handles its own transitions internally
        // Scene 1 ends with white flash, Scene 2 starts from white flash
        // Scene 5 ends with brand color fade
        const isVisible = frame >= start && frame < start + duration;

        if (!isVisible && idx !== 0) return null;

        return (
          <Sequence key={idx} from={start} durationInFrames={duration}>
            <AbsoluteFill>
              <Component />
            </AbsoluteFill>
          </Sequence>
        );
      })}
      <Music />
    </AbsoluteFill>
  );
};
