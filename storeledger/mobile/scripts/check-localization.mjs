import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const mobileRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];

function sourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(target);
    return /\.tsx$/.test(entry.name) ? [target] : [];
  });
}

const i18nPath = path.join(mobileRoot, 'src', 'i18n', 'index.tsx');
const i18nSource = fs.readFileSync(i18nPath, 'utf8');
const normalize = value => value.trim().replaceAll('’', "'").replace(/\s+/g, ' ').toLowerCase();
const keys = [...i18nSource.matchAll(/^\s*(['"])(.*?)\1:\s*/gm)].map(match => normalize(match[2]));
const uniqueKeys = new Set(keys);

if (keys.length < 600) errors.push(`translation catalog is unexpectedly small (${keys.length} entries)`);
if (uniqueKeys.size !== keys.length) errors.push('translation catalog contains duplicate normalized keys');
if (!/[\u1200-\u137f]/.test(i18nSource)) errors.push('translation catalog contains no Ethiopic text');
for (const required of ['storeledger.language', "useState<Language>('am')", 'secureSet(LANGUAGE_KEY', "locale: language === 'am' ? 'am-ET' : 'en-US'"]) {
  if (!i18nSource.includes(required)) errors.push(`language persistence is missing ${required}`);
}

const wantedAttributes = new Set(['title', 'subtitle', 'eyebrow', 'label', 'hint', 'placeholder', 'message', 'text', 'accessibilityLabel', 'description']);
const untranslated = [];
const allowed = [/^StoreLedger$/i, /^StoreLedger Mobile · Version \d+\.\d+\.\d+$/i, /^ETB$/i, /^https?:/i];
function verifyVisible(value, file, node, sourceFile) {
  const text = value.replaceAll('&apos;', "'").replace(/\s+/g, ' ').trim();
  if (!/[A-Za-z]{2}/.test(text) || allowed.some(expression => expression.test(text))) return;
  if (!uniqueKeys.has(normalize(text))) {
    const line = sourceFile.getLineAndCharacterOfPosition(node.pos).line + 1;
    untranslated.push(`${path.relative(mobileRoot, file).replaceAll(path.sep, '/')}:${line}: ${JSON.stringify(text)}`);
  }
}

const files = [...sourceFiles(path.join(mobileRoot, 'app')), ...sourceFiles(path.join(mobileRoot, 'src', 'components'))];
for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  const relative = path.relative(mobileRoot, file).replaceAll(path.sep, '/');
  if (/import\s*\{[^}]*\bText\b[^}]*\}\s*from\s*['"]react-native['"]/.test(source)) {
    errors.push(`${relative}: imports unlocalized React Native Text`);
  }
  if (/\bAlert\.alert\s*\(/.test(source)) errors.push(`${relative}: uses an unlocalized Alert`);
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  function visit(node) {
    if (ts.isJsxText(node)) verifyVisible(node.text, file, node, sourceFile);
    if (ts.isJsxAttribute(node) && wantedAttributes.has(node.name.text) && node.initializer && ts.isStringLiteral(node.initializer)) {
      verifyVisible(node.initializer.text, file, node, sourceFile);
    }
    if (ts.isCallExpression(node) && node.expression.getText(sourceFile) === 'localizedAlert') {
      for (const argument of node.arguments.slice(0, 2)) {
        if (ts.isStringLiteral(argument) || ts.isNoSubstitutionTemplateLiteral(argument)) verifyVisible(argument.text, file, node, sourceFile);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
}

if (untranslated.length) errors.push(`untranslated visible literals:\n  ${untranslated.join('\n  ')}`);

const rootLayout = fs.readFileSync(path.join(mobileRoot, 'app', '_layout.tsx'), 'utf8');
const dashboard = fs.readFileSync(path.join(mobileRoot, 'app', '(tabs)', 'index.tsx'), 'utf8');
const login = fs.readFileSync(path.join(mobileRoot, 'app', 'login.tsx'), 'utf8');
const invoices = fs.readFileSync(path.join(mobileRoot, 'src', 'lib', 'invoices.ts'), 'utf8');
if (!rootLayout.includes('<I18nProvider>') || !rootLayout.includes("title: t('")) errors.push('root navigation is not localized');
if (!dashboard.includes('<LanguageSwitch onDark />')) errors.push('Home is missing its top-right language switch');
if (!login.includes('<LanguageSwitch />')) errors.push('Login is missing its language switch');
if (!invoices.includes('receipt/?language=${language}')) errors.push('receipt requests do not include the selected language');

const backendRoot = path.resolve(mobileRoot, '..', 'backend');
if (!fs.existsSync(path.join(backendRoot, 'assets', 'fonts', 'NotoSansEthiopic.ttf'))) errors.push('backend Ethiopic receipt font is missing');
const receiptService = fs.readFileSync(path.join(backendRoot, 'apps', 'core', 'services.py'), 'utf8');
if (!receiptService.includes('AMHARIC_LABELS') || !receiptService.includes('metadata.add_text("Language", language)')) errors.push('backend image receipts are not localized');

if (errors.length) {
  console.error(`Localization audit failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Localization audit passed: ${files.length} UI files, ${keys.length} Amharic entries, persisted Amharic/English switch and localized PNG receipts.`);
