"""Legacy formula/layout generator for the seven-sheet financial model.

After regeneration, run `node recalculate.mjs` and `python3 verify_model.py`.
The raw generator output has formulas without cached results and must not be
submitted until the Artifact Tool recalculation and verification pass.
"""
from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter as L

FONT = "Arial"
BLUE, BLACK, GREEN = "0000FF", "000000", "008000"
HEAD_FILL = PatternFill("solid", fgColor="0E6B70")
KEY_FILL = PatternFill("solid", fgColor="FFFF00")
SUB_FILL = PatternFill("solid", fgColor="E3F1F1")
thin = Side(style="thin", color="DDE3E3")
THB = '#,##0;(#,##0);"-"'
THBM = '#,##0.0,,"M";(#,##0.0,,"M");"-"'
PCT = '0.0%;(0.0%);"-"'
NUM = '#,##0.##;(#,##0.##);"-"'
USD = '$#,##0.00;($#,##0.00);"-"'

wb = Workbook()
names: dict[str, str] = {}


def style(c, color=BLACK, bold=False, fmt=None, fill=None, size=10, wrap=False):
    c.font = Font(name=FONT, color=color, bold=bold, size=size)
    if fmt:
        c.number_format = fmt
    if fill:
        c.fill = fill
    c.alignment = Alignment(vertical="top", wrap_text=wrap)


def header(ws, row, labels, widths=None):
    for i, t in enumerate(labels, 1):
        c = ws.cell(row=row, column=i, value=t)
        c.font = Font(name=FONT, color="FFFFFF", bold=True, size=10)
        c.fill = HEAD_FILL
        c.alignment = Alignment(vertical="center", wrap_text=True)
    if widths:
        for i, w in enumerate(widths, 1):
            ws.column_dimensions[L(i)].width = w


def title(ws, text, sub):
    ws["A1"] = text
    style(ws["A1"], bold=True, size=14)
    ws["A2"] = sub
    style(ws["A2"], color="4A5759", size=9)


# ---------------------------------------------------------------- Assumptions
A = wb.active
A.title = "Assumptions"
title(A, "Assumptions", "Blue = input (edit these). Yellow = key lever. All THB unless stated. Fictional client; planning assumptions for the case.")
header(A, 4, ["Item", "Value", "Unit", "Source / note"], [46, 14, 16, 90])
row = 5


def section(ws, text):
    global row
    c = ws.cell(row=row, column=1, value=text)
    style(c, bold=True, fill=SUB_FILL)
    for col in range(2, 5):
        ws.cell(row=row, column=col).fill = SUB_FILL
    row += 1


def inp(key, label, value, unit, note, fmt=NUM, key_lever=False):
    global row
    A.cell(row=row, column=1, value=label)
    style(A.cell(row=row, column=1))
    c = A.cell(row=row, column=2, value=value)
    style(c, color=BLUE, fmt=fmt, fill=KEY_FILL if key_lever else None)
    A.cell(row=row, column=3, value=unit)
    style(A.cell(row=row, column=3), color="4A5759")
    A.cell(row=row, column=4, value=note)
    style(A.cell(row=row, column=4), color="4A5759", wrap=True)
    names[key] = f"Assumptions!$B${row}"
    row += 1


section(A, "General")
inp("fx", "FX planning rate", 34, "THB per USD", "Planning rate for the case; replace with treasury rate.")
inp("wd", "Working days per month", 21, "days", "")
inp("build_days", "Build working days (12 weeks)", 60, "days", "12 weeks x 5 days")
inp("ld_per_emp", "Current L&D spend per employee", 3300, "THB / yr", "Thai listed-company disclosures 2024: 3,024-4,038 THB per employee (Supalai, Osotspa, TTW sustainability reports). Midpoint used.")

section(A, "Rollout (months from kick-off; build = months 1-3)")
inp("w1", "Wave 1 employees (RD + PK, Thailand)", 12000, "people", "Brief: first group of 12,000 live within 3 months.")
inp("w1m", "Wave 1 go-live month", 4, "month", "Live at end of week 12; billing from month 4.")
inp("w2", "Wave 2 employees (BM + CS + rest of TH)", 15000, "people", "Assumption.")
inp("w2m", "Wave 2 go-live month", 7, "month", "Assumption.")
inp("w3", "Wave 3 employees (CH + 3 ASEAN countries)", 18000, "people", "Brief: rest of company over the next year. Total 45,000.")
inp("w3m", "Wave 3 go-live month", 13, "month", "Assumption: 12 months after wave 1.")

section(A, "AI coach usage")
inp("mau", "Coach monthly active share", 0.45, "of enrolled", "Assumption; frontline on mobile. Track weekly.", PCT, True)
inp("msgs", "Coach messages per active user per month", 12, "messages", "Assumption.", NUM, True)
inp("nudges", "Nudges per enrolled employee per month", 4, "messages", "LINE / in-app; AI-personalised.")
inp("regen", "Path generations per employee per year", 2, "runs", "Initial + one refresh; generated overnight at off-peak rates.")
inp("tok_in", "Coach input tokens per message (uncached)", 2800, "tokens", "Profile ~500 + sources ~1,500 + history ~800.")
inp("tok_cache", "Coach input tokens per message (cached)", 1200, "tokens", "System prompt + framework excerpts, prompt-cached.")
inp("tok_out", "Coach output tokens per message", 450, "tokens", "~120-word answer + light thinking at low effort.")
inp("cls_in", "Classifier input tokens per message", 500, "tokens", "")
inp("cls_out", "Classifier output tokens per message", 80, "tokens", "")
inp("ndg_in", "Nudge input tokens", 600, "tokens", "")
inp("ndg_out", "Nudge output tokens", 100, "tokens", "")
inp("path_in", "Path generation input tokens", 6000, "tokens", "")
inp("path_out", "Path generation output tokens", 2500, "tokens", "")
inp("judge_usd", "Eval and judge sampling per month", 150, "USD / month", "Weekly regression eval + sampled live answers.")

