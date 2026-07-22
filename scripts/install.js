// Copyright (c) 2026 Delta Infra Authors
// SPDX-License-Identifier: MIT

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const os = require("os");
const crypto = require("crypto");

const PKG = "@delta-infra/cli";

// Resolve the version to download:
//   env var > npm registry > local package.json (fallback)
function resolveVersion() {
  if (process.env.DELTA_CLI_VERSION) return process.env.DELTA_CLI_VERSION.replace(/^v/, "");
  try {
    const out = require("child_process").execFileSync("npm", ["view", PKG, "version"], {
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 15000,
      encoding: "utf8",
    });
    const ver = out.trim();
    if (/^\d+\.\d+\.\d+/.test(ver)) return ver;
  } catch {}
  return require("../package.json").version.replace(/-.*$/, "");
}

const VERSION = resolveVersion();
const NAME = "delta-cli";
const REPO = "yzailab/delta-infra-cli";
const DEFAULT_ALLOWED_HOSTS = new Set([
  "github.com",
  "gh-proxy.com",
  "ghproxy.net",
  "gh.ddlc.top",
  "objects.githubusercontent.com",
  "release-assets.githubusercontent.com",
  "github-releases.githubusercontent.com",
  "raw.githubusercontent.com",
  "registry.npmmirror.com",
]);
const DEFAULT_ALLOWED_HOST_PREFIXES = [
  "github-production-release-asset-",
];

const PLATFORM_MAP = {
  darwin: "darwin",
  linux: "linux",
  win32: "windows",
};

const ARCH_MAP = {
  x64: "amd64",
  arm64: "arm64",
};

const platform = PLATFORM_MAP[process.platform];
const arch = ARCH_MAP[process.arch];

const isWindows = process.platform === "win32";
const ext = isWindows ? ".zip" : ".tar.gz";
const archiveName = `${NAME}-${platform}-${arch}${ext}`;
const GITHUB_URL = `https://github.com/${REPO}/releases/download/v${VERSION}/${archiveName}`;

const binDir = path.join(__dirname, "..", "bin");
const dest = path.join(binDir, NAME + (isWindows ? ".exe" : ""));

// ── Mirror URL resolution ──────────────────────────────────────────────────

var _curlTimeoutMs = null;

function _getCurlTimeout() {
  if (_curlTimeoutMs !== null) return _curlTimeoutMs;
  var env = process.env.DELTA_CLI_DOWNLOAD_TIMEOUT;
  var t = env ? parseInt(env, 10) : 0;
  _curlTimeoutMs = t > 0 ? t : 60000;
  return _curlTimeoutMs;
}

// GitHub release download mirrors.
// Format: [hostname, urlPrefix] — urlPrefix is prepended to the GitHub URL.
var _MIRROR_LIST = [
  ["gh.ddlc.top",    "https://gh.ddlc.top"],
  ["ghproxy.net",    "https://ghproxy.net"],
  ["gh-proxy.com",   "https://gh-proxy.com"],
];

// Quick connectivity check: fetch a small file (checksums.txt) from each
// mirror and return only the ones that respond within the probe timeout.
function probeMirrors(version, cb) {
  console.error("Probing " + _MIRROR_LIST.length + " download mirrors...");
  var probeUrl = "/https://github.com/" + REPO + "/releases/download/v" + version + "/checksums.txt";
  var results = [];
  var pending = _MIRROR_LIST.length;
  var done = false;

  function finish() {
    if (done) return;
    done = true;
    if (results.length > 0) {
      console.error("Found " + results.length + " available mirror(s)");
    } else {
      console.error("No mirror responded, falling back to GitHub source");
    }
    cb(results);
  }

  if (pending === 0) return finish();

  for (var i = 0; i < _MIRROR_LIST.length; i++) {
    (function(idx) {
      var entry = _MIRROR_LIST[idx];
      var host = entry[0];
      var prefix = entry[1];
      var testUrl = prefix + probeUrl;
      var args = [
        "--fail", "--location", "--silent", "--show-error",
        "--connect-timeout", "3", "--max-time", "5",
        "--output", "/dev/null", testUrl,
      ];
      var child;
      try {
        child = require("child_process").spawn("curl", args, { stdio: ["ignore", "pipe", "pipe"], timeout: 5000 });
        var stdout = "";
        var stderr = "";
        child.stdout.on("data", function(d) { stdout += d; });
        child.stderr.on("data", function(d) { stderr += d; });
        child.on("close", function(code) {
          if (code === 0) {
            results.push(prefix + "/https://github.com/" + REPO + "/releases/download/v" + version + "/" + archiveName);
          }
          pending--;
          if (pending === 0) finish();
        });
        child.on("error", function() {
          pending--;
          if (pending === 0) finish();
        });
      } catch (e) {
        pending--;
        if (pending === 0) finish();
      }
    })(i);
  }
  // Safety timeout: if probes hang, continue without mirrors after 10s
  setTimeout(finish, 5000);
}

