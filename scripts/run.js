#!/usr/bin/env node
// Copyright (c) 2026 Delta Infra Authors
// SPDX-License-Identifier: MIT

const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ext = process.platform === "win32" ? ".exe" : "";
const bin = path.join(__dirname, "..", "bin", "delta-cli" + ext);

// On Windows, a crashed self-update may have left the binary renamed to .old.
const oldBin = bin + ".old";
function restoreOldBinary() {
  try {
    if (fs.existsSync(bin)) {
      fs.rmSync(bin, { force: true });
    }
    fs.renameSync(oldBin, bin);
    return true;
  } catch { return false; }
}

if (process.platform === "win32" && fs.existsSync(oldBin)) {
  if (!fs.existsSync(bin)) {
    restoreOldBinary();
  } else {
    try {
      execFileSync(bin, ["--version"], { stdio: "ignore", timeout: 10000 });
      try { fs.rmSync(oldBin, { force: true }); } catch {}
    } catch {
      restoreOldBinary();
    }
  }
}

const args = process.argv.slice(2);

// Intercept install/uninstall — run wizard, bypass native binary
if (args[0] === "install" || args[0] === "uninstall") {
  require("./install-wizard.js");
} else {
  // Auto-download binary if missing (e.g. npx skipped postinstall)
  if (!fs.existsSync(bin)) {
    try {
      execFileSync(process.execPath, [path.join(__dirname, "install.js")], {
        stdio: "inherit",
        env: { ...process.env, DELTA_CLI_RUN: "true", DELTA_CLI_VERSION: process.env.DELTA_CLI_VERSION || "" },
      });
    } catch {
      console.error(
        `\nFailed to auto-install delta-cli binary.\n` +
        `To fix, run the install script manually:\n` +
        `  node "${path.join(__dirname, "install.js")}"\n`
      );
      process.exit(1);
    }
  }

  try {
    execFileSync(bin, args, { stdio: "inherit" });
  } catch (e) {
    process.exit(e.status || 1);
  }
}