section(A, "Model prices (DeepSeek API list, USD per 1M tokens, Oct 2026)")
inp("c_in", "Coach model input (DeepSeek V4.1 Flash, peak)", 0.30, "USD / 1M", "Production coach on DeepSeek V4.1 Flash (deepseek-flash) if it passes the eval gate. Peak rate: DeepSeek peak hours (01:00-04:00 and 06:00-10:00 UTC, weekdays) are Thai working hours. The live prototype run used SEA-LION v4 (Workers AI, free).", USD, True)
inp("c_out", "Coach model output (DeepSeek V4.1 Flash, peak)", 1.20, "USD / 1M", "", USD, True)
inp("c_cache", "Coach model cache read (DeepSeek V4.1 Flash, peak)", 0.006, "USD / 1M", "Cache-hit input price.", USD)
inp("o_in", "Claude Sonnet 5.5 input (scenario)", 2.0, "USD / 1M", "Comparison scenario on the AI Cost sheet (Anthropic list price); the fallback if Flash fails the Thai quality gate.", USD)
inp("o_out", "Claude Sonnet 5.5 output (scenario)", 10.0, "USD / 1M", "", USD)
inp("o_cache", "Claude Sonnet 5.5 cache read (scenario)", 0.20, "USD / 1M", "", USD)
inp("h_in", "Classifier and nudge model input (DeepSeek Flash, peak)", 0.30, "USD / 1M", "", USD)
inp("h_out", "Classifier and nudge model output (DeepSeek Flash, peak)", 1.20, "USD / 1M", "", USD)
inp("batch", "Off-peak discount (overnight path generation)", 0.5, "", "DeepSeek off-peak rates are half the peak rates; paths are generated overnight Bangkok time.", PCT)
inp("llm_cont", "LLM contingency", 0.3, "", "Retries, growth, price changes, and in-region hosting through a cloud provider priced differently from the DeepSeek API.", PCT)

section(A, "Platform run costs")
inp("infra_fix", "Cloud infrastructure, fixed", 70000, "THB / month", "Dedicated tenant in a Thailand region: app, Postgres + pgvector, Redis, storage, WAF, logs, non-prod.")
inp("infra_var", "Cloud infrastructure, variable", 1.8, "THB / employee / mo", "Assumption.")
inp("line_base", "LINE OA Pro plan", 1780, "THB / month", "LINE for Business TH price list (excl. VAT): 35,000 messages included.")
inp("line_incl", "LINE messages included", 35000, "messages", "")
inp("line_extra", "LINE extra message", 0.06, "THB / message", "Pro plan extra rate.")
inp("frontline", "Frontline share", 0.6, "", "Brief: ~60% frontline, mostly mobile.", PCT)
inp("otp_share", "Frontline users needing SMS OTP per month", 0.1, "", "Fallback for staff without corporate SSO; LINE Login is primary.", PCT)
inp("sms", "SMS OTP cost", 0.5, "THB / SMS", "Assumption; confirm with the client's SMS gateway.")
inp("tool_fix", "Tooling (monitoring, LRS, security scanning)", 30000, "THB / month", "")
inp("tool_var", "Tooling, variable", 0.25, "THB / employee / mo", "")
inp("pentest", "Annual penetration test", 400000, "THB / yr", "Also one at go-live (Build sheet).")
inp("dpia", "DPIA refresh and compliance audit", 200000, "THB / yr", "PDPA; PDPC AI guidance expects DPIA for high-risk AI.")

section(A, "Run team (client-dedicated + platform)")
inp("csm_fte", "Customer success / product owner", 0.5, "FTE", "")
inp("analyst_base", "Skills & content analysts, base", 1, "FTE", "Maintain frameworks, tag new content, review flagged answers.")
inp("analyst_per", "Employees per extra analyst", 30000, "people", "")
inp("support_per", "Employees per L2 support analyst", 25000, "people", "L1 stays with the client's HR helpdesk.")
inp("plat_small", "Platform team up to 20k employees", 2.5, "FTE", "Engineering, AI ops and security on call. Dedicated: this is the platform's first client, so no cost is shared yet.")
inp("plat_large", "Platform team above 20k employees", 3.0, "FTE", "Adds wave 2-3 integrations and the ASEAN languages.")

