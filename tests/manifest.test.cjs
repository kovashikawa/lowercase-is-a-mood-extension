const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const os = require('node:os');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const manifest = JSON.parse(read('manifest.json'));

const runtimeFiles = ['content.js', 'content.css', 'popup.html', 'popup.js'];

const allowedPermissions = ['storage'];

test('manifest is Manifest V3 with a valid version', () => {
  assert.equal(manifest.manifest_version, 3);
  assert.match(manifest.version, /^\d+(\.\d+){0,3}$/);
  assert.ok(manifest.name.length <= 75, 'store name limit is 75 characters');
  assert.ok(manifest.description.length <= 132, 'store description limit is 132 characters');
});

test('every file the manifest references exists', () => {
  const files = [
    manifest.action?.default_popup,
    ...(manifest.content_scripts ?? []).flatMap((s) => [...(s.js ?? []), ...(s.css ?? [])]),
    ...Object.values(manifest.icons ?? {}),
    ...Object.values(manifest.action?.default_icon ?? {}),
  ].filter(Boolean);
  for (const file of files) {
    assert.ok(fs.existsSync(path.join(root, file)), `${file} is referenced but missing`);
  }
});

test('permissions stay within the reviewed allowlist', () => {
  const requested = [...(manifest.permissions ?? []), ...(manifest.optional_permissions ?? [])];
  for (const permission of requested) {
    assert.ok(allowedPermissions.includes(permission), `new permission "${permission}" needs maintainer sign-off`);
  }
  assert.equal(manifest.host_permissions, undefined, 'host_permissions need maintainer sign-off');
});

test('no remote code, eval, or network calls', () => {
  const banned = [
    [/\beval\s*\(/, 'eval()'],
    [/new\s+Function\s*\(/, 'new Function()'],
    [/\bimportScripts\s*\(/, 'importScripts()'],
    [/\bfetch\s*\(/, 'fetch()'],
    [/XMLHttpRequest/, 'XMLHttpRequest'],
    [/<script[^>]+src=["']https?:/i, 'remote <script src>'],
    [/<(link|img|iframe)[^>]+(href|src)=["']https?:/i, 'remote resource in HTML'],
  ];
  for (const file of runtimeFiles) {
    const text = read(file);
    for (const [pattern, label] of banned) {
      assert.ok(!pattern.test(text), `${file} uses ${label}`);
    }
  }
});

test('package contains the manifest files and nothing extra', () => {
  const outDir = fs.mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), 'pkg-'));
  try {
    const zip = execFileSync('sh', ['scripts/package.sh'], {
      cwd: root,
      env: { ...process.env, OUT_DIR: outDir },
      encoding: 'utf8',
    }).trim();
    const listed = execFileSync('unzip', ['-Z1', zip], { encoding: 'utf8' }).split('\n').filter(Boolean).sort();
    const expected = ['manifest.json', ...runtimeFiles, ...Object.values(manifest.icons ?? {})].sort();
    assert.deepEqual(listed, expected);
    assert.match(path.basename(zip), new RegExp(`-${manifest.version.replaceAll('.', '\\.')}\\.zip$`));
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});
