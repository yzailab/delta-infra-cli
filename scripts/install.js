#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');
const { execSync, spawn } = require('child_process');

const BINARY_NAME = 'delta-cli';
const VERSION = require('../package.json').version;

const DEFAULT_ALLOWED_HOSTS = [
  'github.com',
  'gh-proxy.com',
  'objects.githubusercontent.com',
  'release-assets.githubusercontent.com',
  'github-releases.githubusercontent.com',
  'raw.githubusercontent.com',
];
const DEFAULT_ALLOWED_HOST_PREFIXES = [
  'github-production-release-asset-',
];
const MAX_REDIRECTS = 5;

const platformMap = {
  darwin: 'darwin',
  linux: 'linux',
  win32: 'windows',
};

const archMap = {
  x64: 'amd64',
  arm64: 'arm64',
};

const RELEASE_SOURCE_BASE = 'https://github.com/yzailab/delta-infra-cli/releases/download';
const RELEASE_DOMESTIC_BASE = 'https://gh-proxy.com/https://github.com/yzailab/delta-infra-cli/releases/download';

function releaseAssetUrls(version, assetName) {
  const urls = [];
  const mirror = process.env.DELTA_CLI_MIRROR || '';
  if (mirror) {
    urls.push(`${mirror.replace(/\/$/, '')}/yzailab/delta-infra-cli/releases/download/v${version}/${assetName}`);
  }
  urls.push(`${RELEASE_DOMESTIC_BASE}/v${version}/${assetName}`);
  urls.push(`${RELEASE_SOURCE_BASE}/v${version}/${assetName}`);
  return urls;
}

function resolveUrl(base, location) {
  if (!location) return base;
  if (location.startsWith('http://') || location.startsWith('https://')) {
    return location;
  }
  const baseUrl = new URL(base);
  return new URL(location, baseUrl).href;
}

function loadChecksums() {
  const checksumPath = path.join(__dirname, '..', 'checksums.txt');
  if (!fs.existsSync(checksumPath)) {
    return null;
  }
  const content = fs.readFileSync(checksumPath, 'utf8');
  const map = new Map();
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('  ');
    let hash, filename;
    if (idx === -1) {
      const parts = trimmed.split(/\s+/);
      if (parts.length < 2) continue;
      hash = parts[0];
      filename = parts[1];
    } else {
      hash = trimmed.slice(0, idx);
      filename = trimmed.slice(idx + 2);
    }
    map.set(filename, hash.toLowerCase());
  }
  return map;
}

function fileSha256(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

function isAllowListedUrl(urlStr) {
  let url;
  try {
    url = new URL(urlStr);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:') {
    return false;
  }
  const host = url.hostname.toLowerCase();
  const allowlist = new Set(DEFAULT_ALLOWED_HOSTS);
  (process.env.DELTA_CLI_MIRROR_ALLOWLIST || '')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean)
    .forEach((h) => allowlist.add(h));
  for (const allowed of allowlist) {
    if (host === allowed || host.endsWith('.' + allowed)) {
      return true;
    }
  }
  for (const prefix of DEFAULT_ALLOWED_HOST_PREFIXES) {
    if (host.startsWith(prefix)) {
      return true;
    }
  }
  return false;
}

function getHttpProxy() {
  return (
    process.env.HTTPS_PROXY ||
    process.env.https_proxy ||
    process.env.HTTP_PROXY ||
    process.env.http_proxy ||
    ''
  );
}

const DOWNLOAD_TIMEOUT_MS = parseInt(process.env.DELTA_CLI_DOWNLOAD_TIMEOUT, 10) || 120000;

