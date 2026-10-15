"""Read-only package, formula, style and independent financial verification.

Uses zipfile/XML for cache/formula inspection and openpyxl only to read public
style/layout properties. It never saves or authors a workbook.
"""
import argparse
import copy
import hashlib
import json
import math
import pathlib
import re
import zipfile
import xml.etree.ElementTree as ET

import openpyxl

NS = {"s": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
MONEY_TOLERANCE = 1.0
MARGIN_TOLERANCE = 0.0001


def package(path):
    with zipfile.ZipFile(path) as archive:
        formulas, missing, errors = {}, [], []
        for part in archive.namelist():
            if not re.fullmatch(r"xl/worksheets/sheet\d+\.xml", part):
                continue
            for cell in ET.fromstring(archive.read(part)).findall(".//s:c", NS):
                address = f"{part}!{cell.attrib['r']}"
                formula = cell.find("s:f", NS)
                value = cell.find("s:v", NS)
                if formula is not None:
                    formulas[address] = formula.text or ""
                    if value is None or value.text is None:
                        missing.append(address)
                if cell.attrib.get("t") == "e":
                    errors.append({"cell": address, "error": value.text if value is not None else None})
        return {
            "formulas": formulas,
            "missing": missing,
            "errors": errors,
            "parts": sorted(archive.namelist()),
            "objects": sorted(part for part in archive.namelist() if any(token in part for token in ("/charts/", "/drawings/", "/tables/", "/pivotTables/", "/externalLinks/"))),
        }


def normalized_style(value):
    # XLSX ignores alpha for these cell font/fill RGB colors. The exporter
    # normalizes the builder's 00RRGGBB to FFRRGGBB; visible RGB is preserved.
    return re.sub(r"rgb='(?:00|FF)([0-9A-Fa-f]{6})'", lambda match: f"rgb='{match.group(1).upper()}'", str(copy.copy(value)))


def compare_reference(reference, candidate):
    assert reference.sheetnames == candidate.sheetnames, "Sheet names/order changed"
    differences = []
    for source in reference:
        target = candidate[source.title]
        for row in source:
            for cell in row:
                other = target[cell.coordinate]
                for attribute in ("font", "fill", "border", "alignment", "number_format", "protection"):
                    if normalized_style(getattr(cell, attribute)) != normalized_style(getattr(other, attribute)):
                        differences.append(f"{source.title}!{cell.coordinate}: {attribute}")
                # Empty inline strings may serialize as an explicit shared empty
                # string; both are blank source notes, not numeric zero inputs.
                source_value = None if cell.value == "" else cell.value
                target_value = None if other.value == "" else other.value
                if cell.data_type != "f" and source_value != target_value:
                    differences.append(f"{source.title}!{cell.coordinate}: input/label changed")
        for attribute in ("freeze_panes", "merged_cells", "data_validations", "print_area", "print_title_rows", "print_title_cols"):
            if str(getattr(source, attribute)) != str(getattr(target, attribute)):
                differences.append(f"{source.title}: {attribute}")
        if source.auto_filter.ref != target.auto_filter.ref:
            differences.append(f"{source.title}: auto filter")
        if len(source.conditional_formatting) != len(target.conditional_formatting):
            differences.append(f"{source.title}: conditional formatting")
        for key, dimension in source.column_dimensions.items():
            other = target.column_dimensions[key]
            for attribute in ("width", "hidden", "outlineLevel", "collapsed"):
                if getattr(dimension, attribute) != getattr(other, attribute):
                    differences.append(f"{source.title}: column {key} {attribute}")
        for key, dimension in source.row_dimensions.items():
            other = target.row_dimensions[key]
            for attribute in ("height", "hidden", "outlineLevel", "collapsed"):
                if getattr(dimension, attribute) != getattr(other, attribute):
                    differences.append(f"{source.title}: row {key} {attribute}")
    assert not differences, f"Reference preservation failed: {differences[:20]}"
    return {"sheets": reference.sheetnames, "cell_styles": "equivalent after RGB alpha normalization", "inputs_and_labels": "unchanged", "panes_layout_validation": "unchanged"}


def controls(values):
    assumptions = values["Assumptions"]
    inputs = {str(row[0].value): row[1].value for row in assumptions.iter_rows(min_row=5, max_col=4) if row[0].value is not None}
    get = lambda label: float(inputs[label])
    checks = []

    def check(sheet, address, expected, tolerance=MONEY_TOLERANCE):
        actual = values[sheet][address].value
        assert isinstance(actual, (float, int)) and math.isfinite(actual), f"Missing/non-numeric output {sheet}!{address}"
        delta = float(actual) - expected
        assert abs(delta) <= tolerance, f"{sheet}!{address}: cached {actual}, independent {expected}, delta {delta}"
        checks.append({"cell": f"{sheet}!{address}", "actual": actual, "independent": expected, "difference": delta, "tolerance": tolerance})

    rates = {}
    for row in assumptions.iter_rows(min_row=72, max_row=85, max_col=3):
        rates[row[0].value] = (float(row[1].value), float(row[2].value))
    build = values["Build"]
    team_cost = sum(float(build.cell(row, 2).value) * get("Build working days (12 weeks)") * rates[build.cell(row, 1).value][0] / get("Working days per month") for row in range(5, 18))
    team_price = sum(float(build.cell(row, 2).value) * get("Build working days (12 weeks)") * rates[build.cell(row, 1).value][1] for row in range(5, 18))
    third_party = sum(float(build.cell(row, 4).value) for row in range(21, 25))
    build_cost = team_cost * 1.1 + third_party
    # Positive Excel ROUND rounds half up. This model's fee is nonnegative.
    implementation = math.floor((team_price + third_party) * (1 + get("Fixed-date risk premium on implementation")) / 500000 + 0.5) * 500000
    check("Build", "D18", team_cost)
    check("Build", "D28", build_cost)
    check("Build", "E31", implementation)

    revenue, cost, profit = [], [], []
    full_run, full_ai, full_people = 0, 0, 0
    for month in range(1, 37):
        people = sum(get(count) for count, start in (("Wave 1 employees (RD + PK, Thailand)", "Wave 1 go-live month"), ("Wave 2 employees (BM + CS + rest of TH)", "Wave 2 go-live month"), ("Wave 3 employees (CH + 3 ASEAN countries)", "Wave 3 go-live month")) if month >= get(start))
        active = people * get("Coach monthly active share")
        messages = active * get("Coach messages per active user per month")
        coach = messages * (get("Coach input tokens per message (uncached)") * get("Coach model input (Sonnet 5.5)") + get("Coach input tokens per message (cached)") * get("Coach model cache read") + get("Coach output tokens per message") * get("Coach model output (Sonnet 5.5)")) / 1e6
        classifier = messages * (get("Classifier input tokens per message") * get("Haiku 5.5 input (classifier, nudges)") + get("Classifier output tokens per message") * get("Haiku 5.5 output")) / 1e6
        nudges = people * get("Nudges per enrolled employee per month") * (get("Nudge input tokens") * get("Haiku 5.5 input (classifier, nudges)") + get("Nudge output tokens") * get("Haiku 5.5 output")) / 1e6
        paths = people * get("Path generations per employee per year") / 12 * (get("Path generation input tokens") * get("Coach model input (Sonnet 5.5)") + get("Path generation output tokens") * get("Coach model output (Sonnet 5.5)")) / 1e6 * (1 - get("Batch API discount"))
        ai = (coach + classifier + nudges + paths + (get("Eval and judge sampling per month") if people else 0)) * (1 + get("LLM contingency")) * get("FX planning rate")
        run = 0
        if people:
            run = ai + get("Cloud infrastructure, fixed") + people * get("Cloud infrastructure, variable")
            run += get("LINE OA Pro plan") + max(0, people * get("Nudges per enrolled employee per month") - get("LINE messages included")) * get("LINE extra message")
            run += people * get("Frontline share") * get("Frontline users needing SMS OTP per month") * get("SMS OTP cost")
            run += get("Tooling (monitoring, LRS, security scanning)") + people * get("Tooling, variable")
            run += (get("Annual penetration test") + get("DPIA refresh and compliance audit")) / 12
            run += get("Customer success / product owner") * rates["Product & delivery lead"][0]
            run += (get("Skills & content analysts, base") + people / get("Employees per extra analyst")) * rates["Content analyst"][0]
            run += max(1, people / get("Employees per L2 support analyst")) * rates["Support analyst"][0]
            run += get("Shared platform team allocation above 20k" if people > 20000 else "Shared platform team allocation up to 20k") * rates["Senior engineer"][0]
        billed = max(people, get("Minimum committed employees from wave 2") if month >= get("Wave 2 go-live month") else 0) if people else 0
        wave_revenue = (get("Wave 2 rollout services (fixed)") if month == get("Wave 2 go-live month") else 0) + (get("Wave 3 rollout services (fixed, incl. ASEAN localisation)") if month == get("Wave 3 go-live month") else 0)
        monthly_revenue = (implementation * (0.3 if month in (1, 2) else 0.4 if month == 3 else 0)) + billed * get("Subscription price per enrolled employee per month") + wave_revenue
        monthly_cost = (build_cost / 3 if month <= 3 else 0) + run + wave_revenue * get("Wave services delivery cost ratio")
        revenue.append(monthly_revenue)
        cost.append(monthly_cost)
        profit.append(monthly_revenue - monthly_cost)
        col = openpyxl.utils.get_column_letter(month + 1)
        check("Run", f"{col}5", people, 0)
        check("Run", f"{col}13", ai)
        check("Run", f"{col}21", run)
        if month == 36:
            full_run, full_ai, full_people = run, ai, people
    for column, start, stop in (("B", 0, 12), ("C", 12, 24), ("D", 24, 36), ("E", 0, 36)):
        r, c, p = sum(revenue[start:stop]), sum(cost[start:stop]), sum(profit[start:stop])
        check("Pricing & P&L", f"{column}8", r)
        check("Pricing & P&L", f"{column}9", c)
        check("Pricing & P&L", f"{column}10", p)
        check("Pricing & P&L", f"{column}11", p / r if r else 0, MARGIN_TOLERANCE)
    check("Pricing & P&L", "D19", full_run / full_people, MARGIN_TOLERANCE)
    check("Pricing & P&L", "D20", full_ai / (full_people * get("Coach monthly active share")), MARGIN_TOLERANCE)
    coach_message = (get("Coach input tokens per message (uncached)") * get("Coach model input (Sonnet 5.5)") + get("Coach input tokens per message (cached)") * get("Coach model cache read") + get("Coach output tokens per message") * get("Coach model output (Sonnet 5.5)")) / 1e6
    opus_message = (get("Coach input tokens per message (uncached)") * get("Opus 5.5 input (scenario)") + get("Coach input tokens per message (cached)") * get("Coach model cache read") + get("Coach output tokens per message") * get("Opus 5.5 output (scenario)")) / 1e6
    classifier_message = (get("Classifier input tokens per message") * get("Haiku 5.5 input (classifier, nudges)") + get("Classifier output tokens per message") * get("Haiku 5.5 output")) / 1e6
    for column, message_cost in (("B", coach_message), ("C", opus_message)):
        per_active = (message_cost + classifier_message) * get("Coach messages per active user per month") * (1 + get("LLM contingency")) * get("FX planning rate")
        annual_coach = per_active * full_people * get("Coach monthly active share") * 12
        check("AI Cost", f"{column}5", message_cost, MARGIN_TOLERANCE)
        check("AI Cost", f"{column}6", classifier_message, MARGIN_TOLERANCE)
        check("AI Cost", f"{column}7", per_active, MARGIN_TOLERANCE)
        check("AI Cost", f"{column}8", full_people * get("Coach monthly active share"), 0)
        check("AI Cost", f"{column}9", annual_coach)
        base_annual_coach = (coach_message + classifier_message) * get("Coach messages per active user per month") * (1 + get("LLM contingency")) * get("FX planning rate") * full_people * get("Coach monthly active share") * 12
        denominator = full_run * 12 if column == "B" else full_run * 12 - base_annual_coach + annual_coach
        check("AI Cost", f"{column}10", annual_coach / denominator, MARGIN_TOLERANCE)
    value = values["Value"]
    annual_value = full_people * get("Current L&D spend per employee") * value["B6"].value + value["B8"].value * value["B9"].value * value["B10"].value + value["B12"].value * value["B13"].value * value["B14"].value + value["B16"].value * value["B17"].value + value["B19"].value
    check("Value", "C21", annual_value)
    check("Value", "C29", annual_value * sum(value[f"B{row}"].value for row in (26, 27, 28)))
    return checks


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("workbook", nargs="?", default=str(pathlib.Path(__file__).with_name("cost-model.xlsx")))
    parser.add_argument("--reference", help="Original workbook used to verify formula, input, style and layout preservation")
    parser.add_argument("--report", help="Optional JSON evidence output")
    args = parser.parse_args()
    path = pathlib.Path(args.workbook)
    snapshot = package(path)
    assert snapshot["formulas"], "No live formulas found"
    assert not snapshot["missing"], f"Missing cached results: {snapshot['missing'][:10]}"
    assert not snapshot["errors"], f"Spreadsheet errors: {snapshot['errors'][:10]}"
    formulas = openpyxl.load_workbook(path, data_only=False)
    values = openpyxl.load_workbook(path, data_only=True)
    report = {"status": "PASS", "sha256": hashlib.sha256(path.read_bytes()).hexdigest(), "sheets": formulas.sheetnames, "formula_count": len(snapshot["formulas"]), "missing_cached_results": 0, "formula_errors": 0}
    if args.reference:
        original = package(args.reference)
        assert snapshot["formulas"] == original["formulas"], "Formula text or locations changed"
        assert snapshot["objects"] == original["objects"], "Chart/drawing/table/external-link objects changed"
        report["preservation"] = compare_reference(openpyxl.load_workbook(args.reference, data_only=False), formulas)
        report["package_changes"] = {"added_parts": sorted(set(snapshot["parts"]) - set(original["parts"])), "removed_parts": sorted(set(original["parts"]) - set(snapshot["parts"]))}
    report["independent_controls"] = controls(values)
    report["headline"] = {"three_year_revenue_thb": values["Pricing & P&L"]["E8"].value, "three_year_gross_profit_thb": values["Pricing & P&L"]["E10"].value, "three_year_gross_margin": values["Pricing & P&L"]["E11"].value}
    if args.report:
        pathlib.Path(args.report).write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({key: value for key, value in report.items() if key != "independent_controls"}, indent=2))
    print(f"PASS: {len(report['independent_controls'])} independent controls, monetary tolerance THB {MONEY_TOLERANCE:g}, margin tolerance {MARGIN_TOLERANCE:g}")


if __name__ == "__main__":
    main()
