#!/usr/bin/env node
// Copyright (c) 2026 Delta Infra Authors
// SPDX-License-Identifier: MIT

const fs = require("fs");
const path = require("path");
const { execFileSync, execFile } = require("child_process");
const p = require("@clack/prompts");

const PKG = "@delta-infra/cli";
const SKILLS_REPO = "yzailab/delta-infra-cli";
const CONFIG_DIR = path.join(osHomedir(), ".delta-infra");
const isWindows = process.platform === "win32";

// ── i18n ────────────────────────────────────────────────────────────────────

const messages = {
  zh: {
    setup:          "正在设置 Delta Sandbox CLI...",
    upgrade:        "正在升级 %s (v%s → v%s)...",
    step1:          "正在安装 %s...",
    step1Skip:      "已安装 (v%s)，跳过",
    step1Done:      "已全局安装",
    step1Upgraded:  "已升级到 v%s",
    step1Fail:      "全局安装失败。运行以下命令重试: npm install -g %s",
    step2:          "安装 AI Skills",
    step2Spinner:   "正在安装 Skills...",
    step2Done:      "Skills 已安装",
    step2Skip:      "已安装，跳过",
    step2Fail:      "Skills 安装失败。运行以下命令重试: npx skills add %s -y -g",
    step3:          "正在初始化配置...",
    step3Skip:      "跳过配置初始化",
    step3Done:      "配置已初始化",
    step3Fail:      "配置初始化失败。运行以下命令重试: delta-cli config init",
    step4:          "身份认证",
    step4Confirm:   "是否进行身份认证？",
    step4Skip:      "跳过身份认证。后续运行 delta-cli auth login 完成",
    step4Done:      "认证完成",
    step4Fail:      "认证失败。运行以下命令重试: delta-cli auth login",
    done:           "安装完成！\n现在可以和你的 AI 工具说：\"帮我使用 delta sandbox 运行一个 GPU 任务\"",
    cancelled:      "安装已取消",
    nonTtyHint:     "要完成配置，请在终端中运行：\n  delta-cli config init\n  delta-cli auth login",
  },
  en: {
    setup:          "Setting up Delta Sandbox CLI...",
    upgrade:        "Upgrading %s (v%s → v%s)...",
    step1:          "Installing %s globally...",
    step1Skip:      "Already installed (v%s). Skipped",
    step1Done:      "Installed globally",
    step1Upgraded:  "Upgraded to v%s",
    step1Fail:      "Failed to install globally. Run manually: npm install -g %s",
    step2:          "Install AI skills",
    step2Spinner:   "Installing skills...",
    step2Done:      "Skills installed",
    step2Skip:      "Already installed. Skipped",
    step2Fail:      "Failed to install skills. Run manually: npx skills add %s -y -g",
    step3:          "Initializing config...",
    step3Skip:      "Skipped config initialization",
    step3Done:      "Config initialized",
    step3Fail:      "Failed to init config. Run manually: delta-cli config init",
    step4:          "Authorization",
    step4Confirm:   "Would you like to authenticate now?",
    step4Skip:      "Skipped. Run delta-cli auth login to authorize later",
    step4Done:      "Authorization complete",
    step4Fail:      "Failed to authorize. Run delta-cli auth login to retry",
    done:           "You are all set!\nNow try asking your AI tool: \"Help me run a GPU task with delta sandbox\"",
    cancelled:      "Installation cancelled",
    nonTtyHint:     "To complete setup, run interactively:\n  delta-cli config init\n  delta-cli auth login",
  },
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function handleCancel(value, msg) {
  if (p.isCancel(value)) {
    p.cancel(msg.cancelled);
    process.exit(0);
  }
  return value;
}

function execCmd(cmd, args, opts) {
  if (isWindows) {
    return execFileSync("cmd.exe", ["/c", cmd, ...args], opts);
  }
  return execFileSync(cmd, args, opts);
}

function run(cmd, args, opts = {}) {
  execCmd(cmd, args, { stdio: "inherit", ...opts });
}

function runSilent(cmd, args, opts = {}) {
  return execCmd(cmd, args, {
    stdio: ["ignore", "pipe", "pipe"],
    ...opts,
  });
}

function runSilentAsync(cmd, args, opts = {}) {
  const actualCmd = isWindows ? "cmd.exe" : cmd;
  const actualArgs = isWindows ? ["/c", cmd, ...args] : args;
  return new Promise((resolve, reject) => {
    execFile(actualCmd, actualArgs, {
      stdio: ["ignore", "pipe", "pipe"],
      ...opts,
    }, (err, stdout) => {
      if (err) reject(err);
      else resolve(stdout);
    });
  });
}

function fmt(template, ...values) {
  let i = 0;
  return template.replace(/%s/g, () => values[i++] ?? "");
}

function osHomedir() {
  return process.env.HOME ||
    process.env.USERPROFILE ||
    (process.env.HOMEDRIVE && process.env.HOMEPATH && process.env.HOMEDRIVE + process.env.HOMEPATH) ||
    "/root";
}

function whichDeltaCli() {
  try {
    const prefix = execFileSync("npm", ["prefix", "-g"], {
      stdio: ["ignore", "pipe", "pipe"],
    }).toString().trim();
    const bin = isWindows
      ? path.join(prefix, "delta-cli.cmd")
      : path.join(prefix, "bin", "delta-cli");
    if (fs.existsSync(bin)) return bin;
  } catch {}
  try {
    const cmd = isWindows ? "where" : "which";
    return execFileSync(cmd, ["delta-cli"], { stdio: ["ignore", "pipe", "pipe"] })
      .toString().split("\n")[0].trim();
  } catch {
    return null;
  }
}

function getLatestVersion() {
  try {
    const out = runSilent("npm", ["view", PKG, "version"], { timeout: 15000 });
    const ver = out.toString().trim();
    return /^\d+\.\d+\.\d+/.test(ver) ? ver : null;
  } catch { return null; }
}

function semverLessThan(a, b) {
  const pa = a.replace(/-.*$/, "").split(".").map(Number);
  const pb = b.replace(/-.*$/, "").split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) < (pb[i] || 0)) return true;
    if ((pa[i] || 0) > (pb[i] || 0)) return false;
  }
  return false;
}

