#!/usr/bin/env python3
"""docs/ux/mockups/e05-s12-tapper-money.html — E05-S12 from the head + icon sprite of flow-sale-v1.1.0.html (page 16)."""
import re
BASE = 'docs/ux/mockups/flow-sale-v1.1.0.html'
OUT = 'docs/ux/mockups/e05-s12-tapper-money.html'
src = open(BASE, encoding='utf-8').read()
head = '<!doctype html>\n<html lang="th">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n' + src[:src.index('<svg width="0"')]
head = re.sub(r'<title>.*?</title>', '<title>E05-S12 · ยอดเงินต่อคนกรีดในหน้าตรวจยอด (ร่าง)</title>', head, flags=re.S)
sprite = src[src.index('<svg width="0" height="0"'):src.index('<div class="wrap">')]

CSS = """
<style>
/* ===== E05-S12 · tapper money line (tokens only) ===== */
.kgcol { display: flex; flex-direction: column; align-items: flex-end; flex: none; text-align: right; }
.kgcol .kg { font-size: 20px; font-weight: 700; line-height: 1.2; font-variant-numeric: tabular-nums; }
.kgcol .bt { font-size: 16px; font-weight: 700; line-height: 1.3; font-variant-numeric: tabular-nums; color: var(--color-ink); }
.pt { padding: 8px 0 2px 4px; display: grid; gap: 2px; }
.pt .r { display: flex; justify-content: space-between; gap: 12px; font-size: 14px; font-variant-numeric: tabular-nums; }
.pt .r.h { color: var(--color-ink); }
.pt .r.h b { font-weight: 700; }
.pt .r.s { padding-left: 24px; color: var(--color-ink-soft); }
.pt .r.s span:first-child { font-weight: 600; flex: 1; min-width: 0; }
.tcard { padding: 4px 12px; }
.tcard .tp { padding: 8px 0; }
.tcard .tp + .tp { border-top: 1px solid var(--color-rule-faint); }
.tcard .hd { display: flex; align-items: center; gap: 12px; }
.tcard .hd .grow { flex: 1; min-width: 0; }
.tcard .hd .nm { font-weight: 700; display: block; }
.tagno, .tagyes { display: inline-block; font-size: 12px; font-weight: 700; padding: 1px 8px; border-radius: var(--r-pill); margin-bottom: 4px; }
.tagno { background: var(--color-reject-sunk); color: var(--color-reject); }
.tagyes { background: var(--color-accept-sunk); color: var(--color-accept); }
.pairs { display: flex; flex-wrap: wrap; justify-content: center; gap: 28px 16px; align-items: flex-start; }
.phone.p390 { width: 410px; max-width: 100%; }
.phone.p320 { width: 340px; max-width: 100%; }
/* text size L = 1.125 of M (tokens.textScale) */
.phone.big .body { zoom: 1.125; }
.phone.long, .phone.long .screen { height: auto; }
.phone.long .body { overflow: visible; }
.pg-note { max-width: 720px; margin: 8px auto; font-size: 14px; color: var(--color-ink-soft); }
.tbl { width: 100%; border-collapse: collapse; font-size: 14px; }
.tbl th, .tbl td { text-align: left; vertical-align: top; padding: 6px 8px; border-bottom: 1px solid var(--color-rule-faint); }
</style>
"""

def ic(n): return f'<svg class="ic"><use href="#i-{n}"/></svg>'
def sbar(): return f'<div class="sbar num"><span>10:15</span><span>{ic("signal")} {ic("battery")}</span></div>'
def appbar(): return f'<div class="appbar"><span class="iconbtn">{ic("back")}</span><h3>ตรวจยอดกับคนรับซื้อยาง<small class="num">การขาย 20 พ.ย. 2569</small></h3><span class="pill p-ok">{ic("cloud-ok")}ซิงก์แล้ว</span></div>'

