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

// ── Farm-team set (D-83) ────────────────────────────────────────────────────
// Same contract: `size` is the outer square, colour from the caller, hidden.

/** Weighing point — a map pin: a ring on a point. */
export function PinIcon({ color, size = 18 }: IconProps) {
  const w = stroke(size);
  const head = size * 0.7;
  return (
    <View aria-hidden style={{ width: size, height: size, alignItems: 'center' }}>
      <View
        style={{
          width: head,
          height: head,
          borderRadius: head / 2,
          borderBottomRightRadius: 0,
          borderWidth: w,
          borderColor: color,
          transform: [{ rotate: '45deg' }],
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View style={{ width: head * 0.3, height: head * 0.3, borderRadius: head, backgroundColor: color }} />
      </View>
    </View>
  );
}

/** Role — a tag: a rounded label with a hole. */
export function TagIcon({ color, size = 18 }: IconProps) {
  const w = stroke(size);
  return (
    <View aria-hidden style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          width: size * 0.72,
          height: size * 0.72,
          borderWidth: w,
          borderColor: color,
          borderTopLeftRadius: size * 0.12,
          borderTopRightRadius: size,
          borderBottomLeftRadius: size * 0.12,
          borderBottomRightRadius: size * 0.12,
          transform: [{ rotate: '-45deg' }],
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View style={{ width: w * 1.6, height: w * 1.6, borderRadius: size, backgroundColor: color }} />
      </View>
    </View>
  );
}

/** Delete — a bin: lid, handle and body. */
export function TrashIcon({ color, size = 18 }: IconProps) {
  const w = stroke(size);
  return (
    <View aria-hidden style={{ width: size, height: size, alignItems: 'center' }}>
      <View style={{ width: size * 0.36, height: size * 0.14, borderWidth: w, borderBottomWidth: 0, borderColor: color }} />
      <View style={{ width: size * 0.9, height: w, backgroundColor: color }} />
      <View
        style={{
          width: size * 0.66,
          flex: 1,
          borderWidth: w,
          borderTopWidth: 0,
          borderBottomLeftRadius: w * 1.5,
          borderBottomRightRadius: w * 1.5,
          borderColor: color,
          flexDirection: 'row',
          justifyContent: 'center',
          gap: size * 0.14,
          paddingTop: size * 0.12,
          paddingBottom: size * 0.12,
        }}
      >
        <View style={{ width: w, backgroundColor: color }} />
        <View style={{ width: w, backgroundColor: color }} />
      </View>
    </View>
  );
}

/** Settings — a gear: a disc with eight teeth. */
export function GearIcon({ color, size = 18 }: IconProps) {
  const w = stroke(size);
  const tooth = { position: 'absolute', width: w * 1.6, height: size, borderRadius: w, backgroundColor: color } as const;
  return (
    <View aria-hidden style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={tooth} />
      <View style={{ ...tooth, transform: [{ rotate: '90deg' }] }} />
      <View style={{ ...tooth, transform: [{ rotate: '45deg' }] }} />
      <View style={{ ...tooth, transform: [{ rotate: '-45deg' }] }} />
      <View style={{ width: size * 0.62, height: size * 0.62, borderRadius: size, backgroundColor: color }} />
    </View>
  );
}

/** Share — a percent sign: two small rings and a slash. */
export function PercentIcon({ color, size = 18 }: IconProps) {
  const w = stroke(size);
  const ring = { position: 'absolute', width: size * 0.32, height: size * 0.32, borderRadius: size, borderWidth: w, borderColor: color } as const;
  return (
    <View aria-hidden style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ ...ring, top: size * 0.04, left: size * 0.04 }} />
      <View style={{ ...ring, bottom: size * 0.04, right: size * 0.04 }} />
      <View style={{ width: w, height: size * 1.1, borderRadius: w, backgroundColor: color, transform: [{ rotate: '45deg' }] }} />
    </View>
  );
}

/** Change over — two arrows, one each way. */
export function SwapIcon({ color, size = 18 }: IconProps) {
  const w = stroke(size);
  const head = size * 0.28;
  const bar = { position: 'absolute', left: size * 0.08, right: size * 0.08, height: w, borderRadius: w, backgroundColor: color } as const;
  const tip = { position: 'absolute', width: head, height: head, borderColor: color } as const;
  return (
    <View aria-hidden style={{ width: size, height: size }}>
      <View style={{ ...bar, top: size * 0.3 }} />
      <View
        style={{ ...tip, right: size * 0.08, top: size * 0.3 - head / 2 + w / 2, borderTopWidth: w, borderRightWidth: w, transform: [{ rotate: '45deg' }] }}
      />
      <View style={{ ...bar, top: size * 0.68 }} />
      <View
        style={{ ...tip, left: size * 0.08, top: size * 0.68 - head / 2 + w / 2, borderBottomWidth: w, borderLeftWidth: w, transform: [{ rotate: '45deg' }] }}
      />
    </View>
  );
}

// Sale set (E04 v2): basket, leaf, tapper, users, alert, flag, clock, expand, dots, hourglass, camera, coin.
export * from './sale-icons';
