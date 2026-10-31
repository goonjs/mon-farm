/**
 * E05-S11 · ให้คนรับซื้อดู (CO-20; mockup A7, A12, A18). A paper-like sheet
 * the owner turns to the buyer: one pile per line block — a symbol (฿ cash ·
 * ⇄ transfer · Σ total), the label on its own line, the amount right-aligned
 * on the full width of the line below, shrinking to fit (never cut, never
 * "…") up to millions. Piles follow the same draft as the cash step, so the
 * buyer sees exactly what that page shows. The farm account under the
 * transfer is what ShowAccountScreen shows (E05-S07).
 */

import { useRouter, type Href } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { PixelRatio, Platform, Text, View } from 'react-native';

import { projectAccounts } from '../../../core/finance/accounts';
import { formatSatang } from '../../../core/finance/money';
import { BANKS } from '../../../core/finance/promptpay';
import { formatThaiDate } from '../../../core/master';
import { useI18n, useT } from '../../../i18n';
import { useTheme } from '../../../theme';
import { AppText, Button, cardStyle } from '../../../ui';
import { FarmScreen } from '../../farm/pieces';
import { buyerPiles, transferRepayName } from './cash-pieces';
import { useCloseout } from './use-closeout';

const baht = formatSatang;
/** A bold tabular figure is about this wide per character, in em (commas and the point are narrower: a safe upper bound). */
const EM_PER_CHAR = 0.62;

/**
 * An amount on one line across the whole width, shrunk to fit, never wrapped
 * inside the figure on any platform (CO-20). One unbreakable run (web
 * `whiteSpace: nowrap`; native one line + `adjustsFontSizeToFit` as a
 * backstop), sized to its own content (`alignSelf: flex-end`) so its layout
 * width is what it really draws. First guess from the line width and the
 * system font scale; then, if what it drew is wider than the line (a bigger
 * system font, a wider face), the size drops by that ratio until it fits.
 * No `numberOfLines` on web, so nothing is ever cut with "…".
 */
export function FitAmount({ satang, testID, max }: { satang: number; testID?: string; max?: number }) {
  const t = useTheme();
  const [width, setWidth] = useState(0);
  const text = baht(satang);
  const base = max ?? t.font.size.displayXl + t.font.size.caption;
  const scale = Math.max(1, PixelRatio.getFontScale());
  const guess = width > 0 ? Math.min(base, Math.floor(width / (text.length * EM_PER_CHAR * scale))) : base;
  const key = text;
  // What this text last drew, at which size (the line and the text lay out in either order).
  const [drawn, setDrawn] = useState<{ key: string; width: number; size: number } | null>(null);
  const size = drawn?.key === key && width > 0 ? (drawn.width > width + 0.5 ? Math.max(8, Math.floor((drawn.size * width) / drawn.width)) : drawn.size) : guess;
  const native = Platform.OS !== 'web';
  const onDrawn = (w: number) => setDrawn({ key, width: w, size });
  return (
    <View testID={testID} onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ alignSelf: 'stretch' }}>
      <Text
        testID={testID ? `${testID}-text` : undefined}
        onLayout={(e) => onDrawn(e.nativeEvent.layout.width)}
        {...(native ? { numberOfLines: 1, adjustsFontSizeToFit: true, minimumFontScale: 0.3 } : {})}
        style={{
          alignSelf: 'flex-end',
          fontFamily: t.font.family.sans,
          fontSize: size,
          fontWeight: t.font.weight.black,
          fontVariant: ['tabular-nums'],
          color: t.color.numeral,
          textAlign: 'right',
          ...(native ? {} : ({ whiteSpace: 'nowrap' } as object)),
        }}
      >
        {text}
      </Text>
    </View>
  );
}

function Pile({ symbol, label, satang, testID, children, rule = 'dashed' }: { symbol: string; label: string; satang: number; testID: string; children?: ReactNode; rule?: 'dashed' | 'double' | 'none' }) {
  const t = useTheme();
  return (
    <View
      testID={testID}
      style={{
        gap: t.space.xxs,
        paddingTop: t.space.sm,
        ...(rule === 'none' ? {} : { borderTopWidth: rule === 'double' ? t.border.thick * 2 : t.border.thick, borderTopColor: t.color.ruleStrong, borderStyle: rule === 'double' ? ('solid' as const) : ('dashed' as const) }),
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm }}>
        <View style={{ width: t.space[8], height: t.space[8], borderRadius: t.radius.sm, backgroundColor: t.color.warnSunk, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.headingMd, fontWeight: t.font.weight.black, color: t.color.ink }}>{symbol}</Text>
        </View>
        <Text style={{ flexShrink: 1, fontFamily: t.font.family.sans, fontSize: t.font.size.headingMd, fontWeight: t.font.weight.bold, color: t.color.ink }}>{label}</Text>
      </View>
      <FitAmount satang={satang} testID={`${testID}-amt`} />
      {children}
    </View>
  );
}

