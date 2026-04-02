import React, { useMemo } from 'react';

/**
 * Procedural cinematic music using Web Audio API rendered as audio buffer.
 * Since Remotion renders frame-by-frame, we generate a WAV data URI
 * that plays across the entire composition as a single <audio> tag.
 *
 * This creates a soft, ambient luxury-style soundtrack with:
 * - Warm pad chords (saw + sine oscillators)
 * - Gentle pulse rhythm
 * - Emotional swell at the end
 */

const SAMPLE_RATE = 44100;
const DURATION = 21;
const TOTAL_SAMPLES = SAMPLE_RATE * DURATION;

function generateMusicBuffer(): Float32Array {
  const buffer = new Float32Array(TOTAL_SAMPLES);

  // Chord progression (frequencies in Hz) — Cm → Ab → Eb → Bb → Fm → G
  const chords: [number, number, number][] = [
    [130.81, 155.56, 196.00], // Cm
    [130.81, 155.56, 196.00], // Cm (repeat)
    [138.59, 174.61, 207.65], // Ab (approx)
    [138.59, 174.61, 207.65], // Ab
    [155.56, 196.00, 233.08], // Eb
    [155.56, 196.00, 233.08], // Eb
    [146.83, 174.61, 220.00], // Bb (approx)
    [130.81, 155.56, 196.00], // Cm resolve
  ];

  const chordDuration = TOTAL_SAMPLES / chords.length;

  for (let i = 0; i < TOTAL_SAMPLES; i++) {
    const t = i / SAMPLE_RATE;
    const chordIdx = Math.min(Math.floor(i / chordDuration), chords.length - 1);
    const chord = chords[chordIdx];

    // Warm pad (low volume sine + filtered saw approximation)
    let padSample = 0;
    for (const freq of chord) {
      // Sine fundamental
      padSample += Math.sin(2 * Math.PI * freq * t) * 0.08;
      // Octave up for shimmer
      padSample += Math.sin(2 * Math.PI * freq * 2 * t) * 0.03;
      // Soft triangle for warmth
      const phase = (freq * t) % 1;
      padSample += (phase < 0.5 ? 4 * phase - 1 : 3 - 4 * phase) * 0.02;
    }

    // Gentle sub bass
    const bassFreq = chord[0] / 2;
    padSample += Math.sin(2 * Math.PI * bassFreq * t) * 0.12;

    // Soft pulse/rhythm (subtle kick pattern at ~92 BPM)
    const beatPeriod = 60 / 92;
    const beatPhase = (t % beatPeriod) / beatPeriod;
    const kick = beatPhase < 0.05 ? Math.sin(2 * Math.PI * 60 * (1 - beatPhase * 20) * t) * Math.exp(-beatPhase * 80) * 0.15 : 0;
    padSample += kick;

    // High shimmer (very soft)
    const shimmer = Math.sin(2 * Math.PI * chord[2] * 4 * t) * 0.008 * (0.5 + 0.5 * Math.sin(2 * Math.PI * 0.3 * t));
    padSample += shimmer;

    // Master envelope (fade in/out)
    let envelope = 1;
    if (t < 1.5) envelope = t / 1.5; // Fade in
    if (t > 19) envelope = (21 - t) / 2; // Fade out

    // Emotional swell in last 6 seconds
    if (t > 15) {
      const swellT = (t - 15) / 6;
      const swell = Math.sin(2 * Math.PI * chord[2] * 2 * t) * 0.04 * swellT;
      padSample += swell;
    }

    buffer[i] = padSample * envelope * 0.7;

    // Clamp
    if (buffer[i] > 1) buffer[i] = 1;
    if (buffer[i] < -1) buffer[i] = -1;
  }

  return buffer;
}

function encodeWAV(samples: Float32Array): string {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = SAMPLE_RATE * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = samples.length * (bitsPerSample / 8);
  const headerSize = 44;
  const totalSize = headerSize + dataSize;

  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);

  // RIFF header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, totalSize - 8, true);
  writeString(view, 8, 'WAVE');

  // fmt sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  // data sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // Write samples
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    const val = s < 0 ? s * 0x8000 : s * 0x7FFF;
    view.setInt16(offset, val, true);
    offset += 2;
  }

  // Convert to base64
  const uint8 = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < uint8.length; i++) {
    binary += String.fromCharCode(uint8[i]);
  }
  return 'data:audio/wav;base64,' + btoa(binary);
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

export const Music: React.FC = () => {
  const audioSrc = useMemo(() => {
    const samples = generateMusicBuffer();
    return encodeWAV(samples);
  }, []);

  return (
    <audio
      src={audioSrc}
      autoPlay
      style={{ display: 'none' }}
    />
  );
};
