#!/usr/bin/env python3
"""Generates docs/ux/mockups/flow-choice-tiles.html (E01-S25 / E01-S26) from the head + icon sprite of flow-farm-v1.1.0.html."""
import re, sys

BASE = 'docs/ux/mockups/flow-farm-v1.1.0.html'
OUT = 'docs/ux/mockups/flow-choice-tiles.html'
src = open(BASE, encoding='utf-8').read()
head_end = src.index('<body>') + len('<body>')
sprite_start = src.index('<svg width="0" height="0"')
sprite_end = src.index('</svg>\n', src.rindex('<symbol', 0, src.index('<div class="wrap">'))) + len('</svg>\n')
head = src[:head_end].replace('<title>', '<title>', 1)
head = re.sub(r'<title>.*?</title>', '<title>E01-S25 / E01-S26 · ปุ่มเลือกทั้งแอป รอบ 2 (ร่าง)</title>', head, flags=re.S)
sprite = src[sprite_start:src.index('<div class="wrap">')]

EXTRA_CSS = """
<style>
/* ===== E01-S25 / E01-S26 · choice tiles (tokens only; one place for every style) ===== */
.tiles { display: grid; gap: 8px; }
.tiles.c2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.tiles.c3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.tiles.c4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
.tl { min-height: var(--target); display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center;
  border-radius: var(--r-md); border: 2px solid var(--color-rule-strong); background: var(--color-surface-raised); color: var(--color-ink);
  padding: 4px 8px; font-size: 15px; font-weight: 700; line-height: 1.25; min-width: 0; }
.tl small { font-size: 12px; font-weight: 600; color: var(--color-ink-soft); }
.tl.on { background: var(--color-action); border-color: var(--color-action); color: var(--color-ink-inverse); }
.tl.on small { color: var(--color-ink-inverse); }
.tl.dash { border-style: dashed; color: var(--color-action); }
.tl.wide { grid-column: 1 / -1; }
/* style I: a reserved slot for the tick, so the tile never changes size; tone = meaning */
/* owner 2026-11-18: left-aligned, not centred */
.ti { flex-direction: row; justify-content: flex-start; text-align: left; padding-left: 10px; gap: 8px; --tone: var(--color-action); --tone-sunk: var(--color-action-sunk); }
.ti.tone-accept { --tone: var(--color-accept); --tone-sunk: var(--color-accept-sunk); }
.ti.tone-warn { --tone: var(--color-warn); --tone-sunk: var(--color-warn-sunk); }
.ti.tone-reject { --tone: var(--color-reject); --tone-sunk: var(--color-reject-sunk); }
/* owner 2026-11-18: before picking, an empty radio ring (never an empty slot); picked = the ring fills with ✓ in the tone colour */
.ti-dash { flex-direction: row; align-items: center; justify-content: flex-start; text-align: left; padding-left: 10px; }
.ti .ck { width: 22px; height: 22px; flex: none; border-radius: var(--r-pill); display: grid; place-items: center; color: var(--color-ink-inverse); background: transparent; border: 2px solid var(--color-rule-strong); }
.ti .ck .ic { width: 14px; height: 14px; stroke-width: 3; visibility: hidden; }
.ti.on { background: var(--tone-sunk); border-color: var(--tone); color: var(--tone); }
.ti.on .ck { background: var(--tone); border-color: var(--tone); }
.ti.on .ck .ic { visibility: visible; }
/* style F: tick box, many can be on */
.tf { min-height: var(--target); display: flex; align-items: center; gap: 8px; padding: 4px 10px; border-radius: var(--r-md); border: 2px solid var(--color-rule-strong);
  background: var(--color-surface-raised); font-size: 15px; font-weight: 700; line-height: 1.25; min-width: 0; }
.tf .bx { width: 22px; height: 22px; flex: none; border-radius: 6px; border: 2px solid var(--color-rule-strong); display: grid; place-items: center; color: var(--color-ink-inverse); }
.tf .bx .ic { width: 14px; height: 14px; stroke-width: 3; visibility: hidden; }
.tf.on { border-color: var(--color-action); background: var(--color-action-sunk); color: var(--color-action); }
.tf.on .bx { background: var(--color-action); border-color: var(--color-action); }
.tf.on .bx .ic { visibility: visible; }
/* style E: a box that shows the value, ▾ opens a sheet */
.vb { min-height: 52px; border: 2px solid var(--color-rule-strong); border-radius: var(--r-md); background: var(--color-surface-raised); padding: 4px 34px 4px 12px; position: relative; display: flex; flex-direction: column; justify-content: center; min-width: 0; }
.vb small { font-size: 12px; font-weight: 600; color: var(--color-ink-soft); }
.vb b { font-size: 15px; line-height: 1.25; }
.vb .dd { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); color: var(--color-action); }
.vb .dd .ic { width: 20px; height: 20px; }
.vb.on { border-color: var(--color-action); background: var(--color-action-sunk); }
/* style H: a command is a whole row with ›, or an underlined link */
.hrow { min-height: 56px; display: flex; align-items: center; gap: 10px; padding: 8px 12px; background: var(--color-surface-raised); border: 1px solid var(--color-rule-faint); border-radius: var(--r-lg); }
.hrow .grow { flex: 1; min-width: 0; }
.hrow small { display: block; font-size: 13px; color: var(--color-ink-soft); }
.hrow .go { color: var(--color-action); flex: none; }
.hrow .go .ic { width: 22px; height: 22px; }
.ulink { min-height: var(--target); display: inline-flex; align-items: center; color: var(--color-reject); font-weight: 700; text-decoration: underline; }
.ulink.act { color: var(--color-action); }
/* old look, drawn only to show "before" (banned by the owner rule 2026-11-18) */
.op { min-height: var(--target); min-width: 64px; display: inline-flex; align-items: center; justify-content: center; padding: 0 14px; border-radius: var(--r-pill);
  border: 1.5px solid var(--color-rule-strong); background: var(--color-surface-raised); font-size: 14px; font-weight: 600; text-align: center; }
.op.on { border: 2px solid var(--color-action); background: var(--color-action-sunk); color: var(--color-action); }
.op.dk { background: var(--color-action); border-color: var(--color-action); color: var(--color-ink-inverse); }
.op.dash { border-style: dashed; color: var(--color-action); }
.ops { display: flex; flex-wrap: wrap; gap: 8px; }
.oseg { display: flex; gap: 6px; background: var(--color-surface-sunk); border-radius: var(--r-pill); padding: 4px; }
.oseg > span { flex: 1; min-height: 44px; display: flex; align-items: center; justify-content: center; text-align: center; border-radius: var(--r-pill); font-size: 14px; font-weight: 600; color: var(--color-ink-soft); line-height: 1.2; padding: 0 6px; }
.oseg > span.on { background: var(--color-action); color: var(--color-ink-inverse); }
.seg.b > span { font-size: 14px; padding: 0 6px; }
/* page furniture */
.lab { font-size: 14px; font-weight: 700; color: var(--color-ink-soft); display: block; }
.lab small { font-weight: 400; margin-left: 6px; }
.stubrow { min-height: 52px; display: flex; align-items: center; gap: 10px; padding: 6px 12px; border-top: 1px solid var(--color-rule-faint); font-size: 15px; }
.stubrow .grow { flex: 1; min-width: 0; }
.stubrow small { display: block; font-size: 12px; color: var(--color-ink-soft); }
.stubcard { background: var(--color-surface-raised); border: 1px solid var(--color-rule-faint); border-radius: var(--r-lg); overflow: hidden; }
.stubcard.pad { padding: 10px 12px; display: grid; gap: 8px; }
.pairs { display: flex; flex-wrap: wrap; justify-content: center; gap: 28px 12px; align-items: flex-start; }
.tagno, .tagyes { display: inline-block; font-size: 12px; font-weight: 700; padding: 1px 8px; border-radius: var(--r-pill); margin-bottom: 4px; }
.tagno { background: var(--color-reject-sunk); color: var(--color-reject); }
.tagyes { background: var(--color-accept-sunk); color: var(--color-accept); }
.tagteam { display: inline-block; font-size: 12px; font-weight: 700; padding: 1px 8px; border-radius: var(--r-pill); margin-bottom: 4px; background: var(--color-warn-sunk); color: var(--color-warn); }
.padk { min-height: 52px; display: grid; place-items: center; border-radius: var(--r-md); border: 2px solid var(--color-rule-strong); background: var(--color-surface-raised); font-size: 20px; font-weight: 700; }
.wheel { display: flex; align-items: center; justify-content: center; gap: 10px; padding: 4px 0; }
.wcol { width: 112px; display: grid; gap: 4px; text-align: center; }
.wi { min-height: 44px; display: grid; place-items: center; font-size: 22px; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--color-ink-faint); }
.wi.n1 { color: var(--color-ink-soft); }
.wi.sel { color: var(--color-ink); background: var(--color-action-sunk); border: 2px solid var(--color-action); border-radius: var(--r-md); font-size: 26px; }
.wsep { font-size: 26px; font-weight: 800; }
.bigt { text-align: center; font-size: 40px; font-weight: 800; font-variant-numeric: tabular-nums; padding: 4px 0; }
.radio.sm { min-height: 48px; padding: 0 12px; border: 0; border-top: 1px solid var(--color-rule-faint); border-radius: 0; background: transparent; }
.calstub { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; padding: 8px 0; text-align: center; font-size: 14px; color: var(--color-ink-soft); }
.calstub span { min-height: 34px; display: grid; place-items: center; }
.calstub .d { font-weight: 700; color: var(--color-ink); }
.tbl { width: 100%; border-collapse: collapse; font-size: 14px; }
.tbl th, .tbl td { text-align: left; vertical-align: top; padding: 6px 8px; border-bottom: 1px solid var(--pg-rule); }
.tbl th { color: var(--pg-ink-soft); font-weight: 600; }
.q { background: var(--color-warn-sunk); border-radius: var(--r-md); padding: 10px 14px; margin: 12px 0; color: var(--color-ink); }
</style>
"""

