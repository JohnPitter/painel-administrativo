import React from 'react';
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame } from 'remotion';
import { Scene01_HeroReveal } from './scenes/Scene01_HeroReveal';
import { Scene02_DetailShowcase } from './scenes/Scene02_DetailShowcase';
import { Scene03_Lifestyle } from './scenes/Scene03_Lifestyle';
import { Scene04_BrandStatement } from './scenes/Scene04_BrandStatement';
import { Scene05_CTA } from './scenes/Scene05_CTA';
import { COLORS } from './constants';

/**
 * 21-second promo video at 30fps = 630 frames total
 *
 * Scene 1: Hero Reveal         — frames 0-125   (4.2s)
 * Scene 2: Detail Showcase     — frames 126-265 (4.6s)
 * Scene 3: Lifestyle           — frames 266-405 (4.6s)
 * Scene 4: Brand Statement     — frames 406-515 (3.7s)
 * Scene 5: CTA                 — frames 516-629 (3.8s)
 */

const SCENES = [
  { start: 0, duration: 126, Component: Scene01_HeroReveal },
  { start: 126, duration: 140, Component: Scene02_DetailShowcase },
  { start: 266, duration: 140, Component: Scene03_Lifestyle },
  { start: 406, duration: 110, Component: Scene04_BrandStatement },
  { start: 516, duration: 114, Component: Scene05_CTA },
] as const;

const CROSSFADE_FRAMES = 15;

export const PromoVideo: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.dark }}>
      {SCENES.map(({ start, duration, Component }, idx) => {
        const sceneEnd = start + duration;
        const isLast = idx === SCENES.length - 1;

        // Crossfade in (except first scene)
        const fadeIn =
          idx === 0
            ? 1
            : interpolate(
                frame,
                [start, start + CROSSFADE_FRAMES],
                [0, 1],
                { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
              );

        // Crossfade out (except last scene)
        const fadeOut = isLast
          ? 1
          : interpolate(
              frame,
              [sceneEnd - CROSSFADE_FRAMES, sceneEnd],
              [1, 0],
              { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
            );

        return (
          <Sequence key={idx} from={start} durationInFrames={duration}>
            <AbsoluteFill style={{ opacity: fadeIn * fadeOut }}>
              <Component />
            </AbsoluteFill>
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