function nodeDownload(url, dest, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (!isAllowListedUrl(url)) {
      reject(new Error(`Download URL is not allow-listed: ${url}`));
      return;
    }
    if (redirectCount > MAX_REDIRECTS) {
      reject(new Error('Too many redirects while downloading'));
      return;
    }

    const file = fs.createWriteStream(dest);
    const hash = crypto.createHash('sha256');
    let finished = false;
    const maxTimer = setTimeout(() => {
      cleanup(new Error(`Download did not complete within ${DOWNLOAD_TIMEOUT_MS}ms`));
    }, DOWNLOAD_TIMEOUT_MS);

    const cleanup = (err) => {
      if (finished) return;
      finished = true;
      clearTimeout(maxTimer);
      try {
        file.destroy();
        fs.unlinkSync(dest);
      } catch {}
      reject(err);
    };

    https
      .get(url, { timeout: 60000 }, (response) => {
        if (response.statusCode >= 301 && response.statusCode <= 308 && response.headers.location) {
          const nextUrl = resolveUrl(url, response.headers.location);
          if (!isAllowListedUrl(nextUrl)) {
            cleanup(new Error(`Redirect URL is not allow-listed: ${nextUrl}`));
            return;
          }
          file.destroy();
          try {
            fs.unlinkSync(dest);
          } catch {}
          nodeDownload(nextUrl, dest, redirectCount + 1).then(resolve).catch(reject);
          return;
        }
        if (response.statusCode !== 200) {
          cleanup(new Error(`Download failed: HTTP ${response.statusCode}`));
          return;
        }
        response.pipe(file);
        response.on('data', (chunk) => hash.update(chunk));
        file.on('finish', () => {
          file.close((err) => {
            if (finished) return;
            if (err) {
              cleanup(err);
              return;
            }
            finished = true;
            clearTimeout(maxTimer);
            resolve(hash.digest('hex'));
          });
        });
        file.on('error', cleanup);
      })
      .on('error', cleanup)
      .on('timeout', () => {
        cleanup(new Error('Download timed out'));
      });
  });
}

function curlDownload(url, dest, proxy) {
  return new Promise((resolve, reject) => {
    const maxSeconds = Math.ceil(DOWNLOAD_TIMEOUT_MS / 1000);
    const args = ['-L', '--fail', '--show-error', '--silent', '--max-time', String(maxSeconds), '-o', dest];
    if (proxy) {
      args.push('--proxy', proxy);
    }
    args.push(url);
    const child = spawn('curl', args, { stdio: ['ignore', 'inherit', 'inherit'] });
    child.on('error', (err) => {
      reject(new Error(`curl not available or failed to start: ${err.message}`));
    });
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`curl download failed (exit ${code})`));
        return;
      }
      fileSha256(dest).then(resolve).catch(reject);
    });
  });
}

async function download(url, dest) {
  const proxy = getHttpProxy();
  const preferCurl =
    process.env.DELTA_CLI_USE_CURL === '1' || (!!proxy && process.env.DELTA_CLI_USE_CURL !== '0');

  if (preferCurl) {
    try {
      return await curlDownload(url, dest, proxy);
    } catch (err) {
      if (process.env.DELTA_CLI_USE_CURL === '1') {
        throw err;
      }
      console.warn(`[delta-cli] curl download failed (${err.message}), falling back to Node https.`);
    }
  }

  return nodeDownload(url, dest);
}

function verifyAsset(assetName, filePath, checksums) {
  if (!checksums) {
    console.warn('[delta-cli] checksums.txt not found; skipping checksum verification.');
    return;
  }
  const expected = checksums.get(assetName);
  if (!expected) {
    throw new Error(`No checksum found for ${assetName} in checksums.txt`);
  }
  const actual = crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
  if (actual !== expected) {
    throw new Error(`Checksum mismatch for ${assetName}: expected ${expected}, got ${actual}`);
  }
  console.log(`[delta-cli] Checksum OK for ${assetName}.`);
}