def ic(n):
    return f'<svg class="ic"><use href="#i-{n}"/></svg>'

def sbar():
    return f'<div class="sbar num"><span>09:20</span><span>{ic("signal")} {ic("battery")}</span></div>'

def appbar(title, sub=''):
    s = f'<small>{sub}</small>' if sub else ''
    return f'<div class="appbar"><span class="iconbtn">{ic("back")}</span><h3>{title}{s}</h3><span class="pill p-ok">{ic("cloud-ok")}บันทึกในเครื่อง</span></div>'

def screen(label, body, foot='', sheet='', dim=False, title='', sub=''):
    t = title or label
    b = f'<div class="body"{" style=\"opacity:.35\"" if dim else ""}>{body}</div>'
    sh = f'<div class="sheet-scrim"></div><div class="sheet" style="gap:12px"><span class="grab"></span>{sheet}</div>' if sheet else ''
    f = f'<div class="navf">{foot}</div>' if foot else ''
    return f'<div class="screen" aria-label="{label}">{sbar()}{appbar(t, sub)}{b}{f}{sh}</div>'

_n = [0]
def fig(pid, scr, title, cap='', ids='', tag=''):
    tg = {'no': '<span class="tagno">ของเดิม · ผิดกฎ</span>', 'yes': '<span class="tagyes">ใหม่ตามที่ตกลง</span>', 'team': '<span class="tagteam">ข้อเสนอของทีม · รอเจ้าของดู</span>', '': ''}[tag]
    c = f'<br>{cap}' if cap else ''
    i = f'<span class="ids">{ids}</span>' if ids else ''
    return (f'<figure class="step" id="fig-{pid}">{tg}<div class="phone" id="{pid}">{scr}</div>'
            f'<figcaption><span class="t">{title}</span>{cap}{i}</figcaption></figure>')

def pair(a, b):
    return f'<div class="pairs">{a}{b}</div>'

# ---- building blocks ----
def op(items, on=(), dash=()):
    return '<div class="ops">' + ''.join(f'<span class="op{" on" if i in on else ""}{" dash" if i in dash else ""}">{t}</span>' for i, t in enumerate(items)) + '</div>'

def tiles(items, cols, on=(), dash=(), sub=None, wide=()):
    sub = sub or {}
    out = f'<div class="tiles c{cols}">'
    for i, t in enumerate(items):
        s = f'<small>{sub[i]}</small>' if i in sub else ''
        out += f'<span class="tl{" on" if i in on else ""}{" dash" if i in dash else ""}{" wide" if i in wide else ""}">{t}{s}</span>'
    return out + '</div>'

def tilesI(items, cols, on=(), tone='action', tones=None, dash=(), wide=()):
    tones = tones or {}
    out = f'<div class="tiles c{cols}">'
    for i, t in enumerate(items):
        tn = tones.get(i, tone)
        if i in dash:
            out += f'<span class="tl dash ti-dash{" wide" if i in wide else ""}">{t}</span>'
            continue
        out += f'<span class="tl ti tone-{tn}{" on" if i in on else ""}{" wide" if i in wide else ""}"><span class="ck">{ic("check")}</span><span>{t}</span></span>'
    return out + '</div>'

def tilesF(items, cols, on=()):
    out = f'<div class="tiles c{cols}">'
    for i, t in enumerate(items):
        out += f'<span class="tf{" on" if i in on else ""}"><span class="bx">{ic("check")}</span><span>{t}</span></span>'
    return out + '</div>'

def vb(label, value, on=False):
    return f'<span class="vb{" on" if on else ""}"><small>{label}</small><b>{value}</b><span class="dd">{ic("down")}</span></span>'

def seg(items, on, old=False):
    if old:
        return '<div class="oseg">' + ''.join(f'<span class="{"on" if i == on else ""}">{t}</span>' for i, t in enumerate(items)) + '</div>'
    return '<div class="seg b">' + ''.join(f'<span class="{"on" if i == on else ""}">{t}</span>' for i, t in enumerate(items)) + '</div>'

def lab(t, hint=''):
    h = f'<small>{hint}</small>' if hint else ''
    return f'<span class="lab">{t}{h}</span>'

def stub(rows):
    return '<div class="stubcard">' + ''.join(f'<div class="stubrow"><span class="grow">{a}<small>{b}</small></span><span class="num">{c}</span></div>' for a, b, c in rows) + '</div>'

PAYERS = ['เงินสวน', 'แดง', 'นัด', 'อ.สมหวัง', 'ใส่ทีหลัง']

secs = []

# =============== header ===============
HEADER = f"""
<header class="hdr">
  <h1>ปุ่มเลือกทั้งแอป · รอบ 2 · E01-S25 / E01-S26 (ร่าง)</h1>
  <p>ตั้งต้นจาก <code>flow-farm-v1.1.0.html</code> (CSS และไอคอนเดียวกัน) · ภาพนิ่ง ไม่ใช่ต้นแบบที่กดได้ · หนึ่งภาพ = หนึ่งจอ 390×844 · <b>ร่าง รอเจ้าของตกลง AC</b> ยังไม่มีโค้ด</p>
  <p>คำตอบเจ้าของรอบ 2 (18 พ.ย. 2569 05:57–06:26 UTC) บันทึกคำต่อคำในสตอรี่ E01-S25 และ E01-S26 · กฎที่ใช้: ห้ามวงรี/เกือบกลมเป็นตัวเลือก (มีขอบหรือพื้นเต็มก็นับ) · ป้ายชื่อบรรทัดของตัวเอง เหนือปุ่ม · ปุ่ม ≥ 48 · ไม่ตัดขอบ</p>
  <p>คำตอบเจ้าของ 20 พ.ย. 2569 16:04 เวลาไทย: \"ค · ค · ขอดูภาพก่อน ยังไม่ตกลง / 1 ข ตามที่ผมตอบตรงๆ\" → ข้อ CT-12(1) = ข: <b>ที่เหลือทุกตัวใช้ F</b> ยกเว้นใบซื้อ (A) และ ใครจ่ายไปก่อน (I) · เวลาเตรียมขาย 08:00–13:00 ทุกชั่วโมง 6 ช่อง + \"กำหนดเอง\" · ภาพที่แก้รอบนี้: 2ข · 4 · S26 ข้อ 2 · 6 · 7</p>
  <div class="legend">
    <span><span class="tagno">ของเดิม · ผิดกฎ</span> ภาพ "ก่อน" วาดจากของจริง (ปุ่มวงรี)</span>
    <span><span class="tagyes">ใหม่ตามที่ตกลง</span> ภาพ "หลัง"</span>
  </div>
  <nav class="toc"><a href="#s1">1 · แบบพื้นฐาน A B E F H I</a><a href="#s25">2 · E01-S25 ส่วนที่ใช้ร่วม</a><a href="#s26">3 · E01-S26 แยกตามหน้า</a></nav>
</header>
"""

