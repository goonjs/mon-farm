/**
 * The string catalogue. Thai is the SOURCE, English is the second locale.
 *
 * That ordering is not a formality. The people this app is for work in Thai,
 * and the domain vocabulary in the code — เข่ง, กอง, โซน, ล้ง, ตะกร้า — is
 * already the real vocabulary rather than a translation of an English design.
 * So `th` is authored, complete, and the fallback for everything; `en` exists
 * for a non-Thai buyer at the scale, or a developer reading a screen.
 *
 * ── Rules for editing this file ──────────────────────────────────────────────
 *
 * ONE ENTRY PER MESSAGE, and `th` is where a new one starts. `MessageId` is
 * derived from `th`, so a string that does not exist in Thai cannot be
 * referenced at all — the type system enforces the source-locale rule rather
 * than a convention nobody remembers.
 *
 * NO CONCATENATION AT THE CALL SITE. A sentence assembled from fragments in
 * JSX cannot be reordered by a translator, and Thai and English do not order
 * the same. Use one entry with `{placeholders}` instead, even when the English
 * happens to come out in the same order.
 *
 * NO WEB FONTS, so no glyph the system stack may not carry: Thai, Latin, and
 * the handful of symbols the design system already uses. `resolve.test.ts`
 * enforces this — a box glyph on the counter screen is a label nobody can
 * read, in any language.
 *
 * The `·` that used to join the two languages on screen is gone from labels
 * by design. It survives only where it is genuinely a separator between two
 * data values, not two languages.
 */

export type Locale = 'th' | 'en';

/**
 * Thai — the source. Every id in the app exists here.
 */