section(A, "Pricing (levers)")
inp("pepm", "Subscription price per enrolled employee per month", 39, "THB", "Includes platform, hosting, AI coach (fair use), L2 support, framework upkeep.", THB, True)
inp("min_emp", "Minimum committed employees from wave 2", 20000, "people", "Protects unit economics while waves ramp.", THB)
inp("risk_prem", "Fixed-date risk premium on implementation", 0.10, "", "IRIS carries schedule risk on a fixed fee.", PCT, True)
inp("w2_fee", "Wave 2 rollout services (fixed)", 6000000, "THB", "Frameworks for new role families, integrations, change.", THB)
inp("w3_fee", "Wave 3 rollout services (fixed, incl. ASEAN localisation)", 9000000, "THB", "3 languages, local data rules, local content.", THB)
inp("wave_cost", "Wave services delivery cost ratio", 0.5, "of fee", "", PCT)
inp("at_risk", "Share of subscription at risk on adoption KPIs", 0.10, "", "Credited back if adoption KPIs are missed. Base case assumes met.", PCT)

section(A, "Rate card (THB)")
rate_row0 = row
A.cell(row=row, column=1, value="Role")
A.cell(row=row, column=2, value="Cost / month")
A.cell(row=row, column=3, value="Bill / day")
A.cell(row=row, column=4, value="Note")
for col in range(1, 5):
    style(A.cell(row=row, column=col), bold=True)
row += 1
RATES = [
    ("Product & delivery lead", 260000, 28000),
    ("Solution architect", 200000, 22000),
    ("Senior engineer", 160000, 16000),
    ("Engineer", 90000, 9500),
    ("AI engineer", 160000, 16000),
    ("Data & integration engineer", 150000, 16000),
    ("QA engineer", 80000, 8500),
    ("UX/UI designer", 110000, 12000),
    ("DevSecOps engineer", 160000, 16000),
    ("Skills methodology lead", 200000, 22000),
    ("Skills consultant", 140000, 15000),
    ("Content analyst", 70000, 7000),
    ("Change & adoption consultant", 140000, 15000),
    ("Support analyst", 60000, 6000),
]
rate_ref = {}
for name, cost, bill in RATES:
    A.cell(row=row, column=1, value=name)
    style(A.cell(row=row, column=1))
    style(A.cell(row=row, column=2, value=cost), color=BLUE, fmt=THB)
    style(A.cell(row=row, column=3, value=bill), color=BLUE, fmt=THB)
    rate_ref[name] = row
    row += 1
A.cell(row=rate_row0 + 1, column=4, value="Cost = fully loaded monthly cost to IRIS (assumption). Bill rates are about 2x the Thai public-sector consultant reference (PDMO FY2026: developer 3,700-4,960 THB/day, senior consultant 8,410, PM 12,120) and below global-SI rates.")
style(A.cell(row=rate_row0 + 1, column=4), color="4A5759", wrap=True)
A.freeze_panes = "A5"


def N(k):
    return names[k]


def RC(role):
    return f"Assumptions!$B${rate_ref[role]}"


def RB(role):
    return f"Assumptions!$C${rate_ref[role]}"


# ---------------------------------------------------------------- Build
B = wb.create_sheet("Build")
title(B, "Build: 12-week implementation", "IRIS team, cost to IRIS vs price to client. FTE = average over the 12 weeks.")
header(B, 4, ["Role", "FTE (avg)", "Person-days", "Cost to IRIS (THB)", "Price (THB)", "Note"], [34, 11, 13, 18, 18, 60])
TEAM = [
    ("Product & delivery lead", 1.0, "Owns product, scope and delivery; runs the product council."),
    ("Solution architect", 1.0, "Architecture, security review pack, integration design."),
    ("Senior engineer", 2.0, "1 backend + 1 frontend lead."),
    ("Engineer", 2.0, "1 backend + 1 frontend (mobile web / LINE LIFF)."),
    ("AI engineer", 1.0, "Coach, path engine, retrieval, eval harness."),
    ("Data & integration engineer", 2.0, "1 for HR system and sign-in (SSO, LINE Login, OTP); 1 for both LMSs, data model and dashboards."),
    ("QA engineer", 1.5, "From week 2; Thai and English test passes, automation, UAT and the 500-user pilot."),
    ("UX/UI designer", 0.7, "Weeks 1-8; frontline and manager journeys."),
    ("DevSecOps engineer", 1.0, "Week-2 security pack, Thailand landing zone, CI/CD, pen-test fixes, staged go-live."),
    ("Skills methodology lead", 1.0, "IRIS method: frameworks and assessment design."),
    ("Skills consultant", 1.4, "Frameworks for ~18 roles; SME validation (weeks 1-8)."),
    ("Content analyst", 1.0, "Tag ~2 LMS catalogues to skills (AI-assisted, human-checked)."),
    ("Change & adoption consultant", 0.8, "Weeks 4-12: champions, manager briefings, comms."),
]
r0 = 5
for i, (role, fte, note) in enumerate(TEAM):
    r = r0 + i
    B.cell(row=r, column=1, value=role)
    style(B.cell(row=r, column=1))
    style(B.cell(row=r, column=2, value=fte), color=BLUE, fmt=NUM)
    style(B.cell(row=r, column=3, value=f"=B{r}*{N('build_days')}"), fmt=NUM)
    style(B.cell(row=r, column=4, value=f"=C{r}*{RC(role)}/{N('wd')}"), color=BLACK, fmt=THB)
    style(B.cell(row=r, column=5, value=f"=C{r}*{RB(role)}"), fmt=THB)
    style(B.cell(row=r, column=6, value=note), color="4A5759", wrap=True)
