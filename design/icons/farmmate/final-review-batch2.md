# FarmMate icons, batch 2: final independent review (48 icons)

Reviewer: independent agent. It had not seen any prior work and did not rely on the manifest's self-reported status.
Date: 2026-10-24/25

## Method
- The 48 SVG masters in this folder were rendered with macOS Quick Look. Copies were padded to a square viewBox, because Quick Look crops non-square SVGs. The masters were not modified.
- Each render was placed side by side with the pre-made `<id>_6x.png` crop of the original sheet, 4 icons per sheet.
- Suspect colours were checked numerically: dominant source pixels against the SVG fills, using ΔE2000.
- `finance.income` and `people.profitShare` were also compared at large size with zoomed crops.
- Limits:
  - I used the pre-made crops, not `references/farmmate-icon-pack.png` directly. That file is outside this worktree, and repo rules require permission to read outside it.
  - Zoomed checks for manager, tapper, tapping, manureFert, expense, buyer, split50 and spray were still rendering when this report was requested. Those 8 were judged only at side-by-side sheet scale.

## Results

### Farmwork (หมวดงานในสวน)
| id | verdict | note |
|---|---|---|
| farmwork.tapping | PASS | |
| farmwork.fertilize | PASS | |
| farmwork.mow | PASS | |
| farmwork.spray | PASS | The body is the duller legend Blue (source is a brighter azure); within the snap rule |
| farmwork.today | PASS | |
| farmwork.calendar | PASS | |
| farmwork.history | PASS | |
| farmwork.maintenance | PASS | |

### Materials (หมวดปุ๋ยและวัสดุ)
| id | verdict | note |
|---|---|---|
| materials.chemFert | PASS | |
| materials.manureFert | PASS | |
| materials.fuel | PASS | |
| materials.pesticide | PASS | |
| materials.stock | PASS | |
| materials.orderMaterials | PASS | |
| materials.materialCost | PASS | |
| materials.costSummary | PASS | |

### Finance (หมวดการเงิน)
| id | verdict | note |
|---|---|---|
| finance.income | **FAIL** | The bag is visibly paler and yellower than the source. The source bag is golden amber (about #FEB82A). The SVG snapped it to Yellow #FECB56 (ΔE 6–8, which is within the rule). This is the paler-amber failure the brief warned about. The bag now looks like the fertilize bag, where the source makes the two clearly different. Fix: keep the measured amber, about #FEB627. The manifest note also says it is "visibly paler than source". |
| finance.expense | PASS | |
| finance.profitCost | PASS | |
| finance.summary | PASS | Note: the source keys are a royal blue (about #0773D3), snapped to azure-ish #1689C7. It reads slightly duller but is acceptable |
| finance.split50 | PASS | |
| finance.workerPay | PASS | |
| finance.otherCost | PASS | |
| finance.financeReport | PASS | |

### Analysis (หมวดข้อมูลและการวิเคราะห์)
| id | verdict | note |
|---|---|---|
| analysis.overview | PASS | |
| analysis.yieldTrend | PASS | |
| analysis.comparePlots | **FAIL** (low) | The source blue bars (about #0177D7, royal) were snapped to #1689C7 at ΔE about 9.97, the edge of the rule. The baseline kept its measured #0358AB. In the source, bars and baseline are one royal-blue family. In the SVG, the bars read as a lighter teal-blue that doesn't match their own baseline, which you notice at a glance. Fix: keep the measured bar blue, about #0572D6. |
| analysis.historyReport | PASS | |
| analysis.worldPrice | PASS | |
| analysis.tradingChart | PASS | The line is slightly duller than the source royal blue (about #0E79D3). Acceptable |
| analysis.costAnalysis | PASS | |
| analysis.saleHistory | PASS | |

### People (หมวดผู้เกี่ยวข้อง)
| id | verdict | note |
|---|---|---|
| people.manager | PASS | |
| people.tapper | PASS | |
| people.buyer | PASS | |
| people.transporter | PASS | |
| people.contacts | PASS | |
| people.commsLog | PASS | |
| people.workerInfo | PASS | |
| people.profitShare | **FAIL** (polish) | It reads as the same handshake, with the right composition and colours. At master scale, though, the edges aren't production-clean. The yellow wrist's upper-left edge is wavy and lumpy, and there is a small notch where it meets the white gap. The lowest yellow fingertip ends in a stubby lobe with a short spur crease. The manifest records two checker FAILs, and the last fix round was self-verified only. Fix: clean up the yellow outline. |

### System (หมวดระบบ)
| id | verdict | note |
|---|---|---|
| system.backup | PASS | |
| system.sync | PASS | |
| system.offline | PASS | |
| system.multiDevice | PASS | |
| system.security | PASS | |
| system.appSettings | PASS | |
| system.about | PASS | |
| system.manual | PASS | |

## Overall verdict
**NOT APPROVED: 45 of 48 pass. 3 need a fix before handoff.**

The set as a whole is a faithful vector version of the source sheet. Silhouettes, proportions, composition and colour families match on every icon, and none is the wrong icon or badly mis-shaped. The 3 failures are narrow:
1. **finance.income**: the bag colour snapped too pale. It should be amber, not butter yellow.
2. **analysis.comparePlots**: the bar blue was snapped at the edge of the rule and no longer matches its own baseline. Keep the measured royal blue.
3. **people.profitShare**: the yellow-hand outline needs a cleanup pass (wavy wrist edge, stub or spur at the lowest fingertip).

Set-wide observation (not a failure): the source uses two blues, a royal blue of about #0575D5 and an azure of about #1695F4. Snapping both to #1689C7 merges them. Calendar, today and materialCost kept their royal blue, while summary, tradingChart and comparePlots were snapped. The owner may want one consistent rule for the royal blue.
