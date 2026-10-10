/**
 * Line icons drawn with plain Views — no icon font, no SVG dependency
 * (react-native-svg is not installed). Each takes a colour from the theme at
 * the call site and is hidden from screen readers: the control around it
 * carries the name.
 */

import { View } from 'react-native';

const STROKE = 2.5;

/** ‹ — back. */
export function ChevronLeft({ color, size = 12 }: { color: string; size?: number }) {
  return (
    <View
      aria-hidden
      style={{
        width: size,
        height: size,
        marginLeft: size / 3,
        borderLeftWidth: STROKE,
        borderBottomWidth: STROKE,
        borderColor: color,
        transform: [{ rotate: '45deg' }],
      }}
    />
  );
}

/** › — goes somewhere. */
export function ChevronRight({ color, size = 10 }: { color: string; size?: number }) {
  return (
    <View
      aria-hidden
      style={{
        width: size,
        height: size,
        marginRight: size / 3,
        borderRightWidth: STROKE,
        borderTopWidth: STROKE,
        borderColor: color,
        transform: [{ rotate: '45deg' }],
      }}
    />
  );
}

/** ☰ — the app menu. */
export function MenuIcon({ color, width = 20 }: { color: string; width?: number }) {
  const bar = { width, height: STROKE, borderRadius: STROKE, backgroundColor: color };
  return (
    <View aria-hidden style={{ gap: 4 }}>
      <View style={bar} />
      <View style={bar} />
      <View style={bar} />
    </View>
  );
}

/** + — add. */
export function Plus({ color, size = 14 }: { color: string; size?: number }) {
  const bar = { position: 'absolute', backgroundColor: color, borderRadius: STROKE } as const;
  return (
    <View aria-hidden style={{ width: size, height: size }}>
      <View style={{ ...bar, left: 0, right: 0, top: (size - STROKE) / 2, height: STROKE }} />
      <View style={{ ...bar, top: 0, bottom: 0, left: (size - STROKE) / 2, width: STROKE }} />
    </View>
  );
}

/** − — remove / subtract. */
export function Minus({ color, size = 14 }: { color: string; size?: number }) {
  return (
    <View aria-hidden style={{ width: size, height: size, justifyContent: 'center' }}>
      <View style={{ height: STROKE, borderRadius: STROKE, backgroundColor: color }} />
    </View>
  );
}

/** ✓ — done. */
export function Check({ color, size = 12 }: { color: string; size?: number }) {
  return (
    <View aria-hidden style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          width: size * 0.5,
          height: size * 0.9,
          marginTop: -size * 0.15,
          borderRightWidth: STROKE,
          borderBottomWidth: STROKE,
          borderColor: color,
          transform: [{ rotate: '45deg' }],
        }}
      />
    </View>
  );
}

/** ↺ — undo: a three-quarter ring with an arrowhead at its open end. */
export function Undo({ color, size = 14 }: { color: string; size?: number }) {
  return (
    <View aria-hidden style={{ width: size, height: size }}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: STROKE,
          borderColor: color,
          borderTopColor: 'transparent',
          transform: [{ rotate: '-45deg' }],
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: -1,
          top: 0,
          width: size * 0.4,
          height: size * 0.4,
          borderLeftWidth: STROKE,
          borderTopWidth: STROKE,
          borderColor: color,
        }}
      />
    </View>
  );
}

/** ⚖ — the scale: beam on a post, a pan hanging from each end. */
export function Scale({ color, size = 16 }: { color: string; size?: number }) {
  const pan = {
    position: 'absolute',
    top: size * 0.3,
    width: size * 0.36,
    height: size * 0.2,
    borderBottomLeftRadius: size,
    borderBottomRightRadius: size,
    borderWidth: STROKE * 0.8,
    borderTopWidth: 0,
    borderColor: color,
  } as const;
  return (
    <View aria-hidden style={{ width: size, height: size }}>
      <View style={{ position: 'absolute', top: size * 0.18, left: 0, right: 0, height: STROKE, backgroundColor: color }} />
      <View
        style={{ position: 'absolute', top: size * 0.05, bottom: size * 0.08, left: (size - STROKE) / 2, width: STROKE, backgroundColor: color }}
      />
      <View
        style={{ position: 'absolute', bottom: 0, left: size * 0.25, right: size * 0.25, height: STROKE, backgroundColor: color }}
      />
      <View style={{ ...pan, left: 0 }} />
      <View style={{ ...pan, right: 0 }} />
    </View>
  );
}
