require("dotenv").config();
const path = require("path");
const { spawnSync } = require("child_process");

const DRY_RUN = process.argv.includes("--dry-run");

const runNode = (scriptRelPath) => {
  const scriptPath = path.resolve(__dirname, scriptRelPath);
  const args = [scriptPath, ...(DRY_RUN ? ["--dry-run"] : [])];
  const result = spawnSync(process.execPath, args, { stdio: "inherit" });
  if (result.error) throw result.error;
  if (typeof result.status === "number" && result.status !== 0) {
    throw new Error(`Script failed: ${path.basename(scriptRelPath)} (exit=${result.status})`);
  }
};

try {
  console.log(DRY_RUN ? "[DRY RUN] Sync VATLY from repo" : "Sync VATLY from repo");
  runNode("importVatLyFromHtml.js");
  console.log(DRY_RUN ? "[DRY RUN] VATLY sync done" : "VATLY sync done");
  process.exit(0);
} catch (error) {
  console.error(DRY_RUN ? "VATLY_SYNC_DRY_FAIL" : "VATLY_SYNC_FAIL", error.message);
  process.exit(1);
}

