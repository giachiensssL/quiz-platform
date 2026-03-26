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

try {
  console.log(DRY_RUN ? "[DRY RUN] Sync KTCT from repo" : "Sync KTCT from repo");
  runNode("importKtctFromTxt.js");
  console.log(DRY_RUN ? "[DRY RUN] KTCT sync done" : "KTCT sync done");
  process.exit(0);
} catch (error) {
  console.error(DRY_RUN ? "KTCT_SYNC_DRY_FAIL" : "KTCT_SYNC_FAIL", error.message);
  process.exit(1);
}

