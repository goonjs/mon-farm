/**
 * E03-S09: the home cover. The drawn scene, and if it throws, the cover the
 * home had before (CS-7) — the rest of the home keeps working either way.
 */

import { Component, type ReactNode } from 'react';

import { ClassicCover } from './classic-cover';
import { CoverScene } from './cover-scene';

class CoverBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.warn('home cover scene failed, showing the classic cover', error);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function HomeCover() {
  return (
    <CoverBoundary fallback={<ClassicCover />}>
      <CoverScene />
    </CoverBoundary>
  );
}
