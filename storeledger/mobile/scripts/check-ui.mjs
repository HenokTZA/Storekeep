import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const mobileRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const themePath = path.join(mobileRoot, 'src', 'theme.ts');
const themeSource = fs.readFileSync(themePath, 'utf8');
const errors = [];

function sourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(target);
    return /\.(ts|tsx)$/.test(entry.name) ? [target] : [];
  });
}

function relative(file) {
  return path.relative(mobileRoot, file).replaceAll(path.sep, '/');
}

function lineAt(source, index) {
  return source.slice(0, index).split('\n').length;
}

function rgb(hex) {
  const value = hex.slice(1);
  return [0, 2, 4].map(offset => Number.parseInt(value.slice(offset, offset + 2), 16) / 255);
}

function luminance(hex) {
  return rgb(hex).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
    .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
}

function contrast(first, second) {
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

const tokens = Object.fromEntries([...themeSource.matchAll(/^\s+(\w+):\s*'(#[0-9A-Fa-f]{6})',?$/gm)].map(match => [match[1], match[2]]));
const requiredTokens = ['background', 'surface', 'text', 'muted', 'border', 'primary', 'primaryButton', 'primarySoft', 'primaryBorder', 'danger', 'dangerButton', 'dangerSoft', 'warning', 'warningSoft', 'success', 'onPrimary'];
for (const token of requiredTokens) if (!tokens[token]) errors.push(`src/theme.ts: missing explicit ${token} color token`);

const contrastChecks = [
  ['text', 'background', 7],
  ['text', 'surface', 7],
  ['muted', 'background', 4.5],
  ['muted', 'surface', 4.5],
  ['primary', 'background', 4.5],
  ['primary', 'surface', 4.5],
  ['onPrimary', 'primaryButton', 4.5],
  ['onPrimary', 'dangerButton', 4.5],
  ['danger', 'surface', 4.5],
  ['warning', 'warningSoft', 4.5],
  ['success', 'surface', 4.5],
];
for (const [foreground, background, minimum] of contrastChecks) {
  if (!tokens[foreground] || !tokens[background]) continue;
  const ratio = contrast(tokens[foreground], tokens[background]);
  if (ratio < minimum) errors.push(`src/theme.ts: ${foreground}/${background} contrast ${ratio.toFixed(2)} is below ${minimum}:1`);
}

const files = [...sourceFiles(path.join(mobileRoot, 'app')), ...sourceFiles(path.join(mobileRoot, 'src'))];
for (const file of files) {
  if (file === themePath) continue;
  const source = fs.readFileSync(file, 'utf8');
  const name = relative(file);
  const forbidden = [
    ['PlatformColor', /\bPlatformColor\b/g],
    ['DynamicColorIOS', /\bDynamicColorIOS\b/g],
    ['CSS-variable color', /var\(--sl-/g],
    ['raw hexadecimal color', /#[0-9A-Fa-f]{3,8}\b/g],
    ['primary text color used as a filled background', /backgroundColor:\s*colors\.primary(?:\s|[,}])/g],
    ['danger text color used as a filled background', /backgroundColor:\s*colors\.danger(?:\s|[,}])/g],
  ];
  for (const [label, expression] of forbidden) {
    for (const match of source.matchAll(expression)) errors.push(`${name}:${lineAt(source, match.index)}: ${label}`);
  }
  for (const match of source.matchAll(/<Text(?=\s|>)(?![^>]*\bstyle=)[^>]*>/g)) {
    errors.push(`${name}:${lineAt(source, match.index)}: Text must declare an explicit visible style`);
  }
}

const routeFiles = sourceFiles(path.join(mobileRoot, 'app')).filter(file => path.basename(file) !== '_layout.tsx');
for (const file of routeFiles) {
  const source = fs.readFileSync(file, 'utf8');
  const name = relative(file);
  if (!source.includes('export default')) errors.push(`${name}: route has no default screen export`);
  if (!source.includes('<Screen')) errors.push(`${name}: route does not use the shared visible Screen container`);
}

const uiSource = fs.readFileSync(path.join(mobileRoot, 'src', 'components', 'ui.tsx'), 'utf8');
if (!/card:\s*\{[^}]*backgroundColor:\s*colors\.surface/s.test(uiSource)) errors.push('src/components/ui.tsx: Card must have an explicit surface');
if (!/input:\s*\{[^}]*color:\s*colors\.text/s.test(uiSource)) errors.push('src/components/ui.tsx: Input must have explicit text color');
if (!/button:\s*\{[^}]*minHeight:\s*48/s.test(uiSource)) errors.push('src/components/ui.tsx: primary touch target must be at least 48dp high');
if (!uiSource.includes("edges={safeTop ? ['top'] : []}")) errors.push('src/components/ui.tsx: Screen must support an explicit top safe area');

const tabsLayoutSource = fs.readFileSync(path.join(mobileRoot, 'app', '(tabs)', '_layout.tsx'), 'utf8');
if (!tabsLayoutSource.includes('useSafeAreaInsets')) errors.push('app/(tabs)/_layout.tsx: tab bar must read the Android bottom safe-area inset');
if (!/height:\s*64\s*\+\s*bottomPadding/.test(tabsLayoutSource)) errors.push('app/(tabs)/_layout.tsx: tab bar height must include the bottom safe-area inset');

for (const route of ['index.tsx', 'stock.tsx', 'sale.tsx', 'customers.tsx', 'more.tsx']) {
  const source = fs.readFileSync(path.join(mobileRoot, 'app', '(tabs)', route), 'utf8');
  if (!/<Screen[^>]*\bsafeTop\b/.test(source)) errors.push(`app/(tabs)/${route}: top-level tab must opt into the top safe area`);
}

const dashboardSource = fs.readFileSync(path.join(mobileRoot, 'app', '(tabs)', 'index.tsx'), 'utf8');
const summaryHeight = dashboardSource.match(/summaryCard:\s*\{[^}]*minHeight:\s*(\d+)/s);
if (!summaryHeight || Number(summaryHeight[1]) > 120) errors.push('app/(tabs)/index.tsx: dashboard summary cards must remain compact enough to show the first six together');

const stockSource = fs.readFileSync(path.join(mobileRoot, 'app', '(tabs)', 'stock.tsx'), 'utf8');
if (!stockSource.includes("pathname: '/purchase-new'") || !stockSource.includes('productId: String(product.id)')) {
  errors.push('app/(tabs)/stock.tsx: Receive must open the full preselected purchase workflow');
}

const saleSource = fs.readFileSync(path.join(mobileRoot, 'app', '(tabs)', 'sale.tsx'), 'utf8');
if (!saleSource.includes('ENTER UNITS / BAGS') || !saleSource.includes('Set Units')) {
  errors.push('app/(tabs)/sale.tsx: sale quantity must support direct typed unit entry');
}
if (!saleSource.includes('quantityError') || !saleSource.includes('Enter') || !saleSource.includes('or less')) {
  errors.push('app/(tabs)/sale.tsx: direct quantity entry must explain an over-stock value inside the modal');
}
if (!saleSource.includes('unit_price: basePiecePrice(product).toFixed(2)') || !saleSource.includes('salePiecePrice(product)') || !saleSource.includes('Number(product.selling_price).toFixed(2)') || !saleSource.includes('{selected ? (')) {
  errors.push('app/(tabs)/sale.tsx: sale lines must submit an editable base price and display the final selling price');
}
const pricingSource = fs.readFileSync(path.join(mobileRoot, 'src', 'lib', 'pricing.ts'), 'utf8');
if (!pricingSource.includes('AGENT_PRICE_FACTOR_NUMERATOR = 157') || !pricingSource.includes('AGENT_PRICE_FACTOR_DENOMINATOR = 160')) {
  errors.push('src/lib/pricing.ts: Agent price must apply the 1.875% discount with cent rounding');
}
if (!saleSource.includes('Total outstanding')) {
  errors.push('app/(tabs)/sale.tsx: invoice preview must show the total account outstanding');
}

const transactionsSource = fs.readFileSync(path.join(mobileRoot, 'app', 'transactions.tsx'), 'utf8');
for (const required of ['SALE RECEIPT', 'PURCHASE RECEIPT', 'eye-outline', 'download-outline', 'share-social-outline']) {
  if (!transactionsSource.includes(required)) errors.push(`app/transactions.tsx: missing receipt behavior ${required}`);
}
if (!transactionsSource.includes("party_type === 'walk_in'") || !transactionsSource.includes('PAID · WALK-IN')) {
  errors.push('app/transactions.tsx: walk-in sales must render as paid sale transactions with receipt actions');
}

const receiptViewSource = fs.readFileSync(path.join(mobileRoot, 'app', 'receipt-view.tsx'), 'utf8');
if (!receiptViewSource.includes('image/png') && !receiptViewSource.includes('PNG image')) {
  errors.push('app/receipt-view.tsx: transaction receipt must be presented as an image');
}

const appConfig = JSON.parse(fs.readFileSync(path.join(mobileRoot, 'app.json'), 'utf8'));
if (appConfig.expo.userInterfaceStyle !== 'light') errors.push('app.json: corrected build must use deterministic light appearance');

if (errors.length) {
  console.error(`UI audit failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`UI audit passed: ${routeFiles.length} routes, ${files.length} TypeScript files, ${contrastChecks.length} contrast pairs.`);