# =============== SECTION 1: base styles ===============
s1 = []
a_body = (lab('กระสอบละกี่กิโล') + tiles(['25 กก.', '40 กก.', '50 กก.', 'อื่น ๆ'], 4, on=(2,), dash=(3,)) +
          lab('ร้าน') + tiles(['ร้านบ้านนา', 'ร้านเกษตร', 'ร้านเมืองใหม่', '+ ร้านใหม่'], 2, on=(0,), dash=(3,)) +
          lab('วัน') + tiles(['วันนี้', 'เมื่อวาน', '2 วันก่อน'], 3, on=(0,)))
s1.append(fig('st-a', screen('แบบ A', a_body, title='แบบ A'), 'A · ช่องสี่เหลี่ยมเท่ากัน', 'เลือกได้อันเดียว · 2–4 ช่องต่อแถว กว้างเท่ากัน มุม 12 · ช่องที่เลือก = พื้นเข้ม ตัวขาว · "+ คนอื่น" ขอบประ = เพิ่มของใหม่ ไม่ใช่ตัวเลือก', 'E01-S25 · ตาม E06-S09', 'yes'))
b_body = (lab('วงจร') + seg(['เกิดจริง', 'ผูกพันแล้ว', 'วางแผน'], 0) + lab('ไว้ก่อน หรือ หักกลบ') + seg(['ไว้ก่อน', 'หักกลบกับหนี้'], 1) +
          lab('ของเดิม (ไม่ใช้แล้ว)') + seg(['เกิดจริง', 'ผูกพันแล้ว', 'วางแผน'], 0, old=True))
s1.append(fig('st-b', screen('แบบ B', b_body, title='แบบ B'), 'B · แถบแบ่งช่อง มุมมน', 'เลือกได้อันเดียว · 2–3 คำสั้น ๆ · แถบเดียวเต็มกว้าง มุม 12 ช่องใน 8 · ที่เลือก = พื้นเข้ม · <b>ไม่ใช่วงรี</b> (ล่างสุดคือของเดิม ให้เทียบ)', 'E01-S25 · SegmentedControl ทั้งแอป', 'yes'))
e_body = (lab('ตัวกรอง') + '<div class="tiles c2">' + vb('วงจร', 'ทั้งหมด') + vb('หมวด', 'ปุ๋ย', on=True) + vb('สวน', 'ทุกสวน') + vb('เดือน', 'พ.ย. 69') + '</div>' +
          '<span class="lab">ช่องที่ตั้งค่าแล้วมีกรอบและพื้นอ่อน (หมวด) ช่องที่ยังไม่ตั้งเป็นกรอบเทา · แตะแล้วเปิดแผ่นเลือก</span>')
s1.append(fig('st-e', screen('แบบ E', e_body, title='แบบ E'), 'E · ช่องแสดงค่า + ▾', 'ตัวกรอง/ตัวเลือกยาว ๆ · หัวเล็กบน ค่าตัวหนาล่าง · เห็นค่าตลอด แตะแล้วเปิดแผ่นเลือก (รายการในแผ่นเป็นแถว ตามกฎข้อ 12)', 'E01-S25', 'yes'))
f_body = (lab('บทบาท', 'เลือกได้หลายอัน') + tilesF(['เจ้าของสวน', 'ผู้จัดการสวน', 'ผู้ช่วยสวน', 'คนกรีดยาง', 'คนงาน', 'คนรับซื้อยาง'], 2, on=(0, 3)) +
          lab('เปิด/ปิด') + tilesF(['ยังไม่บันทึกผู้จ่าย', 'ยังไม่คืนผู้จ่าย'], 2, on=(1,)))
s1.append(fig('st-f', screen('แบบ F', f_body, title='แบบ F'), 'F · ช่องมีกล่องติ๊ก', 'เลือกได้หลายอัน หรือเปิด/ปิด · กล่องติ๊กอยู่ซ้ายเสมอ (ที่เลือก = ✓ พื้นเข้ม) ขนาดช่องไม่เปลี่ยนเมื่อเลือก', 'E01-S25 · ToggleChip หลายอัน', 'yes'))
h_body = (lab('คำสั่ง (ไม่ใช่ตัวเลือก)') +
          '<div class="hrow"><span class="grow"><b>แก้แผน</b><small>นัด เริ่ม 1 ธ.ค. 69</small></span><span class="go">' + ic('chev') + '</span></div>' +
          '<span class="ulink">ยกเลิกแผน</span>' +
          '<span class="lab">ทั้งแถวกดได้ + › · คำสั่งที่ทำลายของ เป็นลิงก์ขีดเส้นใต้สีแดง · ไม่มีปุ่มวงรี</span>')
s1.append(fig('st-h', screen('แบบ H', h_body, title='แบบ H'), 'H · ทั้งแถวกดได้ + › หรือลิงก์ขีดเส้นใต้', 'สำหรับ<b>คำสั่ง</b> (แก้แผน ยกเลิก เปิดหน้าเลือก) ไม่ใช่ตัวเลือก', 'E01-S25 · กฎข้อ 11', 'yes'))
# I states
i1 = (lab('ใครจ่ายไปก่อน', 'เลือกอันเดียว · แตะคนอื่น = เปลี่ยนคน') +
      tilesI(PAYERS + ['+ คนอื่น'], 2, on=(1,), dash=(5,)) +
      lab('ก่อนเลือก → หลังเลือก: ขนาดเท่ากัน ไม่ขยับ') +
      '<div class="tiles c2">' + tilesI(['นัด'], 1).replace('tiles c1', 'tiles c1') + tilesI(['นัด'], 1, on=(0,)) + '</div>' +
      lab('สีของ ✓ และช่อง ตามความหมาย', 'tone') +
      tilesI(['ปกติ (กรมท่า)', 'ไม่มี · เรียบร้อย', 'มี · จดหนี้', 'ผิด/ลบ'], 2, on=(0, 1, 2, 3), tones={0: 'action', 1: 'accept', 2: 'warn', 3: 'reject'}))
s1.append(fig('st-i1', screen('แบบ I สถานะ', i1, title='แบบ I'), 'I · ช่องเท่ากัน + ✓ (แบบใหม่ของเจ้าของ)', 'เลือกอันเดียว แตะอีกอันเปลี่ยนเลย (ไม่ต้องกดอันเก่าออก) · วงกลมแบบ radio อยู่ซ้ายเสมอ (ว่างก่อนเลือก → ✓ ในวงสีตาม tone เมื่อเลือก) ขนาดช่องไม่เปลี่ยน · สีของ ✓ และช่อง = tone ตามความหมาย ส่งเข้าเป็นพารามิเตอร์ (ค่าเริ่มต้นกรมท่า) · สีไม่ใช่ตัวบอกเดียว: ✓ มีเสมอ', 'E01-S25 · ส่วนประกอบใหม่ที่ใช้ซ้ำได้', 'yes'))
i2 = (lab('ใครจ่ายไปก่อน', '3 ช่องต่อแถว') + tilesI(['เงินสวน', 'แดง', 'นัด'], 3, on=(1,)) +
      lab('ชื่อยาว ตัดบรรทัดในช่อง ไม่ล้น') + tilesI(['สหกรณ์ผู้ปลูกยางบ้านนา', 'อ.สมหวัง'], 2, on=(0,)) +
      lab('2 ช่อง · tone ตามความหมาย') + tilesI(['ครบ', 'ยังไม่ครบ'], 2, on=(0,), tones={0: 'accept', 1: 'warn'}))
