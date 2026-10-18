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

/** Settings — a gear: a ring with eight short teeth around it, open in the middle. */
export function GearIcon({ color, size = 18 }: IconProps) {
  const w = stroke(size);
  const ring = size * 0.56;
  // Each tooth sits at the top of a full-size layer turned about the centre.
  const tooth = (deg: number) => (
    <View key={deg} style={{ position: 'absolute', width: size, height: size, alignItems: 'center', transform: [{ rotate: `${deg}deg` }] }}>
      <View style={{ width: w * 1.6, height: size * 0.26, borderRadius: w * 0.4, backgroundColor: color }} />
    </View>
  );
  return (
    <View aria-hidden style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {[0, 45, 90, 135, 180, 225, 270, 315].map(tooth)}
      <View style={{ width: ring, height: ring, borderRadius: size, borderWidth: w, borderColor: color }} />
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

// ── Home set (e03-v2-splash-home) ───────────────────────────────────────────
// The home's action cards, rows and module tiles (flow-v1 screen 3, v1.1.0
// screens 1 and 25), and the menu's fact lines. Same contract as above.

/** Prepare / checklist — three marked lines. */
export function ListIcon({ color, size = 18 }: IconProps) {
  const w = stroke(size);
  const row = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: size * 0.14 }}>
      <View style={{ width: size * 0.18, height: size * 0.18, borderRadius: w, backgroundColor: color }} />
      <View style={{ flex: 1, height: w, borderRadius: w, backgroundColor: color }} />
    </View>
  );
  return (
    <View aria-hidden style={{ width: size, height: size, justifyContent: 'space-around', paddingHorizontal: size * 0.06 }}>
      {row}
      {row}
      {row}
    </View>
  );
}

/** Sale — a basket: a handle over a slatted body. */
export function BasketIcon({ color, size = 18 }: IconProps) {
  const w = stroke(size);
  const slat = { width: w, height: '60%', backgroundColor: color } as const;
  return (
    <View aria-hidden style={{ width: size, height: size, alignItems: 'center' }}>
      <View
        style={{
          width: size * 0.5,
          height: size * 0.32,
          borderWidth: w,
          borderBottomWidth: 0,
          borderTopLeftRadius: size,
          borderTopRightRadius: size,
          borderColor: color,
        }}
      />
      <View style={{ width: size, height: w, borderRadius: w, backgroundColor: color }} />
      <View
        style={{
          width: size * 0.8,
          flex: 1,
          borderWidth: w,
          borderTopWidth: 0,
          borderBottomLeftRadius: size * 0.15,
          borderBottomRightRadius: size * 0.15,
          borderColor: color,
          flexDirection: 'row',
          justifyContent: 'space-evenly',
          alignItems: 'center',
        }}
      >
        <View style={slat} />
        <View style={slat} />
      </View>
    </View>
  );
}

/** Stock — a box with its lid line. */
export function BoxIcon({ color, size = 18 }: IconProps) {
  const w = stroke(size);
  return (
    <View aria-hidden style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: size * 0.86, height: size * 0.8, borderWidth: w, borderRadius: w, borderColor: color, alignItems: 'center' }}>
        <View style={{ width: '100%', height: w, marginTop: size * 0.2, backgroundColor: color }} />
        <View style={{ width: w, height: size * 0.18, backgroundColor: color }} />
      </View>
    </View>
  );
}

/** Report — three bars on an axis. */
export function ChartIcon({ color, size = 18 }: IconProps) {
  const w = stroke(size);
  const bar = (h: number) => <View style={{ width: size * 0.16, height: size * h, backgroundColor: color }} />;
  return (
    <View
      aria-hidden
      style={{
        width: size,
        height: size,
        borderLeftWidth: w,
        borderBottomWidth: w,
        borderColor: color,
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-evenly',
        paddingBottom: w,
      }}
    >
      {bar(0.35)}
      {bar(0.6)}
      {bar(0.45)}
    </View>
  );
}