function getGloballyInstalledVersion() {
  try {
    const out = runSilent("npm", ["list", "-g", PKG], { timeout: 15000 });
    const match = out.toString().match(/@(\d+\.\d+\.\d+[^\s]*)/);
    return match ? match[1] : "unknown";
  } catch { return null; }
}

function getExistingConfig() {
  try {
    const configPath = path.join(CONFIG_DIR, "config.json");
    if (!fs.existsSync(configPath)) return null;
    return JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch { return null; }
}

// ── Steps ───────────────────────────────────────────────────────────────────

async function stepInstallGlobally(msg) {
  const installedVer = getGloballyInstalledVersion();
  const latestVer = getLatestVersion();
  const needsUpgrade = installedVer && latestVer && semverLessThan(installedVer, latestVer);

  if (installedVer && !needsUpgrade) {
    p.log.info(fmt(msg.step1Skip, installedVer));
    return false;
  }

  const targetVer = latestVer || installedVer;
  const s = p.spinner();
  if (needsUpgrade) {
    s.start(fmt(msg.upgrade, PKG, installedVer, latestVer));
  } else {
    s.start(fmt(msg.step1, PKG));
  }
  try {
    // Install the npm package (which triggers postinstall → install.js),
    // then explicitly download the correct version binary in case the
    // npx cache has stale package.json that misleads install.js.
    await runSilentAsync("npm", ["install", "-g", PKG], { timeout: 120000 });
    if (targetVer) {
      await runSilentAsync(process.execPath, [
        path.join(__dirname, "install.js"),
      ], {
        timeout: 120000,
        env: { ...process.env, DELTA_CLI_RUN: "true", DELTA_CLI_VERSION: targetVer },
      });
    }
    s.stop(needsUpgrade ? fmt(msg.step1Upgraded, latestVer) : msg.step1Done);
    return needsUpgrade;
  } catch {
    s.stop(fmt(msg.step1Fail, PKG));
    process.exit(1);
  }
}

async function skillsAlreadyInstalled() {
  try {
    const out = await runSilentAsync("npx", ["-y", "skills", "ls", "-g"], {
      timeout: 120000,
    });
    return /^delta-/m.test(out.toString());
  } catch { return false; }
}

async function stepInstallSkills(msg) {
  const s = p.spinner();
  s.start(msg.step2Spinner);
  try {
    if (await skillsAlreadyInstalled()) {
      s.stop(msg.step2Skip);
      return;
    }
    const GH_PROXY = "https://gh-proxy.com/https://github.com";
    const urls = [
      `${GH_PROXY}/${SKILLS_REPO}`,
      SKILLS_REPO,
      `https://github.com/${SKILLS_REPO}`,
    ];
    let lastErr;
    for (const url of urls) {
      try {
        await runSilentAsync("npx", ["-y", "skills", "add", url, "-y", "-g"], {
          timeout: 120000,
          env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
        });
        s.stop(msg.step2Done);
        return;
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr;
  } catch {
    s.stop(fmt(msg.step2Fail, SKILLS_REPO));
    process.exit(1);
  }
}

async function stepConfigInit(msg) {
  const s = p.spinner();
  s.start(msg.step3);

  const deltaCli = whichDeltaCli();
  if (!deltaCli) {
    s.stop(msg.step3);
    p.log.warn("delta-cli not found on PATH after global install.");
    p.log.info(msg.step3Fail);
    return;
  }

  // Check if config already exists with valid data
  const existingConfig = getExistingConfig();
  s.stop(msg.step3);

  if (existingConfig && existingConfig.base_url) {
    const reuse = await p.confirm({
      message: `发现已有配置 (Server: ${existingConfig.base_url})，继续使用？`,
    });
    if (handleCancel(reuse, msg) && reuse) {
      p.log.info(msg.step3Skip);
      return;
    }
  }

  try {
    run(deltaCli, ["config", "init"]);
    p.log.success(msg.step3Done);
  } catch {
    p.log.error(msg.step3Fail);
    process.exit(1);
  }
}

async function stepAuthLogin(msg) {
  const deltaCli = whichDeltaCli();
  if (!deltaCli) {
    p.log.warn("delta-cli not found, skipping authorization");
    return;
  }

  const yes = await p.confirm({
    message: msg.step4Confirm,
  });
  if (p.isCancel(yes)) {
    p.cancel(msg.cancelled);
    process.exit(0);
  }
  if (!yes) {
    p.log.info(msg.step4Skip);
    return;
  }

  p.log.step(msg.step4);
  try {
    run(deltaCli, ["auth", "login"]);
    p.log.success(msg.step4Done);
  } catch {
    p.log.warn(msg.step4Fail);
  }
}

// ── Uninstall steps ─────────────────────────────────────────────────────────

async function stepUninstallSkills(msg) {
  const s = p.spinner();
  s.start("Removing AI skills...");
  try {
    await runSilentAsync("npx", ["-y", "skills", "remove", "delta-sandbox", "delta-shared", "-g"], {
      timeout: 120000,
    });
    s.stop("AI skills removed");
  } catch {
    s.stop("Warning: skill removal failed. You can retry:");
    p.log.info("  npx skills remove delta-sandbox delta-shared -g");
  }
}

function stepRemoveConfig() {
  if (!fs.existsSync(CONFIG_DIR)) {
    return;
  }
  fs.rmSync(CONFIG_DIR, { recursive: true, force: true });
}

async function stepUninstallPackage(msg) {
  const installedVer = getGloballyInstalledVersion();
  if (!installedVer) {
    return;
  }
  const s = p.spinner();
  s.start("Removing global package...");
  try {
    await runSilentAsync("npm", ["uninstall", "-g", PKG], { timeout: 60000 });
    s.stop("Package removed");
  } catch {
    s.stop("Failed to remove global package");
    p.log.info(`  npm uninstall -g ${PKG}`);
  }
}

// ── Main ────────────────────────────────────────────────────────────────────

async function doInstall() {
  const isInteractive = !!process.stdin.isTTY;

  if (isInteractive) {
    p.intro(messages.zh.setup);
    await stepInstallGlobally(messages.zh);
    await stepInstallSkills(messages.zh);
    await stepConfigInit(messages.zh);
    await stepAuthLogin(messages.zh);
    p.outro(messages.zh.done);
  } else {
    console.log(messages.zh.setup);
    await stepInstallGlobally(messages.zh);
    await stepInstallSkills(messages.zh);
    console.log(messages.zh.nonTtyHint);
  }
}

async function doUninstall() {
  const isInteractive = !!process.stdin.isTTY;

  if (isInteractive) {
    const ok = await p.confirm({
      message: "将移除全局包、AI Skills 和配置文件。是否继续？",
    });
    if (p.isCancel(ok) || !ok) {
      p.cancel("卸载已取消");
      process.exit(0);
    }
  }

  await stepRemoveConfig();
  await stepUninstallSkills();
  await stepUninstallPackage();

  if (isInteractive) {
    p.outro("卸载完成");
  } else {
    console.log("\nUninstall complete.");
  }
}

function main() {
  const subcommand = process.argv[2];
  if (subcommand === "uninstall") {
    doUninstall().catch((e) => {
      console.error("[delta-cli] Uninstall failed:", e.message);
      process.exit(1);
    });
  } else {
    doInstall().catch((e) => {
      console.error("[delta-cli] Install failed:", e.message);
      process.exit(1);
    });
  }
}

main();
