#!/usr/bin/env node
// Turns the PNG captures from tests/e2e/visual/capture-website.spec.ts into the
// website and README assets. Requires ffmpeg with libwebp, libx264 and libvpx-vp9.
// Run through `npm run website:captures` (it runs the capture spec first).
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const captures = path.join(root, 'tests/results/website-captures');
const site = path.join(root, 'website/assets');
const readme = path.join(root, 'docs/screenshots');
const themes = ['light', 'dark'];
const gallery = ['dashboard', 'history', 'live-workout', 'plans', 'workout-details', 'exercises'];
// The hero cycles the four primary tabs, cross-fading like the app's tab bar.
const heroTabs = ['dashboard', 'history', 'live-workout', 'plans', 'dashboard'];
const HOLD = 2.2; // seconds each tab is shown, including its fade
const FADE = 0.25;
const FPS = 12;

function ffmpeg(args) {
  const result = spawnSync('ffmpeg', ['-v', 'error', '-y', ...args], { stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`ffmpeg failed: ${args.join(' ')}`);
}

function input(name) {
  const file = path.join(captures, `${name}.png`);
  if (!existsSync(file)) throw new Error(`Missing capture ${file}; run the capture spec first.`);
  return file;
}

function webp(source, target, width) {
  const scale = width ? ['-vf', `scale=${width}:-2:flags=lanczos`] : [];
  ffmpeg(['-i', source, ...scale, '-c:v', 'libwebp', '-quality', '82', '-compression_level', '6', target]);
}

mkdirSync(site, { recursive: true });
mkdirSync(readme, { recursive: true });

for (const theme of themes) {
  for (const name of gallery) {
    webp(input(`${name}-${theme}`), path.join(site, `iphone-gallery-${name}-${theme}.webp`));
    webp(input(`readme-${name}-${theme}`), path.join(readme, `${name}-${theme}.webp`));
  }
  webp(input(`dashboard-${theme}`), path.join(site, `hero-iphone-tabs-${theme}.webp`));

  const inputs = heroTabs.flatMap((name) => ['-loop', '1', '-t', String(HOLD), '-framerate', String(FPS), '-i', input(`${name}-${theme}`)]);
  const fades = [];
  let last = '[0:v]';
  for (let index = 1; index < heroTabs.length; index += 1) {
    const out = index === heroTabs.length - 1 ? '[hero]' : `[x${index}]`;
    fades.push(`${last}[${index}:v]xfade=transition=fade:duration=${FADE}:offset=${(index * (HOLD - FADE)).toFixed(2)}${out}`);
    last = out;
  }
  const graph = `${fades.join(';')};[hero]format=yuv420p,fps=${FPS}[v]`;
  const base = path.join(site, `hero-iphone-tabs-${theme}`);
  ffmpeg([...inputs, '-filter_complex', graph, '-map', '[v]', '-c:v', 'libx264', '-preset', 'slow', '-crf', '26', '-movflags', '+faststart', '-an', `${base}.mp4`]);
  ffmpeg([...inputs, '-filter_complex', graph, '-map', '[v]', '-c:v', 'libvpx-vp9', '-crf', '42', '-b:v', '0', '-row-mt', '1', '-an', `${base}.webm`]);
}

console.log('Website and README captures written.');
