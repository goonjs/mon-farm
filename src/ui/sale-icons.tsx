/**
 * Sale set (E04 v2, sale mockup v1.1.0): line icons drawn with plain Views,
 * same contract as ./icons — `size` is the outer square, the colour comes
 * from the theme at the call site, and each is hidden from screen readers.
 * Re-exported by ./icons.
 */

import { View } from 'react-native';

type IconProps = { color: string; size?: number };
const stroke = (size: number) => Math.max(1.5, size / 10);

function Ring({ color, size, children }: { color: string; size: number; children?: React.ReactNode }) {
  return (
    <View aria-hidden style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ position: 'absolute', width: size, height: size, borderRadius: size / 2, borderWidth: stroke(size), borderColor: color }} />
      {children}
    </View>
  );
}

/** Basket (เข่ง) — a tub: a wide rim over a body with two slats. */
export function BasketIcon({ color, size = 18 }: IconProps) {
  const w = stroke(size);
  return (
    <View aria-hidden style={{ width: size, height: size, alignItems: 'center', justifyContent: 'flex-end' }}>
      <View style={{ width: size, height: w, borderRadius: w, backgroundColor: color, marginBottom: size * 0.04 }} />
      <View
        style={{
          width: size * 0.8,
          height: size * 0.5,
          borderWidth: w,
          borderTopWidth: 0,
          borderBottomLeftRadius: size * 0.2,
          borderBottomRightRadius: size * 0.2,
          borderColor: color,
          flexDirection: 'row',
          justifyContent: 'center',
          gap: size * 0.16,
        }}
      >
        <View style={{ width: w, backgroundColor: color }} />
        <View style={{ width: w, backgroundColor: color }} />
      </View>
    </View>
  );
}

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

/** Buyer / group — two people side by side. */
export function UsersIcon({ color, size = 18 }: IconProps) {
  const w = stroke(size);
  const head = { position: 'absolute', top: 0, width: size * 0.38, height: size * 0.38, borderRadius: size, borderWidth: w, borderColor: color } as const;
  const body = {
    position: 'absolute',
    bottom: 0,
    width: size * 0.55,
    height: size * 0.4,
    borderTopLeftRadius: size,
    borderTopRightRadius: size,
    borderWidth: w,
    borderBottomWidth: 0,
    borderColor: color,
  } as const;
  return (
    <View aria-hidden style={{ width: size, height: size }}>
      <View style={{ ...head, left: size * 0.06 }} />
      <View style={{ ...body, left: 0 }} />
      <View style={{ ...head, right: size * 0.06 }} />
      <View style={{ ...body, right: 0 }} />
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

/** Time — a clock face with two hands. */
export function ClockIcon({ color, size = 18 }: IconProps) {
  const w = stroke(size);
  return (
    <Ring color={color} size={size}>
      <View style={{ position: 'absolute', top: size * 0.22, left: (size - w) / 2, width: w, height: size * 0.3, backgroundColor: color }} />
      <View style={{ position: 'absolute', top: size * 0.48, left: size / 2 - w / 2, width: size * 0.22, height: w, backgroundColor: color }} />
    </Ring>
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

/** Price — a coin with a bar through it (the baht sign drawn, not typed). */
export function CoinIcon({ color, size = 18 }: IconProps) {
  const w = stroke(size);
  return (
    <Ring color={color} size={size}>
      <View style={{ width: size * 0.3, height: size * 0.45, borderWidth: w, borderRadius: w, borderColor: color }} />
      <View style={{ position: 'absolute', top: size * 0.18, bottom: size * 0.18, width: w, backgroundColor: color }} />
    </Ring>
  );
}
