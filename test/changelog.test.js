import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rollChangelog } from '../.github/scripts/changelog-release.mjs';

const REPO = 'https://github.com/prohand/gladys-pharmaciesgarde';

test('the Unreleased section moves under the new version, links follow', () => {
  const text = [
    '# Changelog',
    '',
    '## [Unreleased]',
    '',
    '### Added',
    '',
    '- Something.',
    '',
    '## [1.0.0] - 2026-10-30',
    '',
    '- First release.',
    '',
    `[Unreleased]: ${REPO}/compare/v1.0.0...HEAD`,
    `[1.0.0]: ${REPO}/releases/tag/v1.0.0`,
    '',
  ].join('\n');
  const rolled = rollChangelog(text, '1.1.0', '2026-11-02');
  assert.match(
    rolled,
    /## \[Unreleased\]\n\n## \[1\.1\.0\] - 2026-11-02\n\n### Added\n\n- Something\./,
  );
  assert.match(rolled, new RegExp(`\\[Unreleased\\]: ${REPO}/compare/v1\\.1\\.0\\.\\.\\.HEAD`));
  assert.match(
    rolled,
    new RegExp(`\\[1\\.1\\.0\\]: ${REPO}/compare/v1\\.0\\.0\\.\\.\\.v1\\.1\\.0`),
  );
  assert.equal(rollChangelog(rolled, '1.1.0', '2026-11-02'), rolled, 'idempotent');
});

test('an empty Unreleased section still names the release', () => {
  const rolled = rollChangelog('## [Unreleased]\n', '1.0.1', '2026-11-03');
  assert.match(rolled, /## \[1\.0\.1\] - 2026-11-03\n\n- Maintenance release/);
});
