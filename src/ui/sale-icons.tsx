/**
 * Sale set (E04 v2, sale mockup v1.1.0): line icons drawn with plain Views,
 * same contract as ./icons — `size` is the outer square, the colour comes
 * from the theme at the call site, and each is hidden from screen readers.
 * Re-exported by ./icons. Basket, users, clock and coin come from the home set there.
 */

import { View } from 'react-native';

type IconProps = { color: string; size?: number };
const stroke = (size: number) => Math.max(1.5, size / 10);

/** Rubber weight (ยางสุทธิ) — a leaf: a pointed oval with its vein. */
export function LeafIcon({ color, size = 18 }: IconProps) {
  const w = stroke(size);
  return (
    <View aria-hidden style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          width: size * 0.7,
          height: size * 0.7,
          borderWidth: w,
          borderColor: color,
          borderTopLeftRadius: size,
          borderBottomRightRadius: size,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View style={{ width: w, height: size * 0.75, backgroundColor: color, transform: [{ rotate: '-45deg' }] }} />
      </View>
    </View>
  );
}

/** Tapper (คนกรีดยาง) — a person under a wide hat brim. */
export function TapperIcon({ color, size = 18 }: IconProps) {
  const w = stroke(size);
  return (
    <View aria-hidden style={{ width: size, height: size, alignItems: 'center' }}>
      <View style={{ width: size * 0.4, height: size * 0.18, borderTopLeftRadius: size, borderTopRightRadius: size, backgroundColor: color }} />
      <View style={{ width: size, height: w, borderRadius: w, backgroundColor: color }} />
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          width: size * 0.7,
          height: size * 0.5,
          borderTopLeftRadius: size,
          borderTopRightRadius: size,
          borderWidth: w,
          borderBottomWidth: 0,
          borderColor: color,
        }}
      />
    </View>
  );
}

/** Warning — a triangle outline with a bar and a dot. */
export function AlertIcon({ color, size = 18 }: IconProps) {
  const w = stroke(size);
  const side = { position: 'absolute', bottom: size * 0.38, width: w, height: size * 0.95, backgroundColor: color } as const;
  return (
    <View aria-hidden style={{ width: size, height: size, alignItems: 'center', overflow: 'hidden' }}>
      <View style={{ ...side, left: size * 0.28, transform: [{ rotate: '28deg' }, { translateY: size * 0.42 }] }} />
      <View style={{ ...side, right: size * 0.28, transform: [{ rotate: '-28deg' }, { translateY: size * 0.42 }] }} />
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: w, backgroundColor: color }} />
      <View style={{ position: 'absolute', top: size * 0.38, width: w, height: size * 0.28, backgroundColor: color }} />
      <View style={{ position: 'absolute', bottom: size * 0.16, width: w, height: w, backgroundColor: color }} />
    </View>
  );
}

/** Flag — a pole with a pennant. */
export function FlagIcon({ color, size = 18 }: IconProps) {
  const w = stroke(size);
  return (
    <View aria-hidden style={{ width: size, height: size }}>
      <View style={{ position: 'absolute', left: size * 0.15, top: 0, bottom: 0, width: w, backgroundColor: color }} />
      <View style={{ position: 'absolute', left: size * 0.15, top: size * 0.05, width: size * 0.7, height: size * 0.45, borderWidth: w, borderColor: color }} />
    </View>
  );
}

/** Full screen — four corners pointing out. */
export function ExpandIcon({ color, size = 18 }: IconProps) {
  const w = stroke(size);
  const c = { position: 'absolute', width: size * 0.32, height: size * 0.32, borderColor: color } as const;
  return (
    <View aria-hidden style={{ width: size, height: size }}>
      <View style={{ ...c, top: 0, left: 0, borderTopWidth: w, borderLeftWidth: w }} />
      <View style={{ ...c, top: 0, right: 0, borderTopWidth: w, borderRightWidth: w }} />
      <View style={{ ...c, bottom: 0, left: 0, borderBottomWidth: w, borderLeftWidth: w }} />
      <View style={{ ...c, bottom: 0, right: 0, borderBottomWidth: w, borderRightWidth: w }} />
    </View>
  );
}

/** More — three dots in a row. */
export function DotsIcon({ color, size = 18 }: IconProps) {
  const dot = { width: size * 0.2, height: size * 0.2, borderRadius: size, backgroundColor: color } as const;
  return (
    <View aria-hidden style={{ width: size, height: size, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <View style={dot} />
      <View style={dot} />
      <View style={dot} />
    </View>
  );
}

/** Waiting — an hourglass: two cones tip to tip between two bars. */
export function HourglassIcon({ color, size = 18 }: IconProps) {
  const w = stroke(size);
  const cone = {
    width: size * 0.56,
    height: size * 0.36,
    borderWidth: w,
    borderColor: color,
  } as const;
  return (
    <View aria-hidden style={{ width: size, height: size, alignItems: 'center' }}>
      <View style={{ width: size * 0.8, height: w, backgroundColor: color }} />
      <View style={{ ...cone, borderBottomLeftRadius: size, borderBottomRightRadius: size }} />
      <View style={{ ...cone, borderTopLeftRadius: size, borderTopRightRadius: size }} />
      <View style={{ width: size * 0.8, height: w, backgroundColor: color }} />
    </View>
  );
}

/** Photo — a camera body with a lens. */
export function CameraIcon({ color, size = 18 }: IconProps) {
  const w = stroke(size);
  return (
    <View aria-hidden style={{ width: size, height: size, justifyContent: 'flex-end', alignItems: 'center' }}>
      <View style={{ width: size * 0.36, height: size * 0.14, backgroundColor: color, borderTopLeftRadius: w, borderTopRightRadius: w }} />
      <View style={{ width: size, height: size * 0.68, borderWidth: w, borderRadius: w * 1.5, borderColor: color, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: size * 0.34, height: size * 0.34, borderRadius: size, borderWidth: w, borderColor: color }} />
      </View>
    </View>
  );
}


/** Search — a lens with a handle, for a list's search in the top bar. */
export function SearchIcon({ color, size = 18 }: IconProps) {
  const w = stroke(size);
  return (
    <View aria-hidden style={{ width: size, height: size }}>
      <View style={{ position: 'absolute', left: 0, top: 0, width: size * 0.7, height: size * 0.7, borderRadius: size, borderWidth: w, borderColor: color }} />
      <View style={{ position: 'absolute', left: size * 0.6, top: size * 0.72, width: size * 0.38, height: w, borderRadius: w, backgroundColor: color, transform: [{ rotate: '45deg' }] }} />
    </View>
  );
}