function extract(archivePath, destDir, platform) {
  fs.mkdirSync(destDir, { recursive: true });
  if (platform === 'windows') {
    const escapedArchive = archivePath.replace(/'/g, "''");
    const escapedDest = destDir.replace(/'/g, "''");
    execSync(
      `powershell.exe -NoProfile -Command "Expand-Archive -Path '${escapedArchive}' -DestinationPath '${escapedDest}' -Force"`,
      { stdio: 'inherit' }
    );
  } else {
    execSync(`tar -xzf "${archivePath}" -C "${destDir}"`, { stdio: 'inherit' });
  }
}

async function install(options = {}) {
  const fatal = options.fatal === true;
  const allowSkip = options.allowSkip !== false;

  if (allowSkip && (process.env.CI === 'true' || process.env.CI === '1' || process.env.DELTA_CLI_SKIP_POSTINSTALL)) {
    console.log('[delta-cli] postinstall skipped (CI or DELTA_CLI_SKIP_POSTINSTALL).');
    return;
  }

  const platform = platformMap[process.platform];
  const arch = archMap[process.arch];
  if (!platform || !arch) {
    throw new Error(`Unsupported platform: ${process.platform} ${process.arch}`);
  }

  const isWin = platform === 'windows';
  const archiveExt = isWin ? '.zip' : '.tar.gz';
  const binaryExt = isWin ? '.exe' : '';
  const assetName = `${BINARY_NAME}-${platform}-${arch}${archiveExt}`;
  const binDir = path.join(__dirname, '..', 'bin');
  const archivePath = path.join(binDir, assetName);
  const binaryPath = path.join(binDir, `${BINARY_NAME}${binaryExt}`);

  fs.mkdirSync(binDir, { recursive: true });

  const localArchive = process.env.DELTA_CLI_ARCHIVE;
  if (localArchive) {
    if (!fs.existsSync(localArchive)) {
      throw new Error(`DELTA_CLI_ARCHIVE file not found: ${localArchive}`);
    }
    fs.copyFileSync(localArchive, archivePath);
  } else {
    const urls = releaseAssetUrls(VERSION, assetName);
    let lastErr;
    let checksum;
    for (const url of urls) {
      console.log(`[delta-cli] Downloading ${assetName} from ${new URL(url).hostname}...`);
      try {
        checksum = await download(url, archivePath);
        break;
      } catch (err) {
        console.warn(`[delta-cli] Download failed from ${url}: ${err.message}`);
        lastErr = err;
      }
    }
    if (checksum === undefined) {
      throw lastErr || new Error('All download sources failed');
    }
  }

  const checksums = loadChecksums();
  verifyAsset(assetName, archivePath, checksums);

  console.log(`[delta-cli] Extracting to ${binDir}...`);
  extract(archivePath, binDir, platform);
  fs.unlinkSync(archivePath);

  const extractedBinary = path.join(binDir, `${BINARY_NAME}-${platform}-${arch}${binaryExt}`);
  if (fs.existsSync(extractedBinary) && extractedBinary !== binaryPath) {
    fs.renameSync(extractedBinary, binaryPath);
  }

  if (!fs.existsSync(binaryPath)) {
    throw new Error(`Binary not found after extraction: ${binaryPath}`);
  }

  if (platform !== 'windows') {
    fs.chmodSync(binaryPath, 0o755);
  }

  console.log(`[delta-cli] Installed at ${binaryPath}.`);
}

function handleError(err) {
  const fatal = process.env.DELTA_CLI_FATAL_ON_ERROR === '1';
  const message = err && err.message ? err.message : String(err);
  if (fatal) {
    console.error('[delta-cli] install failed:', message);
    process.exit(1);
  }
  console.error('[delta-cli] postinstall warning:', message);
  console.error('The wrapper is installed, but the native binary may be missing.');
  console.error('Run "delta-cli" once to retry, or set DELTA_CLI_ARCHIVE to a local archive path.');
  process.exit(0);
}

if (require.main === module) {
  install({ allowSkip: true }).catch(handleError);
}

module.exports = { install };
