import { ScrollView, View } from 'react-native';

import { DataStateBadge } from '../../components/DataStateBadge';
import { FIELD_DATA_STATES } from '../../core/field-state';
import { useTheme } from '../../theme';

/**
 * Unlinked preview of the six data-state badges (E01-S15) for the owner's
 * review and the e2e screenshot. Real screens place the badge themselves.
 */
export default function DataStatesPreview() {
  const t = useTheme();
  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.color.surface }} contentContainerStyle={{ padding: t.space.md }}>
      <View style={{ gap: t.space.sm }}>
        {FIELD_DATA_STATES.map((s) => (
          <DataStateBadge key={s} state={s} />
        ))}
      </View>
    </ScrollView>
  );
}