/** Due / hold time — a clock face with two hands. */
export function ClockIcon({ color, size = 18 }: IconProps) {
  const w = stroke(size);
  return (
    <View
      aria-hidden
      style={{ width: size, height: size, borderRadius: size, borderWidth: w, borderColor: color, alignItems: 'center', justifyContent: 'center' }}
    >
      <View style={{ position: 'absolute', top: size * 0.16, width: w, height: size * 0.34, backgroundColor: color }} />
      <View style={{ position: 'absolute', top: size * 0.44, left: size * 0.44, width: size * 0.24, height: w, backgroundColor: color }} />
    </View>
  );
}

/** This device — a phone with its home bar. */
export function DeviceIcon({ color, size = 18 }: IconProps) {
  const w = stroke(size);
  return (
    <View aria-hidden style={{ width: size, height: size, alignItems: 'center' }}>
      <View
        style={{
          width: size * 0.6,
          height: size,
          borderWidth: w,
          borderRadius: size * 0.14,
          borderColor: color,
          alignItems: 'center',
          justifyContent: 'flex-end',
          paddingBottom: size * 0.1,
        }}
      >
        <View style={{ width: size * 0.2, height: w, borderRadius: w, backgroundColor: color }} />
      </View>
    </View>
  );
}

/** Sound — a speaker: a box, its cone and one sound wave. */
export function SpeakerIcon({ color, size = 18 }: IconProps) {
  const w = stroke(size);
  return (
    <View aria-hidden style={{ width: size, height: size, flexDirection: 'row', alignItems: 'center' }}>
      <View style={{ width: size * 0.2, height: size * 0.36, backgroundColor: color }} />
      <View
        style={{
          width: 0,
          height: 0,
          borderTopWidth: size * 0.3,
          borderBottomWidth: size * 0.3,
          borderRightWidth: size * 0.3,
          borderTopColor: 'transparent',
          borderBottomColor: 'transparent',
          borderRightColor: color,
        }}
      />
      <View
        style={{
          marginLeft: size * 0.04,
          width: size * 0.36,
          height: size * 0.6,
          borderRadius: size,
          borderWidth: w,
          borderLeftColor: 'transparent',
          borderTopColor: 'transparent',
          borderBottomColor: 'transparent',
          borderRightColor: color,
        }}
      />
    </View>
  );
}