s1.append(fig('st-i2', screen('แบบ I ความกว้าง', i2, title='แบบ I (ต่อ)'), 'I · 3 ช่อง / 2 ช่อง / ชื่อยาว (ใช้กับ "ใครจ่ายไปก่อน" เท่านั้น)', 'ช่องต่อแถวตามจำนวนตัวเลือก (2–4) · ช่องเดียวเต็มแถวได้ · ชื่อยาวขึ้นบรรทัดใหม่ในช่อง (ความสูงช่องในแถวเดียวกันเท่ากัน)', 'E01-S25', 'yes'))
secs.append('<section class="sec" id="s1"><h2>1 · แบบพื้นฐาน (A B E F H และแบบใหม่ I)</h2><p>แต่ละแบบเหมาะกับงานไหน · ภาพเดียว = หนึ่งจอ · I คือแบบใหม่จากเจ้าของ (cc-form) · ที่ไม่ได้วาดซ้ำ: C (แถว + วงเลือก) วาดเทียบกับ I ในข้อ 4 ของ S26</p><div class="flow">' + ''.join(s1) + '</div></section>')

# =============== SECTION 2: E01-S25 shared ===============
s25 = []
# P1a payer
def payer_sheet(new):
    sh = '<h4>ใครจ่ายไปก่อน</h4>' + (tilesI(PAYERS + ['+ คนอื่น'], 2, on=(0,), dash=(5,)) if new else op(PAYERS + ['+ คนอื่น'], on=(0,), dash=(5,)))
    return screen('ใครจ่ายไปก่อน', stub([('ค่าปุ๋ย', 'ปุ๋ย · 1 ธ.ค.', '3,250')]), sheet=sh, dim=True, title='บันทึกค่าใช้จ่าย')
s25.append('<h3 class="sub-h">1 · ใครจ่ายไปก่อน — แบบ I (ChoiceChip → PayerPicker)</h3>' + pair(
    fig('p1a-before', payer_sheet(False), 'ก่อน · ชื่อคนเป็นปุ่มวงรีมีขอบ', 'บันทึกค่าใช้จ่าย › ใครจ่ายไปก่อน', 'ChoiceChip', 'no'),
    fig('p1a-after', payer_sheet(True), 'หลัง · ช่องเท่ากัน + ✓ (I)', 'แตะคนอื่น = เปลี่ยนคนทันที · ช่องไม่ขยับ', 'PayerPicker ทุกที่ (7 หน้า)', 'yes')))
# P1b order kg (A)
def order_item(new):
    kg = ['25 กก.', '40 กก.', '50 กก.', 'อื่น ๆ']
    body = (lab('ปุ๋ย') + '<div class="stubcard pad"><b>15-15-15 · ตราใบไม้</b></div>' + lab('กระสอบละกี่กิโล') +
            (tiles(kg, 4, on=(2,), dash=(3,)) if new else op(kg, on=(2,), dash=(3,))) +
            lab('ร้าน') + (tiles(['ร้านบ้านนา', 'ร้านเกษตร', '+ ร้านใหม่'], 3, on=(0,), dash=(2,)) if new else op(['ร้านบ้านนา', 'ร้านเกษตร', '+ ร้านใหม่'], on=(0,), dash=(2,))))
    return screen('ใบซื้อ › ปุ๋ยใหม่', body, foot='<div class="btn btn-primary">ถัดไป' + ic('arrow') + '</div>', title='ปุ๋ยใหม่')
s25.append('<h3 class="sub-h">2 · ใบซื้อของร้าน — แบบ A (กระสอบละกี่กิโล · ร้าน · คนสั่ง · ยี่ห้อ)</h3>' + pair(
    fig('p1b-before', order_item(False), 'ก่อน · ปุ่มวงรีมีขอบ', 'ซื้อของร้าน › ปุ๋ยใหม่', 'ChoiceChip (order-sheets, item-sheets)', 'no'),
    fig('p1b-after', order_item(True), 'หลัง · ช่องสี่เหลี่ยมเท่ากัน (A)', 'ป้ายอยู่บรรทัดของตัวเอง เหนือช่อง · ที่เลือก = พื้นเข้ม', 'เจ้าของ: "ใบซื้อใช้ A"', 'yes')))
# P1d expense form single-selects (F) + payer (I)
def expform(new):
    farms = ['จันทเขลม', 'บ้านบน', 'คลองพลู']
    pay = ['เงินสวน', 'แดง', 'นัด', 'ใส่ทีหลัง', '+ คนอื่น']
    if new:
        body = (lab('สวน', 'เลือกได้อันเดียว') + tilesF(farms, 2, on=(0,)) + lab('ใครจ่ายไปก่อน') + tilesI(pay, 2, on=(1,), dash=(4,)) +
                lab('จำนวนเงิน') + tilesF(['ยังไม่ทราบจำนวนเงิน'], 1))
    else:
        body = (lab('สวน') + op(farms, on=(0,)) + lab('ใครจ่ายไปก่อน') + op(pay, on=(1,), dash=(4,)) + lab('จำนวนเงิน') + op(['ยังไม่ทราบจำนวนเงิน'], dash=(0,)))
    return screen('บันทึกค่าใช้จ่าย', body, foot='<div class="btn btn-primary">บันทึก' + ic('check') + '</div>', title='บันทึกค่าใช้จ่าย')
s25.append('<h3 class="sub-h">2ข · ฟอร์มบันทึกค่าใช้จ่าย — ตัวเลือกที่เหลือเป็น F · "ใครจ่ายไปก่อน" เป็น I (ตามที่เจ้าของตอบ ข)</h3>' + pair(
    fig('p1d-before', expform(False), 'ก่อน · ปุ่มวงรีมีขอบ', 'บันทึกค่าใช้จ่าย › สวน · ใครจ่ายไปก่อน · ยังไม่ทราบจำนวนเงิน', 'expense-form-screen.tsx (ChoiceChip 10 จุด)', 'no'),
    fig('p1d-after', expform(True), 'หลัง · สวน = F · ผู้จ่าย = I · ยังไม่ทราบ = F', 'ที่เหลือที่เลือกอันเดียวก็ใช้ F ตามตัวอักษร (อ่านแบบ ข) · เลือกสวนอันอื่น = เปลี่ยนเลย (ทีมเสนอ)', 'เจ้าของ: "1 ข ตามที่ผมตอบตรงๆ"', 'yes')))
# P1c where (F)
def where(new):
    zones = ['จันทเขลม', 'บ้านบน', 'สวนใหม่', 'ทุกโซน']
    reasons = ['ตามรอบปกติ', 'ต้นยางทรุดโทรม', 'หลังตัดแต่ง']
    body = (lab('โซนที่ใส่', 'เลือกได้หลายโซน') + (tilesF(zones, 2, on=(0, 1)) if new else op(zones, on=(0, 1))) +
            lab('เหตุผล', 'เลือกได้หลายอัน') + (tilesF(reasons, 2, on=(0,)) if new else op(reasons, on=(0,))) +
            '<div class="stubcard"><div class="stubrow"><span class="grow"><b style="color:var(--color-action)">+ เหตุผลใหม่</b></span></div></div>')
    return screen('โซนที่ใส่ · เหตุผล', body, foot='<div class="btn btn-primary">เสร็จ' + ic('check') + '</div>', title='โซนที่ใส่ · เหตุผล')
s25.append('<h3 class="sub-h">3 · โซนที่ใส่ · เหตุผล — แบบ F (เลือกได้หลายอัน)</h3>' + pair(
    fig('p1c-before', where(False), 'ก่อน · ปุ่มวงรีมีขอบ', 'การดูแลสวน › บันทึกการดูแล › โซนที่ใส่ · เหตุผล', 'ChoiceChip (where-page)', 'no'),
    fig('p1c-after', where(True), 'หลัง · ช่องมีกล่องติ๊ก (F)', 'หลายอัน จึงมีกล่องติ๊ก · ขนาดไม่เปลี่ยนเมื่อเลือก', 'เจ้าของ: "ที่เหลือใช้ F"', 'yes')))
