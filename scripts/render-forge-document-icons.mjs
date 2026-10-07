import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const directory = path.join(root, 'assets/file-icons');
const logo = await fs.readFile(path.join(root, 'assets/forge-app-icon-ios.png'));
const svg = (await fs.readFile(path.join(directory, 'forge-document.svg'), 'utf8')).replace(
  '../forge-app-icon-ios.png',
  `data:image/png;base64,${logo.toString('base64')}`,
);
const variants = [
  ['ForgeDocument.png', 22, 29],
  ['ForgeDocument@2x.png', 44, 58],
  ['ForgeDocument@3x.png', 66, 87],
  ['ForgeDocumentTablet.png', 64, 64],
  ['ForgeDocumentLarge.png', 320, 320],
  ['forge_document.png', 192, 192],
];

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  for (const [name, width, height] of variants) {
    await page.setViewportSize({ width, height });
    await page.setContent(
      `<style>html,body{margin:0;width:100%;height:100%}svg{display:block;width:100%;height:100%}</style>${svg}`,
    );
    await page.waitForFunction(() => {
      const image = document.querySelector('image');
      if (!image) return false;
      const source = new Image();
      source.src = image.href.baseVal;
      return source.complete && source.naturalWidth > 0;
    });
    await page.screenshot({ path: path.join(directory, name), omitBackground: true });
  }
} finally {
  await browser.close();
}
