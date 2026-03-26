require("dotenv").config();
const path = require("path");
const { spawnSync } = require("child_process");

const DRY_RUN = process.argv.includes("--dry-run");

const runNode = (scriptRelPath, extraArgs = []) => {
  const scriptPath = path.resolve(__dirname, scriptRelPath);
  const args = [scriptPath, ...(DRY_RUN ? ["--dry-run"] : []), ...extraArgs];
  const result = spawnSync(process.execPath, args, { stdio: "inherit" });
  if (result.error) throw result.error;
  if (typeof result.status === "number" && result.status !== 0) {
    const err = new Error(`Script failed: ${path.basename(scriptRelPath)} (exit=${result.status})`);
    err.exitCode = result.status;
    throw err;
  }
};

const main = () => {
  console.log(DRY_RUN ? "[DRY RUN] Sync MONHOC from repo" : "Sync MONHOC from repo");

  // 1) Ensure subjects/lessons exist (PLDC, QTH, TMDT).
  runNode("importMonhocSubjects.js");

  // 2) Import question text + initial answers (PLDC from extracted docx text).
  runNode("importPldcFromStarDocx.js");

  // 3) Apply correct answer keys for PLDC from monhoc/pldc.txt.
  runNode("applyPldcAnswerKeyFromTxt.js");

  // 4) Import QTH/TMDT from repo txt where '*' marks correctness.
  runNode("importQthFromStarTxt.js");
  runNode("importTmdtFromStarTxt.js");

  console.log(DRY_RUN ? "[DRY RUN] MONHOC sync done" : "MONHOC sync done");
};

try {
  main();
  process.exit(0);
} catch (error) {
  console.error(DRY_RUN ? "MONHOC_SYNC_DRY_FAIL" : "MONHOC_SYNC_FAIL", error.message);
  process.exit(1);
}