# P7 date quick (A)
def datesheet(new):
    q = ['วันนี้', 'เมื่อวาน', '2 วันก่อน']
    cal = '<div class="calstub"><span>อา</span><span>จ</span><span>อ</span><span>พ</span><span>พฤ</span><span>ศ</span><span>ส</span>' + ''.join(f'<span class="d">{d}</span>' for d in range(1, 15)) + '</div>'
    sh = '<h4>วันที่</h4>' + (tilesF(q, 2, on=(0,)) if new else op(q, on=(0,)).replace('op on','op on dk')) + cal
    return screen('เลือกวัน', stub([('ค่าปุ๋ย', 'ปุ๋ย', '3,250')]), sheet=sh, dim=True, title='บันทึกค่าใช้จ่าย')
s25.append('<h3 class="sub-h">4 · วันนี้ / เมื่อวาน / 2 วันก่อน — แบบ F (DatePickerSheet ทุกช่องวันที่ · เจ้าของ 2026-11-20: ที่เหลือใช้ F)</h3>' + pair(
    fig('p7-before', datesheet(False), 'ก่อน · ปุ่มวงรี พื้นเข้มเมื่อเลือก', 'ปฏิทินด้านล่างไม่เปลี่ยน', 'src/ui/date-picker-sheet.tsx', 'no'),
    fig('p7-after', datesheet(True), 'หลัง · ช่องมีกล่องติ๊ก 2 ต่อแถว (F)', 'หน้าเตรียมขายเป็น วันนี้ / พรุ่งนี้ / มะรืน (ช่อง "เมื่อวาน" ไม่มี)', 'ทุกช่องวันที่ (13 ไฟล์)', 'yes')))
# P16 segmented generic
def segg(new):
    body = (lab('วงจร') + seg(['เกิดจริง', 'ผูกพันแล้ว', 'วางแผน'], 0, old=not new) + lab('รับเงินคืนหนี้ทางไหน') + seg(['เข้าเงินสวน', 'ให้คนกรีดโดยตรง'], 1, old=not new) +
            lab('วิธีบันทึกเข่งไม่เต็ม') + seg(['พิมพ์', 'หน้าปัด'], 1, old=not new))
    return screen('แถบแบ่งช่อง', body, title='แถบแบ่งช่อง')
s25.append('<h3 class="sub-h">5 · แถบแบ่งช่อง SegmentedControl ทั้งแอป — แบบ B (แก้ที่ src/ui/form.tsx ที่เดียว ทั้ง 14 ไฟล์)</h3>' + pair(
    fig('p16-before', segg(False), 'ก่อน · แถบวงรี', 'เทียบรูปทรงเท่านั้น: ทั้งแถบและช่องในแถบเป็นวงรี', 'SegmentedControl 14 ไฟล์', 'no'),
    fig('p16-after', segg(True), 'หลัง · มุมมน ไม่ใช่วงรี (B)', 'แถบ มุม 12 · ช่อง มุม 8 · ที่เลือกพื้นเข้ม', 'เจ้าของ: "SegmentedControl ทั้งแอป"', 'yes')))
# P12-15 seg callers
def seg_item(pid, label, title_screen, labels, on, builder):
    return builder
def order_stage(new):
    body = (stub([('15-15-15 · 10 กระสอบ', 'ตราใบไม้', '9,500')]) + lab('สถานะของที่สั่ง') + seg(['สั่งไว้', 'ได้ของแล้ว'], 0, old=not new))
    return screen('ใบซื้อ', body, foot='<div class="btn btn-primary">บันทึก' + ic('check') + '</div>', title='ใบซื้อของร้าน')
def rp(new):
    sh = '<h4>ได้เงินสดคืนหนี้เท่าไร</h4>' + lab('เงินอยู่ที่ไหน') + seg(['อยู่กับคนซื้อ', 'คนซื้อให้แดงไปแล้ว'], 0, old=not new) + '<div class="stubcard pad"><span class="lab">จำนวนเงิน (ช่องกรอก ไม่เปลี่ยน)</span><b class="num">2,500.00 บาท</b></div>'
    return screen('ได้เงินคืนหนี้', stub([('ขาย 18 พ.ย.', 'รอเงินสดจากคนซื้อ', '2,500')]), sheet=sh, dim=True, title='บัญชีหนี้ · แดง')
def owed(new):
    body = ('<div class="stubcard pad"><b>สวนค้างจ่ายคนกรีด</b>' + lab('นัด ค้างจ่าย ฿ 640') + seg(['ไว้ก่อน', 'หักกลบกับหนี้'], 1, old=not new) + '</div>')
    return screen('สวนค้างจ่ายคนกรีด', body, title='สรุปจ่ายเงิน', sub='ขั้น 2 จาก 3')
def basis(new):
    sh = '<h4>เข่งไม่เต็ม</h4>' + lab('ใส่น้ำหนักแบบไหน') + seg(['ตาชั่งอ่าน', 'ยางสุทธิ'], 0, old=not new) + '<div class="stubcard pad"><b class="num">35 กก.</b></div>'
    return screen('เข่งไม่เต็ม', '<div class="stubcard pad"><b>เข่ง 12 · จุด 1</b></div>', sheet=sh, dim=True, title='นับเข่ง')
for pid, h, fn, tt, cap in [('p12', '6 · สั่งไว้ / ได้ของแล้ว (ใบซื้อ) — แบบ B', order_stage, 'ซื้อของร้าน › ใต้รายการปุ๋ย', 'order-screen.tsx:311, 372'),
                            ('p13', '7 · อยู่กับคนซื้อ / คนซื้อให้แดงไปแล้ว — แบบ B', rp, 'บัญชีหนี้ › รอเงินสด › ได้น้อยกว่านี้', 'received-sheet.tsx:113, 127'),
                            ('p14', '8 · ไว้ก่อน / หักกลบกับหนี้ — แบบ B', owed, 'สรุปจ่ายเงิน › สวนค้างจ่ายคนกรีด', 'summary-owed-sheet.tsx:66'),
                            ('p15', '9 · ตาชั่งอ่าน / ยางสุทธิ — แบบ B', basis, 'เข่งไม่เต็ม (แบบหน้าปัด)', 'short-reading.tsx:31-42')]:
    s25.append(f'<h3 class="sub-h">{h}</h3>' + pair(fig(pid + '-before', fn(False), 'ก่อน · แถบวงรีพื้นเต็ม', tt, cap, 'no'), fig(pid + '-after', fn(True), 'หลัง · มุมมน (B)', 'รูปเดิม แค่เปลี่ยนมุม · ป้ายบรรทัดของตัวเอง', 'เจ้าของ: "ข้อนี้ B"', 'yes')))
secs.append('<section class="sec" id="s25"><h2>2 · E01-S25 · ส่วนประกอบที่ใช้ร่วม (แก้ที่เดียว เปลี่ยนหลายหน้า)</h2><p>ChoiceChip / PayerPicker · ToggleChip · DatePickerSheet · SegmentedControl · และแบบใหม่ I · ทุกภาพ "ก่อน" วาดจากของจริง แล้วเทียบ "หลัง"</p>' + ''.join(s25) + '</section>')

# =============== SECTION 3: E01-S26 per screen ===============
s26 = []
# P2 expense filter
def expfilter(new):
    if new:
        flt = ('<div class="tiles c2">' + vb('วงจร', 'ทั้งหมด') + vb('หมวด', 'ปุ๋ย', on=True) + vb('สวน', 'ทุกสวน') + vb('เดือน', 'พ.ย. 69') + '</div>' +
               tilesF(['ยังไม่บันทึกผู้จ่าย', 'ยังไม่คืนผู้จ่าย'], 1, on=(1,)))
    else:
        flt = op(['วงจร ▾', 'หมวด: ปุ๋ย ▾', 'สวน ▾', 'เดือน ▾', 'ยังไม่บันทึกผู้จ่าย', 'ยังไม่คืนผู้จ่าย', 'ล้าง ✕'], on=(1, 5))
    body = lab('ตัวกรอง') + flt + stub([('ค่าปุ๋ย 15-15-15', '1 ธ.ค. · เงินสวน', '9,500'), ('ค่าแรงตัดหญ้า', '28 พ.ย. · แดง', '1,200'), ('น้ำมัน', '25 พ.ย. · นัด', '640')])
    return screen('ค่าใช้จ่ายทั้งหมด', body, title='ค่าใช้จ่ายทั้งหมด')
