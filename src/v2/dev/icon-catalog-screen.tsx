/**
 * /v2/dev/icons — dev-only catalogue of every traced FarmMate original
 * ("ตัวสวย", design/icons/farmmate/*.svg, 72 icons in nine groups), drawn the
 * way the app draws them (`FarmMateArt`, E03-S11). Not linked from any menu
 * (not in v2/routes.ts `FARM_SECTIONS`); reached from the view-only row at the
 * end of เครื่องนี้ or by direct URL, so the team and the owner can see the
 * real rendered icons and their ids.
 */

import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { V2_HOME } from '../routes';
import { useTheme } from '../../theme';
import { FARMMATE_MASTER_LABEL_TH, type FarmMateArtId } from '../../../design/icons/farmmate-masters';
import { AppText, Card, CardLabel, FarmMateArt, FARMMATE_ART_CATEGORIES } from '../../ui';
import { ScreenHeader } from '../../ui/screen-header';
import { ScrollCue } from '../../ui/scroll-cue';

const IDS = (Object.keys(FARMMATE_MASTER_LABEL_TH) as FarmMateArtId[]).sort();

export function IconCatalogScreen() {
  const t = useTheme();
  const router = useRouter();

  return (
    <View style={{ flex: 1, backgroundColor: t.color.surface }}>
      <ScreenHeader
        title="ไอคอน FarmMate (พรีวิว)"
        subtitle={`${IDS.length} ไอคอน — เครื่องมือสำหรับทีม ไม่อยู่ในเมนูจริง`}
        back={{ label: 'กลับ', onPress: () => (router.canGoBack() ? router.back() : router.replace(V2_HOME)), testID: 'dev-icons-back' }}
      />
      <ScrollCue contentContainerStyle={{ padding: t.layout.screenPaddingX, gap: t.space.lg, paddingBottom: t.space.xl }}>
        {FARMMATE_ART_CATEGORIES.map((category) => (
          <View key={category.key} testID={`dev-icons-group-${category.key}`} style={{ gap: t.space.sm }}>
            <AppText variant="title">{category.labelTh}</AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space.sm }}>
              {IDS.filter((id) => id.startsWith(`${category.key}.`)).map((id) => (
                <Card key={id} style={{ width: 150, alignItems: 'center', gap: t.space.xs }} testID={`dev-icon-${id}`}>
                  <FarmMateArt id={id} size={48} />
                  <AppText variant="bodySm" style={{ textAlign: 'center' }}>
                    {FARMMATE_MASTER_LABEL_TH[id]}
                  </AppText>
                  {/* The id may wrap after its dot: one unbroken "materials.materialCost" stuck out of the card at L on CI's font. */}
                  <CardLabel>{id.replace('.', '.\u200B')}</CardLabel>
                </Card>
              ))}
            </View>
          </View>
        ))}
      </ScrollCue>
    </View>
  );
}