function releaseAssetUrls(version, assetName, cb) {
  var urls = [];
  var mirror = process.env.DELTA_CLI_MIRROR || "";
  if (mirror) {
    urls.push("" + mirror.replace(/\/$/, "") + "/yzailab/delta-infra-cli/releases/download/v" + version + "/" + assetName);
  }
  // Probe mirrors in parallel first, then fallback
  probeMirrors(version, function(mirrorUrls) {
    for (var i = 0; i < mirrorUrls.length; i++) {
      urls.push(mirrorUrls[i]);
    }
    // GitHub source (last resort)
    urls.push(GITHUB_URL);
    cb(urls);
  });
}

function assertAllowedHost(url) {
  const { hostname } = new URL(url);
  const allowlist = new Set(DEFAULT_ALLOWED_HOSTS);
  (process.env.DELTA_CLI_MIRROR_ALLOWLIST || "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean)
    .forEach((h) => allowlist.add(h));
  for (const allowed of allowlist) {
    if (hostname === allowed || hostname.endsWith("." + allowed)) return;
  }
  for (const prefix of DEFAULT_ALLOWED_HOST_PREFIXES) {
    if (hostname.startsWith(prefix)) return;
  }
  throw new Error(`Download host not allowed: ${hostname}`);
}

// ── curl version detection (for --ssl-revoke-best-effort) ──────────────────

function isCurlVersionSupported(versionOutput) {
  const match = String(versionOutput).match(/^\s*curl\s+(\d+)\.(\d+)\.(\d+)/i);
  if (!match) return false;
  const major = parseInt(match[1], 10);
  const minor = parseInt(match[2], 10);
  return major > 7 || (major === 7 && minor >= 70);
}

let _curlSupportsSslRevokeBestEffort;

function curlSupportsSslRevokeBestEffort() {
  if (_curlSupportsSslRevokeBestEffort !== undefined) {
    return _curlSupportsSslRevokeBestEffort;
  }
  try {
    const output = execFileSync("curl", ["--version"], {
      stdio: ["ignore", "pipe", "ignore"],
      encoding: "utf8",
      timeout: 5000,
    });
    _curlSupportsSslRevokeBestEffort = isCurlVersionSupported(output);
  } catch {
    _curlSupportsSslRevokeBestEffort = false;
  }
  return _curlSupportsSslRevokeBestEffort;
}

// ── Download ───────────────────────────────────────────────────────────────

function download(url, destPath) {
  assertAllowedHost(url);
  const args = [
    "--fail", "--location", "--silent", "--show-error",
    "--connect-timeout", "10",
    "--max-time", "45",
    "--speed-limit", "50000", "--speed-time", "10",
    "--max-redirs", "3",
    "--output", destPath,
  ];
  if (isWindows && curlSupportsSslRevokeBestEffort()) {
    args.unshift("--ssl-revoke-best-effort");
  }
  args.push(url);
  execFileSync("curl", args, { stdio: ["ignore", "ignore", "pipe"] });
}

// ── Extraction ─────────────────────────────────────────────────────────────

function extractZipWindows(archivePath, destDir) {
  const psOpts = ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command"];
  const psEnv = {
    DELTA_CLI_ARCHIVE: archivePath,
    DELTA_CLI_DEST: destDir,
  };
  try {
    const dotnet =
      "$ErrorActionPreference='Stop';" +
      "Add-Type -AssemblyName System.IO.Compression.FileSystem;" +
      "[System.IO.Compression.ZipFile]::ExtractToDirectory($env:DELTA_CLI_ARCHIVE,$env:DELTA_CLI_DEST)";
    execFileSync("powershell.exe", [...psOpts, dotnet], { stdio: ["ignore", "inherit", "inherit"], env: psEnv });
  } catch (primaryErr) {
    try {
      const cmdlet =
        "$ErrorActionPreference='Stop';" +
        "Expand-Archive -LiteralPath $env:DELTA_CLI_ARCHIVE -DestinationPath $env:DELTA_CLI_DEST -Force";
      execFileSync("powershell.exe", [...psOpts, cmdlet], { stdio: ["ignore", "inherit", "inherit"], env: psEnv });
    } catch (secondErr) {
      try {
        execFileSync("tar", ["-xf", archivePath, "-C", destDir], { stdio: "ignore" });
      } catch (fallbackErr) {
        throw new Error(
          `Failed to extract ${archivePath}. ` +
          `.NET ZipFile: ${primaryErr.message}. ` +
          `Expand-Archive: ${secondErr.message}. ` +
          `tar: ${fallbackErr.message}`
        );
      }
    }
  }
}

// ── Checksum ───────────────────────────────────────────────────────────────

function getExpectedChecksum(archiveName, checksumsDir) {
  const dir = checksumsDir || path.join(__dirname, "..");
  const checksumsPath = path.join(dir, "checksums.txt");
  if (!fs.existsSync(checksumsPath)) {
    console.error("[WARN] checksums.txt not found, skipping checksum verification");
    return null;
  }
  const content = fs.readFileSync(checksumsPath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const idx = trimmed.indexOf("  ");
    if (idx === -1) continue;
    const hash = trimmed.slice(0, idx);
    const name = trimmed.slice(idx + 2);
    if (name === archiveName) return hash;
  }
  throw new Error(`Checksum entry not found for ${archiveName}`);
}

function verifyChecksum(archivePath, expectedHash) {
  if (expectedHash === null) return;
  const hash = crypto.createHash("sha256");
  const fd = fs.openSync(archivePath, "r");
  try {
    const buf = Buffer.alloc(64 * 1024);
    let bytesRead;
    while ((bytesRead = fs.readSync(fd, buf, 0, buf.length, null)) > 0) {
      hash.update(buf.subarray(0, bytesRead));
    }
  } finally {
    fs.closeSync(fd);
  }
  const actual = hash.digest("hex");
  if (actual.toLowerCase() !== expectedHash.toLowerCase()) {
    throw new Error(
      `[SECURITY] Checksum mismatch for ${path.basename(archivePath)}: expected ${expectedHash} but got ${actual}`
    );
  }
}

// ── Main install ───────────────────────────────────────────────────────────

function install() {
  fs.mkdirSync(binDir, { recursive: true });
  var tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "delta-cli-"));
  var archivePath = path.join(tmpDir, archiveName);

  releaseAssetUrls(VERSION, archiveName, function(downloadUrls) {
    try {
      var lastErr;
      var downloaded = false;
      for (var i = 0; i < downloadUrls.length; i++) {
        try {
          console.error("Downloading from " + downloadUrls[i]);
          download(downloadUrls[i], archivePath);
          console.error("Download complete, verifying checksum...");
          const expectedHash = getExpectedChecksum(archiveName);
          verifyChecksum(archivePath, expectedHash);
          console.error("Checksum verified");
          downloaded = true;
          break;
        } catch (e) {
          console.error("Failed: " + e.message + " (" + downloadUrls[i] + ")");
          lastErr = e;
        }
      }
      if (!downloaded) throw lastErr;

      if (isWindows) {
        console.error("Extracting archive...");
        extractZipWindows(archivePath, tmpDir);
      } else {
        console.error("Extracting archive...");
        execFileSync("tar", ["-xzf", archivePath, "-C", tmpDir], { stdio: "ignore" });
      }

      const binaryName = NAME + (isWindows ? ".exe" : "");
      const extractedBinary = path.join(tmpDir, NAME + "-" + platform + "-" + arch);
      if (fs.existsSync(extractedBinary)) {
        fs.copyFileSync(extractedBinary, dest);
      } else {
        // Fallback: try the plain name (older release format)
        const plainBinary = path.join(tmpDir, binaryName);
        if (fs.existsSync(plainBinary)) {
          fs.copyFileSync(plainBinary, dest);
        } else {
          // Search in tmpDir
          const files = fs.readdirSync(tmpDir).filter(function(f) { return f.indexOf(NAME) !== -1 || f.indexOf(binaryName) !== -1; });
          if (files.length > 0) {
            fs.copyFileSync(path.join(tmpDir, files[0]), dest);
          } else {
            throw new Error("Binary not found in extracted archive. Files: " + fs.readdirSync(tmpDir).join(", "));
          }
        }
      }
      fs.chmodSync(dest, 0o755);
      console.error("Installed to " + dest);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
}

// ── Entry ──────────────────────────────────────────────────────────────────

if (require.main === module) {
  if (!platform || !arch) {
    console.error(`Unsupported platform: ${process.platform}-${process.arch}`);
    process.exit(1);
  }

  // npx postinstall guard: skip binary download in ephemeral npx context
  const isNpxPostinstall =
    process.env.npm_command === "exec" && !process.env.DELTA_CLI_RUN;

  if (isNpxPostinstall) {
    process.exit(0);
  }

  try {
    install();
    console.log(`${NAME} v${VERSION} installed successfully`);
  } catch (err) {
    console.error(`Failed to install ${NAME}:`, err.message);
    console.error(
      `\nIf you are behind a firewall or in a restricted network, try one of:\n` +
      `  # 1. Use a proxy:\n` +
      `  export https_proxy=http://your-proxy:port\n` +
      `  npm install -g @delta-infra/cli\n\n` +
      `  # 2. Point to a corporate npm mirror:\n` +
      `  npm install -g @delta-infra/cli --registry=https://your-corp-mirror/\n` +
      `\nOr manually download from:\n` +
      `  https://github.com/${REPO}/releases/tag/v${VERSION}`
    );
    process.exit(1);
  }
}

module.exports = {
  getExpectedChecksum, verifyChecksum, assertAllowedHost,
  isCurlVersionSupported, curlSupportsSslRevokeBestEffort,
};
