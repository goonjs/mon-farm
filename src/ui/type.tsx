/**
 * Type scale (v1.1.0 mockups) for Thai-first screens: one place that turns a
 * named step into font, size, weight, leading and colour, so screens stop
 * hand-picking sizes. Sans only — the mono stack has no good Thai and made
 * labels read as code. Leading never drops below `snug`: Thai stacks vowel
 * and tone marks above and below the line.
 *
 * Num — figures (money, weights, counts): sans + tabular digits so columns
 * line up without a monospace face.
 */

import { Text, type TextProps, type TextStyle } from 'react-native';

import type { ColorName } from '../../design/tokens';
import { useTheme, type Theme } from '../theme';

export const TYPE_VARIANTS = ['display', 'title', 'heading', 'body', 'bodySm', 'label', 'caption'] as const;
export type TypeVariant = (typeof TYPE_VARIANTS)[number];

export function typeStyle(t: Theme, variant: TypeVariant): TextStyle {
  const f = t.font;
  const step = (size: number, weight: TextStyle['fontWeight'], color: string, leading: number): TextStyle => ({
    fontFamily: f.family.sans,
    fontSize: size,
    fontWeight: weight,
    lineHeight: Math.round(size * leading),
    color,
  });
  switch (variant) {
    case 'display':
      return step(f.size.displayLg, f.weight.bold, t.color.ink, f.lineHeight.snug);
    case 'title':
      return step(f.size.headingLg, f.weight.bold, t.color.ink, f.lineHeight.snug);
    case 'heading':
      return step(f.size.headingSm, f.weight.semibold, t.color.ink, f.lineHeight.snug);
    case 'body':
      return step(f.size.bodyLg, f.weight.regular, t.color.ink, f.lineHeight.body);
    case 'bodySm':
      return step(f.size.bodySm, f.weight.regular, t.color.inkSoft, f.lineHeight.body);
    case 'label':
      return step(f.size.bodySm, f.weight.semibold, t.color.inkSoft, f.lineHeight.body);
    case 'caption':
      return step(f.size.caption, f.weight.regular, t.color.inkSoft, f.lineHeight.body);
  }
}

export function AppText({ variant = 'body', style, ...rest }: TextProps & { variant?: TypeVariant }) {
  const t = useTheme();
  return <Text {...rest} style={[typeStyle(t, variant), style]} />;
}

const NUM_SIZE = { body: 'bodyLg', lead: 'lead', title: 'title', figure: 'figure' } as const;

export function Num({
  size = 'body',
  tone = 'ink',
  style,
  ...rest
}: TextProps & { size?: keyof typeof NUM_SIZE; tone?: ColorName }) {
  const t = useTheme();
  const fontSize = t.font.size[NUM_SIZE[size]];
  return (
    <Text
      {...rest}
      style={[
        {
          fontFamily: t.font.family.sans,
          fontSize,
          fontWeight: t.font.weight.bold,
          fontVariant: ['tabular-nums'],
          color: t.color[tone],
          letterSpacing: size === 'figure' ? fontSize * t.font.tracking.tight : 0,
        },
        style,
      ]}
    />
  );
}