const th = {
  // ── Shared vocabulary ────────────────────────────────────────────────────
  'common.cancel': 'ยกเลิก',
  'common.confirm': 'ยืนยัน',
  'common.back': 'กลับ',
  'common.next': 'ต่อไป',
  'common.save': 'บันทึก',
  'common.kg': 'กก.',
  'common.baskets': 'เข่ง',
  'common.themeLight': 'สว่าง',
  'common.themeDark': 'มืด',
  'common.language': 'ภาษา',

  // ── The counter screen's tabs and stage ──────────────────────────────────
  'tabs.count': 'นับ',
  'tabs.pile': 'กอง',
  'tabs.log': 'บันทึก',

  'hold.label': 'ตัวนับ กดค้างเพื่อนับหนึ่งเข่ง',
  'hold.counted': '✓ นับแล้ว',
  'hold.movedOff': '✗ ไม่นับ นิ้วเลื่อนออกจากปุ่ม',
  'hold.releasedEarly': '✗ ไม่นับ ปล่อยเร็วไป {seconds} วิ',
  'hold.rotate': 'หมุนจอเพื่อดูตัวเลขชัดขึ้น',

  // ── Short basket (F-22) ──────────────────────────────────────────────────
  'short.title': 'เข่งไม่เต็ม ชั่งได้เท่าไหร่ (กก.) น้ำหนักรวม',
  'short.readingLabel': 'ตาชั่งอ่านได้ (รวมตะกร้า) กก.',
  'short.derivation': 'ยางสุทธิ = ชั่งได้ {reading} − ตะกร้า {tare} = {net} กก.',
  'short.log': 'บันทึกเข่งนี้',
  'short.open': 'เข่งไม่เต็ม',

  // ── The zero / tare gate (S9) ────────────────────────────────────────────
  'gate.step': 'ขั้นที่ {step} จาก 3',
  'gate.zeroQuestion': 'ไม่มีอะไรบนตาชั่ง — ขึ้นศูนย์ไหม?',
  'gate.zeroYes': 'ใช่ ขึ้นศูนย์',
  'gate.zeroNo': 'ไม่ใช่',
  'gate.zeroReading': 'ขึ้นเลขอะไร (กก.)',
  'gate.flagAndContinue': 'บันทึกไว้แล้วนับต่อ',
  'gate.tareQuestion': 'ชั่งตะกร้าเปล่า ตาชั่งขึ้นเท่าไหร่?',
  'gate.tareConfirm': 'ยืนยันน้ำหนักตะกร้า',
  'gate.expected': '{tare} + {std} = {expected} กก.',
  'gate.ready': 'เริ่มนับได้',
  'gate.readAloud': 'อ่านออกเสียงก่อนเข่งแรก',

  // ── The announced register (FR-11) — ALWAYS THAI ─────────────────────────
  //
  // Everything under `say.` is spoken aloud, or is a quotation on screen of
  // something spoken aloud. It does NOT follow the UI locale, and there is no
  // English column for any of it — see the note at the foot of this file.
  'say.ready': 'พร้อมค่ะ',
  'say.count': '{n}',
  'say.next': 'ต่อไปค่ะ',

  // ── Reopen (lifecycle §7.2) ──────────────────────────────────────────────
  'reopen.title': 'เปิด {target} อีกครั้ง',
  'reopen.reasonPlaceholder': 'เหตุผลที่เปิดอีกครั้ง',
  'reopen.areYouSure': 'แน่ใจนะ? การเปิดอีกครั้งจะถูกบันทึกไว้',
  'reopen.confirm': 'ยืนยันเปิดอีกครั้ง',
  'reopen.pileConsequence': 'กองนี้จะกลับมานับต่อได้ บันทึกเดิมยังอยู่ครบ',
  'reopen.zoneConsequence': 'โซนนี้จะเปิดอีกครั้ง แต่กองที่ปิดไว้จะยังปิดอยู่',
  'reopen.saleConsequence': 'การขายจะกลับมาแก้ไขได้ ผลสรุปจะคำนวณใหม่',

  // ── The counter screen ───────────────────────────────────────────────────
  'counter.loading': 'กำลังโหลด…',
  'counter.miniCount': 'นับ {n}',
  'counter.counting': 'กำลังนับ',
  'counter.stopped': 'หยุด',
  'counter.clockSuspect': 'เวลาผิด',
  'counter.switcher': 'โซน/กอง',
  'counter.pileNotReady': 'กองยังไม่พร้อม',
  'counter.undo': 'ยกเลิกเข่งล่าสุด',
  'counter.mistapReason': 'กดพลาด',
  'counter.undoDetail':
    'ยกเลิกเข่ง #{seq} — {kind} {weight} กก. จะกลายเป็นรายการที่ถูกยกเลิกในบันทึก ไม่ใช่การลบ',
  'counter.undoConfirm': 'ยืนยันยกเลิก',
  'counter.undoCancel': 'พัก',
  'counter.closeSale': 'ปิดการขาย',
  'counter.closeSaleTitle': 'ปิดการขาย?',
  'counter.closeSaleDetail': '{zones} โซน {piles} กอง — นับได้ {baskets} เข่ง {weight} กก.',
  'counter.closeSaleStillCounting':
    'ยังนับอยู่ {n} กอง จะหยุดนับทันที (ไม่ได้ถูกปิดให้อัตโนมัติ)',
  'counter.closeSaleAfter': 'จะคำนวณผลสรุปทันที และเปิดการขายใหม่ได้ภายหลัง',
  'counter.closeSaleConfirm': 'ยืนยันปิดการขาย',

  // ── The pile panel ───────────────────────────────────────────────────────
  'pile.thisPile': '{name}',
  'pile.standard': 'เข่งมาตรฐาน',
  'pile.short': 'เข่งไม่เต็ม',
  'pile.weight': 'น้ำหนักรวม',
  'pile.scale': 'ตาชั่ง',
  'pile.tare': 'ตะกร้าเปล่า',
  'pile.stdNet': 'ยางต่อเข่ง',
  'pile.expected': 'ต้องอ่านได้',
  'pile.rollups': 'รวม',
  'pile.wholeSale': 'ทั้งการขาย',
  'pile.allBaskets': 'เข่งทั้งหมด',
  'pile.closeReopen': 'ปิด / เปิดอีกครั้ง',
  'pile.close': 'ปิดกอง',
  'pile.closeDetail': 'ปิด {name} — {baskets} เข่ง {weight} กก. จะหยุดนับทันที',
  'pile.closeConfirm': 'ยืนยันปิดกอง',
  'pile.reopen': 'เปิดกองอีกครั้ง',
  'pile.notStarted': 'กองยังไม่เริ่ม',
  'zone.close': 'ปิดโซน',
  'zone.closeDetail': 'ปิด {name} — {baskets} เข่ง {weight} กก.',
  'zone.closeWarning': 'ยังนับอยู่ {n} กอง จะถูกปิดไปด้วย: {names}',
  'zone.closeConfirm': 'ยืนยันปิดโซน',
  'zone.reopen': 'เปิดโซนอีกครั้ง',

  // ── The zone / pile switcher ─────────────────────────────────────────────
  'switcher.title': 'เลือกโซนและกอง',
  'switcher.close': '✕',
  'switcher.zoneRow': '{name} · {status}',
  'switcher.pileRow': '{name} · {status}',
  'status.notStarted': 'ยังไม่เริ่ม',
  'status.counting': 'กำลังนับ',
  'status.closed': 'ปิดแล้ว',
  'status.open': 'เปิดอยู่',

  // ── The people picker (S16) ──────────────────────────────────────────────
  'people.loading': 'กำลังโหลดรายชื่อ…',
  'people.change': 'เปลี่ยน',
  'people.empty': 'ยังไม่มีรายชื่อ',
  'people.namePlaceholder': 'ชื่อคนงาน',
  'people.add': 'เพิ่ม',
  'people.addNew': '+ เพิ่มคนงานใหม่',

  // ── The weight input (F-22) ──────────────────────────────────────────────
  'weight.dragHint': 'ลากเพื่อปรับ',

  // ── The pile-closed decision point (S13) ─────────────────────────────────
  'closed.title': 'ปิดกองแล้ว',
  'closed.total': '{name} — {baskets} เข่ง · {weight} กก.',
  'closed.nextPile': 'กองถัดไปในโซนนี้ →',
  'closed.switchZone': 'เปลี่ยนโซน',
  'closed.closeZone': 'ปิดโซนนี้',

  // ── Settlement (S14, S18) ────────────────────────────────────────────────
  'settle.title': 'สรุป',
  'settle.list': 'รายการ',
  'settle.cannotSettle': 'ยังสรุปไม่ได้',
  'settle.backToCounting': '← กลับไปนับ',
  'settle.saleConsequence': 'การขายนี้จะเปิดอีกครั้ง สามารถนับและปิดกองต่อได้',
  'settle.derivation': 'ที่มาของยอด',
  'settle.ownerTotal': 'รวมส่วนเจ้าของ',
  'settle.ownerNote': 'รวมทุกโซน แต่ละโซนคิดตาม % ของตัวเอง',
  'settle.perZone': 'แยกตามโซน',
  'settle.zoneRow': '{name} — {baskets} เข่ง · {weight} กก.',
  'settle.total': 'รวม',
  'settle.perWorker': 'แยกตามคนงาน',
  'settle.noWorker': 'ยังไม่มีการระบุคนงานประจำโซน',
  'settle.reopen': '↺ เปิดการขายอีกครั้ง — กลับไปนับ',

  // ── The sale list (S17) ──────────────────────────────────────────────────
  'sales.title': 'การขาย',
  'sales.empty': 'ยังไม่มีการขาย — เริ่มการขายใหม่ด้านล่าง',
  'sales.new': '+ เริ่มการขายใหม่',
  'sales.unnamed': 'ยังไม่ได้ตั้งค่า',
  'sales.row': '{name} · {status} · {zones} โซน',

  // ── The log tab ──────────────────────────────────────────────────────────
  'log.accept': 'เข่งมาตรฐาน {weight} กก.',
  'log.short': 'เข่งไม่เต็ม ชั่งได้ {reading} − ตะกร้า {tare} = {net} กก.',
  'log.reject': 'ไม่นับ — ปล่อยเร็วไป {seconds} วิ',
  'log.correction': 'แก้ไข — ยกเลิก #{seq} · {reason}',
  'log.saleStarted': 'เริ่มขาย — {buyer}',
  'log.priceSet': 'ราคา {price} ต่อ กก.',
  'log.splitSet': 'ส่วนแบ่ง {owner}/{worker}',
  'log.zoneAdded': 'เพิ่มโซน {name}',
  'log.zoneContractSet': 'สัญญาโซน — {worker} {pct}%',
  'log.pileAdded': 'เพิ่มกอง {name}',
  'log.zeroOk': 'ตาชั่งขึ้นศูนย์ ✓',
  'log.zeroNotOk': 'ตาชั่งไม่ศูนย์ {reading} กก.',
  'log.tareConfirmed': 'ตะกร้าเปล่า {tare} กก.',
  'log.ready': 'พร้อมนับ',
  'log.pileClosed': 'ปิดกอง',
  'log.pileReopened': 'เปิดกองอีกครั้ง — {reason}',
  'log.zoneClosed': 'ปิดโซน',
  'log.zoneReopened': 'เปิดโซนอีกครั้ง — {reason}',
  'log.saleClosed': 'ปิดการขาย',
  'log.saleReopened': 'เปิดการขายอีกครั้ง — {reason}',
  'log.clockAnomaly': 'เวลาเครื่องผิด ({anomaly})',
} as const;

