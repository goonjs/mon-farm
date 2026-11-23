/**
 * "กำหนดเอง" — hour and minute wheels for the sale prep time (E01-S26 PS26-6, owner 2026-11-21:
 * "ใช้เป็นแบบเลื่อนๆขึ้นลงเลือก hour กับเวลาได้เลยเวลาขอใช้แค่00 15 30 45 ... default เป็นสัก 10 โมง").
 * Each column scrolls up and down; the middle row is the pick, and tapping a row picks it too.
 * Nothing is written until ตกลง (owner prep-time-default: closing the sheet saves nothing).
 */

import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

import { useT } from '../../i18n';
import { useTheme } from '../../theme';
import { BottomSheet, CTA } from '../../ui';

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = ['00', '15', '30', '45'] as const;
const ROW = 48;
const SHOWN = 5;

/** "HH:MM" → its hour and the nearest allowed minute; anything else starts at 10:00. */
export function wheelStart(time: string | null | undefined): { h: string; m: string } {
  const hit = /^(\d{2}):(\d{2})$/.exec(time ?? '');
  if (!hit || !HOURS.includes(hit[1])) return { h: '10', m: '00' };
  return { h: hit[1], m: MINUTES.includes(hit[2] as (typeof MINUTES)[number]) ? hit[2] : '00' };
}

function Column({ items, value, onPick, testID }: { items: readonly string[]; value: string; onPick: (v: string) => void; testID: string }) {
  const t = useTheme();
  const ref = useRef<ScrollView>(null);
  const index = Math.max(0, items.indexOf(value));
  useEffect(() => {
    ref.current?.scrollTo({ y: index * ROW, animated: false });
  }, [index]);
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.min(items.length - 1, Math.max(0, Math.round(e.nativeEvent.contentOffset.y / ROW)));
    if (items[i] !== value) onPick(items[i]);
  };
  return (
    <View style={{ height: ROW * SHOWN, width: 88 }}>
      {/* The pick band, behind the rows. */}
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: ROW * 2, height: ROW, borderRadius: t.radius.md, backgroundColor: t.color.actionSunk }} />
      <ScrollView
        ref={ref}
        testID={testID}
        showsVerticalScrollIndicator={false}
        snapToInterval={ROW}
        decelerationRate="fast"
        scrollEventThrottle={32}
        onScroll={onScroll}
        contentOffset={{ x: 0, y: index * ROW }}
        contentContainerStyle={{ paddingVertical: ROW * 2 }}
      >
        {items.map((v) => {
          const on = v === value;
          return (
            <Pressable
              key={v}
              testID={`${testID}-${v}`}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              aria-selected={on}
              onPress={() => onPick(v)}
              style={{ height: ROW, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ fontFamily: t.font.family.sans, fontVariant: ['tabular-nums'], fontSize: t.font.size.headingMd, fontWeight: on ? t.font.weight.black : t.font.weight.regular, color: on ? t.color.ink : t.color.inkSoft }}>{v}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

export function TimeWheelSheet({ open, initial, onClose, onDone, testID }: { open: boolean; initial: string | null | undefined; onClose: () => void; onDone: (time: string) => void; testID: string }) {
  const t = useTheme();
  const msg = useT();
  // Mounted each time it opens, so it starts from the saved time (or 10:00).
  const [pick, setPick] = useState(() => wheelStart(initial));
  const time = `${pick.h}:${pick.m}`;
  return (
    <BottomSheet open={open} onClose={onClose} title={msg('prep.timeCustomTitle')} testID={testID}>
      <View style={{ gap: t.space.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: t.space.sm }}>
          <Column testID={`${testID}-h`} items={HOURS} value={pick.h} onPick={(h) => setPick((p) => ({ ...p, h }))} />
          <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.headingMd, fontWeight: t.font.weight.black, color: t.color.ink }}>:</Text>
          <Column testID={`${testID}-m`} items={MINUTES} value={pick.m} onPick={(m) => setPick((p) => ({ ...p, m }))} />
        </View>
        <CTA testID={`${testID}-done`} onPress={() => onDone(time)}>{msg('prep.timeOk', { time })}</CTA>
      </View>
    </BottomSheet>
  );
}
