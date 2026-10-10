import { Redirect, useLocalSearchParams } from 'expo-router';

import { BUILT_SECTIONS, FARM_SECTIONS, findSection, V2_HOME } from '../../v2/routes';
import { Placeholder } from '../../v2/placeholder-screen';

/** Pre-render one page per placeholder section for the static web export. */
export function generateStaticParams() {
  return FARM_SECTIONS.filter((s) => !BUILT_SECTIONS.has(s.slug)).map((s) => ({ section: s.slug }));
}

/** /v2/<section>: a placeholder until the section's real screen exists. */
export default function V2Section() {
  const { section } = useLocalSearchParams<{ section: string }>();
  const s = findSection(FARM_SECTIONS, section);
  if (!s) return <Redirect href={V2_HOME} />;
  return <Placeholder titleId={s.titleId} />;
}
