// Generate the Windows .ico from the source PNG logo.
//
// electron-builder requires a Windows .ico that is at least 256x256 and ideally
// carries several embedded sizes (16/24/32/48/64/128/256). `png-to-ico` takes a
// single high-resolution PNG and emits a multi-size .ico, so we keep one source
// of truth (resources/icon.png) and regenerate the .ico from it.
//
// Run from the shell package: `pnpm gen:icons`

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import pngToIco from 'png-to-ico';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const resourcesDir = path.resolve(__dirname, '../resources');
const srcPng = path.join(resourcesDir, 'icon.png');
const outIco = path.join(resourcesDir, 'icon.ico');

async function main() {
  try {
    await fs.access(srcPng);
  } catch {
    console.error(`[gen:icons] missing source PNG: ${srcPng}`);
    process.exit(1);
  }

  // png-to-ico resizes the source into the standard icon sizes internally.
  const icoBuffer = await pngToIco(srcPng);
  await fs.writeFile(outIco, icoBuffer);

  console.log(`[gen:icons] wrote ${outIco} (${icoBuffer.length} bytes)`);
}

main().catch((err) => {
  console.error('[gen:icons] failed:', err);
  process.exit(1);
});