s26.append('<h3 class="sub-h">1 · ตัวกรองหน้า "ค่าใช้จ่ายทั้งหมด" — E (4 ช่อง ▾) + F (2 ตัวเปิด/ปิด)</h3>' + pair(
    fig('p2-before', expfilter(False), 'ก่อน · 7 ปุ่มวงรี ห่อหลายบรรทัด', 'หน้า ค่าใช้จ่ายทั้งหมด', 'expenses-screen.tsx (16 จุด)', 'no'),
    fig('p2-after', expfilter(True), 'หลัง · ช่องแสดงค่า 2×2 + ช่องติ๊ก 2 อัน', 'เห็นค่าที่กรองอยู่ทุกช่อง · "ล้างตัวกรอง" ไปเป็นลิงก์ขีดเส้นใต้ (H) เมื่อมีตัวกรอง', 'เจ้าของ: "เปลี่ยนตามที่เสนอ (E)"', 'yes')))
# P3 debt filter
def debtfilter(new):
    f = ['ทั้งหมด', 'เงินยืม/เบิกล่วงหน้า', 'ค่าปุ๋ย', 'อื่น ๆ', 'หักหนี้', 'จ่ายคืน']
    body = ('<div class="stubcard pad"><b>นัด ค้างสวน 8,350.00 บาท</b></div>' + lab('ประวัติ') + (tilesF(f, 2, on=(0,)) if new else op(f, on=(0,))) +
            stub([('ค่าปุ๋ย', '5 ต.ค.', '7,350'), ('เงินยืม', '20 ต.ค.', '1,000')]))
    return screen('บัญชีหนี้ › ประวัติ', body, title='บัญชีหนี้', sub='นัด')
s26.append('<h3 class="sub-h">2 · ตัวกรอง "ประวัติ" ในบัญชีหนี้ของคน — แบบ F (6 ช่อง 2×3 · เจ้าของ 2026-11-20: ที่เหลือใช้ F)</h3>' + pair(
    fig('p3-before', debtfilter(False), 'ก่อน · 6 ปุ่มวงรี', 'บัญชีหนี้ › นัด › ประวัติ', 'debts-screens.tsx:318', 'no'),
    fig('p3-after', debtfilter(True), 'หลัง · ช่องมีกล่องติ๊ก 2 ต่อแถว (F)', 'ชื่อยาว "เงินยืม/เบิกล่วงหน้า" ขึ้นบรรทัดใหม่ในช่อง', 'เจ้าของ: "ที่เหลือใช้ F"', 'yes')))
# P4 C vs I
def tgfarm(kind):
    farms = ['จันทเขลม', 'บ้านบน']
    if kind == 'C':
        sel = '<div class="stubcard">' + ''.join(f'<div class="radio sm{" on" if i == 0 else ""}"><span class="dot"></span><span>{t}</span></div>' for i, t in enumerate(farms)) + '</div>'
    else:
        sel = tilesI(farms, 2, on=(0,))
    body = ('<div class="stubcard pad"><span class="lab">ชื่อจุด</span><b>จุด 7</b></div>' +
            '<div class="stubcard pad">' + lab('สวน') + sel + '</div>')
    return screen('เพิ่มจุดชั่ง', body, foot='<div class="btn btn-primary">บันทึก' + ic('check') + '</div>', title='เพิ่มจุดชั่ง')
def tgtap(kind):
    ppl = ['แดง', 'นัด', 'อ.สมหวัง']
    if kind == 'C':
        sel = '<div class="stubcard">' + ''.join(f'<div class="radio sm{" on" if i == 1 else ""}"><span class="dot"></span><span>{t}</span></div>' for i, t in enumerate(ppl)) + '</div>'
    else:
        sel = tilesI(ppl, 2, on=(1,))
    sh = '<h4>วางแผนเปลี่ยนคนกรีดยาง</h4>' + lab('เลือกคนกรีดยางคนใหม่') + sel
    return screen('วางแผนเปลี่ยนคนกรีด', '<div class="stubcard pad"><b>จุด 1 · จันทเขลม</b><span class="lab">คนกรีดตอนนี้: แดง</span></div>', sheet=sh, dim=True, title='จุด 1')
s26.append('<h3 class="sub-h">3 · เลือกสวน / คนกรีด ในหน้าจุดชั่ง — <u>คำถามถึงเจ้าของ</u>: C หรือ I (เจ้าของตอบ C แต่ขอดูก่อน เพราะอาจดูซ้อนในกรอบ)</h3><div class="q">ซ้าย = C (แถว + วงเลือก) · ขวา = I (ช่องเท่ากัน + ✓) · วาดในกรอบการ์ดเดิมของหน้า เพื่อดูว่า "ซ้อน" ไหม · ข้อนี้ยังเป็นคำถาม รอเจ้าของเลือก</div>' + pair(
    fig('p4-farm-c', tgfarm('C'), 'C · แถว + วงเลือก (เพิ่มจุดชั่ง › สวน)', 'แถวอยู่ในกรอบการ์ด', 'points-screens.tsx:269', ''),
    fig('p4-farm-i', tgfarm('I'), 'I · ช่องเท่ากัน + ✓ (เพิ่มจุดชั่ง › สวน)', 'ช่องอยู่ในกรอบการ์ดเดียวกัน', 'points-screens.tsx:269', '')) + pair(
    fig('p4-tap-c', tgtap('C'), 'C · แถว (วางแผนเปลี่ยนคนกรีด)', 'แผ่นล่าง แถวเดียวต่อคน', 'points-screens.tsx:511', ''),
    fig('p4-tap-i', tgtap('I'), 'I · ช่องเท่ากัน + ✓ (วางแผนเปลี่ยนคนกรีด)', 'แผ่นล่าง 3 ช่อง', 'points-screens.tsx:511', '')))
# P5 people filter
def people(kind):
    rows = stub([('แดง', 'คนกรีดยาง', ''), ('นัด', 'คนกรีดยาง', ''), ('อ.สมหวัง', 'ผู้จัดการสวน', '')])
    if kind == 'before':
        body = op(['ทุกคน', 'เจ้าของสวน', 'ผู้จัดการสวน', 'ผู้ช่วยสวน', 'คนกรีดยาง', 'คนงาน', 'คนรับซื้อยาง'], on=(4,)) + rows
        return screen('หน้า คน', body, title='ข้อมูลคนงาน')
    if kind == 'closed':
        return screen('หน้า คน', lab('แสดง') + vb('กลุ่มคน', 'คนกรีดยาง') + rows, title='ข้อมูลคนงาน')
    sh = '<h4>แสดงคนกลุ่มไหน</h4><div class="stubcard">' + ''.join(f'<div class="radio sm{" on" if i == 4 else ""}"><span class="dot"></span><span>{t}</span></div>' for i, t in enumerate(['ทุกคน', 'เจ้าของสวน', 'ผู้จัดการสวน', 'ผู้ช่วยสวน', 'คนกรีดยาง', 'คนงาน', 'คนรับซื้อยาง'])) + '</div>'
    return screen('หน้า คน', lab('แสดง') + vb('กลุ่มคน', 'คนกรีดยาง', on=True) + rows, sheet=sh, dim=True, title='ข้อมูลคนงาน')
s26.append('<h3 class="sub-h">4 · ตัวกรองหน้า "คน" — แบบ E (ช่องเดียว ▾ เปิดแผ่นรายการ)</h3>' + pair(fig('p5-before', people('before'), 'ก่อน · 7 ปุ่มวงรี กิน 3 แถว', 'หน้า คน', 'people-screens.tsx:151', 'no'), fig('p5-after', people('closed'), 'หลัง · ช่องเดียว "กลุ่มคน: คนกรีดยาง ▾"', 'รายชื่อขึ้นมาสูงขึ้น', 'เจ้าของ: "เปลี่ยนตามที่เสนอ (E)"', 'yes')) + pair(
    fig('p5-after-open', people('open'), 'หลัง · แตะแล้วเปิดแผ่น (รายการเป็นแถว)', 'แถวละกลุ่ม แตะแถว = เลือกและปิดแผ่น (กฎข้อ 12)', 'people-screens.tsx', 'yes'), ''))
