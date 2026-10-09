/**
 * The pre-count wizard (F-21, FR-3): scale zero check, then bucket weight,
 * then a read-back before the stage hands off to `HoldStage`.
 *
 * Occupies the same space `HoldStage` will once the pile is ready — there is
 * nothing to show the Public register yet, so it's fine for this Operator
 * content to sit on the stage temporarily, the same way the design mockup
 * (docs/ux/mvp-screens.html screen 2) places it.
 *
 * A failed zero check FLAGS AND CONTINUES rather than blocking (see
 * `project.ts`'s `zero_check` handling) — the judgement of whether it's safe
 * to proceed belongs to the person standing at the scale, not the app.
 *
 * Thai voice read-back (FR-11) is not wired here — S10 is not built yet. The
 * "พร้อมค่ะ" button commits the ready event and shows the text that would be
 * spoken; it does not yet speak it.
 */

import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { Button } from './chrome';
import { useT } from '../i18n';
import { useTheme } from '../theme';

export interface ZeroTareGateProps {
  pileName: string;
  /** The pile's current tare, in grams — the starting value offered in step 2. */
  tareG: number;
  stdNetG: number;
  zeroChecked: boolean;
  tareConfirmed: boolean;
  onZeroChecked: (ok: boolean, readingG: number) => void;
  onTareConfirmed: (tareG: number) => void;
  onReady: () => void;
}

const kg = (g: number) => (g / 1000).toLocaleString('en-US', { maximumFractionDigits: 3 });

export function ZeroTareGate({
  pileName,
  tareG,
  stdNetG,
  zeroChecked,
  tareConfirmed,
  onZeroChecked,
  onTareConfirmed,
  onReady,
}: ZeroTareGateProps) {
  const t = useTheme();
  const msg = useT();
  const step = !zeroChecked ? 1 : !tareConfirmed ? 2 : 3;

  return (
    <View
      testID="zero-tare-gate"
      style={{
        flex: 1,
        backgroundColor: t.color.stage,
        alignItems: 'center',
        justifyContent: 'center',
        padding: t.space.xl,
        gap: t.space.md,
      }}
    >
      <Text
        style={{
          fontFamily: t.font.family.mono,
          fontSize: t.font.size.micro,
          letterSpacing: t.font.tracking.wide,
          color: t.color.action,
        }}
      >
        {msg('gate.step', { step })}
      </Text>

      {step === 1 ? (
        <ZeroStep pileName={pileName} onZeroChecked={onZeroChecked} />
      ) : step === 2 ? (
        <TareStep tareG={tareG} onTareConfirmed={onTareConfirmed} />
      ) : (
        <ReadyStep pileName={pileName} tareG={tareG} stdNetG={stdNetG} onReady={onReady} />
      )}
    </View>
  );
}

function ZeroStep({
  pileName,
  onZeroChecked,
}: {
  pileName: string;
  onZeroChecked: (ok: boolean, readingG: number) => void;
}) {
  const t = useTheme();
  const msg = useT();
  const [flagging, setFlagging] = useState(false);
  const [reading, setReading] = useState('0');

  return (
    <>
      <Text style={{ ...t.face(t.font.weight.black), fontSize: t.font.size.title, color: t.color.ink }}>
        {pileName}
      </Text>
      <Text style={{ ...t.face(t.font.weight.regular), fontSize: t.font.size.lead, color: t.color.ink, textAlign: 'center' }}>
        {msg('gate.zeroQuestion')}
      </Text>

      {!flagging ? (
        <View style={{ flexDirection: 'row', gap: t.space.sm }}>
          <Button testID="zero-yes" variant="primary" onPress={() => onZeroChecked(true, 0)}>
            {msg('gate.zeroYes')}
          </Button>
          <Button testID="zero-no" onPress={() => setFlagging(true)}>
            {msg('gate.zeroNo')}
          </Button>
        </View>
      ) : (
        <View style={{ alignItems: 'center', gap: t.space.sm }}>
          <Text style={{ fontFamily: t.font.family.mono, fontSize: t.font.size.micro, color: t.color.inkSoft }}>
            {msg('gate.zeroReading')}
          </Text>
          <TextInput
            testID="zero-reading"
            value={reading}
            onChangeText={setReading}
            keyboardType="decimal-pad"
            style={{
              minWidth: 100,
              textAlign: 'center',
              ...t.face(t.font.weight.regular),
              fontSize: t.font.size.lead,
              minHeight: 40,
              paddingHorizontal: t.space.sm,
              borderWidth: t.border.hair,
              borderColor: t.color.ruleStrong,
              borderRadius: t.radius.sm,
              backgroundColor: t.color.surfaceRaised,
              color: t.color.ink,
            }}
          />
          <Button
            testID="zero-flag-confirm"
            variant="primary"
            onPress={() => {
              const g = Math.round((Number(reading) || 0) * 1000);
              onZeroChecked(false, g);
            }}
          >
            {msg('gate.flagAndContinue')}
          </Button>
        </View>
      )}
    </>
  );
}

function TareStep({ tareG, onTareConfirmed }: { tareG: number; onTareConfirmed: (tareG: number) => void }) {
  const t = useTheme();
  const msg = useT();
  const [kgStr, setKgStr] = useState(kg(tareG));

  return (
    <>
      <Text style={{ ...t.face(t.font.weight.regular), fontSize: t.font.size.lead, color: t.color.ink, textAlign: 'center' }}>
        {msg('gate.tareQuestion')}
      </Text>
      <TextInput
        testID="tare-input"
        value={kgStr}
        onChangeText={setKgStr}
        keyboardType="decimal-pad"
        style={{
          minWidth: 120,
          textAlign: 'center',
          ...t.face(t.font.weight.black),
          fontSize: t.font.size.figure,
          minHeight: 56,
          paddingHorizontal: t.space.md,
          borderWidth: t.border.hair,
          borderColor: t.color.ruleStrong,
          borderRadius: t.radius.md,
          backgroundColor: t.color.surfaceRaised,
          color: t.color.ink,
        }}
      />
      <Button
        testID="tare-confirm"
        variant="primary"
        disabled={!(Number(kgStr) >= 0)}
        onPress={() => onTareConfirmed(Math.round((Number(kgStr) || 0) * 1000))}
      >
        {msg('gate.tareConfirm')}
      </Button>
    </>
  );
}

function ReadyStep({
  pileName,
  tareG,
  stdNetG,
  onReady,
}: {
  pileName: string;
  tareG: number;
  stdNetG: number;
  onReady: () => void;
}) {
  const t = useTheme();
  const msg = useT();
  const expectedG = tareG + stdNetG;

  return (
    <>
      <Text style={{ ...t.face(t.font.weight.black), fontSize: t.font.size.title, color: t.color.ink }}>
        {pileName}
      </Text>
      <Text testID="read-back" style={{ ...t.face(t.font.weight.regular), fontSize: t.font.size.lead, color: t.color.ink, textAlign: 'center' }}>
        {msg('gate.expected', { tare: kg(tareG), std: kg(stdNetG), expected: kg(expectedG) })}
        {'\n'}
        <Text style={{ fontSize: t.font.size.small, color: t.color.inkSoft }}>{msg('gate.readAloud')}</Text>
      </Text>
      <Button testID="ready-button" variant="primary" onPress={onReady}>
        {`${msg('say.ready')} — ${msg('gate.ready')}`}
      </Button>
    </>
  );
}