/** Workers — two people side by side, the second a step behind. */
export function UsersIcon({ color, size = 18 }: IconProps) {
  const w = stroke(size);
  const person = (scale: number) => (
    <View style={{ width: size * 0.5 * scale, height: size * scale, alignItems: 'center', justifyContent: 'flex-end' }}>
      <View style={{ width: size * 0.32 * scale, height: size * 0.32 * scale, borderRadius: size, borderWidth: w, borderColor: color, marginBottom: size * 0.06 }} />
      <View
        style={{
          width: size * 0.5 * scale,
          height: size * 0.32 * scale,
          borderTopLeftRadius: size,
          borderTopRightRadius: size,
          borderWidth: w,
          borderBottomWidth: 0,
          borderColor: color,
        }}
      />
    </View>
  );
  return (
    <View aria-hidden style={{ width: size, height: size, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
      {person(1)}
      {person(0.86)}
    </View>
  );
}

/** Money — a coin with a bar through it (the mockup's ฿ coin, drawn). */
export function CoinIcon({ color, size = 18 }: IconProps) {
  const w = stroke(size);
  return (
    <Coin color={color} size={size}>
      <View style={{ width: size * 0.28, height: size * 0.44, borderWidth: w, borderRadius: w, borderColor: color }} />
      <View style={{ position: 'absolute', width: w, height: size * 0.62, backgroundColor: color }} />
    </Coin>
  );
}

/** Opens outside the app — a box with an arrow leaving its corner. */
export function ExternalIcon({ color, size = 18 }: IconProps) {
  const w = stroke(size);
  return (
    <View aria-hidden style={{ width: size, height: size }}>
      <View
        style={{
          position: 'absolute',
          left: 0,
          bottom: 0,
          width: size * 0.78,
          height: size * 0.78,
          borderWidth: w,
          borderRadius: w,
          borderTopRightRadius: 0,
          borderColor: color,
        }}
      />
      <View style={{ position: 'absolute', right: 0, top: 0, width: size * 0.4, height: size * 0.4, borderTopWidth: w, borderRightWidth: w, borderColor: color }} />
      <View
        style={{
          position: 'absolute',
          right: size * 0.18,
          top: size * 0.04,
          width: w,
          height: size * 0.6,
          backgroundColor: color,
          transform: [{ rotate: '45deg' }],
        }}
      />
    </View>
  );
}

/** To pay — a wallet with its clasp tab. */
export function WalletIcon({ color, size = 18 }: IconProps) {
  const w = stroke(size);
  return (
    <View aria-hidden style={{ width: size, height: size, justifyContent: 'center' }}>
      <View
        style={{
          width: size,
          height: size * 0.76,
          borderWidth: w,
          borderRadius: size * 0.14,
          borderColor: color,
          alignItems: 'flex-end',
          justifyContent: 'center',
        }}
      >
        <View
          style={{
            width: size * 0.36,
            height: size * 0.3,
            borderWidth: w,
            borderRightWidth: 0,
            borderTopLeftRadius: w * 2,
            borderBottomLeftRadius: w * 2,
            borderColor: color,
          }}
        />
      </View>
    </View>
  );
}

/** Weather — a sun peeking over a cloud. */
export function WeatherIcon({ color, size = 18 }: IconProps) {
  const w = stroke(size);
  return (
    <View aria-hidden style={{ width: size, height: size }}>
      <View style={{ position: 'absolute', left: size * 0.04, top: size * 0.06, width: size * 0.38, height: size * 0.38, borderRadius: size, backgroundColor: color }} />
      <View
        style={{
          position: 'absolute',
          right: 0,
          bottom: size * 0.1,
          width: size * 0.84,
          height: size * 0.44,
          borderRadius: size,
          borderWidth: w,
          borderColor: color,
        }}
      />
      <View
        style={{
          position: 'absolute',
          right: size * 0.18,
          top: size * 0.2,
          width: size * 0.42,
          height: size * 0.42,
          borderRadius: size,
          borderWidth: w,
          borderBottomColor: 'transparent',
          borderLeftColor: color,
          borderTopColor: color,
          borderRightColor: color,
        }}
      />
    </View>
  );
}
// Sale set (E04 v2): basket, leaf, tapper, users, alert, flag, clock, expand, dots, hourglass, camera, coin.
export * from './sale-icons';

/** Home — a roof over a house body. */
export function HomeIcon({ color, size = 18 }: IconProps) {
  const w = stroke(size);
  return (
    <View
      aria-hidden
      style={{
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "flex-end",
      }}
    >
      <View
        style={{
          position: "absolute",
          top: size * 0.12,
          width: size * 0.56,
          height: size * 0.56,
          borderLeftWidth: w,
          borderTopWidth: w,
          borderColor: color,
          transform: [{ rotate: "45deg" }],
        }}
      />
      <View
        style={{
          width: size * 0.62,
          height: size * 0.42,
          borderWidth: w,
          borderTopWidth: 0,
          borderColor: color,
        }}
      />
    </View>
  );
}

/** Info — a ring with a dot over a short stem. */
export function InfoIcon({ color, size = 18 }: IconProps) {
  const w = stroke(size);
  return (
    <View
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: size,
        borderWidth: w,
        borderColor: color,
        alignItems: "center",
        justifyContent: "center",
        gap: size * 0.07,
      }}
    >
      <View
        style={{
          width: w * 1.2,
          height: w * 1.2,
          borderRadius: w,
          backgroundColor: color,
        }}
      />
      <View style={{ width: w, height: size * 0.28, backgroundColor: color }} />
    </View>
  );
}
