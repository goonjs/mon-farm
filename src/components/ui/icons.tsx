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

// ── Money-team set (E01-S17 X4) ─────────────────────────────────────────────
// Same contract as above: `size` is the outer square, `color` comes from the
// theme at the call site, everything is aria-hidden. Stroke scales with size.

type IconProps = { color: string; size?: number };
const stroke = (size: number) => Math.max(1.5, size / 10);

/** A coin ring with a mark inside — the base of the money icons. */
function Coin({ color, size, children }: { color: string; size: number; children?: React.ReactNode }) {
  return (
    <View aria-hidden style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: stroke(size),
          borderColor: color,
        }}
      />
      {children}
    </View>
  );
}

/** Money in — coin with +. Pair with a "+" amount and a word, never colour alone. */
export function MoneyInIcon({ color, size = 18 }: IconProps) {
  return (
    <Coin color={color} size={size}>
      <Plus color={color} size={size * 0.45} />
    </Coin>
  );
}

/** Money out — coin with −. */
export function MoneyOutIcon({ color, size = 18 }: IconProps) {
  return (
    <Coin color={color} size={size}>
      <View style={{ width: size * 0.45, height: stroke(size), borderRadius: stroke(size), backgroundColor: color }} />
    </Coin>
  );
}

/** Payer / person — head over shoulders. */
export function PersonIcon({ color, size = 18 }: IconProps) {
  const w = stroke(size);
  return (
    <View aria-hidden style={{ width: size, height: size, alignItems: 'center' }}>
      <View style={{ width: size * 0.45, height: size * 0.45, borderRadius: size, borderWidth: w, borderColor: color }} />
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          width: size * 0.85,
          height: size * 0.42,
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

/** Calendar / date — page with a heavy top band and two rings. */
export function CalendarIcon({ color, size = 18 }: IconProps) {
  const w = stroke(size);
  const ring = { position: 'absolute', top: 0, width: w, height: size * 0.25, backgroundColor: color } as const;
  return (
    <View aria-hidden style={{ width: size, height: size }}>
      <View
        style={{
          position: 'absolute',
          top: size * 0.12,
          left: 0,
          right: 0,
          bottom: 0,
          borderWidth: w,
          borderTopWidth: w * 2,
          borderRadius: w,
          borderColor: color,
        }}
      />
      <View style={{ ...ring, left: size * 0.28 }} />
      <View style={{ ...ring, right: size * 0.28 }} />
    </View>
  );
}

/** Receipt — a slip with three lines of text. */
export function ReceiptIcon({ color, size = 18 }: IconProps) {
  const w = stroke(size);
  const line = { height: w, borderRadius: w, backgroundColor: color } as const;
  return (
    <View aria-hidden style={{ width: size, height: size, alignItems: 'center' }}>
      <View
        style={{
          width: size * 0.75,
          height: size,
          borderWidth: w,
          borderRadius: w,
          borderColor: color,
          paddingHorizontal: size * 0.12,
          paddingTop: size * 0.2,
          gap: size * 0.12,
        }}
      >
        <View style={line} />
        <View style={line} />
        <View style={{ ...line, width: '60%' }} />
      </View>
    </View>
  );
}

/** Debt — a coin resting on an open tray: money held for someone. */
export function DebtIcon({ color, size = 18 }: IconProps) {
  const w = stroke(size);
  return (
    <View aria-hidden style={{ width: size, height: size, alignItems: 'center' }}>
      <View
        style={{ width: size * 0.55, height: size * 0.55, borderRadius: size, borderWidth: w, borderColor: color }}
      />
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: size * 0.35,
          borderWidth: w,
          borderTopWidth: 0,
          borderBottomLeftRadius: size * 0.2,
          borderBottomRightRadius: size * 0.2,
          borderColor: color,
        }}
      />
    </View>
  );
}

/** Account / bank — roof, three columns, base. */
export function BankIcon({ color, size = 18 }: IconProps) {
  const w = stroke(size);
  const col = { width: w, height: size * 0.38, backgroundColor: color } as const;
  return (
    <View aria-hidden style={{ width: size, height: size, alignItems: 'center' }}>
      <View
        style={{
          width: 0,
          height: 0,
          borderLeftWidth: size / 2,
          borderRightWidth: size / 2,
          borderBottomWidth: size * 0.3,
          borderLeftColor: 'transparent',
          borderRightColor: 'transparent',
          borderBottomColor: color,
        }}
      />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: size * 0.7, marginTop: size * 0.08 }}>
        <View style={col} />
        <View style={col} />
        <View style={col} />
      </View>
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: w * 1.4, backgroundColor: color }} />
    </View>
  );
}

/** Farm — a tree: round canopy on a trunk (the mockup's farm mark). */
export function FarmIcon({ color, size = 18 }: IconProps) {
  const w = stroke(size);
  return (
    <View aria-hidden style={{ width: size, height: size, alignItems: 'center' }}>
      <View
        style={{ width: size * 0.62, height: size * 0.62, borderRadius: size, borderWidth: w, borderColor: color }}
      />
      <View style={{ width: w, flex: 1, backgroundColor: color }} />
    </View>
  );
}

/** Scale / weighing point — the money team's name for `Scale`. */
export function ScaleIcon({ color, size = 18 }: IconProps) {
  return <Scale color={color} size={size} />;
}
