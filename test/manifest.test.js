// -----------------------------------------------------------------------------
// Consistency checks between `gladys-assistant-integration.json` and the code.
// The manifest is validated by the store indexer, but nothing there can know
// which handlers the code actually registers — these tests keep both in sync.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ACTIONS } from '../src/capabilities/actions.js';
import { SCENE_ACTIONS, SCENE_TRIGGERS } from '../src/capabilities/scenes.js';
import { PHARMACY_WIDGET } from '../src/capabilities/widget.js';
import { COUNTRIES, DEFAULT_CONFIG, normalizeConfig } from '../src/config.js';
import { LANGUAGES } from '../src/i18n.js';
import { MOMENTS, SOURCES } from '../src/pharmacies.js';

const manifest = JSON.parse(
  await readFile(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

const keysOf = (list) => (list ?? []).map((entry) => entry.key);

const allFields = [
  ...manifest.config_schema,
  ...(manifest.actions ?? []).flatMap((a) => a.fields ?? []),
  ...(manifest.widgets ?? []).flatMap((w) => w.settings ?? []),
  ...(manifest.scene_triggers ?? []).flatMap((t) => t.fields ?? []),
  ...(manifest.scene_actions ?? []).flatMap((a) => a.fields ?? []),
];

// Every multi-language text of the manifest, with where it sits.
function texts(node, path = '') {
  if (Array.isArray(node)) return node.flatMap((item, i) => texts(item, `${path}[${i}]`));
  if (node === null || typeof node !== 'object') return [];
  return Object.entries(node).flatMap(([key, value]) =>
    ['label', 'description', 'placeholder'].includes(key)
      ? [{ path: `${path}.${key}`, value }]
      : texts(value, `${path}.${key}`),
  );
}

test('every text is a multi-language object in the four languages', () => {
  for (const { path, value } of texts(manifest)) {
    assert.equal(typeof value, 'object', `${path} must be a multi-language object`);
    for (const language of LANGUAGES) {
      assert.ok(value[language], `${path}: missing "${language}"`);
    }
  }
});

test('the catalog description holds 10 to 100 characters per language', () => {
  for (const language of LANGUAGES) {
    const { length } = manifest.description[language];
    assert.ok(length >= 10 && length <= 100, `${language}: ${length} characters`);
  }
});

test('version, package.json and docker_image agree', () => {
  assert.equal(manifest.version, pkg.version);
  assert.equal(manifest.docker_image, `ghcr.io/prohand/gladys-pharmaciesgarde:${pkg.version}`);
});

test('local AND cloud transports, house location, one catalog shelf', () => {
  assert.deepEqual(manifest.transports, ['local', 'cloud']);
  assert.equal(manifest.location, true);
  assert.ok(manifest.categories.length >= 1 && manifest.categories.length <= 3);
});

test('gladys_version covers the fields the manifest uses', () => {
  const [major, minor] = manifest.gladys_version
    .match(/>=\s*(\d+)\.(\d+)\.(\d+)/)
    .slice(1)
    .map(Number);
  // widgets, scenes and `source: "houses"` need 5.1; keywords 5.3.
  assert.ok(major > 5 || (major === 5 && minor >= 3), manifest.gladys_version);
});

test('the search keywords follow the store rules', () => {
  const { keywords } = manifest;
  assert.ok(keywords.length >= 1 && keywords.length <= 10);
  const normalized = keywords.map((keyword) => keyword.trim().toLowerCase());
  assert.equal(new Set(normalized).size, keywords.length);
  for (const keyword of normalized) assert.ok(keyword.length >= 2 && keyword.length <= 30);
});

test('every field uses a type the store accepts, keys in snake_case', () => {
  const types = ['string', 'number', 'boolean', 'select', 'multi_select', 'secret', 'section'];
  for (const field of allFields) {
    assert.ok(types.includes(field.type), `${field.key}: ${field.type}`);
    assert.match(field.key, /^[a-z0-9_]+$/);
    if (field.min !== undefined || field.max !== undefined) assert.equal(field.type, 'number');
    if (field.placeholder !== undefined) {
      assert.ok(['string', 'number', 'secret'].includes(field.type), field.key);
    }
    if (field.type === 'section') {
      assert.equal(field.default, undefined);
      assert.equal(field.required, undefined);
    }
    if (field.source) assert.equal(field.options, undefined, `${field.key}: source and options`);
  }
});

test('config_schema defaults match DEFAULT_CONFIG and survive normalization', () => {
  for (const field of manifest.config_schema) {
    if (field.default === undefined) continue;
    assert.equal(DEFAULT_CONFIG[field.key], field.default, field.key);
    assert.equal(normalizeConfig({})[field.key], field.default, field.key);
  }
  const schemaKeys = keysOf(manifest.config_schema).filter((key) => key !== 'intro');
  for (const key of Object.keys(DEFAULT_CONFIG)) {
    if (key === 'GLADYS_PREFER_LOCAL') continue;
    assert.ok(schemaKeys.includes(key), `DEFAULT_CONFIG.${key} is not in config_schema`);
  }
  const countries = manifest.config_schema.find((f) => f.key === 'country').options;
  assert.deepEqual(
    countries.map((o) => o.value),
    COUNTRIES,
  );
});

test('actions, scene actions, scene triggers and widgets match the code', () => {
  assert.deepEqual(keysOf(manifest.actions).sort(), Object.values(ACTIONS).sort());
  assert.deepEqual(keysOf(manifest.scene_actions).sort(), Object.values(SCENE_ACTIONS).sort());
  assert.deepEqual(keysOf(manifest.scene_triggers).sort(), Object.values(SCENE_TRIGGERS).sort());
  assert.deepEqual(keysOf(manifest.widgets), [PHARMACY_WIDGET]);
});

test('scene option lists match the values the code produces', () => {
  const moment = manifest.scene_actions
    .find((a) => a.key === SCENE_ACTIONS.GET_PHARMACY)
    .fields.find((f) => f.key === 'moment');
  assert.deepEqual(
    moment.options.map((o) => o.value),
    MOMENTS,
  );
  const source = manifest.scene_triggers
    .find((t) => t.key === SCENE_TRIGGERS.DUTY_CHANGED)
    .fields.find((f) => f.key === 'source');
  assert.deepEqual(source.options.map((o) => o.value).sort(), Object.values(SOURCES).sort());
});

test('timeouts stay within the 5-120 s the core accepts', () => {
  for (const item of [...manifest.actions, ...manifest.scene_actions]) {
    if (item.timeout_seconds !== undefined) {
      assert.ok(item.timeout_seconds >= 5 && item.timeout_seconds <= 120, item.key);
    }
  }
});

test('the documentation exists in the four languages', async () => {
  for (const language of LANGUAGES) {
    const doc = await readFile(new URL(`../docs/${language}.md`, import.meta.url), 'utf8');
    assert.ok(doc.length > 500, `docs/${language}.md`);
  }
});