rt = r0 + len(TEAM)
B.cell(row=rt, column=1, value="Team total")
style(B.cell(row=rt, column=1), bold=True)
for col, fmt in [(2, NUM), (3, NUM), (4, THB), (5, THB)]:
    style(B.cell(row=rt, column=col, value=f"=SUM({L(col)}{r0}:{L(col)}{rt-1})"), bold=True, fmt=fmt)

r = rt + 2
B.cell(row=r, column=1, value="Third-party and one-off")
style(B.cell(row=r, column=1), bold=True, fill=SUB_FILL)
third = [
    ("Go-live penetration test", 400000),
    ("Cloud and environments during build", 200000),
    ("Content indexing: Thai ASR transcripts, embeddings", 150000),
    ("LLM usage during build and evals", 60000),
]
tp0 = r + 1
for i, (lbl, v) in enumerate(third):
    rr = tp0 + i
    B.cell(row=rr, column=1, value=lbl)
    style(B.cell(row=rr, column=1))
    style(B.cell(row=rr, column=4, value=v), color=BLUE, fmt=THB)
    style(B.cell(row=rr, column=5, value=f"=D{rr}"), fmt=THB)
tpt = tp0 + len(third)
B.cell(row=tpt, column=1, value="Third-party total (passed through at cost)")
style(B.cell(row=tpt, column=1), bold=True)
style(B.cell(row=tpt, column=4, value=f"=SUM(D{tp0}:D{tpt-1})"), bold=True, fmt=THB)
style(B.cell(row=tpt, column=5, value=f"=SUM(E{tp0}:E{tpt-1})"), bold=True, fmt=THB)

r = tpt + 2
lines = [
    ("Delivery contingency (15% of team cost)", f"=0.15*D{rt}", None),
    ("Total cost to IRIS", f"=D{rt}+D{tpt}+D{r}", None),
    ("Price before risk premium", None, f"=E{rt}+E{tpt}"),
    ("Fixed-date risk premium", None, f"=E{r+2}*{N('risk_prem')}"),
    ("Implementation fee (rounded to 0.5M)", None, f"=ROUND((E{r+2}+E{r+3})/500000,0)*500000"),
    ("Gross margin on implementation", None, f"=(E{r+4}-D{r+1})/E{r+4}"),
]
for i, (lbl, dc, ec) in enumerate(lines):
    rr = r + i
    B.cell(row=rr, column=1, value=lbl)
    style(B.cell(row=rr, column=1), bold=i in (1, 4, 5))
    if dc:
        style(B.cell(row=rr, column=4, value=dc), fmt=THB, bold=i == 1)
    if ec:
        style(B.cell(row=rr, column=5, value=ec), fmt=PCT if i == 5 else THB, bold=i in (4, 5), fill=KEY_FILL if i == 4 else None)
build_cost_cell = f"Build!$D${r+1}"
impl_fee_cell = f"Build!$E${r+4}"
B.cell(row=r + 7, column=1, value="Milestones: 30% at kick-off, 30% at week 6 (integrated demo), 40% at go-live acceptance.")
style(B.cell(row=r + 7, column=1), color="4A5759")
B.cell(row=r + 8, column=1, value="Client-side roles (not priced): HRIS owner, 2 LMS admins, IT security, DPO, 2 SMEs per BU, comms lead, ~60 champions.")
style(B.cell(row=r + 8, column=1), color="4A5759")
B.freeze_panes = "A5"

# ---------------------------------------------------------------- Run (monthly, 36 months)
R = wb.create_sheet("Run")
title(R, "Run cost by month (months from kick-off)", "Months 1-3 are the build (covered on the Build sheet). THB unless stated.")
MONTHS = 36
R.column_dimensions["A"].width = 44
for m in range(1, MONTHS + 1):
    R.column_dimensions[L(m + 1)].width = 11
R.cell(row=4, column=1, value="Line")
for m in range(1, MONTHS + 1):
    R.cell(row=4, column=m + 1, value=m)
for col in range(1, MONTHS + 2):
    c = R.cell(row=4, column=col)
    c.font = Font(name=FONT, color="FFFFFF", bold=True, size=10)
    c.fill = HEAD_FILL

