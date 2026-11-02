/**
 * E03-S09: the home cover scene's own colours. An illustration, not UI: these
 * never carry text, so they live here beside the tokens rather than as theme
 * roles. `COVER_FRAMES` is the sky/land palette by hour (blended in between by
 * `src/core/cover-sky.ts`); `COVER_FIXED` are the few colours that do not
 * change with the hour.
 */

const NIGHT = {
  skyTop: '#0b1633', skyBot: '#23365e', sun: '#ffe9b0', cloud: '#5e6c8c', hill: '#1d3b4a', farD: '#11302b', farL: '#1a3f36',
  g1: '#1c4a3a', g2: '#12352a', bank: '#0e2a20', water1: '#34507c', water2: '#1c3558', flow: '#a9c0e6', leafD: '#0c2a21',
  leafM: '#13392d', leafL: '#1f4b3a', trunk: '#4a4f57', trunkHi: '#6e747e', tint: '#0a1430',
  glow: 0, cloudOp: 0.35, tintOp: 0.22, star: 1, shadow: 0,
};

/** Keyframes by hour, matching the owner-approved mockup (docs/ux/mockups/home-cover-scene.html). */
export const COVER_FRAMES = [
  [0, NIGHT],
  [4.75, NIGHT],
  [5.75, { skyTop: '#2e4277', skyBot: '#c4889a', sun: '#ff9a5c', cloud: '#b68da0', hill: '#4c6070', farD: '#1e4a3e', farL: '#2e5e4a', g1: '#36664e', g2: '#22503c', bank: '#1c4632', water1: '#9a88ae', water2: '#3e5486', flow: '#f0d8e4', leafD: '#163e30', leafM: '#21533c', leafL: '#456b48', trunk: '#625d62', trunkHi: '#9a8a90', tint: '#5a3a7a', glow: 0.4, cloudOp: 0.6, tintOp: 0.18, star: 0.3, shadow: 0 }],
  [6.75, { skyTop: '#7fb6e0', skyBot: '#ffd3a0', sun: '#ffb45c', cloud: '#ffe4cf', hill: '#86a9a2', farD: '#2c7659', farL: '#4c9870', g1: '#6cb678', g2: '#3e9661', bank: '#2e7650', water1: '#b6d7ee', water2: '#5fa0cc', flow: '#ffffff', leafD: '#1c684a', leafM: '#2c875a', leafL: '#76b66c', trunk: '#8c8578', trunkHi: '#d9c6aa', tint: '#ffa860', glow: 0.95, cloudOp: 0.8, tintOp: 0.13, star: 0, shadow: 0.22 }],
  [10, { skyTop: '#4fa6e2', skyBot: '#c9e8f8', sun: '#ffe27a', cloud: '#ffffff', hill: '#8dc3b8', farD: '#2e8461', farL: '#52a878', g1: '#79c885', g2: '#45a666', bank: '#348457', water1: '#a6daf4', water2: '#4b9ed4', flow: '#ffffff', leafD: '#1b6e4d', leafM: '#2b9160', leafL: '#7cc57a', trunk: '#8e8a82', trunkHi: '#d8d2c6', tint: '#fff3c8', glow: 0.7, cloudOp: 0.85, tintOp: 0.04, star: 0, shadow: 0.26 }],
  [12, { skyTop: '#3d9be0', skyBot: '#bde3f9', sun: '#fff6cf', cloud: '#ffffff', hill: '#94c8bc', farD: '#2f8963', farL: '#5aaf7e', g1: '#82ce8a', g2: '#4bac6b', bank: '#3a8b5c', water1: '#ace0f7', water2: '#4aa3da', flow: '#ffffff', leafD: '#1c7150', leafM: '#2e9664', leafL: '#88cd80', trunk: '#908d86', trunkHi: '#e0dbd0', tint: '#ffffff', glow: 0.65, cloudOp: 0.9, tintOp: 0.02, star: 0, shadow: 0.3 }],
  [15, { skyTop: '#4a9dda', skyBot: '#d6eaf0', sun: '#ffd764', cloud: '#fff7ea', hill: '#8bbdb0', farD: '#2d7f5c', farL: '#57a576', g1: '#7bc37f', g2: '#449f62', bank: '#337f52', water1: '#a6d5ec', water2: '#4c98cc', flow: '#ffffff', leafD: '#1c6a4a', leafM: '#2d8c5c', leafL: '#8ec476', trunk: '#8f897e', trunkHi: '#dccdb4', tint: '#ffd58a', glow: 0.75, cloudOp: 0.85, tintOp: 0.07, star: 0, shadow: 0.28 }],
  [17.6, { skyTop: '#5e78be', skyBot: '#ffaa70', sun: '#ff7e3a', cloud: '#ffc4a4', hill: '#7e8f98', farD: '#2b5e4c', farL: '#4e7f5e', g1: '#5e9a62', g2: '#3a7550', bank: '#2b5e40', water1: '#f4b890', water2: '#6e7eb0', flow: '#ffe6d2', leafD: '#1d4e3b', leafM: '#2e6a48', leafL: '#9aa85a', trunk: '#7d6e62', trunkHi: '#e6a878', tint: '#ff7a3a', glow: 1, cloudOp: 0.85, tintOp: 0.15, star: 0, shadow: 0.2 }],
  [19, { skyTop: '#283a74', skyBot: '#b06a84', sun: '#ff6a3a', cloud: '#b98494', hill: '#3d4d66', farD: '#1b3a36', farL: '#2a4e42', g1: '#2e5a48', g2: '#1f4436', bank: '#183a2c', water1: '#8c80a8', water2: '#3a4c7a', flow: '#e2cadc', leafD: '#13322a', leafM: '#1c4434', leafL: '#3a5a40', trunk: '#5a5558', trunkHi: '#8a7a80', tint: '#3a2a6a', glow: 0.25, cloudOp: 0.55, tintOp: 0.2, star: 0.45, shadow: 0 }],
  [20.25, NIGHT],
  [24, NIGHT],
] as const;

export const COVER_FIXED = {
  barkCut: '#4e4339',
  freshBark: '#f4eedf',
  cup: '#e9e2d3',
  cupRim: '#6b5e50',
  stone: '#7d8287',
  stoneLight: '#9aa0a6',
  shadow: '#0b2a1c',
  star: '#ffffff',
  moon: '#f4efd8',
} as const;
