import { Redirect, useLocalSearchParams } from 'expo-router';

import { useT } from '../../i18n';
import { FARM_SECTIONS, findSection, SALE_STEPS, sectionHref, V2_HOME } from '../../v2/routes';
import { Placeholder } from '../../v2/placeholder-screen';
import { MenuItem, MenuSection } from '../../ui';

/** Sections that already have their own route file (not placeholders). */
const BUILT = new Set(['device']);

/** Pre-render one page per placeholder section for the static web export. */
export function generateStaticParams() {
  return FARM_SECTIONS.filter((s) => !BUILT.has(s.slug)).map((s) => ({ section: s.slug }));
}

/** /v2/<section>: a placeholder until the section's real screen exists. */
export default function V2Section() {
  const { section } = useLocalSearchParams<{ section: string }>();
  const msg = useT();
  const s = findSection(FARM_SECTIONS, section);
  if (!s) return <Redirect href={V2_HOME} />;
  return (
    <Placeholder titleId={s.titleId}>
      {s.slug === 'sales' ? (
        // The sale flow's steps hang off the sale list until it is rebuilt.
        <MenuSection title={msg('v2.saleStart')}>
          {SALE_STEPS.map((step) => (
            <MenuItem key={step.slug} testID={`nav-sale-${step.slug}`} label={msg(step.titleId)} href={sectionHref(step)} />
          ))}
        </MenuSection>
      ) : null}
    </Placeholder>
  );
}
