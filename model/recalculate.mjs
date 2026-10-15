/** Populate cached results with the Artifact Tool public workbook API.
 * No formulas are flattened. verify_model.py validates the exported package.
 */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";

const directory = path.dirname(fileURLToPath(import.meta.url));
const argument = (name) => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);

async function artifactTool() {
  const candidates = [process.env.ARTIFACT_TOOL_NODE_MODULES, path.join(os.homedir(), ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules")].filter(Boolean);
  for (const nodeModules of candidates) {
    try {
      const require = createRequire(path.join(nodeModules, "iris-artifact-loader.mjs"));
      return await import(pathToFileURL(require.resolve("@oai/artifact-tool")).href);
    } catch (error) {
      if (error.code !== "MODULE_NOT_FOUND" && error.code !== "ENOENT") throw error;
    }
  }
  throw new Error("Artifact Tool runtime unavailable. Set ARTIFACT_TOOL_NODE_MODULES to the installed loader node_modules directory. Repository dependencies are not used.");
}

const input = path.resolve(argument("input") ?? path.join(directory, "cost-model.xlsx"));
const output = path.resolve(argument("output") ?? input);
const evidenceDirectory = argument("evidence") ? path.resolve(argument("evidence")) : undefined;
const changes = process.argv.filter((arg) => arg.startsWith("--set="));
const { FileBlob, SpreadsheetFile } = await artifactTool();
const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(input));

// Optional sensitivity changes operate on a disposable imported workbook. The
// checked-in deliverable is regenerated without --set arguments.
for (const change of changes) {
  const [, sheetName, address, rawValue] = change.match(/^--set=(.+)!([A-Z]+[1-9][0-9]*)=(-?[0-9]+(?:\.[0-9]+)?)$/) ?? [];
  if (!sheetName) throw new Error("Expected --set=Sheet!A1=number");
  workbook.worksheets.getItem(sheetName).getRange(address).values = [[Number(rawValue)]];
}
workbook.recalculate();
const errors = await workbook.inspect({ kind: "match", searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!", options: { useRegex: true, maxResults: 300 }, summary: "Final formula error scan", maxChars: 5000 });
const summary = await workbook.inspect({ kind: "table", range: "'Pricing & P&L'!A4:E11", include: "values,formulas", tableMaxRows: 8, tableMaxCols: 5, maxChars: 5000 });
if (evidenceDirectory) {
  await fs.mkdir(evidenceDirectory, { recursive: true });
  await fs.writeFile(path.join(evidenceDirectory, "formula-errors.ndjson"), errors.ndjson + "\n");
  await fs.writeFile(path.join(evidenceDirectory, "summary.ndjson"), summary.ndjson + "\n");
  const preview = await workbook.render({ sheetName: "Pricing & P&L", range: "A1:E22", scale: 1, format: "png" });
  await fs.writeFile(path.join(evidenceDirectory, "pricing.png"), new Uint8Array(await preview.arrayBuffer()));
}
await fs.mkdir(path.dirname(output), { recursive: true });
const temporary = `${output}.${process.pid}.tmp.xlsx`;
try {
  await (await SpreadsheetFile.exportXlsx(workbook)).save(temporary);
  const verification = [path.join(directory, "verify_model.py"), temporary];
  if (changes.length === 0) verification.push(`--reference=${input}`);
  if (evidenceDirectory) verification.push(`--report=${path.join(evidenceDirectory, "verification.json")}`);
  // Validate the saved package before replacing the destination. A failed cache,
  // formula, preservation or financial check leaves the prior file untouched.
  execFileSync(process.env.ARTIFACT_TOOL_PYTHON ?? "python3", verification, { stdio: "inherit" });
  await fs.rename(temporary, output);
} finally {
  await fs.rm(temporary, { force: true });
  await fs.rm(`${temporary}.inspect.ndjson`, { force: true });
}
console.log(`Recalculated workbook: ${output}`);
console.log("Cached results, formula preservation and independent financial controls verified before replacement.");