run_rows = [
    ("enrolled", "Enrolled employees", lambda c: f"=IF({c}$4>={N('w3m')},{N('w1')}+{N('w2')}+{N('w3')},IF({c}$4>={N('w2m')},{N('w1')}+{N('w2')},IF({c}$4>={N('w1m')},{N('w1')},0)))", THB),
    ("mau", "Coach monthly active users", lambda c: f"={c}{{enrolled}}*{N('mau')}", THB),
    ("msgs", "Coach messages", lambda c: f"={c}{{mau}}*{N('msgs')}", THB),
    ("coach_usd", "Coach LLM (USD)", lambda c: f"={c}{{msgs}}*({N('tok_in')}*{N('c_in')}+{N('tok_cache')}*{N('c_cache')}+{N('tok_out')}*{N('c_out')})/1000000", USD),
    ("cls_usd", "Guardrail classifier LLM (USD)", lambda c: f"={c}{{msgs}}*({N('cls_in')}*{N('h_in')}+{N('cls_out')}*{N('h_out')})/1000000", USD),
    ("ndg_usd", "Nudges LLM (USD)", lambda c: f"={c}{{enrolled}}*{N('nudges')}*({N('ndg_in')}*{N('h_in')}+{N('ndg_out')}*{N('h_out')})/1000000", USD),
    ("path_usd", "Path generation LLM, off-peak (USD)", lambda c: f"={c}{{enrolled}}*{N('regen')}/12*({N('path_in')}*{N('c_in')}+{N('path_out')}*{N('c_out')})/1000000*(1-{N('batch')})", USD),
    ("judge_usd", "Evals and judge (USD)", lambda c: f"=IF({c}{{enrolled}}>0,{N('judge_usd')},0)", USD),
    ("llm_thb", "AI / LLM total incl. contingency", lambda c: f"=SUM({c}{{coach_usd}}:{c}{{judge_usd}})*(1+{N('llm_cont')})*{N('fx')}", THB),
    ("infra", "Cloud infrastructure", lambda c: f"=IF({c}{{enrolled}}>0,{N('infra_fix')}+{N('infra_var')}*{c}{{enrolled}},0)", THB),
    ("line", "LINE Official Account", lambda c: f"=IF({c}{{enrolled}}>0,{N('line_base')}+MAX(0,{c}{{enrolled}}*{N('nudges')}-{N('line_incl')})*{N('line_extra')},0)", THB),
    ("sms", "SMS OTP", lambda c: f"={c}{{enrolled}}*{N('frontline')}*{N('otp_share')}*{N('sms')}", THB),
    ("tools", "Tooling", lambda c: f"=IF({c}{{enrolled}}>0,{N('tool_fix')}+{N('tool_var')}*{c}{{enrolled}},0)", THB),
    ("compliance", "Security and compliance", lambda c: f"=IF({c}{{enrolled}}>0,({N('pentest')}+{N('dpia')})/12,0)", THB),
    ("team_ded", "Client-dedicated team", lambda c: f"=IF({c}{{enrolled}}>0,{N('csm_fte')}*{RC('Product & delivery lead')}+({N('analyst_base')}+{c}{{enrolled}}/{N('analyst_per')})*{RC('Content analyst')}+MAX(1,{c}{{enrolled}}/{N('support_per')})*{RC('Support analyst')},0)", THB),
    ("team_plat", "Platform team", lambda c: f"=IF({c}{{enrolled}}>0,IF({c}{{enrolled}}>20000,{N('plat_large')},{N('plat_small')})*{RC('Senior engineer')},0)", THB),
    ("run_total", "Total run cost", lambda c: f"={c}{{llm_thb}}+SUM({c}{{infra}}:{c}{{team_plat}})", THB),
    ("per_emp", "Run cost per enrolled employee", lambda c: f"=IF({c}{{enrolled}}>0,{c}{{run_total}}/{c}{{enrolled}},0)", NUM),
    ("llm_per_mau", "AI cost per coach active user", lambda c: f"=IF({c}{{mau}}>0,{c}{{llm_thb}}/{c}{{mau}},0)", NUM),
]
run_idx = {k: 5 + i for i, (k, *_ ) in enumerate(run_rows)}
for i, (k, label, f, fmt) in enumerate(run_rows):
    rr = 5 + i
    R.cell(row=rr, column=1, value=label)
    style(R.cell(row=rr, column=1), bold=k in ("run_total", "llm_thb"))
    for m in range(1, MONTHS + 1):
        col = L(m + 1)
        formula = f(col)
        for kk, ri in run_idx.items():
            formula = formula.replace("{" + kk + "}", str(ri))
        style(R.cell(row=rr, column=m + 1, value=formula), fmt=fmt, bold=k == "run_total")
R.freeze_panes = "B5"

# ---------------------------------------------------------------- P&L
P = wb.create_sheet("Pricing & P&L")
title(P, "Pricing and 3-year P&L (IRIS view) and client spend", "Monthly detail below; yearly summary at the top.")
P.column_dimensions["A"].width = 44
for m in range(1, MONTHS + 1):
    P.column_dimensions[L(m + 1)].width = 11
# monthly detail starts at row 30
D0 = 30
P.cell(row=D0 - 1, column=1, value="Monthly detail")
style(P.cell(row=D0 - 1, column=1), bold=True)
P.cell(row=D0, column=1, value="Month")
for m in range(1, MONTHS + 1):
    P.cell(row=D0, column=m + 1, value=m)
for col in range(1, MONTHS + 2):
    c = P.cell(row=D0, column=col)
    c.font = Font(name=FONT, color="FFFFFF", bold=True, size=10)
    c.fill = HEAD_FILL
