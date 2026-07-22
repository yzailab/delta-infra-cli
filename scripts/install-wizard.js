#!/usr/bin/env node
// Copyright (c) 2026 Delta Infra Authors
// SPDX-License-Identifier: MIT

const fs = require("fs");
const path = require("path");
const { execFileSync, execFile } = require("child_process");
const p = require("@clack/prompts");

const PKG = "@delta-infra/cli";
const SKILLS_REPO = "yzailab/delta-infra-cli";
const NPM_REGISTRIES = ["https://registry.npmmirror.com", "https://registry.npmjs.org"];
const GH_MIRRORS = ["https://gh.ddlc.top", "https://ghproxy.net", "https://gh-proxy.com"];
const CONFIG_DIR = path.join(osHomedir(), ".delta-infra");
const CONFIG_VERSION = 1;
const DEFAULT_BASE_URL = "https://delta-infra-nacos-test.yangtzeailab.com/sandbox/api/v1";
const isWindows = process.platform === "win32";

const PLATFORM_PATHS = {
  agents:   [".agents", "skills"],
  claude:   [".claude", "skills"],
  opencode: [".config", "opencode", "skills"],
  cursor:   [".cursor", "skills"],
  mementos: ["memento_s", "skills"],
};

const PLATFORM_LABELS = {
  zh: {
    agents:   "通用 Agent 目录 (~/.agents/skills) — Codex / Cursor / OpenCode",
    claude:   "Claude Code (~/.claude/skills)",
    opencode: "OpenCode 原生目录 (~/.config/opencode/skills)",
    cursor:   "Cursor (~/.cursor/skills)",
    mementos: "Memento-S 开发模式 (~/memento_s/skills)",
  },
  en: {
    agents:   "Generic agent dir (~/.agents/skills) — Codex / Cursor / OpenCode",
    claude:   "Claude Code (~/.claude/skills)",
    opencode: "OpenCode native dir (~/.config/opencode/skills)",
    cursor:   "Cursor (~/.cursor/skills)",
    mementos: "Memento-S dev mode (~/memento_s/skills)",
  },
};

const SKILL_NAMES = ["delta-sandbox", "delta-shared", "delta-science"];
const LANG = "zh";

function platformSkillDir(platform) {
  return path.join(osHomedir(), ...PLATFORM_PATHS[platform]);
}

// ── i18n ────────────────────────────────────────────────────────────────────

