/**
 * Sale setup — STUB.
 *
 * The real screen (parties, buyer, price, zones each with a worker and split,
 * piles with tare/standard net) is story S6, not this one. This exists so
 * "start a new sale" from the sale list has somewhere honest to land in the
 * meantime, rather than either a broken counter screen (no zones yet) or a
 * silently fabricated one.
 *
 * Nothing here writes an event. A sale that never gets past this screen never
 * existed as far as the store is concerned — see src/app/index.tsx's header
 * for why that is the correct behaviour, not a bug.
 */

import { View, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Button, TopBar } from '../../../components/chrome';
import { useTheme } from '../../../theme';

export default function SetupScreen() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  return (
    <View style={{ flex: 1, backgroundColor: t.color.surface }}>
      <TopBar crumb="ตั้งค่าการขาย · sale setup" />
      <View style={{ flex: 1, padding: t.space.xl, justifyContent: 'center', gap: t.space.md }}>
        <Text
          style={{
            fontFamily: t.font.family.sans,
            fontSize: t.font.size.lead,
            fontWeight: t.font.weight.bold,
            color: t.color.ink,
          }}
        >
          หน้าตั้งค่ายังไม่พร้อม · setup isn&apos;t built yet
        </Text>
        <Text
          testID="setup-stub-note"
          style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.small, color: t.color.inkSoft }}
        >
          Sale id {id}. Nothing has been recorded — leaving this screen loses
          nothing, because nothing was written.
        </Text>
        <View style={{ flexDirection: 'row' }}>
          {/*
           * router.back() — a real pop, not a Link. The list screen we came
           * from is already on the stack; navigating there with a Link would
           * PUSH A SECOND COPY on top of it (or, with `replace`, swap the top
           * entry and still leave the original underneath), so repeated
           * visits here would leave hidden list-screen instances stacking up
           * forever. Popping reuses the one that's already there.
           */}
          <Button variant="primary" onPress={() => router.back()}>
            ← กลับไปรายการ · back to the sale list
          </Button>
        </View>
      </View>
    </View>
  );
}
