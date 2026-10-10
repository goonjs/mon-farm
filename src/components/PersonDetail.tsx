/**
 * One person, read-only (mockup v1.1.0 farm-05): who they are, the points
 * they tap today with each point's farm and dates, and — for a tapper — their
 * share, one tap from its own screen. "แก้" opens the form; "ลบ (กู้คืนได้)"
 * opens a sheet that names the points left without a tapper (farm-06,
 * E03-S01 AC4/AC7): a warning, never a block.
 *
 * The debt summary card in the mockup belongs to the worker-debt ledger
 * (team MONEY) and is added with it.
 */

import { Link, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { shareOn, tapperPointsNow, todayIso, type MasterState, type TapperPoint } from '../core/master';
import { useT } from '../i18n';
import { peopleStore } from '../store/people';
import { useTheme } from '../theme';
import { Button } from './chrome';
import { Card, FarmScreen, ListRow, Sheet } from './farm-ui';
import { ThaiDate } from './ThaiDate';

const dayTs = (day: string) => Date.parse(`${day}T12:00:00+07:00`);

export function PersonDetail({ personId, onEdit, onDone }: { personId: string; onEdit: () => void; onDone: () => void }) {
  const t = useTheme();
  const msg = useT();
  const [state, setState] = useState<MasterState | null>(null);
  const [now] = useState(() => Date.now());
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    peopleStore.state().then(setState);
  }, [personId]);

  const person = state?.people.find((p) => p.id === personId);
  if (!state || !person) return null;
  const today = todayIso(now);
  const points = tapperPointsNow(state, person.id, today);
  const isTapper = person.roles.includes('tapper');
  const share = shareOn(state, person.id, today);
  const roleNames = [...person.roles.map((r) => msg(`role.${r}`)), ...person.otherRoles].join(' · ');

  const remove = async () => {
    await peopleStore.remove(person.id);
    onDone();
  };

  const text = (size: number, bold = false, color = t.color.ink) => ({
    fontFamily: t.font.family.sans,
    fontSize: size,
    fontWeight: bold ? t.font.weight.bold : t.font.weight.regular,
    color,
  });

  return (
    <FarmScreen
      title={person.name}
      subtitle={msg('peopleList.title')}
      back={'/people' as Href}
      right={
        <Pressable
          testID="person-edit"
          accessibilityRole="button"
          onPress={onEdit}
          style={{
            minWidth: t.target.min,
            minHeight: t.target.min,
            borderRadius: t.radius.pill,
            borderWidth: t.border.thick,
            borderColor: t.color.action,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: t.space.sm,
          }}
        >
          <Text style={text(t.font.size.body, true, t.color.action)}>{msg('personDetail.edit')}</Text>
        </Pressable>
      }
      overlay={
        confirming ? (
          <Sheet testID="delete-confirm" onClose={() => setConfirming(false)}>
            <Text style={text(t.font.size.headingLg, true)}>{msg('personForm.deleteTitle', { name: person.name })}</Text>
            {points.length > 0 ? (
              <View
                testID="delete-warning"
                style={{ backgroundColor: t.color.rejectSunk, borderRadius: t.radius.md, padding: t.space.md, gap: t.space.xxs }}
              >
                <Text style={text(t.font.size.body, true, t.color.reject)}>
                  {`⚠ ${msg('personDetail.warnTitle', { name: person.name, n: points.length })}`}
                </Text>
                <Text style={text(t.font.size.body, false, t.color.reject)}>{points.map((p) => p.name).join(' · ')}</Text>
                <Text style={text(t.font.size.body, false, t.color.reject)}>{msg('personDetail.warnAfter')}</Text>
              </View>
            ) : null}
            {msg('personForm.deleteBody')
              .split(' · ')
              .map((line, i, all) => (
                <Text key={line} style={text(t.font.size.body, i === all.length - 1, i === all.length - 1 ? t.color.ink : t.color.inkSoft)}>
                  {line}
                </Text>
              ))}
            <View style={{ flexDirection: 'row', gap: t.space.sm }}>
              <View style={{ flex: 1 }}>
                <Button testID="delete-confirm-no" onPress={() => setConfirming(false)}>
                  {msg('common.cancel')}
                </Button>
              </View>
              <View style={{ flex: 1 }}>
                <Button testID="delete-confirm-yes" variant="destructive" onPress={() => void remove()}>
                  {msg('personForm.deleteYes')}
                </Button>
              </View>
            </View>
          </Sheet>
        ) : null
      }
    >
      <Card testID="person-profile">
        <Text style={text(t.font.size.headingLg, true)}>{person.name}</Text>
        <Text style={text(t.font.size.body, false, t.color.inkSoft)}>{roleNames}</Text>
      </Card>

      {points.length > 0 ? (
        <Card testID="person-points">
          <Text style={text(t.font.size.bodyMd, true)}>{msg('person.points')}</Text>
          {points.map((p) => (
            <PointLine key={p.pointId} point={p} />
          ))}
        </Card>
      ) : null}

      {isTapper ? (
        <Card>
          <Link href={`/share/${person.id}` as Href} asChild>
            <ListRow
              testID="share-summary"
              title={msg('share.title')}
              lines={[
                msg('share.tapper', { n: share.tapperPct }),
                msg('share.owner', { n: share.ownerPct }),
                ...(share.isDefault ? [`✓ ${msg('personDetail.shareDefault')}`] : []),
              ]}
            />
          </Link>
        </Card>
      ) : null}

      {!person.deleted ? (
        <View style={{ alignSelf: 'flex-start' }}>
          <Button testID="person-delete" variant="destructive" onPress={() => setConfirming(true)}>
            {msg('personForm.delete')}
          </Button>
        </View>
      ) : null}
    </FarmScreen>
  );
}

function PointLine({ point }: { point: TapperPoint }) {
  const t = useTheme();
  const msg = useT();
  const small = { fontFamily: t.font.family.sans, fontSize: t.font.size.small, color: t.color.inkSoft };
  return (
    <Link href={`/point/${point.pointId}` as Href} asChild>
      <Pressable
        testID={`person-point-${point.pointId}`}
        accessibilityRole="button"
        style={{ minHeight: t.target.min, paddingVertical: t.space.xs, borderTopWidth: t.border.hair, borderTopColor: t.color.ruleFaint, gap: 2 }}
      >
        <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.body, fontWeight: t.font.weight.bold, color: t.color.ink }}>
          {point.name}
        </Text>
        <Text style={small}>{point.farmName}</Text>
        {point.to ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.xs }}>
            <Text style={small}>{msg('assign.to')}</Text>
            <ThaiDate ts={dayTs(point.to)} />
          </View>
        ) : point.from ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.xs }}>
            <Text style={small}>{msg('personDetail.since')}</Text>
            <ThaiDate ts={dayTs(point.from)} />
          </View>
        ) : (
          <Text style={small}>{msg('assign.noStart')}</Text>
        )}
        {point.planned ? (
          <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.small, fontWeight: t.font.weight.bold, color: t.color.warn }}>
            {`⇄ ${msg('personDetail.planChange')}`}
          </Text>
        ) : null}
      </Pressable>
    </Link>
  );
}