# P6 roles
def roles(new):
    items = ['เจ้าของสวน', 'ผู้จัดการสวน', 'ผู้ช่วยสวน', 'คนกรีดยาง', 'คนงาน', 'คนรับซื้อยาง']
    body = '<div class="stubcard pad"><span class="lab">ชื่อ</span><b>ตัวอย่าง คนใหม่</b></div>' + lab('บทบาท', 'เลือกได้หลายอัน') + (tilesF(items, 2, on=(3,)) if new else op(items, on=(3,)))
    return screen('เพิ่มคน', body, foot='<div class="btn btn-primary">บันทึก' + ic('check') + '</div>', title='เพิ่มคน')
s26.append('<h3 class="sub-h">5 · "บทบาท" ในหน้าเพิ่มคน — แบบ F</h3>' + pair(fig('p6-before', roles(False), 'ก่อน · ปุ่มวงรี', 'เพิ่มคน › บทบาท', 'people-screens.tsx:301, 304', 'no'), fig('p6-after', roles(True), 'หลัง · ช่องมีกล่องติ๊ก 2 ต่อแถว (F)', 'หลายอัน จึงมีกล่องติ๊ก · บทบาทอื่น ๆ ที่เพิ่มเอง ก็เป็นช่องแบบเดียวกัน', 'เจ้าของ: "เปลี่ยนตามที่เสนอ (F)"', 'yes')))
# P8 prep time (I)
def preptime(new):
    t = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00']
    old = ['06:00', '07:00', '08:00', '09:00', '10:00', '13:00', 'ไม่ระบุเวลา']
    if new:
        sh = '<h4>กี่โมง</h4>' + tilesF(t, 3, on=(2,)) + '<div class="tiles c1"><span class="tl dash">กำหนดเอง</span></div>'
    else:
        sh = '<h4>กี่โมง</h4>' + op(old, on=(2,))
    return screen('เตรียมขาย › กี่โมง', stub([('วันที่', 'พรุ่งนี้', '')]), sheet=sh, dim=True, title='เตรียมการขาย')
def preptime_i():
    t = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00']
    sh = '<h4>กี่โมง</h4>' + tilesI(t, 3, on=(2,)) + '<div class="tiles c1"><span class="tl dash">กำหนดเอง</span></div>'
    return screen('เตรียมขาย › กี่โมง', stub([('วันที่', 'พรุ่งนี้', '')]), sheet=sh, dim=True, title='เตรียมการขาย')
def preptime_custom():
    def col(items):
        return '<div class="wcol">' + ''.join(f'<span class="wi{" sel" if k == 2 else (" n1" if k in (1, 3) else "")}">{v}</span>' for k, v in enumerate(items)) + '</div>'
    sh = ('<h4>กำหนดเวลาเอง</h4>'
          '<div class="wheel">' + col(['08', '09', '10', '11', '12']) + '<span class="wsep">:</span>' + col(['30', '45', '00', '15', '30']) + '</div>'
          '<div class="btn btn-primary">ตกลง · 10:00</div>')
    return screen('เตรียมขาย › กำหนดเวลาเอง', stub([('วันที่', 'พรุ่งนี้', '')]), sheet=sh, dim=True, title='เตรียมการขาย')
s26.append('<h3 class="sub-h">6 · เวลา ในแผ่น "กี่โมง" (เตรียมขาย) — แบบ F · 08:00–13:00 ทุกชั่วโมง 6 ช่อง + "กำหนดเอง"</h3><div class="q">เจ้าของตอบ (20 พ.ย. 2569 16:04 เวลาไทย): "เลือกเวลานัด เอาเป็น 8:00 และ ทุกๆ 1 ชั่วโมง ไปจนถึง 13:00 จะได้ 6 ช่องเดิมพอดี และเปลี่ยนปุ่ม ไม่ระบุเวลา เป็นกำหนดเอง" · เจ้าของสั่งเพิ่ม (21 พ.ย. 2569 ประมาณ 09:05 เวลาไทย): \"ใช้เป็นแบบเลื่อนๆขึ้นลงเลือก hour กับเวลาได้เลย เวลาขอใช้แค่ 00 15 30 45 … ไม่ใช่เอาไว้ default เป็นสัก 10 โมง\" → ช่อง "กำหนดเอง" เปิดแผ่นเลื่อนเลือก ชม./นาที (ภาพขวาสุด) · ไม่มี "ไม่ระบุเวลา" แล้ว เวลาว่างไม่ได้ · ค่าตั้งต้น 10:00 (ลีดอ่านว่า \"ไม่ใช่\" = ไม่ให้เว้นว่าง)</div>' + pair(
    fig('p8-before', preptime(False), 'ก่อน · ปุ่มวงรี 6 เวลา + ไม่ระบุเวลา', 'เตรียมขาย › วันที่ › กี่โมง', 'prepare-screen.tsx:150-166', 'no'),
    fig('p8-after', preptime(True), 'หลัง · 6 ช่องมีกล่องติ๊ก (F) + "กำหนดเอง"', '08:00–13:00 ทุกชั่วโมง · "กำหนดเอง" เป็นปุ่มขอบประ (เปิดแผ่นพิมพ์เวลา) ไม่ใช่ตัวเลือก', 'เจ้าของ: "ที่เหลือใช้ F" + 8:00–13:00', 'yes') +
    fig('p8-after-i', preptime_i(), 'ถ้าเจ้าของยืนยัน "แบบ I" ที่ตอบไว้ข้อ r2-prep-time · 6 ช่องมีวง radio', 'เทียบกับ F ซ้าย: เวลาเดียวกัน ต่างที่วงกลม (I) กับกล่อง (F) · ลีดอ่านคำตอบ ข ว่าทุกตัวที่เหลือ = F จึงวาดทั้งสองให้เจ้าของเลือก', 'ทีมวาดไว้เทียบ', 'team') +
    fig('p8-custom', preptime_custom(), 'แตะ "กำหนดเอง" → แผ่นพิมพ์เวลา', 'ตามที่เจ้าของสั่ง: แผ่นเลื่อนขึ้น-ลงเลือกชั่วโมง กับ นาที (นาทีมีแค่ 00 · 15 · 30 · 45) ค่าตั้งต้น 10:00 · ตกลง = บันทึก · <b>หน้าตาแผ่นเป็นข้อเสนอของทีม</b>', 'ทีมเสนอ', 'team')))
# P9 co-ask (I)
def coask(new):
    def card(q, a):
        if new:
            ch = tilesF(['ไม่มี', '+ มี · จดหนี้'], 2, on=((0,) if a == 0 else ()))
        else:
            ch = '<div class="ops"><span class="op" style="flex:1">ไม่มี</span><span class="op" style="flex:1">+ มี · จดหนี้</span></div>'
        return f'<div class="stubcard pad"><b>{q}</b>{ch}</div>'
    body = card('มีหนี้ค้างของคนกรีดไหม', 0) + card('สวนค้างจ่ายคนกรีดไหม', 9)
    return screen('สรุปจ่ายเงิน', body, title='สรุปจ่ายเงิน', sub='ขั้น 2 จาก 3')
s26.append('<h3 class="sub-h">7 · "ไม่มี / + มี · จดหนี้" ในการ์ดถาม (สรุปจ่ายเงิน) — แบบ F</h3>' + pair(fig('p9-before', coask(False), 'ก่อน · ปุ่มครึ่งจอทรงวงรี', 'สรุปจ่ายเงิน (ยังไม่มีใครมีหนี้)', 'summary-cards.tsx:74-86', 'no'), fig('p9-after', coask(True), 'หลัง · 2 ช่องมีกล่องติ๊ก (F)', 'การ์ดบน: ตอบ "ไม่มี" · การ์ดล่าง: ยังไม่ตอบ · F ไม่มีสีตามความหมาย', 'เจ้าของ: "ที่เหลือใช้ F"', 'yes')))
# P10 plan buttons (H)
def planbtn(new):
    if new:
        body = ('<div class="stubcard pad"><b>จุด 1 · จันทเขลม</b></div>' + lab('แผนเปลี่ยนคนกรีด') +
                '<div class="hrow"><span class="grow"><b>แผน: นัด เริ่ม 1 ธ.ค. 69</b><small>แตะเพื่อแก้แผน</small></span><span class="go">' + ic('chev') + '</span></div><span class="ulink">ยกเลิกแผน</span>')
    else:
        body = ('<div class="stubcard pad"><b>จุด 1 · จันทเขลม</b></div>' + lab('แผนเปลี่ยนคนกรีด') + '<div class="stubcard pad"><b>แผน: นัด เริ่ม 1 ธ.ค. 69</b><div class="ops"><span class="op" style="flex:1">แก้แผน</span><span class="op" style="flex:1">ยกเลิกแผน</span></div></div>')
    return screen('จุด 1 › แผน', body, title='จุด 1')