pl_rows = [
    ("enrolled", "Enrolled employees", lambda c: f"=Run!{c}{run_idx['enrolled']}", THB, GREEN),
    ("billed", "Billed employees (with minimum)", lambda c: f"=IF({c}{{enrolled}}>0,MAX({c}{{enrolled}},IF({c}${D0}>={N('w2m')},{N('min_emp')},0)),0)", THB, BLACK),
    ("r_impl", "Revenue: implementation", lambda c: f"=IF({c}${D0}=1,0.3,IF({c}${D0}=2,0.3,IF({c}${D0}=3,0.4,0)))*{impl_fee_cell}", THB, BLACK),
    ("r_sub", "Revenue: subscription", lambda c: f"={c}{{billed}}*{N('pepm')}", THB, BLACK),
    ("r_wave", "Revenue: rollout services", lambda c: f"=IF({c}${D0}={N('w2m')},{N('w2_fee')},0)+IF({c}${D0}={N('w3m')},{N('w3_fee')},0)", THB, BLACK),
    ("r_total", "Total revenue (= client spend)", lambda c: f"=SUM({c}{{r_impl}}:{c}{{r_wave}})", THB, BLACK),
    ("c_build", "Cost: build", lambda c: f"=IF({c}${D0}<=3,{build_cost_cell}/3,0)", THB, BLACK),
    ("c_run", "Cost: run", lambda c: f"=Run!{c}{run_idx['run_total']}", THB, GREEN),
    ("c_wave", "Cost: rollout services", lambda c: f"={c}{{r_wave}}*{N('wave_cost')}", THB, BLACK),
    ("c_total", "Total cost", lambda c: f"=SUM({c}{{c_build}}:{c}{{c_wave}})", THB, BLACK),
    ("gp", "Gross profit", lambda c: f"={c}{{r_total}}-{c}{{c_total}}", THB, BLACK),
]
pl_idx = {k: D0 + 1 + i for i, (k, *_ ) in enumerate(pl_rows)}
for i, (k, label, f, fmt, color) in enumerate(pl_rows):
    rr = D0 + 1 + i
    P.cell(row=rr, column=1, value=label)
    style(P.cell(row=rr, column=1), bold=k in ("r_total", "gp"))
    for m in range(1, MONTHS + 1):
        col = L(m + 1)
        formula = f(col)
        for kk, ri in pl_idx.items():
            formula = formula.replace("{" + kk + "}", str(ri))
        style(P.cell(row=rr, column=m + 1, value=formula), fmt=fmt, color=color, bold=k in ("r_total", "gp"))

# yearly summary rows 4-24
header(P, 4, ["THB", "Year 1 (M1-12)", "Year 2 (M13-24)", "Year 3 (M25-36)", "3-year total"])
for col, w in zip("BCDE", [16, 16, 16, 16]):
    P.column_dimensions[col].width = max(P.column_dimensions[col].width or 0, w)
yr_ranges = [("B", "M"), ("N", "Y"), ("Z", "AK")]
summary = [
    ("Implementation", "r_impl"),
    ("Subscription", "r_sub"),
    ("Rollout services", "r_wave"),
    ("Total revenue / client spend", "r_total"),
    ("Total cost to IRIS", "c_total"),
    ("Gross profit", "gp"),
]
for i, (lbl, key) in enumerate(summary):
    rr = 5 + i
    P.cell(row=rr, column=1, value=lbl)
    style(P.cell(row=rr, column=1), bold=key in ("r_total", "gp"))
    for j, (a, b) in enumerate(yr_ranges):
        style(P.cell(row=rr, column=2 + j, value=f"=SUM({a}{pl_idx[key]}:{b}{pl_idx[key]})"), fmt=THBM, bold=key in ("r_total", "gp"))
    style(P.cell(row=rr, column=5, value=f"=SUM(B{rr}:D{rr})"), fmt=THBM, bold=True)
rr = 11
P.cell(row=rr, column=1, value="Gross margin")
style(P.cell(row=rr, column=1), bold=True)
for j, col in enumerate("BCDE"):
    style(P.cell(row=rr, column=2 + j, value=f"=IF({col}8>0,{col}10/{col}8,0)"), fmt=PCT, bold=True, fill=KEY_FILL if col == "E" else None)
rr = 13
P.cell(row=rr, column=1, value="Client view")
style(P.cell(row=rr, column=1), bold=True, fill=SUB_FILL)
P.cell(row=14, column=1, value="Employees enrolled at year end")
style(P.cell(row=14, column=1))
for j, col in enumerate(["M", "Y", "AK"]):
    style(P.cell(row=14, column=2 + j, value=f"={col}{pl_idx['enrolled']}"), fmt=THB)
P.cell(row=15, column=1, value="Client spend per employee per year (year-end headcount)")
style(P.cell(row=15, column=1))
for j, col in enumerate("BCD"):
    style(P.cell(row=15, column=2 + j, value=f"=IF({col}14>0,{col}8/{col}14,0)"), fmt=THB)
P.cell(row=16, column=1, value="As share of current L&D spend per employee")
style(P.cell(row=16, column=1))
for j, col in enumerate("BCD"):
    style(P.cell(row=16, column=2 + j, value=f"=IF({col}15>0,{col}15/{N('ld_per_emp')},0)"), fmt=PCT)
