import { render } from '@testing-library/react-native';

import {
  BankIcon,
  BasketIcon,
  BoxIcon,
  ChartIcon,
  ClockIcon,
  CoinIcon,
  DeviceIcon,
  ExternalIcon,
  ListIcon,
  SpeakerIcon,
  UsersIcon,
  WalletIcon,
  WeatherIcon,
  CalendarIcon,
  Check,
  ChevronLeft,
  ChevronRight,
  DebtIcon,
  FarmIcon,
  GearIcon,
  MenuIcon,
  Minus,
  MoneyInIcon,
  MoneyOutIcon,
  PercentIcon,
  PersonIcon,
  PinIcon,
  Plus,
  ReceiptIcon,
  Scale,
  ScaleIcon,
  SwapIcon,
  TagIcon,
  TrashIcon,
  Undo,
} from './icons';

/** Every stroke/fill View an icon draws, as flat styles. */
function strokes(el: React.ReactElement) {
  const { toJSON } = render(el);
  const out: Record<string, unknown>[] = [];
  const walk = (n: unknown) => {
    if (!n || typeof n !== 'object') return;
    const node = n as { props?: { style?: unknown }; children?: unknown[] };
    if (node.props?.style) out.push(Object.assign({}, ...[node.props.style].flat(Infinity).filter(Boolean)));
    node.children?.forEach(walk);
  };
  walk(toJSON());
  return out;
}

describe('line icons — Views only, coloured by the caller (E01-S17 X8)', () => {
  it.each([
    ['ChevronLeft', <ChevronLeft key="a" color="sentinel" />],
    ['ChevronRight', <ChevronRight key="b" color="sentinel" />],
    ['MenuIcon', <MenuIcon key="c" color="sentinel" />],
    ['Plus', <Plus key="d" color="sentinel" />],
    ['Minus', <Minus key="e" color="sentinel" />],
    ['Check', <Check key="f" color="sentinel" />],
    ['Undo', <Undo key="g" color="sentinel" />],
    ['Scale', <Scale key="h" color="sentinel" />],
    // Money-team set (E01-S17 X4).
    ['MoneyInIcon', <MoneyInIcon key="i" color="sentinel" />],
    ['MoneyOutIcon', <MoneyOutIcon key="j" color="sentinel" />],
    ['PersonIcon', <PersonIcon key="k" color="sentinel" />],
    ['CalendarIcon', <CalendarIcon key="l" color="sentinel" />],
    ['ReceiptIcon', <ReceiptIcon key="m" color="sentinel" />],
    ['DebtIcon', <DebtIcon key="n" color="sentinel" />],
    ['BankIcon', <BankIcon key="o" color="sentinel" />],
    ['FarmIcon', <FarmIcon key="p" color="sentinel" size={24} />],
    ['ScaleIcon', <ScaleIcon key="q" color="sentinel" size={20} />],
    // Farm-team set (D-83).
    ['PinIcon', <PinIcon key="r" color="sentinel" />],
    ['TagIcon', <TagIcon key="s" color="sentinel" />],
    ['TrashIcon', <TrashIcon key="t" color="sentinel" />],
    ['GearIcon', <GearIcon key="u" color="sentinel" />],
    ['PercentIcon', <PercentIcon key="v" color="sentinel" />],
    ['SwapIcon', <SwapIcon key="w" color="sentinel" />],
    // Home set (e03-v2-splash-home).
    ['CoinIcon', <CoinIcon key="hc" color="sentinel" />],
    ['ExternalIcon', <ExternalIcon key="he" color="sentinel" />],
    ['BasketIcon', <BasketIcon key="h1" color="sentinel" />],
    ['BoxIcon', <BoxIcon key="h2" color="sentinel" />],
    ['ChartIcon', <ChartIcon key="h3" color="sentinel" />],
    ['ClockIcon', <ClockIcon key="h4" color="sentinel" />],
    ['DeviceIcon', <DeviceIcon key="h5" color="sentinel" />],
    ['ListIcon', <ListIcon key="h6" color="sentinel" />],
    ['SpeakerIcon', <SpeakerIcon key="h7" color="sentinel" />],
    ['UsersIcon', <UsersIcon key="h8" color="sentinel" />],
    ['WalletIcon', <WalletIcon key="h9" color="sentinel" />],
    ['WeatherIcon', <WeatherIcon key="h10" color="sentinel" />],
  ])('%s paints only in the colour it is given', (_name, icon) => {
    const s = strokes(icon);
    const colours = s.flatMap((x) =>
      ['backgroundColor', 'borderColor', 'borderTopColor', 'borderLeftColor', 'borderRightColor', 'borderBottomColor']
        .map((k) => x[k])
        .filter((v) => v !== undefined && v !== 'transparent'),
    );
    expect(colours.length).toBeGreaterThan(0);
    expect(new Set(colours)).toEqual(new Set(['sentinel']));
  });
});

describe('money-team icons take size', () => {
  it.each([MoneyInIcon, MoneyOutIcon, PersonIcon, CalendarIcon, ReceiptIcon, DebtIcon, BankIcon, FarmIcon, ScaleIcon, PinIcon, TagIcon, TrashIcon, GearIcon, PercentIcon, SwapIcon, CoinIcon, ExternalIcon, BasketIcon, BoxIcon, ChartIcon, ClockIcon, DeviceIcon, ListIcon, SpeakerIcon, UsersIcon, WalletIcon, WeatherIcon])(
    '%p outer box follows size',
    (Icon) => {
      const s = strokes(<Icon color="x" size={24} />);
      expect(s[0]).toMatchObject({ width: 24, height: 24 });
    },
  );
});