s26.append('<h3 class="sub-h">8 · "แก้แผน / ยกเลิกแผน" ใต้แผนเปลี่ยนคนกรีด — แบบ H</h3>' + pair(fig('p10-before', planbtn(False), 'ก่อน · 2 ปุ่มวงรีมีขอบ', 'จุด 1 › แผนเปลี่ยนคนกรีด', 'points-screens.tsx:329-340', 'no'), fig('p10-after', planbtn(True), 'หลัง · แถวกดได้ + › และลิงก์ขีดเส้นใต้ (H)', 'เป็นคำสั่ง ไม่ใช่ตัวเลือก', 'เจ้าของ: "เปลี่ยนตามที่เสนอ (H)"', 'yes')))
# P11 history filter
def hist(kind):
    rows = stub([('เข่ง 12', 'จุด 1 · แดง', '50 กก.'), ('เข่ง 11', 'จุด 1 · แดง', '50 กก.'), ('เข่ง 10', 'จุด 2 · นัด', '35 กก.')])
    if kind == 'before':
        body = op(['ทั้งหมด', 'เต็ม', 'ไม่เต็ม'], on=(0,)) + op(['ทุกคน', 'แดง', 'นัด', 'อ.สมหวัง']) + rows
    elif kind == 'b-e':
        body = ('<div class="tiles c2" style="grid-template-columns: minmax(0,1.6fr) minmax(0,1fr);">' +
                '<div style="display:grid;gap:4px;min-width:0">' + lab('คนกรีด') + seg(['ทุกคน', 'แดง', 'นัด'], 0) + '</div>' +
                '<div style="display:grid;gap:4px;min-width:0">' + lab('เข่ง') + vb('', 'ทั้งหมด') .replace('<small></small>', '') + '</div></div>' + rows)
    else:
        body = ('<div class="tiles c2">' + '<div style="display:grid;gap:4px;min-width:0">' + lab('คนกรีด') + vb('', 'ทุกคน').replace('<small></small>', '') + '</div>' +
                '<div style="display:grid;gap:4px;min-width:0">' + lab('เข่ง') + vb('', 'ทั้งหมด').replace('<small></small>', '') + '</div></div>' + rows)
    return screen('รายการเข่ง', body, title='รายการเข่ง')
s26.append('<h3 class="sub-h">9 · ตัวกรองหน้า "รายการเข่ง" — คนกรีดเป็นแบบ B ขึ้นก่อน เข่งเป็นแบบ E อยู่บรรทัดเดียวกัน · คนกรีดเยอะเกินจอ → E ทั้งสอง</h3>' + pair(
    fig('p11-before', hist('before'), 'ก่อน · แถบวงรีพื้นเต็ม 2 แถว', 'รายการเข่ง', 'history-screen.tsx:68-79', 'no'),
    fig('p11-after', hist('b-e'), 'หลัง · B (คนกรีด) + E (เข่ง) บรรทัดเดียวกัน', 'คนกรีดไม่เกิน 3 คนและจอพอ · ป้ายแต่ละช่องอยู่บรรทัดของมันเหนือช่อง', 'เจ้าของ: "คนกรีดแบบ B ส่วนเข่งแบบ E"', 'yes')) + pair(
    fig('p11-after-many', hist('e-e'), 'หลัง · คนกรีดเยอะ → E ทั้งสอง', 'เกณฑ์สลับ: ชื่อคนกรีดรวมกว้างเกินแถบ หรือมีเกิน 3 คน หรือตัวอักษรใหญ่ → ทั้งสองเป็น E', 'เจ้าของ: "ถ้าล้น ให้ทำเป็น E ทั้งสองอัน"', 'yes'), ''))
# P17 cash pills (H)
def cash(new):
    if new:
        body = ('<div class="stubcard pad"><b>จัดเงินสดกับคนรับซื้อยาง</b>' + lab('โอนเข้าบัญชีสวน') +
                '<div class="hrow"><span class="grow"><b>บัญชีออมทรัพย์ ธ.กรุงเทพ</b><small>แตะเพื่อเปลี่ยนบัญชี</small></span><span class="go">' + ic('chev') + '</span></div>' +
                lab('เงินสดที่แดง') + '<div class="hrow"><span class="grow"><b>แดง · หยิบจากเงินคนกรีด</b><small style="color:var(--color-warn);font-weight:700">ต้องแตกเงิน · แตะเพื่อจัดแบงก์</small></span><span class="go">' + ic('chev') + '</span></div></div>')
    else:
        body = ('<div class="stubcard pad"><b>จัดเงินสดกับคนรับซื้อยาง</b>' + lab('โอนเข้าบัญชีสวน') +
                '<div class="stubrow" style="border:0;padding:0"><span class="grow"><b>บัญชีออมทรัพย์ ธ.กรุงเทพ</b></span><span class="op" style="min-width:0">เปลี่ยน ›</span></div>' +
                lab('เงินสดที่แดง') + '<div class="stubrow" style="border:0;padding:0"><span class="grow"><b>แดง</b></span><span class="op dash" style="min-width:0;background:var(--color-warn-sunk);color:var(--color-warn)">ต้องแตกเงิน</span></div></div>')
    return screen('จัดเงินสด', body, title='จัดเงินสด')
s26.append('<h3 class="sub-h">10 · "เลือก › / เปลี่ยน ›" และ "ต้องแตกเงิน" (จัดเงินสด) — แบบ H</h3>' + pair(fig('p17-before', cash(False), 'ก่อน · ปุ่มวงรีท้ายแถว และป้ายวงรีพื้นอ่อน', 'สรุปจ่ายเงิน › จัดเงินสดกับคนรับซื้อยาง', 'cash-account.tsx:64 · cash-screen.tsx:162', 'no'), fig('p17-after', cash(True), 'หลัง · ทั้งแถวกดได้ + › · คำเตือนเป็นข้อความในแถว', 'ไม่มีปุ่มวงรี', 'เจ้าของ: "เปลี่ยนตามที่เสนอ (H)"', 'yes')))
s26.append('<h3 class="sub-h">11 · ป้าย "ค่าตาชั่ง · พิมพ์" / "คำนวณให้" (เข่งไม่เต็ม) — <u>คงไว้</u></h3><div class="q">เจ้าของตอบ "keep": เป็นป้ายบอกว่าช่องไหนกำลังพิมพ์ กดไม่ได้ ไม่ใช่ปุ่มเลือก · ไม่เปลี่ยน ไม่วาดซ้ำ</div>')
secs.append('<section class="sec" id="s26"><h2>3 · E01-S26 · แยกตามหน้า</h2><p>ทุกข้อ: ภาพ "ก่อน" วาดจากของจริง (ภาพถ่ายจริงของแต่ละหน้าอยู่บนแดชบอร์ด) · "หลัง" ตามคำตอบเจ้าของ · ข้อ 3 เป็นคำถามที่ยังเปิด</p>' + ''.join(s26) + '</section>')

html = head + EXTRA_CSS.join(['', '']) + sprite + '<div class="wrap">' + HEADER + ''.join(secs) + '</div>\n</body>\n</html>\n'
# EXTRA_CSS must live in <head>: put it before </head>
html = head.replace('</head>', EXTRA_CSS + '</head>') + sprite + '<div class="wrap">' + HEADER + ''.join(secs) + '</div>\n</body>\n</html>\n'
open(OUT, 'w', encoding='utf-8').write(html)
print('wrote', OUT, len(html))
