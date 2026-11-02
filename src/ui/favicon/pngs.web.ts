/**
 * The tab-icon PNGs (E03-S10), web only: pre-rendered from the traced FarmMate
 * originals by `npm run favicons` (scripts/render-favicons.mjs, which reads the
 * ids from the `-64.png` lines below) into assets/favicons, and shipped with
 * the build (FV-2: nothing is drawn or fetched from elsewhere at run time).
 *   tab  64 px, on a light rounded tile so it shows on a dark tab strip
 *   home 180 px, square light tile (apple-touch-icon; iOS rounds it itself)
 *   grid 128 px, the icon alone, for the picker
 * Android / iOS get `pngs.ts` (empty): the card is hidden there, so the
 * native build does not carry these files.
 */

import type { FaviconPngs } from './pngs';

// Metro bundles an asset only from a literal require().
export const FAVICON_PNGS: Readonly<Record<string, FaviconPngs>> = {
  'farmwork.tapping': {
    tab: require('../../../assets/favicons/farmwork.tapping-64.png'),
    home: require('../../../assets/favicons/farmwork.tapping-180.png'),
    grid: require('../../../assets/favicons/farmwork.tapping-128.png'),
  },
  'people.tapper': {
    tab: require('../../../assets/favicons/people.tapper-64.png'),
    home: require('../../../assets/favicons/people.tapper-180.png'),
    grid: require('../../../assets/favicons/people.tapper-128.png'),
  },
  'sale.recordYield': {
    tab: require('../../../assets/favicons/sale.recordYield-64.png'),
    home: require('../../../assets/favicons/sale.recordYield-180.png'),
    grid: require('../../../assets/favicons/sale.recordYield-128.png'),
  },
  'sale.weigh': {
    tab: require('../../../assets/favicons/sale.weigh-64.png'),
    home: require('../../../assets/favicons/sale.weigh-180.png'),
    grid: require('../../../assets/favicons/sale.weigh-128.png'),
  },
  'sale.rubberPrice': {
    tab: require('../../../assets/favicons/sale.rubberPrice-64.png'),
    home: require('../../../assets/favicons/sale.rubberPrice-180.png'),
    grid: require('../../../assets/favicons/sale.rubberPrice-128.png'),
  },
  'farmwork.fertilize': {
    tab: require('../../../assets/favicons/farmwork.fertilize-64.png'),
    home: require('../../../assets/favicons/farmwork.fertilize-180.png'),
    grid: require('../../../assets/favicons/farmwork.fertilize-128.png'),
  },
  'materials.manureFert': {
    tab: require('../../../assets/favicons/materials.manureFert-64.png'),
    home: require('../../../assets/favicons/materials.manureFert-180.png'),
    grid: require('../../../assets/favicons/materials.manureFert-128.png'),
  },
  'farmwork.mow': {
    tab: require('../../../assets/favicons/farmwork.mow-64.png'),
    home: require('../../../assets/favicons/farmwork.mow-180.png'),
    grid: require('../../../assets/favicons/farmwork.mow-128.png'),
  },
  'farmwork.spray': {
    tab: require('../../../assets/favicons/farmwork.spray-64.png'),
    home: require('../../../assets/favicons/farmwork.spray-180.png'),
    grid: require('../../../assets/favicons/farmwork.spray-128.png'),
  },
  'farm.treeCondition': {
    tab: require('../../../assets/favicons/farm.treeCondition-64.png'),
    home: require('../../../assets/favicons/farm.treeCondition-180.png'),
    grid: require('../../../assets/favicons/farm.treeCondition-128.png'),
  },
  'nav.myFarm': {
    tab: require('../../../assets/favicons/nav.myFarm-64.png'),
    home: require('../../../assets/favicons/nav.myFarm-180.png'),
    grid: require('../../../assets/favicons/nav.myFarm-128.png'),
  },
  'farm.allFarms': {
    tab: require('../../../assets/favicons/farm.allFarms-64.png'),
    home: require('../../../assets/favicons/farm.allFarms-180.png'),
    grid: require('../../../assets/favicons/farm.allFarms-128.png'),
  },
  'farm.plotZone': {
    tab: require('../../../assets/favicons/farm.plotZone-64.png'),
    home: require('../../../assets/favicons/farm.plotZone-180.png'),
    grid: require('../../../assets/favicons/farm.plotZone-128.png'),
  },
  'materials.stock': {
    tab: require('../../../assets/favicons/materials.stock-64.png'),
    home: require('../../../assets/favicons/materials.stock-180.png'),
    grid: require('../../../assets/favicons/materials.stock-128.png'),
  },
  'people.transporter': {
    tab: require('../../../assets/favicons/people.transporter-64.png'),
    home: require('../../../assets/favicons/people.transporter-180.png'),
    grid: require('../../../assets/favicons/people.transporter-128.png'),
  },
  'finance.income': {
    tab: require('../../../assets/favicons/finance.income-64.png'),
    home: require('../../../assets/favicons/finance.income-180.png'),
    grid: require('../../../assets/favicons/finance.income-128.png'),
  },
  'sale.sale': {
    tab: require('../../../assets/favicons/sale.sale-64.png'),
    home: require('../../../assets/favicons/sale.sale-180.png'),
    grid: require('../../../assets/favicons/sale.sale-128.png'),
  },
  'nav.home': {
    tab: require('../../../assets/favicons/nav.home-64.png'),
    home: require('../../../assets/favicons/nav.home-180.png'),
    grid: require('../../../assets/favicons/nav.home-128.png'),
  },
  'nav.notifications': {
    tab: require('../../../assets/favicons/nav.notifications-64.png'),
    home: require('../../../assets/favicons/nav.notifications-180.png'),
    grid: require('../../../assets/favicons/nav.notifications-128.png'),
  },
  'system.sync': {
    tab: require('../../../assets/favicons/system.sync-64.png'),
    home: require('../../../assets/favicons/system.sync-180.png'),
    grid: require('../../../assets/favicons/system.sync-128.png'),
  },
};
