import * as fs from 'node:fs';
import * as path from 'node:path';

const REPO = 'dxsl-org/hailykit';
const API_BASE = 'https://api.github.com';
const HEADERS: Record<string, string> = {
  'User-Agent': 'hailykit-cli',
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
};

/** Shape of the GitHub release API response we rely on. */
export interface GithubRelease {
  tag_name: string;
  assets: Array<{ name: string; browser_download_url: string }>;
  published_at: string;
  html_url: string;
}

/**
 * Fetch a release from the GitHub API.
 * Validates tag_name before returning — it is used in file paths and URLs.
 *
 * @param tag - Release tag (e.g. "v1.2.3") or "latest".
 * @throws When the release is not found, the API returns an error, or tag_name fails validation.
 */
export async function fetchRelease(tag = 'latest'): Promise<GithubRelease> {
  const url = tag === 'latest'
    ? `${API_BASE}/repos/${REPO}/releases/latest`
    : `${API_BASE}/repos/${REPO}/releases/tags/${tag}`;

  const res = await fetch(url, { headers: HEADERS });
  if (res.status === 404) throw new Error(`Release not found: ${tag}`);
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${res.statusText}`);

  const release = await res.json() as unknown;

  // Validate shape before trusting anything — API response is `unknown`.
  if (
    typeof release !== 'object' ||
    release === null ||
    typeof (release as Record<string, unknown>).tag_name !== 'string'
  ) {
    throw new Error(`Unexpected release shape from API`);
  }

  const r = release as GithubRelease;
  if (!/^v?\d+\.\d+\.\d+(?:[-+][\w.]+)?$/.test(r.tag_name)) {
    throw new Error(`Unexpected tag_name from API: ${JSON.stringify(r.tag_name)}`);
  }
  return r;
}

/**
 * Download the release zip into `destDir`.
 * Each call writes to a fresh `hailykit.zip` inside the caller-provided temp dir —
 * no shared, predictable path so concurrent installs and multi-user systems are safe.
 *
 * @param release - A validated GithubRelease from fetchRelease().
 * @param destDir - Directory to write the zip into (typically from makeTempDir()).
 * @returns Absolute path to the downloaded zip file.
 * @throws When the download HTTP request fails.
 */
export async function downloadZip(release: GithubRelease, destDir: string): Promise<string> {
  const asset = (release.assets || []).find(a => a.name === 'hailykit.zip');
  const downloadUrl = asset
    ? asset.browser_download_url
    : `https://github.com/${REPO}/archive/refs/tags/${release.tag_name}.zip`;

  const dest = path.join(destDir, 'hailykit.zip');

  process.stdout.write(`  Downloading ${release.tag_name}...`);
  const res = await fetch(downloadUrl, { headers: HEADERS });
  if (!res.ok) throw new Error(`Download failed: ${res.status} ${res.statusText}`);

  const buf = await res.arrayBuffer();
  fs.writeFileSync(dest, Buffer.from(buf));
  console.log(` ${Math.round(buf.byteLength / 1024)}KB`);
  return dest;
}
