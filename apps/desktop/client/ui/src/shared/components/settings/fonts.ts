import type { ImportedFont } from '@orison/shared-contracts';

/**
 * Common Chinese fonts that ship with Windows. `value` is the CSS font-family
 * (with a sensible fallback); `family` is the bare name used to probe whether
 * the font is actually installed; `label` is the Chinese display name.
 */
export type FontPreset = { family: string; value: string; label: string };

export const CHINESE_FONT_PRESETS: FontPreset[] = [
  { family: 'Microsoft YaHei', value: '"Microsoft YaHei", sans-serif', label: '微软雅黑' },
  { family: 'SimSun', value: 'SimSun, serif', label: '宋体' },
  { family: 'SimHei', value: 'SimHei, sans-serif', label: '黑体' },
  { family: 'KaiTi', value: 'KaiTi, serif', label: '楷体' },
  { family: 'FangSong', value: 'FangSong, serif', label: '仿宋' },
  { family: 'DengXian', value: 'DengXian, sans-serif', label: '等线' },
  { family: 'NSimSun', value: 'NSimSun, serif', label: '新宋体' },
  { family: 'LiSu', value: 'LiSu, serif', label: '隶书' },
  { family: 'YouYuan', value: 'YouYuan, sans-serif', label: '幼圆' },
  { family: 'STKaiti', value: 'STKaiti, serif', label: '华文楷体' },
  { family: 'STSong', value: 'STSong, serif', label: '华文宋体' },
  { family: 'STZhongsong', value: 'STZhongsong, serif', label: '华文中宋' },
  { family: 'STFangsong', value: 'STFangsong, serif', label: '华文仿宋' },
];

const CJK_PROBE = '永国体字汉';

/**
 * True if `family` is installed: render the probe text backed by `monospace`
 * vs `sans-serif`. An installed font supplies the glyphs itself → equal widths;
 * a missing font falls back to each generic → differing widths.
 */
export function isFontInstalled(family: string): boolean {
  if (typeof document === 'undefined') return true;
  const ctx = document.createElement('canvas').getContext('2d');
  if (!ctx) return true;
  const quoted = `"${family.replace(/"/g, '\\"')}"`;
  ctx.font = `40px ${quoted}, monospace`;
  const mono = ctx.measureText(CJK_PROBE).width;
  ctx.font = `40px ${quoted}, sans-serif`;
  const sans = ctx.measureText(CJK_PROBE).width;
  return Math.abs(mono - sans) < 0.5;
}

const IMPORTED_FONTS_STYLE_ID = 'orison-imported-fonts';

/** Inject @font-face rules for user-imported fonts into the document head. */
export function injectImportedFonts(fonts: ImportedFont[]): void {
  if (typeof document === 'undefined') return;
  let style = document.getElementById(IMPORTED_FONTS_STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = IMPORTED_FONTS_STYLE_ID;
    document.head.appendChild(style);
  }
  style.textContent = fonts
    .map(
      (f) =>
        `@font-face { font-family: "${f.family.replace(/"/g, '\\"')}"; ` +
        `src: url("${f.dataUrl}"); font-display: swap; }`,
    )
    .join('\n');
}