const messages = {
  zh: {
    setup:          "正在设置 Delta Infra CLI...",
    upgrade:        "正在升级 %s (v%s → v%s)...",
    step1:          "正在安装 %s...",
    step1Skip:      "已安装 (v%s)，跳过",
    step1Done:      "已全局安装",
    step1Upgraded:  "已升级到 v%s",
    step1Fail:      "全局安装失败。运行以下命令重试: npm install -g %s",
    step2:          "安装 AI Skills",
    step2SelectPlatforms: "选择需要安装 Delta Skills 的 AI 工具平台（可多选）",
    step2Spinner:   "正在安装 Skills...",
    step2Done:      "Skills 已安装",
    step2DoneFor:   "已安装至: %s",
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
    done:           "安装完成！\n现在可以让你的 AI 工具使用 delta-cli 管理 Delta Sandbox 资源或调用 Science 工具。",
    cancelled:      "安装已取消",
    nonTtyHint:     "要完成配置，请在终端中运行：\n  delta-cli config init\n  delta-cli auth login",
  },
  en: {
    setup:          "Setting up Delta Infra CLI...",
    upgrade:        "Upgrading %s (v%s → v%s)...",
    step1:          "Installing %s globally...",
    step1Skip:      "Already installed (v%s). Skipped",
    step1Done:      "Installed globally",
    step1Upgraded:  "Upgraded to v%s",
    step1Fail:      "Failed to install globally. Run manually: npm install -g %s",
    step2:          "Install AI skills",
    step2SelectPlatforms: "Select AI tool platforms to install Delta Skills (multi-select)",
    step2Spinner:   "Installing skills...",
    step2Done:      "Skills installed",
    step2DoneFor:   "Installed to: %s",
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
    done:           "You are all set!\nYour AI tool can now use delta-cli to manage Delta Sandbox resources or invoke Science tools.",
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
    }, (err, stdout, stderr) => {
      if (err) {
        err.stdout = stdout;
        err.stderr = stderr;
        reject(err);
      }
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

function isInteractiveEnv() {
  return !!process.stdin.isTTY &&
    !!process.stdout.isTTY &&
    !process.env.CI &&
    !process.env.NO_COLOR &&
    process.env.TERM !== "dumb";
}

function createSpinner() {
  if (isInteractiveEnv()) return p.spinner();
  return {
    start: (msg) => { if (msg) console.log(msg); },
    stop: (msg) => { if (msg) console.log(msg); },
  };
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

function writeDefaultConfig(existing = null) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  const config = {
    version: CONFIG_VERSION,
    base_url: DEFAULT_BASE_URL,
  };
  if (existing && existing.token) {
    config.token = existing.token;
  }
  if (existing && existing.science_base_url) {
    config.science_base_url = existing.science_base_url;
  }
  fs.writeFileSync(path.join(CONFIG_DIR, "config.json"), JSON.stringify(config, null, 2) + "\n", { mode: 0o600 });
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
  const s = createSpinner();
  if (needsUpgrade) {
    s.start(fmt(msg.upgrade, PKG, installedVer, latestVer));
  } else {
    s.start(fmt(msg.step1, PKG));
  }
  try {
    let installed = false;
    for (const registry of NPM_REGISTRIES) {
      try {
        await runSilentAsync("npm", ["install", "-g", PKG, "--registry", registry], {
          timeout: 300000,
          env: { ...process.env, DELTA_CLI_MIRROR: GH_MIRRORS[0] },
        });
        installed = true;
        break;
      } catch { }
    }
    if (!installed) throw new Error("all npm registries failed");

    if (targetVer) {
      for (const mirror of GH_MIRRORS) {
        try {
          await runSilentAsync(process.execPath, [
            path.join(__dirname, "install.js"),
          ], {
            timeout: 300000,
            env: { ...process.env, DELTA_CLI_RUN: "true", DELTA_CLI_VERSION: targetVer, DELTA_CLI_MIRROR: mirror },
          });
          break;
        } catch { }
      }
    }
    s.stop(needsUpgrade ? fmt(msg.step1Upgraded, latestVer) : msg.step1Done);
    return needsUpgrade;
  } catch {
    s.stop(fmt(msg.step1Fail, PKG));
    process.exit(1);
  }
}

function findPackageSkillsDir() {
  const candidates = [];
  try {
    const npmRoot = runSilent("npm", ["root", "-g"], { timeout: 10000 })
      .toString().trim();
    candidates.push(path.join(npmRoot, PKG, "skills"));
  } catch {}
  candidates.push(path.join(__dirname, "..", "skills"));

  for (const c of candidates) {
    if (fs.existsSync(path.join(c, "delta-sandbox", "SKILL.md"))) {
      return c;
    }
  }
  return null;
}

function installSkillsFromLocalPackage(platforms) {
  const pkgSkillsDir = findPackageSkillsDir();
  if (!pkgSkillsDir) return false;

  for (const platform of platforms) {
    const targetDir = platformSkillDir(platform);
    fs.mkdirSync(targetDir, { recursive: true });
    for (const skill of SKILL_NAMES) {
      const src = path.join(pkgSkillsDir, skill);
      if (!fs.existsSync(src)) continue;
      const dst = path.join(targetDir, skill);
      try { fs.rmSync(dst, { recursive: true, force: true }); } catch {}
      fs.cpSync(src, dst, { recursive: true });
    }
  }
  return true;
}

async function stepSelectPlatforms(msg) {
  if (!isInteractiveEnv()) {
    return ["agents"];
  }
  const labels = PLATFORM_LABELS[LANG];
  const defaultPlatforms = fs.existsSync(path.dirname(platformSkillDir("claude")))
    ? ["agents", "claude", "mementos"]
    : ["agents", "mementos"];
  const selected = await p.multiselect({
    message: msg.step2SelectPlatforms,
    options: Object.keys(PLATFORM_PATHS).map((key) => ({
      value: key,
      label: labels[key],
    })),
    initialValues: defaultPlatforms,
    required: true,
  });
  handleCancel(selected, msg);
  return selected;
}

async function stepInstallSkills(msg, platforms) {
  const s = createSpinner();
  s.start(msg.step2Spinner);
  try {
    try {
      if (installSkillsFromLocalPackage(platforms)) {
        s.stop(msg.step2Done);
        p.log.info(fmt(msg.step2DoneFor, platforms.join(", ")));
        return;
      }
    } catch { }

    if (!platforms.includes("agents")) {
      throw new Error("local skills package not found and agent dir not selected");
    }

    const urls = [
      `https://gh.ddlc.top/https://github.com/${SKILLS_REPO}`,
      `https://ghproxy.net/https://github.com/${SKILLS_REPO}`,
      `https://github.com/${SKILLS_REPO}`,
    ];
    let lastErr;
    for (const url of urls) {
      try {
        s.start(`${msg.step2Spinner} (try ${url.split("/")[2]})`);
        await runSilentAsync("npx", ["-y", "skills", "add", url, "-y", "-g"], {
          timeout: 15000,
          env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
        });
        s.stop(msg.step2Done);
        p.log.info(fmt(msg.step2DoneFor, "agents"));
        return;
      } catch (e) {
        lastErr = e;
        if (e && e.stderr) console.error(`[skills mirror failed] ${url}: ${e.stderr.toString().trim().slice(0, 200)}`);
        else if (e && e.message) console.error(`[skills mirror failed] ${url}: ${e.message}`);
      }
    }
    throw lastErr;
  } catch {
    s.stop(fmt(msg.step2Fail, SKILLS_REPO));
    process.exit(1);
  }
}

async function stepConfigInit(msg) {
  const s = createSpinner();
  s.start(msg.step3);

  const existingConfig = getExistingConfig();

  if (existingConfig && existingConfig.base_url) {
    s.stop(msg.step3);
    const reuse = await p.confirm({
      message: `发现已有配置 (Server: ${existingConfig.base_url})，继续使用？`,
    });
    if (p.isCancel(reuse)) {
      handleCancel(reuse, msg);
      return;
    }
    if (reuse) {
      p.log.info(msg.step3Skip);
      return;
    }
  }

  try {
    writeDefaultConfig(existingConfig);
    s.stop(msg.step3Done);
  } catch (e) {
    s.stop(msg.step3Fail);
    p.log.error(e.message || String(e));
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
  const s = createSpinner();
  s.start("Removing AI skills...");

  let removedLocally = false;
  for (const platform of Object.keys(PLATFORM_PATHS)) {
    const dir = platformSkillDir(platform);
    for (const skill of SKILL_NAMES) {
      try {
        fs.rmSync(path.join(dir, skill), { recursive: true, force: true });
        removedLocally = true;
      } catch { }
    }
  }

  if (removedLocally) {
    s.stop("AI skills removed");
    return;
  }

  try {
    await runSilentAsync("npx", ["-y", "skills", "remove", "delta-sandbox", "delta-shared", "-g"], {
      timeout: 60000,
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
  const s = createSpinner();
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
  const isInteractive = isInteractiveEnv();

  if (isInteractive) {
    p.intro(messages.zh.setup);
    await stepInstallGlobally(messages.zh);
    const platforms = await stepSelectPlatforms(messages.zh);
    await stepInstallSkills(messages.zh, platforms);
    await stepConfigInit(messages.zh);
    await stepAuthLogin(messages.zh);
    p.outro(messages.zh.done);
  } else {
    console.log(messages.zh.setup);
    await stepInstallGlobally(messages.zh);
    const platforms = ["agents"];
    await stepInstallSkills(messages.zh, platforms);
    console.log(messages.zh.nonTtyHint);
  }
}

async function doUninstall() {
  const isInteractive = isInteractiveEnv();

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
