/**
 * Edit or void one basket from the recorder's list (E04-S09, SALE-17).
 *
 * An edit never rewrites the basket: the caller voids it (reason `edit`) and
 * records a new one with `editOf`, so the original stays in the log. A void
 * keeps the row, struck through, and every other number where it was
 * (owner 2026-10-03). Weight is the net rubber, in kg, as the list shows it.
 */

import { useState } from 'react';
import { Text, View } from 'react-native';

import { formatKg } from '../core/settle';
import { parseKgG } from '../core/sale-points';
import { useT } from '../i18n';
import { useTheme } from '../theme';
import { Button } from './chrome';
import { Chip, ChipRow, TextField } from './farm-ui';

export interface BasketEditorProps {
  readonly basketNo: number;
  readonly netG: number;
  readonly pointId: string;
  /** Where the basket can be moved: the sale's points, by name. */
  readonly points: readonly { id: string; name: string }[];
  readonly by: string;
  readonly onSave: (change: { netG: number; pointId: string }) => void;
  readonly onVoid: () => void;
  readonly onCancel: () => void;
}

export function BasketEditor(props: BasketEditorProps) {
  const t = useT();
  const th = useTheme();
  const [kg, setKg] = useState(() => formatKg(props.netG).replace(/,/g, ''));
  const [pointId, setPointId] = useState(props.pointId);
  const [tried, setTried] = useState(false);
  const [voiding, setVoiding] = useState(false);
  const netG = parseKgG(kg);

  const save = () => {
    setTried(true);
    if (netG === null) return;
    props.onSave({ netG, pointId });
  };

  return (
    <View testID="basket-editor" style={{ gap: th.space.sm }}>
      <Text style={{ fontFamily: th.font.family.sans, fontSize: th.font.size.headingMd, fontWeight: th.font.weight.bold, color: th.color.ink }}>
        {t('edit.title', { n: props.basketNo })}
      </Text>
      <Text style={{ fontFamily: th.font.family.sans, fontSize: th.font.size.small, color: th.color.inkSoft }}>{props.by}</Text>
      {voiding ? (
        <>
          <Text style={{ fontFamily: th.font.family.sans, fontSize: th.font.size.body, color: th.color.reject }}>
            {t('edit.voidBody', { n: props.basketNo })}
          </Text>
          <View style={{ flexDirection: 'row', gap: th.space.sm }}>
            <Button testID="edit-void-cancel" onPress={() => setVoiding(false)}>
              {t('common.cancel')}
            </Button>
            <Button testID="edit-void-confirm" variant="destructive" onPress={props.onVoid}>
              {t('edit.voidConfirm')}
            </Button>
          </View>
        </>
      ) : (
        <>
          <TextField
            testID="edit-kg"
            label={t('edit.kg')}
            value={kg}
            onChangeText={setKg}
            error={tried && netG === null ? t('edit.badKg') : null}
          />
          <Text style={{ fontFamily: th.font.family.sans, fontSize: th.font.size.bodyMd, fontWeight: th.font.weight.bold, color: th.color.ink }}>
            {t('edit.point')}
          </Text>
          <ChipRow>
            {props.points.map((p) => (
              <Chip key={p.id} testID={`edit-point-${p.id}`} label={p.name} on={p.id === pointId} onPress={() => setPointId(p.id)} />
            ))}
          </ChipRow>
          <View style={{ flexDirection: 'row', gap: th.space.sm, flexWrap: 'wrap' }}>
            <Button testID="edit-cancel" onPress={props.onCancel}>
              {t('common.cancel')}
            </Button>
            <Button testID="edit-save" variant="primary" onPress={save}>
              {t('edit.save')}
            </Button>
            <Button testID="edit-void" variant="destructive" onPress={() => setVoiding(true)}>
              {t('edit.void')}
            </Button>
          </View>
        </>
      )}
    </View>
  );
}
