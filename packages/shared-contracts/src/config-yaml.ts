export type FlatConfigValue = string | number | boolean | null;
export type FlatConfig = Record<string, FlatConfigValue>;

export function parseFlatYaml(text: string): FlatConfig {
  const result: FlatConfig = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const index = line.indexOf(':');
    if (index < 0) continue;

    const key = line.slice(0, index).trim();
    const rawValue = line.slice(index + 1).trim();
    if (!key) continue;

    result[key] = parseScalar(rawValue);
  }
  return result;
}

export function stringifyFlatYaml(config: FlatConfig): string {
  return `${Object.entries(config)
    .map(([key, value]) => `${key}: ${formatScalar(value)}`)
    .join('\n')}\n`;
}

function parseScalar(value: string): FlatConfigValue {
  if (value === '' || value === 'null') return null;
  if (value === 'true') return true;
  if (value === 'false') return false;
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1).replace(/\\"/g, '"').replace(/\\'/g, "'");
  }
  const asNumber = Number(value);
  if (Number.isFinite(asNumber) && value.trim() !== '') return asNumber;
  return value;
}

function formatScalar(value: FlatConfigValue): string {
  if (value === null) return 'null';
  if (typeof value === 'boolean' || typeof value === 'number') return String(value);
  if (/^[A-Za-z0-9_./:@+-]+$/.test(value)) return value;
  return JSON.stringify(value);
}
