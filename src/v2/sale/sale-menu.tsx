/**
 * The ⋮ menu of the sale pages (E04-S18): grouped rows, each with a tinted
 * icon and its word — never colour alone. The screen passes the groups only
 * it has (finish and record, on the counter) as `lead`; the rest is shared:
 * price and info, go to (home, debts, all sales), and delete last, set apart.
 */

import { useRouter, type Href } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

import { formatSatang as formatPrice } from "../../core/finance/money";
import { useT } from "../../i18n";
import { useTheme } from "../../theme";
import {
  DebtIcon,
  HomeIcon,
  IconTile,
  InfoIcon,
  ListIcon,
  CoinIcon,
  TrashIcon,
  type TileTone,
} from "../../ui";
import type { OptionSheet } from "./sale-options";
import { type useSaleView } from "./pieces";

type View_ = ReturnType<typeof useSaleView>;

export function MenuGroup({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  const t = useTheme();
  return (
    <View style={{ gap: t.space.xxs }}>
      {title ? (
        <Text
          accessibilityRole="header"
          style={{
            fontFamily: t.font.family.sans,
            fontSize: t.font.size.caption,
            fontWeight: t.font.weight.bold,
            color: t.color.inkSoft,
            paddingHorizontal: t.space.xs,
            paddingTop: t.space.xs,
          }}
        >
          {title}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

export function MenuRow({
  testID,
  tone,
  icon,
  main,
  onPress,
  children,
}: {
  testID: string;
  tone: TileTone;
  icon: (c: string) => ReactNode;
  main?: boolean;
  onPress: () => void;
  children: ReactNode;
}) {
  const t = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      style={{
        minHeight: main ? t.target.min + t.space.sm : t.target.min,
        flexDirection: "row",
        alignItems: "center",
        gap: t.space.sm,
        paddingHorizontal: t.space.xs,
        borderRadius: t.radius.md,
        backgroundColor: main ? t.color.acceptSunk : undefined,
      }}
    >
      <IconTile tone={tone} size="sm" icon={icon} />
      <Text
        style={{
          flex: 1,
          fontFamily: t.font.family.sans,
          fontSize: t.font.size.bodyLg,
          fontWeight: main ? t.font.weight.bold : t.font.weight.semibold,
          color: main
            ? t.color.accept
            : tone === "reject"
              ? t.color.reject
              : t.color.ink,
        }}
      >
        {children}
      </Text>
    </Pressable>
  );
}

export function SaleMenu({
  view,
  pick,
  close,
  lead,
}: {
  view: View_;
  pick: (s: OptionSheet) => void;
  close: () => void;
  lead?: ReactNode;
}) {
  const msg = useT();
  const router = useRouter();
  const t = useTheme();
  const price = view.state.price?.satangPerKg ?? null;
  const go = (href: string) => () => {
    close();
    router.push(href as Href);
  };
  return (
    <View style={{ gap: t.space.xs }}>
      {lead}
      <MenuGroup title={msg("menu.grpPrice")}>
        <MenuRow
          testID="menu-price"
          tone="warn"
          icon={(c) => <CoinIcon color={c} size={16} />}
          onPress={() => pick("price")}
        >
          {price === null
            ? msg("opt.priceNone")
            : msg("opt.priceHave", { price: formatPrice(price) })}
        </MenuRow>
        <MenuRow
          testID="menu-info"
          tone="warn"
          icon={(c) => <InfoIcon color={c} size={16} />}
          onPress={() => pick("info")}
        >
          {msg("opt.info")}
        </MenuRow>
      </MenuGroup>
      <MenuGroup title={msg("menu.grpGo")}>
        <MenuRow
          testID="menu-home"
          tone="neutral"
          icon={(c) => <HomeIcon color={c} size={16} />}
          onPress={go("/v2")}
        >
          {msg("v2.home")}
        </MenuRow>
        <MenuRow
          testID="menu-debts"
          tone="neutral"
          icon={(c) => <DebtIcon color={c} size={16} />}
          onPress={go("/v2/debts")}
        >
          {msg("v2.debts")}
        </MenuRow>
        <MenuRow
          testID="menu-sales"
          tone="neutral"
          icon={(c) => <ListIcon color={c} size={16} />}
          onPress={go("/v2/sales")}
        >
          {msg("v2.sales")}
        </MenuRow>
      </MenuGroup>
      <View
        style={{
          height: 1,
          backgroundColor: t.color.rule,
          marginVertical: t.space.xxs,
        }}
      />
      <MenuRow
        testID="menu-delete"
        tone="reject"
        icon={(c) => <TrashIcon color={c} size={16} />}
        onPress={() => pick("delete")}
      >
        {msg("opt.delete")}
      </MenuRow>
    </View>
  );
}
