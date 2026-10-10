/**
 * Why money changed on a Completed sale (E04-S11, SALE-21): one of the
 * owner's preset reasons, or "อื่นๆ" typed. Nothing is recorded until a
 * reason is given; the caller writes `money_edit` with it, then the edit.
 */

import { useState } from 'react';
import { Text, View } from 'react-native';

import { MONEY_REASONS } from '../core/sale-status';
import { useT } from '../i18n';
import { useTheme } from '../theme';
import { Button } from './chrome';
import { Card, Chip, ChipRow, FieldError, TextField } from './farm-ui';

export function MoneyReasonPrompt({ onConfirm, onCancel }: { onConfirm: (reason: string) => void; onCancel: () => void }) {
  const t = useT();
  const th = useTheme();
  const [pick, setPick] = useState<number | 'other' | null>(null);
  const [typed, setTyped] = useState('');
  const [tried, setTried] = useState(false);
  const reason = pick === 'other' ? typed.trim() : pick === null ? '' : MONEY_REASONS[pick];

  const confirm = () => {
    setTried(true);
    if (reason) onConfirm(reason);
  };

  return (
    <Card testID="money-reason">
      <Text style={{ fontFamily: th.font.family.sans, fontSize: th.font.size.headingMd, fontWeight: th.font.weight.bold, color: th.color.ink }}>
        {t('reason.title')}
      </Text>
      <Text style={{ fontFamily: th.font.family.sans, fontSize: th.font.size.small, color: th.color.inkSoft }}>{t('reason.body')}</Text>
      <ChipRow>
        {MONEY_REASONS.map((r, i) => (
          <Chip key={r} testID={`reason-${i}`} label={r} on={pick === i} onPress={() => setPick(i)} />
        ))}
        <Chip testID="reason-other" label={t('reason.other')} on={pick === 'other'} onPress={() => setPick('other')} />
      </ChipRow>
      {pick === 'other' ? <TextField testID="reason-text" label={t('reason.otherLabel')} value={typed} onChangeText={setTyped} /> : null}
      {tried && !reason ? <FieldError text={t('reason.need')} /> : null}
      <View style={{ flexDirection: 'row', gap: th.space.sm }}>
        <Button testID="reason-cancel" onPress={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button testID="reason-confirm" variant="primary" onPress={confirm}>
          {t('reason.confirm')}
        </Button>
      </View>
    </Card>
  );
}