def top_card(done):
    foot = (f'<div style="margin-top:8px"><span class="chip ch-ok">{ic("check")}ตรงกัน</span></div>' if done else
            f'<div class="btn btn-primary" style="margin-top:8px">{ic("check")}ตรงกันทั้งหมด</div><div class="btn btn-secondary small" style="width:100%;margin-top:8px">ไม่ตรงกัน</div>')
    return ('<div class="card">'
        '<div style="font-size:18px;font-weight:700;margin-bottom:2px">คนรับซื้อยางได้ยอดเท่านี้ไหม?</div><h4>ยอดที่คำนวณได้ทั้งหมด</h4>'
        '<div class="kv"><span>น้ำหนัก</span><span class="num"><b>7,694 กก.</b></span></div>'
        '<div class="kv"><span>ราคา</span><span class="num"><b>40.00 ฿/กก.</b></span></div>'
        '<div class="kv"><span>จำนวนเข่ง</span><span class="num"><b>155 เข่ง</b></span></div>'
        '<div class="kv"><span>เข่งไม่เต็ม (2 เข่ง)</span><span class="num"><b>44 กก.</b></span></div>'
        '<div class="kv muted" style="padding-left:12px"><span>จันทเขลม จุด 2 · เข่ง 120 · นายแดง</span><span class="num">33 กก.</span></div>'
        '<div class="kv muted" style="padding-left:12px"><span>จันทเขลม จุด 1 · เข่ง 35 · นายนัด</span><span class="num">11 กก.</span></div>'
        '<div class="kv total"><span><b>ยอดเงิน (บาท)</b></span><span class="fig" style="font-size:26px">307,760.00</span></div>'
        f'<span class="mi" style="margin-top:6px">{ic("users")}คนรับซื้อยาง ก</span>' + foot + '</div>')

def tapper(tile, name, kg, money, point, full, short, after):
    right = (f'<span class="kgcol"><span class="kg">{kg}</span><span class="bt">{money}</span></span>' if after
             else f'<span class="kgcol"><span class="kg">{kg}</span></span>')
    return (f'<div class="tp"><div class="hd"><span class="tile sm {tile}">{ic("tapper")}</span>'
            f'<span class="grow"><span class="nm">{name}</span><span class="mi">{ic("pin")}1 จุด</span></span>{right}</div>'
            f'<div class="pt"><div class="r h"><span>{point}</span><b>{kg}</b></div>'
            f'<div class="r s"><span>เต็ม {full[0]} เข่ง</span><span>{full[1]} กก.</span></div>'
            f'<div class="r s"><span>ไม่เต็ม 1 เข่ง</span><span>{short} กก.</span></div></div></div>')

def tappers(after):
    return ('<div class="card tcard">' +
            tapper('t-cat4', 'นายนัด', '1,711 กก.', '฿68,440.00', 'จุด 1', (34, '1,700'), '11', after) +
            tapper('t-cat3', 'นายแดง', '5,983 กก.', '฿239,320.00', 'จุด 2', (119, '5,950'), '33', after) + '</div>')

def phone(pid, cls, after, done=False, tag=''):
    scr = (f'<div class="screen" aria-label="ตรวจยอดกับคนรับซื้อยาง">{sbar()}{appbar()}'
           f'<div class="body" style="gap:10px">{top_card(done)}{tappers(after)}</div></div>')
    return f'<div class="phone long {cls}" id="{pid}">{scr}</div>'

def fig(pid, cls, after, title, cap, done=False, tag=''):
    tg = {'no': '<span class="tagno">ของเดิม</span>', 'yes': '<span class="tagyes">ใหม่ตามที่ตกลง</span>', '': ''}[tag]
    return (f'<figure class="step" style="width:auto">{tg}{phone(pid, cls, after, done)}'
            f'<figcaption><span class="t">{title}</span>{cap}</figcaption></figure>')