P.cell(row=17, column=1, value="Subscription at full scale (per year)")
style(P.cell(row=17, column=1))
style(P.cell(row=17, column=4, value=f"=({N('w1')}+{N('w2')}+{N('w3')})*{N('pepm')}*12"), fmt=THBM)
P.cell(row=18, column=1, value="Subscription at risk on adoption KPIs (per year, full scale)")
style(P.cell(row=18, column=1))
style(P.cell(row=18, column=4, value=f"=D17*{N('at_risk')}"), fmt=THBM)
P.cell(row=19, column=1, value="Run cost per enrolled employee per month (month 36)")
style(P.cell(row=19, column=1))
style(P.cell(row=19, column=4, value=f"=Run!AK{run_idx['per_emp']}"), fmt=NUM, color=GREEN)
P.cell(row=20, column=1, value="AI cost per coach active user per month (month 36)")
style(P.cell(row=20, column=1))
style(P.cell(row=20, column=4, value=f"=Run!AK{run_idx['llm_per_mau']}"), fmt=NUM, color=GREEN)
P.cell(row=21, column=1, value="Implementation fee")
style(P.cell(row=21, column=1))
style(P.cell(row=21, column=4, value=f"={impl_fee_cell}"), fmt=THBM, color=GREEN)
P.cell(row=22, column=1, value="Wave 1 months: run cost vs subscription (month 4)")
style(P.cell(row=22, column=1))
style(P.cell(row=22, column=3, value=f"=Run!E{run_idx['run_total']}"), fmt=THB, color=GREEN)
style(P.cell(row=22, column=4, value=f"=E{pl_idx['r_sub']}"), fmt=THB)
P.freeze_panes = "B5"

# ---------------------------------------------------------------- AI cost scenarios
C = wb.create_sheet("AI Cost")
title(C, "AI cost per message and per user", "Why model choice matters less than people costs. Full scale = 45,000 enrolled.")
header(C, 4, ["Item", "DeepSeek V4.1 Flash coach (base)", "Claude Sonnet 5.5 coach (scenario)", "Note"], [44, 28, 30, 60])
crow = [
    ("Coach cost per message (USD)", f"=({N('tok_in')}*{N('c_in')}+{N('tok_cache')}*{N('c_cache')}+{N('tok_out')}*{N('c_out')})/1000000", f"=({N('tok_in')}*{N('o_in')}+{N('tok_cache')}*{N('o_cache')}+{N('tok_out')}*{N('o_out')})/1000000", USD),
    ("Classifier cost per message (USD)", f"=({N('cls_in')}*{N('h_in')}+{N('cls_out')}*{N('h_out')})/1000000", "=B6", USD),
    ("Per coach active user per month (THB, incl. contingency)", f"=(B5+B6)*{N('msgs')}*(1+{N('llm_cont')})*{N('fx')}", f"=(C5+C6)*{N('msgs')}*(1+{N('llm_cont')})*{N('fx')}", NUM),
    ("Coach active users at full scale", f"=({N('w1')}+{N('w2')}+{N('w3')})*{N('mau')}", "=B8", THB),
    ("Coach LLM cost per year at full scale (THB)", "=B7*B8*12", "=C7*C8*12", THB),
    ("Share of full-scale run cost", f"=B9/(Run!AK{run_idx['run_total']}*12)", f"=C9/(Run!AK{run_idx['run_total']}*12-B9+C9)", PCT),
]
for i, (lbl, b, c, fmt) in enumerate(crow):
    rr = 5 + i
    C.cell(row=rr, column=1, value=lbl)
    style(C.cell(row=rr, column=1))
    style(C.cell(row=rr, column=2, value=b), fmt=fmt)
    style(C.cell(row=rr, column=3, value=c), fmt=fmt)
C.cell(row=12, column=1, value="Decision rule: route coaching to the cheaper model only if it passes the same eval gate (groundedness >= 95%, Thai quality >= 4/5, 100% red-team). Price is not the deciding factor at this scale.")
style(C.cell(row=12, column=1), color="4A5759")

# ---------------------------------------------------------------- Value
V = wb.create_sheet("Value")
title(V, "Value case for the client (illustrative, full scale per year)", "Inputs in blue are assumptions to validate with the client's finance team in week 1-2.")
header(V, 4, ["Lever", "Input", "Value", "Unit / note"], [52, 16, 16, 70])
vrows = [
    ("Current L&D spend (45,000 people)", f"=({N('w1')}+{N('w2')}+{N('w3')})*{N('ld_per_emp')}", None, "THB / yr", THB, False),
    ("Share of L&D spend redirected to skill gaps", 0.10, None, "Low-relevance courses cut or replaced; assumption", PCT, True),
    ("1. L&D spend optimisation", None, "=B5*B6", "THB / yr", THB, False),
    ("Supervisor-level vacancies per year (group)", 1200, None, "people; assumption", THB, True),
    ("Uplift in internal fill rate", 0.05, None, "percentage points; conservative assumption", PCT, True),
    ("Cost avoided per external hire", 100000, None, "THB: recruitment, onboarding, ramp-up; assumption", THB, True),
    ("2. Internal fills instead of external hires", None, "=B8*B9*B10", "THB / yr", THB, False),
    ("Retail & Distribution revenue", 40000000000, None, "THB / yr; assumption for the fictional BU", THB, True),
    ("Shrink as share of revenue", 0.015, None, "assumption", PCT, True),
    ("Relative shrink reduction from supervisor capability", 0.03, None, "assumption; measured vs later-wave stores", PCT, True),
    ("3. Retail shrink reduction", None, "=B12*B13*B14", "THB / yr", THB, False),
    ("OEE points gained on wave-1 packaging lines", 0.5, None, "points; assumption", NUM, True),
    ("Value per OEE point", 8000000, None, "THB / yr; assumption", THB, True),
    ("4. Packaging OEE", None, "=B16*B17", "THB / yr", THB, False),
    ("5. Admin and compliance (Skill Development Promotion Act reporting, manual reports)", 2000000, None, "THB / yr; assumption", THB, True),
]
for i, (lbl, b, c, note, fmt, is_input) in enumerate(vrows):
    rr = 5 + i
    V.cell(row=rr, column=1, value=lbl)
    style(V.cell(row=rr, column=1), bold=lbl[:2] in ("1.", "2.", "3.", "4.", "5."))
    if b is not None:
        style(V.cell(row=rr, column=2, value=b), color=BLUE if is_input else BLACK, fmt=fmt)
    if c is not None:
        style(V.cell(row=rr, column=3, value=c), fmt=fmt, bold=True)
    V.cell(row=rr, column=4, value=note)
    style(V.cell(row=rr, column=4), color="4A5759", wrap=True)
