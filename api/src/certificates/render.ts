import { renderAsync } from '@resvg/resvg-js';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PDFDocument } from 'pdf-lib';
import QRCode from 'qrcode';
import { SIGNATURE_ALGORITHM } from './signing.js';

// Landscape A4 in tenths of a millimetre: 297 × 210 mm.
const W = 2970;
const H = 2100;
const CX = W / 2;

const INK = '#1C2230';
const MUTED = '#6B7280';
const AMBER = '#F5A623';
const AMBER_DARK = '#E08E12';
const GOLD = '#B8913A';
const GOLD_LIGHT = '#E2C77E';

const FONT_DIR = fileURLToPath(new URL('../../assets/fonts', import.meta.url));
const FONT_FILES = readdirSync(FONT_DIR)
  .filter((file) => file.endsWith('.ttf'))
  .map((file) => `${FONT_DIR}/${file}`);

export interface CertificateView {
  certNo: string;
  recipientName: string;
  orgName: string | null;
  courseTitleTr: string;
  courseTitleEn: string;
  instructorName: string;
  hours: number;
  startedAt: Date;
  completedAt: Date;
  issuedAt: Date;
  keyId: string;
  verifyUrl: string;
  revoked: boolean;
}

/** Everything placed in the SVG passes through here: names cannot become markup. */
function xml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function longDate(date: Date, locale: 'tr' | 'en'): string {
  return new Intl.DateTimeFormat(locale === 'tr' ? 'tr-TR' : 'en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Istanbul',
  }).format(date);
}