/**
 * English — the second locale. Incomplete by design and by expectation: see
 * `untranslated` below for what is knowingly missing, and `resolve()` for what
 * happens when something is missing that shouldn't be.
 */
const en: Partial<Record<keyof typeof th, string>> = {
  'common.cancel': 'cancel',
  'common.confirm': 'confirm',
  'common.back': 'back',
  'common.next': 'next',
  'common.save': 'save',
  'common.kg': 'kg',
  'common.baskets': 'baskets',
  'common.themeLight': 'light',
  'common.themeDark': 'dark',

  'tabs.count': 'Count',
  'tabs.pile': 'Pile',
  'tabs.log': 'Log',

  'hold.label': 'Counter, press and hold to count one basket',
  'hold.counted': '✓ counted',
  'hold.movedOff': '✗ not counted — moved off the stage',
  'hold.releasedEarly': '✗ not counted — released early, {seconds}s',
  'hold.rotate': 'turn the phone for a clearer count',

  'short.title': 'short basket — what does the scale read (kg), gross',
  'short.readingLabel': 'scale reading (gross), kg',
  'short.derivation': 'net rubber = reading {reading} − tare {tare} = {net} kg',
  'short.log': 'log this basket',
  'short.open': 'short basket',

  'gate.step': 'step {step} of 3',
  'gate.zeroQuestion': 'nothing on the scale — does it read zero?',
  'gate.zeroYes': 'yes, zero',
  'gate.zeroNo': 'no',
  'gate.zeroReading': 'what does it read instead? (kg)',
  'gate.flagAndContinue': 'flag it and continue anyway',
  'gate.tareQuestion': 'weigh the empty basket — what does the scale read?',
  'gate.tareConfirm': 'confirm basket weight',
  'gate.expected': '{tare} + {std} = {expected} kg',
  'gate.ready': 'start counting',
  'gate.readAloud': 'read aloud before the first basket',

  'reopen.title': 'reopening {target}',
  'reopen.reasonPlaceholder': 'reason for reopening',
  'reopen.areYouSure': 'are you sure? reopening will be recorded.',
  'reopen.confirm': 'confirm reopen',
  'reopen.pileConsequence': 'this pile becomes countable again. Nothing already recorded is erased.',
  'reopen.zoneConsequence': 'the zone reopens, but piles already closed inside it stay closed.',
  'reopen.saleConsequence': 'the sale becomes editable again and settlement is recalculated.',

  'counter.loading': 'loading…',
  'counter.miniCount': 'count {n}',
  'counter.counting': 'counting',
  'counter.stopped': 'stopped',
  'counter.clockSuspect': 'clock looks wrong',
  'counter.switcher': 'zone/pile',
  'counter.pileNotReady': 'pile not ready',
  'counter.undo': 'undo last',
  'counter.mistapReason': 'mistap',
  'counter.undoDetail':
    'undo basket #{seq} — {kind} {weight} kg. Shown as voided in the log, not deleted.',
  'counter.undoConfirm': 'confirm undo',
  'counter.undoCancel': 'cancel',
  'counter.closeSale': 'close sale',
  'counter.closeSaleTitle': 'close the sale?',
  'counter.closeSaleDetail': '{zones} zones, {piles} piles — {baskets} baskets, {weight} kg counted so far.',
  'counter.closeSaleStillCounting':
    '{n} pile(s) still counting stop being countable immediately — they are not auto-closed.',
  'counter.closeSaleAfter': 'settlement is calculated immediately; the sale can be reopened later.',
  'counter.closeSaleConfirm': 'confirm close sale',

  'pile.thisPile': '{name}',
  'pile.standard': 'standard',
  'pile.short': 'short',
  'pile.weight': 'weight',
  'pile.scale': 'scale',
  'pile.tare': 'tare',
  'pile.stdNet': 'standard net',
  'pile.expected': 'expected',
  'pile.rollups': 'rollups',
  'pile.wholeSale': 'whole sale',
  'pile.allBaskets': 'all baskets',
  'pile.closeReopen': 'close / reopen',
  'pile.close': 'close pile',
  'pile.closeDetail': 'close {name} — {baskets} baskets, {weight} kg. Counting stops immediately.',
  'pile.closeConfirm': 'confirm close pile',
  'pile.reopen': 'reopen pile',
  'pile.notStarted': 'not started yet',
  'zone.close': 'close zone',
  'zone.closeDetail': 'close {name} — {baskets} baskets, {weight} kg.',
  'zone.closeWarning': '{n} pile(s) still counting will be force-closed too: {names}',
  'zone.closeConfirm': 'confirm close zone',
  'zone.reopen': 'reopen zone',

  'switcher.title': 'pick a zone and pile',
  'switcher.close': '✕',
  'switcher.zoneRow': '{name} · {status}',
  'switcher.pileRow': '{name} · {status}',
  'status.notStarted': 'not started',
  'status.counting': 'counting',
  'status.closed': 'closed',
  'status.open': 'open',

  'people.loading': 'loading the list…',
  'people.change': 'change',
  'people.empty': 'no one on the list yet',
  'people.namePlaceholder': "worker's name",
  'people.add': 'add',
  'people.addNew': '+ add a new worker',

  'weight.dragHint': 'drag to adjust',

  'closed.title': 'pile closed',
  'closed.total': '{name} — {baskets} baskets · {weight} kg',
  'closed.nextPile': 'next pile in this zone →',
  'closed.switchZone': 'switch zone',
  'closed.closeZone': 'close this zone',

  'settle.title': 'settlement',
  'settle.list': 'list',
  'settle.cannotSettle': 'cannot settle yet',
  'settle.backToCounting': '← back to counting',
  'settle.saleConsequence': 'the sale reopens; counting and closing can continue.',
  'settle.derivation': 'how the total was reached',
  'settle.ownerTotal': 'owner total',
  'settle.ownerNote': 'summed across every zone below, each at its own %',
  'settle.perZone': 'per zone',
  'settle.zoneRow': '{name} — {baskets} baskets · {weight} kg',
  'settle.total': 'total',
  'settle.perWorker': 'per worker',
  'settle.noWorker': 'no zone has a worker named yet',
  'settle.reopen': '↺ reopen — back to counting',

  'sales.title': 'sales',
  'sales.empty': 'no sales yet — start one below.',
  'sales.new': '+ start a new sale',
  'sales.unnamed': 'not set up yet',
  'sales.row': '{name} · {status} · {zones} zones',

  'log.accept': 'standard basket {weight} kg',
  'log.short': 'short basket — reading {reading} − tare {tare} = {net} kg',
  'log.reject': 'not counted — released early, {seconds}s',
  'log.correction': 'correction — undo #{seq} · {reason}',
  'log.saleStarted': 'sale started — {buyer}',
  'log.priceSet': 'price {price} per kg',
  'log.splitSet': 'split {owner}/{worker}',
  'log.zoneAdded': 'zone added — {name}',
  'log.zoneContractSet': 'zone contract — {worker} {pct}%',
  'log.pileAdded': 'pile added — {name}',
  'log.zeroOk': 'scale read zero ✓',
  'log.zeroNotOk': 'scale did not read zero — {reading} kg',
  'log.tareConfirmed': 'empty basket {tare} kg',
  'log.ready': 'ready to count',
  'log.pileClosed': 'pile closed',
  'log.pileReopened': 'pile reopened — {reason}',
  'log.zoneClosed': 'zone closed',
  'log.zoneReopened': 'zone reopened — {reason}',
  'log.saleClosed': 'sale closed',
  'log.saleReopened': 'sale reopened — {reason}',
  'log.clockAnomaly': "device clock looks wrong ({anomaly})",
};

