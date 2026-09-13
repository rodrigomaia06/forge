import assert from 'node:assert/strict';
import test from 'node:test';
import { extractBuildArtifacts } from '../../scripts/eas-build-artifacts.mjs';

test('extracts a finished IPA URL and optional Xcode logs URL', () => {
  assert.deepEqual(
    extractBuildArtifacts({
      status: 'FINISHED',
      artifacts: {
        applicationArchiveUrl: 'https://artifacts.example/Forge.ipa?signature=1',
        xcodeBuildLogsUrl: 'https://artifacts.example/logs.tar.gz?signature=1',
      },
    }),
    {
      applicationArchiveUrl: 'https://artifacts.example/Forge.ipa?signature=1',
      xcodeBuildLogsUrl: 'https://artifacts.example/logs.tar.gz?signature=1',
    },
  );
});

test('allows a finished build without logs', () => {
  assert.deepEqual(
    extractBuildArtifacts({
      status: 'finished',
      artifacts: { applicationArchiveUrl: 'https://artifacts.example/Forge.ipa' },
    }),
    { applicationArchiveUrl: 'https://artifacts.example/Forge.ipa' },
  );
});

test('rejects an unfinished build or unavailable IPA', () => {
  assert.throws(() => extractBuildArtifacts({ status: 'ERRORED', artifacts: {} }), /not finished/);
  assert.throws(
    () => extractBuildArtifacts({ status: 'FINISHED', artifacts: {} }),
    /applicationArchiveUrl/,
  );
});
