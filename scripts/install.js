#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');
const { execSync } = require('child_process');

const BINARY_NAME = 'delta-cli';
const VERSION = require('../package.json').version;
const RELEASE_BASE_URL = 'https://github.com/yzailab/delta-infra-cli/releases/download';

function releaseAssetUrl(version, assetName) {
  const mirror = process.env.DELTA_CLI_MIRROR || '';
  if (mirror) {
    return `${mirror.replace(/\/$/, '')}/yzailab/delta-infra-cli/releases/download/v${version}/${assetName}`;
  }
  return `${RELEASE_BASE_URL}/v${version}/${assetName}`;
}

const platformMap = {
  darwin: 'darwin',
  linux: 'linux',
  win32: 'windows',
};

const archMap = {
  x64: 'amd64',
  arm64: 'arm64',
};

function resolveUrl(base, location) {
  if (!location) return base;
  if (location.startsWith('http://') || location.startsWith('https://')) {
    return location;
  }
  const baseUrl = new URL(base);
  return new URL(location, baseUrl).href;
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const hash = crypto.createHash('sha256');

    const cleanup = () => {
      try { fs.unlinkSync(dest); } catch {}
    };

    https.get(url, { timeout: 60000 }, (response) => {
      if (response.statusCode >= 301 && response.statusCode <= 308 && response.headers.location) {
        file.destroy();
        cleanup();
        download(resolveUrl(url, response.headers.location), dest).then(resolve).catch(reject);
        return;
      }
      if (response.statusCode !== 200) {
        file.destroy();
        cleanup();
        reject(new Error(`Download failed: ${response.statusCode}`));
        return;
      }
      response.pipe(file);
      response.on('data', (chunk) => hash.update(chunk));
      file.on('finish', () => {
        file.close(() => resolve(hash.digest('hex')));
      });
    }).on('error', (err) => {
      file.destroy();
      cleanup();
      reject(err);
    });
  });
}

function extract(archivePath, destDir, platform) {
  if (platform === 'windows') {
    execSync(`unzip -o "${archivePath}" -d "${destDir}"`, { stdio: 'inherit' });
  } else {
    execSync(`tar -xzf "${archivePath}" -C "${destDir}"`, { stdio: 'inherit' });
  }
}

async function main() {
  const platform = platformMap[process.platform];
  const arch = archMap[process.arch];
  if (!platform || !arch) {
    console.error(`Unsupported platform: ${process.platform} ${process.arch}`);
    process.exit(1);
  }

  const isWin = platform === 'windows';
  const archiveExt = isWin ? '.zip' : '.tar.gz';
  const binaryExt = isWin ? '.exe' : '';
  const assetName = `${BINARY_NAME}-${platform}-${arch}${archiveExt}`;
  const binDir = path.join(__dirname, '..', 'bin');
  const archivePath = path.join(binDir, assetName);
  const binaryPath = path.join(binDir, `${BINARY_NAME}${binaryExt}`);

  fs.mkdirSync(binDir, { recursive: true });

  const url = releaseAssetUrl(VERSION, assetName);
  console.log(`Downloading ${assetName} from ${process.env.DELTA_CLI_MIRROR ? 'mirror' : 'GitHub'}...`);

  try {
    const checksum = await download(url, archivePath);
    console.log(`Downloaded archive, SHA256: ${checksum}`);
    console.log(`Extracting to ${binDir}...`);
    extract(archivePath, binDir, platform);
    const extractedBinary = path.join(binDir, `${BINARY_NAME}-${platform}-${arch}${binaryExt}`);
    if (fs.existsSync(extractedBinary) && extractedBinary !== binaryPath) {
      fs.renameSync(extractedBinary, binaryPath);
    }
    fs.chmodSync(binaryPath, 0o755);
    fs.unlinkSync(archivePath);
    console.log(`Installed to ${binaryPath}`);
  } catch (err) {
    console.error('Install failed:', err.message);
    process.exit(1);
  }
}

main();