style(V.cell(row=19, column=3, value="=B19"), fmt=THB, bold=True)
V.cell(row=21, column=1, value="Total annual value at full scale")
style(V.cell(row=21, column=1), bold=True)
style(V.cell(row=21, column=3, value="=C7+C11+C15+C18+C19"), fmt=THB, bold=True, fill=KEY_FILL)
V.cell(row=22, column=1, value="Annual subscription at full scale")
style(V.cell(row=22, column=1))
style(V.cell(row=22, column=3, value="='Pricing & P&L'!D17"), fmt=THB, color=GREEN)
V.cell(row=23, column=1, value="Value / subscription")
style(V.cell(row=23, column=1), bold=True)
style(V.cell(row=23, column=3, value="=IF(C22>0,C21/C22,0)"), fmt='0.0"x"', bold=True)
V.cell(row=25, column=1, value="Value ramp (business results lag capability)")
style(V.cell(row=25, column=1), bold=True, fill=SUB_FILL)
ramp = [("Year 1", 0.15), ("Year 2", 0.6), ("Year 3", 1.0)]
for i, (y, pct) in enumerate(ramp):
    rr = 26 + i
    V.cell(row=rr, column=1, value=f"{y} share of full value")
    style(V.cell(row=rr, column=1))
    style(V.cell(row=rr, column=2, value=pct), color=BLUE, fmt=PCT)
    style(V.cell(row=rr, column=3, value=f"=B{rr}*$C$21"), fmt=THB)
V.cell(row=29, column=1, value="3-year value")
style(V.cell(row=29, column=1), bold=True)
style(V.cell(row=29, column=3, value="=SUM(C26:C28)"), fmt=THB, bold=True)
V.cell(row=30, column=1, value="3-year client spend")
style(V.cell(row=30, column=1))
style(V.cell(row=30, column=3, value="='Pricing & P&L'!E8"), fmt=THB, color=GREEN)
V.cell(row=31, column=1, value="3-year value / spend")
style(V.cell(row=31, column=1), bold=True)
style(V.cell(row=31, column=3, value="=IF(C30>0,C29/C30,0)"), fmt='0.00"x"', bold=True)
V.cell(row=33, column=1, value="Break-even check: the shrink lever alone needs this relative reduction to cover the full-scale subscription")
style(V.cell(row=33, column=1), wrap=True)
style(V.cell(row=33, column=3, value="=C22/(B12*B13)"), fmt=PCT, bold=True)
V.cell(row=35, column=1, value="Measurement: staggered waves give a comparison group (later-wave BUs and stores act as controls), so the causal read comes after 2-3 quarters. The dashboard shows correlation until then.")
style(V.cell(row=35, column=1), color="4A5759")

# ---------------------------------------------------------------- README
Rd = wb.create_sheet("README", 0)
title(Rd, "Learning Suite: cost, pricing and value model", "Case exercise for IRIS Consulting. Fictional client (Siam Pinnacle Group). Planning-grade estimates, not a quote.")
notes = [
    "Sheets: Assumptions (all inputs) -> Build (12-week team and fee) -> Run (36-month run cost) -> Pricing & P&L (IRIS view and client spend) -> AI Cost (model choice) -> Value (client value case).",
    "Colour code: blue = input, black = formula, green = link to another sheet, yellow = key lever.",
    "Pricing structure: fixed-fee implementation (milestones 30/30/40) + subscription per enrolled employee per month with a minimum from wave 2 + fixed-fee rollout services per wave + 10% of subscription at risk on adoption KPIs.",
    "Model prices: DeepSeek API list prices (Oct 2026), at peak rates for daytime coaching. Hosting DeepSeek in an approved region through a cloud provider is priced differently; the 30% LLM contingency covers the difference.",
    "Change the yellow levers on Assumptions to test scenarios (price, usage, risk premium, coach model).",
]
for i, t in enumerate(notes):
    Rd.cell(row=4 + i, column=1, value=t)
    style(Rd.cell(row=4 + i, column=1), wrap=True)
Rd.column_dimensions["A"].width = 140

from openpyxl.workbook.properties import CalcProperties

wb.calculation = CalcProperties(fullCalcOnLoad=True)  # Excel / Numbers recompute on open
wb.save("cost-model.xlsx")
print("Saved formula/layout source. Required next: node recalculate.mjs && python3 verify_model.py")