export function BuyerViewScreen() {
  const t = useTheme();
  const msg = useT();
  const { era } = useI18n();
  const router = useRouter();
  const co = useCloseout();
  const saleId = co.saleId;
  const fallback = `/v2/sale/${saleId}/cash` as Href;
  const title = msg('cop.bvTitle');
  const subtitle = msg('cop.bvSubtitle');
  const back = () => (router.canGoBack() ? router.back() : router.replace(fallback));
  const footer = (
    <Button testID="bv-back" size="large" onPress={back}>
      {msg('cop.bvBack')}
    </Button>
  );
  if (!co.ready || !co.plan) return <FarmScreen title={title} subtitle={subtitle} fallback={fallback} footer={footer} />;

  const plan = co.plan;
  const repayName = transferRepayName(plan);
  const accounts = co.fin.events ? projectAccounts(co.fin.events) : null;
  const choice = accounts?.choiceFor(saleId);
  const account = choice?.kind === 'account' ? accounts?.accounts.find((a) => a.id === choice.accountId) : undefined;
  const grouped = (n: string) => (n.length === 10 ? `${n.slice(0, 3)}-${n.slice(3, 4)}-${n.slice(4, 9)}-${n.slice(9)}` : n.length === 12 ? `${n.slice(0, 4)}-${n.slice(4, 8)}-${n.slice(8)}` : n);
  const pp = account?.promptPay;
  const ppText = pp ? (pp.type === 'mobile' && pp.id.length === 10 ? `${pp.id.slice(0, 3)}-${pp.id.slice(3, 6)}-${pp.id.slice(6)}` : pp.id) : '';
  const small = { fontFamily: t.font.family.sans, fontSize: t.font.size.bodyMd, color: t.color.inkSoft, textAlign: 'right' as const };
  const big = { fontFamily: t.font.family.sans, fontSize: t.font.size.headingSm, fontWeight: t.font.weight.bold, color: t.color.ink, textAlign: 'right' as const };

  return (
    <FarmScreen title={title} subtitle={subtitle} fallback={fallback} testID="buyer-view" footer={footer}>
      <View style={{ ...cardStyle(t), padding: t.space.md, gap: t.space.sm }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'baseline', gap: t.space.sm }}>
          <AppText variant="title" style={{ fontWeight: t.font.weight.bold }}>{msg('cop.bvSheet')}</AppText>
          {co.money.state.startedTs != null ? <AppText variant="bodySm">{formatThaiDate(co.money.state.startedTs, era)}</AppText> : null}
        </View>
        {buyerPiles(plan).map((p) =>
          p.kind === 'cash' ? (
            <Pile key={`cash-${p.id}`} testID={`bv-cash-${p.id}`} symbol={msg('cop.symCash')} label={msg('cop.bvCash', { name: p.name })} satang={p.satang}>
              {p.pickedSatang ? <Text style={{ ...small, color: t.color.debtIn }}>{msg('cop.pickedOf', { dir: '↘', amount: baht(p.pickedSatang) })}</Text> : null}
            </Pile>
          ) : (
            <Pile key={`repay-${p.id}`} testID={`bv-repay-${p.id}`} symbol={msg('cop.symCash')} label={msg('cop.bvRepayCash', { name: p.name })} satang={p.satang}>
              <Text style={small}>{msg('cop.bvRepayNote', { dir: '↘' })}</Text>
            </Pile>
          ),
        )}
        <Pile testID="bv-transfer" symbol={'⇄'} label={msg('cop.transfer')} satang={plan.transferSatang}>
          {plan.transferRepaySatang ? (
            <Text style={small}>
              {msg('cop.ownerSplitShare', { owner: baht(plan.ownerSatang) })}{' '}
              <Text style={{ color: t.color.debtIn }}>{msg('cop.ownerSplitRepay', { dir: '↘', name: repayName, repay: baht(plan.transferRepaySatang) })}</Text>
            </Text>
          ) : null}
          {account ? (
            <View testID="bv-account" style={{ gap: t.space.xxs, paddingTop: t.space.xs }}>
              {pp ? (
                <>
                  <Text style={small}>{msg(pp.type === 'mobile' ? 'v2s.ppMobile' : 'v2s.ppId')}</Text>
                  <Text style={big}>{ppText}</Text>
                </>
              ) : (
                <>
                  <Text style={small}>{BANKS.find((b) => b.code === account.bankCode)?.name ?? account.label}</Text>
                  <Text style={big}>{grouped(account.accountNo)}</Text>
                </>
              )}
              <Text style={small}>
                {msg('v2s.accountName')} {account.accountName}
              </Text>
            </View>
          ) : null}
        </Pile>
        <Pile testID="bv-total" rule="double" symbol={'Σ'} label={msg('cop.bvTotal')} satang={plan.tally.sumSatang} />
      </View>
    </FarmScreen>
  );
}