HEADER = """
<header class="hdr">
  <h1>E05-S12 · ยอดเงินของแต่ละคนกรีดในหน้าตรวจยอด (ร่าง)</h1>
  <p>ตั้งต้นจากหน้า 16 ของ <code>flow-sale-v1.1.0.html</code> (CSS และไอคอนเดียวกัน) แล้วปรับให้ตรงหน้าจริงบน preview · ภาพนิ่ง ไม่ใช่ต้นแบบที่กดได้</p>
  <p>ตัวเลขทั้งหมดเป็นของเจ้าของ (การขาย 20 พ.ย. 2569): นายนัด 1,711 กก. ฿68,440.00 · นายแดง 5,983 กก. ฿239,320.00 · รวม 7,694 กก. ฿307,760.00 ที่ราคา 40.00 ฿/กก.</p>
  <p>คำของเจ้าของ (แชตลีด 2026-11-20): "ในการ์ดคนกรีด แต่ยอดราคา อยู่คนละบรรรท้ดกับ" (ลีดอ่านว่า อยู่คนละบรรทัดกับ กก.) · รูปตัวเลข "ก · เต็ม ทศนิยม 2" = ฿68,440.00 ไม่ใช่แบบย่อ k/m</p>
</header>
"""

secs = []
secs.append('<section class="sec"><h2>1 · ก่อน / หลัง (390 กว้าง ตัวอักษร M)</h2><div class="pairs">' +
    fig('p-before', 'p390', False, 'ก่อน · ของจริงตอนนี้', 'การ์ดคนกรีดมีแค่ กก. · ยอดเงินมีแต่รวมทั้งการขายในการ์ดบน', tag='no') +
    fig('p-after', 'p390', True, 'หลัง · ยอดเงินอยู่บรรทัดใต้ กก.', 'ในการ์ดคนกรีด ขวาบน: กก. แล้วบรรทัดใหม่ ฿ เต็ม ทศนิยม 2 · ยอดรวมทุกคน = ยอดเงินการ์ดบน (68,440.00 + 239,320.00 = 307,760.00) · ไม่เปลี่ยนการ์ดบน', tag='yes') +
    '</div></section>')
secs.append('<section class="sec"><h2>2 · หลังกด "ตรงกันทั้งหมด" และตอนการขายปิดแล้ว (หน้านี้อ่านอย่างเดียว) · 320 กว้าง ตัวอักษร L</h2><div class="pairs">' +
    fig('p-after-ok', 'p390', True, 'หลัง · ตรวจแล้ว (CK-4)', 'ปุ่มกลายเป็นป้าย "ตรงกัน" · ยอดเงินคนกรีดยังอยู่เหมือนเดิม', done=True, tag='yes') +
    fig('p-after-320l', 'p320 big', True, 'หลัง · 320 กว้าง ตัวอักษร L', 'ต้องไม่มีอะไรถูกตัดหรือ "…" · ยอดเงิน ฿239,320.00 กับชื่อไม่ทับกัน', tag='yes') +
    '</div></section>')
secs.append("""<section class="sec"><h2>ตารางหน้าจอ → story / AC</h2><div class="pg-note"><table class="tbl">
<tr><th>ภาพ</th><th>AC</th></tr>
<tr><td>หลัง 390 M</td><td>CK-1 ยอดเงินต่อคนกรีด · CK-2 คนละบรรทัดกับ กก. · CK-3 รวมเท่ายอดการ์ดบน · CK-5 ไม่เปลี่ยนการ์ดบน</td></tr>
<tr><td>หลัง ตรวจแล้ว</td><td>CK-4 แสดงทั้งก่อนและหลังกด "ตรงกันทั้งหมด" และตอนปิดการขาย</td></tr>
<tr><td>หลัง 320 L</td><td>CK-2 ไม่ตัด ไม่ "…" ที่ 320 ตัวอักษร L</td></tr></table></div></section>""")

html = head + CSS + '</head>\n<body>\n' + sprite + '<div class="wrap">' + HEADER + ''.join(secs) + '</div>\n</body>\n</html>\n'
open(OUT, 'w', encoding='utf-8').write(html)
print('wrote', OUT, len(html))
