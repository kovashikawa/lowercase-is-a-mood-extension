// The one list of files that must ship in the store zip.
//
// Derived from manifest.json plus the local src/href dependencies of any page
// the manifest points at, so a newly referenced file cannot go missing from the
// package. scripts/package.sh and tests/manifest.test.cjs both read this.
//
// Run directly to print the list, one file per line.

const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

// Skips absolute URLs, protocol-relative URLs, data: URIs and bare fragments.
function localReferences(html) {
  const found = [];
  for (const [, value] of html.matchAll(/(?:src|href)\s*=\s*["']([^"']+)["']/gi)) {
    if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(value)) continue;
    const file = value.split(/[?#]/)[0].replace(/^\//, '');
    if (file) found.push(file);
  }
  return found;
}

function requiredFiles() {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
  const files = new Set(['manifest.json']);
  const add = (file) => {
    if (typeof file === 'string' && file) files.add(file);
  };

  add(manifest.action?.default_popup);
  add(manifest.options_page);
  add(manifest.options_ui?.page);
  add(manifest.background?.service_worker);
  for (const script of manifest.content_scripts ?? []) {
    for (const file of [...(script.js ?? []), ...(script.css ?? [])]) add(file);
  }
  for (const file of Object.values(manifest.icons ?? {})) add(file);
  for (const file of Object.values(manifest.action?.default_icon ?? {})) add(file);
  for (const entry of manifest.web_accessible_resources ?? []) {
    // Glob patterns cannot be resolved to one file, so they are left out.
    for (const file of entry.resources ?? []) if (!file.includes('*')) add(file);
  }

  // A page the manifest points at can pull in local scripts, styles and images.
  for (const page of [...files].filter((file) => file.endsWith('.html'))) {
    const full = path.join(root, page);
    if (!fs.existsSync(full)) continue;
    for (const reference of localReferences(fs.readFileSync(full, 'utf8'))) {
      add(path.posix.normalize(path.posix.join(path.posix.dirname(page), reference)));
    }
  }

  return [...files].sort();
}

module.exports = { requiredFiles };

if (require.main === module) process.stdout.write(`${requiredFiles().join('\n')}\n`);
