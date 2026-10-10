/**
 * One weighing point, read-only (mockup v1.1.0 farm-20): its farm, who taps
 * it over time with ตอนนี้ / ตามแผน, "วางแผนเปลี่ยนคนกรีดยาง" opening the
 * plan as a sheet (farm-21), "แก้แผน" / "ยกเลิกแผน" on a plan not started,
 * and "ลบจุดชั่ง (กู้คืนได้)" behind a sheet (D-58). "แก้ชื่อ" opens the form.
 */

import { type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { todayIso, type MasterState } from '../core/master';
import { useT } from '../i18n';
import { peopleStore as master } from '../store/people';
import { useTheme } from '../theme';
import { Button } from './chrome';
import { Card, FarmScreen, Sheet } from './farm-ui';
import { AssignmentTimeline, PlanChangeForm } from './TapperAssignments';

type SheetState = { kind: 'none' } | { kind: 'plan'; replacing: string | null } | { kind: 'delete' };

export function PointDetail({ pointId, onRename, onDone }: { pointId: string; onRename: () => void; onDone: () => void }) {
  const t = useTheme();
  const msg = useT();
  const [state, setState] = useState<MasterState | null>(null);
  const [now] = useState(() => Date.now());
  const [sheet, setSheet] = useState<SheetState>({ kind: 'none' });

  const reload = useCallback(() => {
    master.state().then(setState);
  }, []);
  useEffect(reload, [reload]);

  const point = state?.points.find((p) => p.id === pointId);
  if (!state || !point) return null;
  const farm = state.properties.find((f) => f.id === point.propertyId);
  const today = todayIso(now);

  const text = (size: number, bold = false, color = t.color.ink) => ({
    fontFamily: t.font.family.sans,
    fontSize: size,
    fontWeight: bold ? t.font.weight.bold : t.font.weight.regular,
    color,
  });

  const remove = async () => {
    await master.remove(point.id);
    onDone();
  };

  return (
    <FarmScreen
      title={point.name}
      subtitle={farm?.name}
      back={(farm ? `/property/${farm.id}` : '/properties') as Href}
      right={
        <Pressable
          testID="point-rename"
          accessibilityRole="button"
          onPress={onRename}
          style={{
            minHeight: t.target.min,
            borderRadius: t.radius.pill,
            borderWidth: t.border.thick,
            borderColor: t.color.action,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: t.space.md,
          }}
        >
          <Text style={text(t.font.size.body, true, t.color.action)}>{msg('pointDetail.rename')}</Text>
        </Pressable>
      }
      overlay={
        sheet.kind === 'plan' ? (
          <Sheet testID="plan-sheet" onClose={() => setSheet({ kind: 'none' })}>
            <Text style={text(t.font.size.headingLg, true)}>{msg('assign.planTitle', { point: point.name })}</Text>
            <PlanChangeForm
              state={state}
              pointId={point.id}
              replacing={sheet.replacing}
              onSaved={() => {
                setSheet({ kind: 'none' });
                reload();
              }}
            />
          </Sheet>
        ) : sheet.kind === 'delete' ? (
          <Sheet testID="delete-confirm" onClose={() => setSheet({ kind: 'none' })}>
            <Text style={text(t.font.size.headingLg, true)}>{msg('pointForm.deleteTitle', { name: point.name })}</Text>
            {msg('pointForm.deleteBody')
              .split(' · ')
              .map((line, i, all) => (
                <Text key={line} style={text(t.font.size.body, i === all.length - 1, i === all.length - 1 ? t.color.ink : t.color.inkSoft)}>
                  {line}
                </Text>
              ))}
            <View style={{ flexDirection: 'row', gap: t.space.sm }}>
              <View style={{ flex: 1 }}>
                <Button testID="delete-confirm-no" onPress={() => setSheet({ kind: 'none' })}>
                  {msg('common.cancel')}
                </Button>
              </View>
              <View style={{ flex: 1 }}>
                <Button testID="delete-confirm-yes" variant="destructive" onPress={() => void remove()}>
                  {msg('pointForm.deleteYes')}
                </Button>
              </View>
            </View>
          </Sheet>
        ) : null
      }
    >
      <Card testID="point-summary">
        <Text style={text(t.font.size.headingLg, true)}>{point.name}</Text>
        <Text style={text(t.font.size.body, false, t.color.inkSoft)}>{farm?.name ?? ''}</Text>
      </Card>

      <AssignmentTimeline
        state={state}
        pointId={point.id}
        today={today}
        onCancelPlan={(id) => void master.remove(id).then(reload)}
        onEditPlan={(id) => setSheet({ kind: 'plan', replacing: id })}
      />

      <Button testID="plan-change" onPress={() => setSheet({ kind: 'plan', replacing: null })}>
        {`⇄ ${msg('assign.plan')}`}
      </Button>

      <View style={{ backgroundColor: t.color.surfaceSunk, borderRadius: t.radius.md, padding: t.space.md }}>
        <Text style={text(t.font.size.body, false, t.color.inkSoft)}>{`?  ${msg('assign.planHelp')}`}</Text>
      </View>

      {!point.deleted ? (
        <View style={{ alignSelf: 'flex-start' }}>
          <Button testID="point-delete" variant="destructive" onPress={() => setSheet({ kind: 'delete' })}>
            {msg('pointForm.delete')}
          </Button>
        </View>
      ) : null}
    </FarmScreen>
  );
}
