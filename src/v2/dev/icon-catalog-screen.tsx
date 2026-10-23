/**
 * /v2/dev/icons — dev-only catalog of the FarmMate icon pilot batch (24 of
 * ~70 icons: nav, farm, sale — see src/ui/farmmate-icons/registry.tsx).
 * Not linked from any menu (not in v2/routes.ts `FARM_SECTIONS`); reached by
 * direct URL on-device or the PR's Cloud Run preview, so devs, designers and
 * the owner can see the real rendered icons before they land in product
 * screens. The usage proposal itself is a separate Artifact (branch PR
 * description), not this page — this page is "what exists", the Artifact is
 * "where it's suggested to go".
 */

import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { V2_HOME } from '../routes';
import { useTheme } from '../../theme';
import { AppText, Card, CardLabel, FarmMateIcon, FARMMATE_ICONS, FARMMATE_ICON_CATEGORY_LABEL_TH, type FarmMateIconCategory } from '../../ui';
import { ScreenHeader } from '../../ui/screen-header';
import { ScrollCue } from '../../ui/scroll-cue';

const CATEGORY_ORDER: FarmMateIconCategory[] = ['nav', 'farm', 'sale'];

export function IconCatalogScreen() {
  const t = useTheme();
  const router = useRouter();

  return (
    <View style={{ flex: 1, backgroundColor: t.color.surface }}>
      <ScreenHeader
        title="ไอคอน FarmMate (พรีวิว)"
        subtitle={`${FARMMATE_ICONS.length} ไอคอน — เครื่องมือสำหรับทีม ไม่อยู่ในเมนูจริง`}
        back={{ label: 'กลับ', onPress: () => (router.canGoBack() ? router.back() : router.replace(V2_HOME)), testID: 'dev-icons-back' }}
      />
      <ScrollCue contentContainerStyle={{ padding: t.layout.screenPaddingX, gap: t.space.lg, paddingBottom: t.space.xl }}>
        {CATEGORY_ORDER.map((category) => (
          <View key={category} style={{ gap: t.space.sm }}>
            <AppText variant="title">{FARMMATE_ICON_CATEGORY_LABEL_TH[category]}</AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space.sm }}>
              {FARMMATE_ICONS.filter((icon) => icon.category === category).map((icon) => (
                <Card key={icon.id} style={{ width: 150, alignItems: 'center', gap: t.space.xs }} testID={`dev-icon-${icon.id}`}>
                  <FarmMateIcon id={icon.id} size={40} />
                  <AppText variant="bodySm" style={{ textAlign: 'center' }}>
                    {icon.labelTh}
                  </AppText>
                  <CardLabel>{icon.id}</CardLabel>
                  <AppText variant="bodySm" style={{ textAlign: 'center', color: t.color.inkFaint }}>
                    {icon.note}
                  </AppText>
                </Card>
              ))}
            </View>
          </View>
        ))}
      </ScrollCue>
    </View>
  );
}
