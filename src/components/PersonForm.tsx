/**
 * Add or edit one person (E03-S01, mockup v1.1.0 screen 5): a name, one or
 * more roles — built-in or typed in by hand — and, for an existing person,
 * "ลบ (กู้คืนได้)" behind a confirmation (D-65 Q3, D-68).
 *
 * Errors show only after a save attempt, and what was typed is kept.
 */

import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { BUILTIN_ROLES, pointsOf, todayIso, validatePerson, type PointRecord } from '../core/master';
import type { BuiltinRole } from '../core/types';
import { useT } from '../i18n';
import { peopleStore, type Person } from '../store/people';
import { useTheme } from '../theme';
import { Button } from './chrome';
import { Card, Chip, ChipRow, FieldError, TextField } from './farm-ui';
import { TapperShare } from './TapperShare';
import { ThaiDate } from './ThaiDate';

export function PersonForm({ personId, onDone }: { personId: string | null; onDone: () => void }) {
  const t = useTheme();
  const msg = useT();
  const [existing, setExisting] = useState<Person | null>(null);
  const [name, setName] = useState('');
  const [roles, setRoles] = useState<BuiltinRole[]>([]);
  const [otherRoles, setOtherRoles] = useState<string[]>([]);
  const [otherDraft, setOtherDraft] = useState('');
  const [tried, setTried] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [points, setPoints] = useState<PointRecord[]>([]);
  const [roleWarning, setRoleWarning] = useState(false);

  useEffect(() => {
    if (!personId) return;
    peopleStore.state().then((s) => setPoints(pointsOf(s, personId, todayIso(Date.now()))));
    peopleStore.get(personId).then((p) => {
      if (!p) return;
      setExisting(p);
      setName(p.name);
      setRoles([...p.roles]);
      setOtherRoles([...p.otherRoles]);
    });
  }, [personId]);

  const errors = validatePerson({ name, roles, otherRoles });
  const toggle = (r: BuiltinRole) => setRoles((cur) => (cur.includes(r) ? cur.filter((x) => x !== r) : [...cur, r]));
  const addOther = () => {
    const v = otherDraft.trim();
    if (v && !otherRoles.includes(v)) setOtherRoles([...otherRoles, v]);
    setOtherDraft('');
  };

  const pointList = points.map((p) => p.name).join(', ');
  const tapperWarning = existing ? msg('person.pointsWarn', { name: existing.name, n: points.length, points: pointList }) : '';

  const save = async (confirmed = false) => {
    setTried(true);
    if (errors.length) return;
    // Taking away the tapper role while they still tap points: warn, never block (D-65 Q5).
    if (!confirmed && existing && points.length > 0 && existing.roles.includes('tapper') && !roles.includes('tapper')) {
      setRoleWarning(true);
      return;
    }
    if (existing) await peopleStore.edit(existing.id, { name, roles, otherRoles });
    else await peopleStore.create(name, roles, otherRoles);
    onDone();
  };

  const remove = async () => {
    if (!existing) return;
    await peopleStore.remove(existing.id);
    onDone();
  };

  return (
    <View style={{ gap: t.space.md }}>
      <Card>
        <TextField
          testID="person-name"
          label={msg('personForm.name')}
          value={name}
          onChangeText={setName}
          error={tried && errors.includes('name') ? msg('personForm.needName') : null}
        />
        <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.bodyMd, fontWeight: t.font.weight.bold, color: t.color.ink }}>
          {msg('personForm.roles')}
        </Text>
        <ChipRow>
          {BUILTIN_ROLES.map((r) => (
            <Chip key={r} testID={`role-${r}`} label={msg(`role.${r}`)} on={roles.includes(r)} onPress={() => toggle(r)} />
          ))}
          {otherRoles.map((r) => (
            <Chip key={r} testID={`other-role-${r}`} label={r} on onPress={() => setOtherRoles(otherRoles.filter((x) => x !== r))} />
          ))}
        </ChipRow>
        <View style={{ flexDirection: 'row', gap: t.space.sm, alignItems: 'flex-end' }}>
          <TextField
            testID="person-other-role"
            label={msg('personForm.otherRoles')}
            placeholder={msg('personForm.otherRolePlaceholder')}
            value={otherDraft}
            onChangeText={setOtherDraft}
          />
          <Button testID="person-add-other-role" onPress={addOther} disabled={!otherDraft.trim()}>
            {msg('personForm.addOtherRole')}
          </Button>
        </View>
        {tried && errors.includes('roles') ? <FieldError text={msg('personForm.needRole')} /> : null}
        {existing ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.xs }}>
            <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.small, color: t.color.inkSoft }}>
              {msg('personForm.added')}
            </Text>
            <ThaiDate testID="person-added-date" ts={existing.createdTs} />
          </View>
        ) : null}
      </Card>

      {existing && points.length > 0 ? (
        <Card testID="person-points">
          <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.bodyMd, fontWeight: t.font.weight.bold, color: t.color.ink }}>
            {msg('person.points')}
          </Text>
          <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.body, color: t.color.ink }}>{pointList}</Text>
        </Card>
      ) : null}

      {/* E03-S06: a tapper's share sits on their page (AC9). */}
      {existing && existing.roles.includes('tapper') ? <TapperShare tapperId={existing.id} /> : null}

      {roleWarning ? (
        <Card testID="role-warning">
          <FieldError text={tapperWarning} />
          <Button testID="role-warning-yes" variant="primary" onPress={() => void save(true)}>
            {msg('person.roleWarnYes')}
          </Button>
        </Card>
      ) : null}

      <Button testID="person-save" variant="primary" onPress={() => void save()}>
        {msg('common.save')}
      </Button>

      {existing && !existing.deleted ? (
        confirming ? (
          <Card testID="delete-confirm">
            <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.headingMd, fontWeight: t.font.weight.bold, color: t.color.ink }}>
              {msg('personForm.deleteTitle', { name: existing.name })}
            </Text>
            {points.length > 0 ? <FieldError text={tapperWarning} /> : null}
            <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.body, color: t.color.ink }}>
              {msg('personForm.deleteBody')}
            </Text>
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
          </Card>
        ) : (
          <View style={{ alignSelf: 'flex-start' }}>
            <Button testID="person-delete" variant="destructive" onPress={() => setConfirming(true)}>
              {msg('personForm.delete')}
            </Button>
          </View>
        )
      ) : null}
    </View>
  );
}
