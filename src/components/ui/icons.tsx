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