/** Greedy word wrap by character count; good enough for a centred paragraph. */
function wrap(text: string, max: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    if (line && (line + ' ' + word).length > max) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Fine interlaced curves, as on banknotes: hard to redraw by hand, easy to recognise. */
function guilloche(): string {
  const curves: string[] = [];
  const rosette = (cx: number, cy: number, R: number, r: number, d: number, scale: number) => {
    const points: string[] = [];
    const steps = 2400;
    const turns = r / gcd(R, r);
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * Math.PI * 2 * turns;
      const x = (R - r) * Math.cos(t) + d * Math.cos(((R - r) / r) * t);
      const y = (R - r) * Math.sin(t) - d * Math.sin(((R - r) / r) * t);
      points.push(`${(cx + x * scale).toFixed(1)},${(cy + y * scale).toFixed(1)}`);
    }
    return `M${points.join('L')}`;
  };
  curves.push(rosette(CX, H / 2, 96, 34, 70, 7.2));
  curves.push(rosette(CX, H / 2, 105, 40, 52, 6.4));
  const waves = [];
  for (let band = 0; band < 6; band++) {
    for (const y0 of [230, H - 230]) {
      const points: string[] = [];
      for (let x = 120; x <= W - 120; x += 8) {
        const y = y0 + Math.sin(x / 38 + band * 0.9) * (14 + band * 3);
        points.push(`${x},${y.toFixed(1)}`);
      }
      waves.push(`M${points.join('L')}`);
    }
  }
  return [
    `<path d="${curves.join(' ')}" fill="none" stroke="${AMBER}" stroke-opacity="0.09" stroke-width="1.6"/>`,
    `<path d="${waves.join(' ')}" fill="none" stroke="${GOLD}" stroke-opacity="0.18" stroke-width="1.4"/>`,
  ].join('');
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

function corners(): string {
  const arm = 150;
  const inset = 125;
  const paths = [
    `M${inset},${inset + arm}V${inset}H${inset + arm}`,
    `M${W - inset - arm},${inset}H${W - inset}V${inset + arm}`,
    `M${inset},${H - inset - arm}V${H - inset}H${inset + arm}`,
    `M${W - inset - arm},${H - inset}H${W - inset}V${H - inset - arm}`,
  ];
  return `<path d="${paths.join('')}" fill="none" stroke="${AMBER}" stroke-width="12" stroke-linecap="square"/>
    ${[
      [inset, inset],
      [W - inset, inset],
      [inset, H - inset],
      [W - inset, H - inset],
    ]
      .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="16" fill="${AMBER}"/>`)
      .join('')}`;
}

function logo(y: number): string {
  // The Lumio mark from the brand kit: a book giving off light, then the wordmark.
  return `<g transform="translate(${CX - 250},${y})">
    <g transform="scale(0.85)">
      <path d="M48 152 L128 136 L208 152 L208 186 L128 170 L48 186 Z" fill="${INK}"/>
      <circle cx="128" cy="98" r="23" fill="${AMBER}"/>
      <path d="M128 62 V38 M172 76 L190 56 M84 76 L66 56" stroke="${AMBER}" stroke-width="17" stroke-linecap="round"/>
    </g>
    <text x="205" y="148" font-family="Poppins" font-weight="600" font-size="120" letter-spacing="-4"><tspan fill="${INK}">lum</tspan><tspan fill="${AMBER}">io</tspan></text>
  </g>`;
}

function seal(cx: number, cy: number): string {
  // Sized to fill the ring once: the path is about 740 units long.
  const ring = 'LUMIO · DOĞRULANMIŞ BELGE · VERIFIED · ';
  return `<g>
    <defs>
      <radialGradient id="gold" cx="40%" cy="35%" r="70%">
        <stop offset="0%" stop-color="${GOLD_LIGHT}"/>
        <stop offset="100%" stop-color="${GOLD}"/>
      </radialGradient>
      <path id="ring" d="M${cx - 118},${cy} a118,118 0 1,1 236,0 a118,118 0 1,1 -236,0"/>
    </defs>
    ${Array.from({ length: 36 }, (_, i) => {
      const a = (i / 36) * Math.PI * 2;
      const x = cx + Math.cos(a) * 165;
      const y = cy + Math.sin(a) * 165;
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="16" fill="${GOLD}"/>`;
    }).join('')}
    <circle cx="${cx}" cy="${cy}" r="160" fill="url(#gold)"/>
    <circle cx="${cx}" cy="${cy}" r="142" fill="none" stroke="#fff" stroke-opacity="0.7" stroke-width="3"/>
    <circle cx="${cx}" cy="${cy}" r="92" fill="none" stroke="#fff" stroke-opacity="0.7" stroke-width="3"/>
    <text text-anchor="start" font-family="Poppins" font-weight="600" font-size="22" letter-spacing="7.6" fill="#fff"><textPath href="#ring">${xml(ring)}</textPath></text>
    <path d="M${cx - 38},${cy + 2} l26,28 l52,-60" fill="none" stroke="#fff" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>
  </g>`;
}

async function qr(url: string, x: number, y: number, size: number): Promise<string> {
  const code = QRCode.create(url, { errorCorrectionLevel: 'M' });
  const count = code.modules.size;
  const cell = size / count;
  const rects: string[] = [];
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      if (code.modules.get(row, col)) {
        rects.push(
          `M${(x + col * cell).toFixed(2)},${(y + row * cell).toFixed(2)}h${cell.toFixed(2)}v${cell.toFixed(2)}h-${cell.toFixed(2)}z`,
        );
      }
    }
  }
  return `<rect x="${x - 18}" y="${y - 18}" width="${size + 36}" height="${size + 36}" fill="#fff" stroke="${GOLD}" stroke-width="3" rx="10"/>
    <path d="${rects.join('')}" fill="${INK}"/>`;
}

