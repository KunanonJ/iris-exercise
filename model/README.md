# Financial model

`cost-model.xlsx` retains seven worksheets and 1,207 editable formulas. The saved file includes calculated results so previewers and tools that do not calculate Excel formulas can read the outputs. Figures are planning assumptions for the fictional case, not vendor quotations or verified client results.

## Inputs and financial basis

- `Assumptions` contains rollout, model usage, token rates, platform costs, staffing rates and commercial inputs. Blue inputs also appear in the build team and the illustrative client value case.
- The plan enrols 12,000 people from month 4, another 15,000 from month 7 and another 18,000 from month 13. The model covers 36 months from project kick-off.
- The commercial case uses THB 39 per enrolled employee per month, fixed implementation and wave-service fees, and a minimum employee commitment from wave 2. Revenue follows the stated milestones and monthly service assumptions.
- AI planning uses 2,800 uncached input tokens, 1,200 cached input tokens and 450 output tokens per coach message. Production model prices and other vendor figures remain the original frozen case assumptions. Confirm prices, regional availability, taxes and contractual commitments before procurement.
- Prototype Clerk development authentication and free-tier Workers AI testing are separate from these production estimates. The prototype's current vendor choices do not automatically change commercial numbers. The production authentication and messaging approach, vendor quotation and security approval remain delivery decisions.
- Client benefit estimates are illustrative. The workbook's value case does not establish a realised causal return.

The current base case calculates three-year client spend/revenue of THB 82,342,000, IRIS gross profit of THB 26,447,633.61 and gross margin of 32.12%.

## Recalculate and verify

Use the existing managed Artifact Tool runtime. The script searches `ARTIFACT_TOOL_NODE_MODULES`, then `~/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules`. It uses public import, recalculation, inspection and export APIs and does not install packages or use repository-local dependencies. Python 3 with the existing `openpyxl` dependency is required for read-only validation. If needed, select the runtime Node and Python executables with `ARTIFACT_TOOL_NODE` and `ARTIFACT_TOOL_PYTHON`.

From the repository root:

```sh
node model/recalculate.mjs --evidence=/tmp/iris-model-verification
python3 model/verify_model.py model/cost-model.xlsx
python3 model/verify_sensitivity.py model/cost-model.xlsx --report=/tmp/iris-model-verification/sensitivity.json
```

Use the managed runtime's Node executable in place of `node` if the system Node version is incompatible. Set `ARTIFACT_TOOL_NODE` to the same executable for sensitivity tests. The recalculation script validates its temporary export before atomically replacing the destination. `--input=/path/source.xlsx` and `--output=/path/result.xlsx` allow a separate export; omitting them recalculates the existing model in place.

Verification checks every formula cache and error cell, reconciles 143 independent build, run, AI, revenue, profit and value controls, and compares unchanged formula text, inputs, visible styles, sheet order and layout against the input. Monetary tolerance is THB 1; margin/ratio tolerance is 0.0001. Sensitivity checks use disposable files for enrolment, subscription price, doubled AI usage and zero coach usage, then confirm the deliverable is unchanged. All commands fail on a failed check.

## Regeneration

Preserve `build_model.py` as the legacy source of formulas and layout. Run it from the `model` directory, then always recalculate before submission:

```sh
cd model
python3 build_model.py
node recalculate.mjs --evidence=/tmp/iris-model-verification
python3 verify_model.py cost-model.xlsx
python3 verify_sensitivity.py cost-model.xlsx
```

The generator alone creates uncached formulas. It is not the final deliverable. No formula is replaced with its result by the recalculation step.

## Export and validation limits

The Artifact Tool export preserves all existing formula strings, input values, visible font/fill/border/alignment/number formats, freeze panes, widths, heights and worksheet order. The source has no charts, drawings, tables, pivots or external-link objects. Serialization converts empty inline notes to empty shared strings, normalizes cell RGB alpha bytes, adds `sharedStrings.xml`, and removes legacy document-property and calculation-property metadata. These package changes do not alter the verified financial results or visible cell formatting.

Recalculation and sensitivity checks use Artifact Tool. Native Microsoft Excel recalculation and desktop rendering have not been tested. Recheck the workbook in the target spreadsheet application before external presentation if that application is part of the acceptance process.
