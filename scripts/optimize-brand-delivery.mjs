import fs from 'node:fs';
import path from 'node:path';
import { deflateSync, inflateSync } from 'node:zlib';

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// Recompresión del contenedor: conserva dimensiones, color, alfa y cada píxel.
export function recompressPng(original) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (!original.subarray(0, 8).equals(signature)) throw new Error('PNG inválido');
  const chunks = [];
  for (let offset = 8; offset < original.length;) {
    const length = original.readUInt32BE(offset);
    const end = offset + length + 12;
    if (end > original.length) throw new Error('PNG truncado');
    chunks.push({ type: original.toString('ascii', offset + 4, offset + 8), raw: original.subarray(offset, end), data: original.subarray(offset + 8, end - 4) });
    offset = end;
  }
  const raw = inflateSync(Buffer.concat(chunks.filter(c => c.type === 'IDAT').map(c => c.data)));
  const compressed = deflateSync(raw, { level: 9 });
  if (!inflateSync(compressed).equals(raw)) throw new Error('La recompresión alteró los datos');
  const payload = Buffer.concat([Buffer.from('IDAT'), compressed]);
  const idat = Buffer.alloc(payload.length + 8);
  idat.writeUInt32BE(compressed.length, 0);
  payload.copy(idat, 4);
  idat.writeUInt32BE(crc32(payload), idat.length - 4);
  let emitted = false;
  const output = Buffer.concat([signature, ...chunks.flatMap(c => {
    if (c.type !== 'IDAT') return [c.raw];
    if (emitted) return [];
    emitted = true;
    return [idat];
  })]);
  return output.length < original.length ? output : original;
}

export function optimizeBrandDelivery(root, out) {
  fs.mkdirSync(path.join(out, 'brand/optimized'), { recursive: true });
  for (const variant of ['light', 'dark']) {
    const file = `cosmica-logo-${variant}.png`;
    const original = fs.readFileSync(path.join(root, 'brand/official', file));
    const optimized = recompressPng(original);
    fs.writeFileSync(path.join(out, 'brand/optimized', file), optimized);
    console.log(`✓ ${file}: ${original.length} → ${optimized.length} bytes, sin cambios de imagen.`);
  }
  for (const file of fs.readdirSync(out).filter(name => name.endsWith('.html'))) {
    const target = path.join(out, file);
    const source = fs.readFileSync(target, 'utf8');
    fs.writeFileSync(target, source.replaceAll('/brand/official/cosmica-logo-', '/brand/optimized/cosmica-logo-'));
  }
}
