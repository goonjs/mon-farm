import { Redirect, useLocalSearchParams } from 'expo-router';

import { findSection, SALE_STEPS, V2_HOME } from '../../../v2/routes';
import { Placeholder } from '../../../v2/placeholder-screen';

/** Pre-render one page per sale step for the static web export. */
export function generateStaticParams() {
  return SALE_STEPS.map((s) => ({ step: s.slug }));
}

/** /v2/sale/<step>: a placeholder until the step's real screen exists. */
export default function V2SaleStep() {
  const { step } = useLocalSearchParams<{ step: string }>();
  const s = findSection(SALE_STEPS, step);
  if (!s) return <Redirect href={V2_HOME} />;
  return <Placeholder titleId={s.titleId} />;
}
