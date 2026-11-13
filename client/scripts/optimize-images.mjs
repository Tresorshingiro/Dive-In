// Converts the original photos in client/assets-src into the optimised .webp files the site uses.
// Usage:  npm run images          (from the repo root or client/)
// Replace a photo by dropping a new file into assets-src/photos and updating MAP below.
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const src = (f) => path.join(root, 'assets-src', 'photos', f);
const out = (f) => path.join(root, 'public', 'images', f);

/** target name -> [source file, width, height] (cover crop, attention-based) */
const MAP = {
  'hero.webp': ['edgar-chaparro-sHfo3WOgGTU-unsplash.jpg', 1100, 1300],
  'gym-1.webp': ['ambitious-studio-rick-barrett-1RNQ11ZODJM-unsplash.jpg', 1200, 800],
  'gym-2.webp': ['mirko-meister-j4T5z94b8ns-unsplash.jpg', 1200, 800],
  'gym-3.webp': ['salman-sidheek-iW79tgCbiMs-unsplash.jpg', 1200, 800],
  'gym-4.webp': ['richard-r-b-sz9vKfkrc-unsplash.jpg', 1200, 800],
  'coach-1.webp': ['john-wallace-5_G4i0NRLx4-unsplash.jpg', 720, 900],
  'coach-2.webp': ['sushil-ghimire-5UbIqV58CW8-unsplash.jpg', 720, 900],
  'coach-3.webp': ['lawrence-crayton-Th2Pk8NKpOc-unsplash.jpg', 720, 900],
  'coach-4.webp': ['nigel-msipa-lREjkc9DeRA-unsplash.jpg', 720, 900],
  'gym-5.webp': ['aalo-lens-uYnHRrm63uo-unsplash.jpg', 1200, 800],
  'gym-6.webp': ['ambitious-studio-rick-barrett-w7jYaN7GqyA-unsplash.jpg', 1200, 800],
  'gym-7.webp': ['luis-reyes-mTorQ9gFfOg-unsplash.jpg', 1200, 800],
  'gym-8.webp': ['mohamed-fareed-rbSNsoXk-3A-unsplash.jpg', 1200, 800],
  'gym-9.webp': ['mulberry-digital-LOA2mTj1vhc-unsplash.jpg', 1200, 800],
  'gym-10.webp': ['samuel-girven-fqMu99l8sqo-unsplash.jpg', 1200, 800],
  'gym-11.webp': ['oswald-elsaboath-8ylrWcyhNIQ-unsplash.jpg', 1200, 800],
  'coach-5.webp': ['resilience-cbd-Rb6fH5ecKdg-unsplash.jpg', 720, 900],
  'coach-6.webp': ['praise-judah-NnvuuecD0c4-unsplash.jpg', 720, 900],
  'gym-owner.webp': ['praise-judah-ANLC8vwUP_g-unsplash.jpg', 1200, 800],
  'about-kigali.webp': ['dushane-white-3IbnOuxXST4-unsplash.jpg', 1400, 1000],
  'about-class.webp': ['karsten-winegeart-0Wra5YYVQJE-unsplash.jpg', 1400, 1000],
};

await mkdir(path.join(root, 'public', 'images'), { recursive: true });
for (const [target, [file, w, h]] of Object.entries(MAP)) {
  await sharp(src(file)).rotate().resize(w, h, { fit: 'cover', position: sharp.strategy.attention }).webp({ quality: 78 }).toFile(out(target));
  console.log('✓', target, '←', file);
}

// Logo → navbar mark, favicon and touch icon
const logo = path.join(root, 'assets-src', 'logo.jpeg');
await sharp(logo).resize(256, 256).webp({ quality: 85 }).toFile(out('logo.webp'));
await sharp(logo).resize(64, 64).png().toFile(path.join(root, 'public', 'favicon.png'));
await sharp(logo).resize(180, 180).png().toFile(path.join(root, 'public', 'apple-touch-icon.png'));
console.log('✓ logo.webp, favicon.png, apple-touch-icon.png');