export async function renderSvg(view: CertificateView): Promise<string> {
  const nameSize =
    view.recipientName.length > 30 ? 104 : view.recipientName.length > 22 ? 124 : 150;
  const start = longDate(view.startedAt, 'tr');
  const end = longDate(view.completedAt, 'tr');
  const trBody = `${view.orgName ? `${view.orgName} bünyesinde ` : ''}${start} – ${end} tarihleri arasında ${view.hours} saatlik “${view.courseTitleTr}” eğitimini başarıyla tamamlamıştır.`;
  const enBody = `has successfully completed the ${view.hours}-hour course “${view.courseTitleEn}”${view.orgName ? ` at ${view.orgName}` : ''}, ${longDate(view.startedAt, 'en')} – ${longDate(view.completedAt, 'en')}.`;
  const trLines = wrap(trBody, 70);
  const enLines = wrap(enBody, 92);
  let y = 1100;
  const body = [
    ...trLines.map((line) => {
      const out = `<text x="${CX}" y="${y}" font-size="46" fill="${INK}">${xml(line)}</text>`;
      y += 66;
      return out;
    }),
    ...enLines.map((line, index) => {
      if (index === 0) y += 14;
      const out = `<text x="${CX}" y="${y}" font-size="36" fill="${MUTED}">${xml(line)}</text>`;
      y += 52;
      return out;
    }),
  ].join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="Poppins" text-anchor="middle">
  <rect width="${W}" height="${H}" fill="#FFFDF7"/>
  ${guilloche()}
  <rect x="50" y="50" width="${W - 100}" height="${H - 100}" fill="none" stroke="${GOLD}" stroke-width="14"/>
  <rect x="90" y="90" width="${W - 180}" height="${H - 180}" fill="none" stroke="${GOLD}" stroke-width="4"/>
  ${corners()}
  <g text-anchor="start">${logo(190)}</g>
  <text x="${CX}" y="530" font-size="94" font-weight="700" letter-spacing="14" fill="${INK}">BAŞARI SERTİFİKASI</text>
  <text x="${CX}" y="608" font-size="42" font-weight="500" letter-spacing="18" fill="${MUTED}">CERTIFICATE OF ACHIEVEMENT</text>
  <rect x="${CX - 110}" y="650" width="220" height="7" fill="${AMBER}"/>
  <text x="${CX}" y="770" font-size="44" fill="${MUTED}">Bu belge ile · This is to certify that</text>
  <text x="${CX}" y="935" font-size="${nameSize}" font-weight="700" fill="${AMBER_DARK}">${xml(view.recipientName)}</text>
  <rect x="${CX - 700}" y="985" width="1400" height="3" fill="${GOLD}"/>
  ${body}
  <text x="650" y="1760" font-size="54" font-weight="500" fill="${INK}">${xml(view.instructorName)}</text>
  <rect x="380" y="1790" width="540" height="3" fill="${INK}"/>
  <text x="650" y="1850" font-size="32" fill="${MUTED}">Eğitmen · Instructor</text>
  ${seal(CX, 1700)}
  <text x="${CX}" y="1925" font-size="30" fill="${MUTED}">Veriliş · Issued: ${xml(longDate(view.issuedAt, 'tr'))}</text>
  ${await qr(view.verifyUrl, 2190, 1500, 250)}
  <text x="2315" y="1830" font-size="28" fill="${MUTED}">Belge No · Certificate No</text>
  <text x="2315" y="1885" font-size="44" font-weight="600" fill="${INK}" letter-spacing="2">${xml(view.certNo)}</text>
  <text x="2315" y="1935" font-size="24" fill="${MUTED}">QR ile doğrulayın · Scan to verify</text>
  <text x="${CX}" y="1982" font-size="22" fill="${MUTED}">Dijital olarak imzalanmıştır · Digitally signed · ${SIGNATURE_ALGORITHM} · ${xml(view.keyId)}</text>
  ${
    view.revoked
      ? `<g transform="rotate(-18 ${CX} ${H / 2})"><rect x="${CX - 760}" y="${H / 2 - 130}" width="1520" height="220" fill="#FBEBEB" fill-opacity="0.92" stroke="#DC2626" stroke-width="10"/><text x="${CX}" y="${H / 2 + 30}" font-size="120" font-weight="700" fill="#DC2626" letter-spacing="10">İPTAL · REVOKED</text></g>`
      : ''
  }
</svg>`;
}

/**
 * A PNG of the certificate. 3508 px wide is A4 at 300 dpi; smaller widths are
 * previews. Drawn on a background thread, so other requests keep moving.
 */
export async function renderPng(svg: string, width = 3508): Promise<Buffer> {
  const image = await renderAsync(svg, {
    fitTo: { mode: 'width', value: width },
    font: { fontFiles: FONT_FILES, loadSystemFonts: false, defaultFontFamily: 'Poppins' },
  });
  return image.asPng();
}

/** An A4 landscape PDF carrying the print-quality image and the certificate number. */
export async function renderPdf(svg: string, view: CertificateView): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Lumio ${view.certNo}`);
  pdf.setSubject(`${view.courseTitleEn} · ${view.verifyUrl}`);
  pdf.setAuthor('Lumio');
  pdf.setCreator('Lumio');
  pdf.setProducer('Lumio');
  pdf.setCreationDate(view.issuedAt);
  const image = await pdf.embedPng(await renderPng(svg));
  const page = pdf.addPage([841.89, 595.28]);
  page.drawImage(image, { x: 0, y: 0, width: 841.89, height: 595.28 });
  return pdf.save();
}
