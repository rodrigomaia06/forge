import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

function httpsUrl(value, field) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`EAS build is missing ${field}.`);
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`EAS build returned an invalid ${field}.`);
  }
  if (url.protocol !== 'https:') throw new Error(`EAS build returned a non-HTTPS ${field}.`);
  return url.toString();
}

/** Validate the final EAS response and retain only artifact URLs needed by CI. */
export function extractBuildArtifacts(build) {
  if (!build || typeof build !== 'object') throw new Error('EAS did not return a build object.');
  const status = typeof build.status === 'string' ? build.status : 'unknown';
  if (status.toLowerCase() !== 'finished')
    throw new Error(`EAS build is not finished (status: ${status}).`);
  const artifacts = build.artifacts;
  if (!artifacts || typeof artifacts !== 'object')
    throw new Error('EAS build did not return artifacts.');
  const xcodeBuildLogsUrl = artifacts.xcodeBuildLogsUrl;
  return {
    applicationArchiveUrl: httpsUrl(artifacts.applicationArchiveUrl, 'applicationArchiveUrl'),
    ...(typeof xcodeBuildLogsUrl === 'string' && xcodeBuildLogsUrl.trim()
      ? { xcodeBuildLogsUrl: httpsUrl(xcodeBuildLogsUrl, 'xcodeBuildLogsUrl') }
      : {}),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [inputPath] = process.argv.slice(2);
  if (!inputPath) throw new Error('Usage: node scripts/eas-build-artifacts.mjs <eas-build-json>');
  console.log(
    JSON.stringify(extractBuildArtifacts(JSON.parse(fs.readFileSync(inputPath, 'utf8')))),
  );
}
