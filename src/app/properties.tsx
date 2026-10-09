/**
 * Farms (สวน) — farm master data (E03-S02, mockup v1.1.0 screen 9): crop and
 * today's area per farm, "ไม่ทราบ" when none was given (D-65 Q7). Deleted
 * farms sit behind the small deleted link, like people (D-74 F13).
 */

import { Link, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Text } from 'react-native';

import { Button } from '../components/chrome';
import { Card, FarmScreen, LinkButton, ListRow, StateBadge } from '../components/farm-ui';
import { areaOn, formatRai, todayIso, type MasterState } from '../core/master';
import { useT } from '../i18n';
import { peopleStore as master } from '../store/people';
import { useTheme } from '../theme';

export default function PropertiesScreen() {
  const t = useTheme();
  const msg = useT();
  const [state, setState] = useState<MasterState | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);

  const reload = useCallback(() => {
    master.state().then(setState);
  }, []);
  useEffect(reload, [reload]);
  useFocusEffect(reload);

  const restore = async (id: string) => {
    await master.restore(id);
    reload();
  };

  const [today] = useState(() => todayIso(Date.now()));
  const active = state?.properties.filter((p) => !p.deleted) ?? [];
  const deleted = state?.properties.filter((p) => p.deleted) ?? [];

  return (
    <FarmScreen
      title={msg('properties.title')}
      subtitle={msg('farmData.title')}
      back={'/farm-data' as Href}
      footer={
        <Link href={'/property/new' as Href} asChild>
          <Button testID="add-property" variant="primary">{msg('properties.add')}</Button>
        </Link>
      }
    >
      {showDeleted ? (
        <>
          <LinkButton testID="hide-deleted" label={msg('peopleList.hideDeleted')} onPress={() => setShowDeleted(false)} />
          <Card>
            {deleted.map((p) => (
              <ListRow
                key={p.id}
                testID={`deleted-${p.id}`}
                title={p.name}
                badge={
                  <>
                    <StateBadge text={msg('peopleList.deletedBadge')} />
                    <LinkButton testID={`restore-${p.id}`} label={msg('peopleList.restore')} onPress={() => void restore(p.id)} />
                  </>
                }
              />
            ))}
          </Card>
        </>
      ) : (
        <>
          <Card>
            {state && active.length === 0 ? (
              <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.small, color: t.color.inkSoft }}>
                {msg('properties.empty')}
              </Text>
            ) : null}
            {active.map((p) => {
              const area = areaOn(p, today);
              return (
                <Link key={p.id} href={`/property/${p.id}` as Href} asChild>
                  <ListRow
                    testID={`property-${p.id}`}
                    title={p.name}
                    lines={[
                      msg(`crop.${p.crop}`),
                      area === null ? msg('properties.areaUnknown') : msg('properties.area', { rai: formatRai(area) }),
                    ]}
                  />
                </Link>
              );
            })}
          </Card>
          {deleted.length > 0 ? (
            <LinkButton testID="show-deleted" label={msg('peopleList.deletedLink', { n: deleted.length })} onPress={() => setShowDeleted(true)} />
          ) : null}
        </>
      )}
    </FarmScreen>
  );
}
