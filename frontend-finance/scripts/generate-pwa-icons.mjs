import sharp from 'sharp';
import { fileURLToPath } from 'node:url';

const source = fileURLToPath(new URL('../public/icons/meu-bolso.svg', import.meta.url));
for (const [file, size] of [['pwa-192x192.png', 192], ['pwa-512x512.png', 512], ['apple-touch-icon.png', 180]]) {
  const target = fileURLToPath(new URL(`../public/icons/${file}`, import.meta.url));
  await sharp(source).resize(size, size).png().toFile(target);
  console.log(`Generated ${file} (${size}x${size})`);
}