export const messages = { th, en } as const;

export type MessageId = keyof typeof th;

/**
 * True for the announced register (FR-11): everything the app SAYS, and every
 * on-screen quotation of it.
 *
 * ── The announced register is always Thai ───────────────────────────────────
 *
 * The UI locale is about the person holding the phone. The voice is not — it
 * is aimed at the people standing around the scale, and they are Thai
 * speakers. FR-9's whole cross-check rests on the other party hearing a count
 * they can follow without holding anything; a count announced in English
 * because the operator switched their own labels would break exactly that,
 * silently, for everyone except the one person who changed the setting.
 *
 * So `say.*` never takes a locale and never gets an English column. It is not
 * an untranslated backlog item — translating it is the bug.
 *
 * The spoken numerals are Thai for the same reason and stay Arabic digits on
 * screen for a different one: the log and the settlement are documents two
 * parties check by hand.
 */
export function isAnnounced(id: MessageId): boolean {
  return id.startsWith('say.');
}

/**
 * Ids knowingly shown in Thai even to an English reader.
 *
 * Not a to-do list — an explicit decision, per id, that translating it would
 * be wrong. The parity test in `resolve.test.ts` fails on anything missing
 * from `en` that is not listed here, which is what stops the catalogue rotting
 * quietly as stories add strings.
 */
export const untranslated: readonly MessageId[] = [
  ...(Object.keys(th) as MessageId[]).filter(isAnnounced),
  'common.language',
];
