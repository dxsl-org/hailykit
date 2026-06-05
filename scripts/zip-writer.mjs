/*
 * Minimal, dependency-free ZIP writer (DEFLATE) using only node:zlib.
 *
 * Exists because no single platform zip tool is reliable across the team's
 * machines: Windows `Compress-Archive` emits backslash entries that break Unix
 * `unzip`, and the bundled `tar` cannot write the zip container. Writing the
 * archive ourselves guarantees standard forward-slash entries everywhere.
 *
 * Supports stored file entries with a fixed timestamp (reproducible builds).
 * Not a general-purpose library — just enough for the release artifact.
 */
import { deflateRawSync } from 'node:zlib';
import { readFileSync, writeFileSync } from 'node:fs';

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// Fixed DOS date/time (1980-01-01 00:00:00) for reproducible archives.
const DOS_TIME = 0;
const DOS_DATE = 0x0021;

/**
 * Write a ZIP archive to `outPath`.
 * @param {{archivePath: string, absPath: string}[]} files - Entries; archivePath
 *   uses forward slashes and is the path stored inside the zip.
 * @param {string} outPath - Destination .zip path.
 */
export function createZip(files, outPath) {
  // EOCD counts/sizes are 16/32-bit (no Zip64 support) — guard against overflow.
  if (files.length > 0xffff) {
    throw new Error('Too many entries for a non-Zip64 archive (>65535)');
  }
  const locals = [];
  const centrals = [];
  let offset = 0;

  for (const { archivePath, absPath } of files) {
    const nameBuf = Buffer.from(archivePath.replace(/\\/g, '/'), 'utf8');
    const raw = readFileSync(absPath);
    const compressed = deflateRawSync(raw);
    const crc = crc32(raw);

    const local = Buffer.alloc(30 + nameBuf.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);          // version needed
    local.writeUInt16LE(0, 6);           // flags
    local.writeUInt16LE(8, 8);           // method: deflate
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);          // extra length
    nameBuf.copy(local, 30);
    locals.push(local, compressed);

    const central = Buffer.alloc(46 + nameBuf.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);        // version made by
    central.writeUInt16LE(20, 6);        // version needed
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(DOS_TIME, 12);
    central.writeUInt16LE(DOS_DATE, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30);        // extra
    central.writeUInt16LE(0, 32);        // comment
    central.writeUInt16LE(0, 34);        // disk start
    central.writeUInt16LE(0, 36);        // internal attrs
    central.writeUInt32LE(0, 38);        // external attrs
    central.writeUInt32LE(offset, 42);   // local header offset
    nameBuf.copy(central, 46);
    centrals.push(central);

    offset += local.length + compressed.length;
  }

  const centralBuf = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  writeFileSync(outPath, Buffer.concat([...locals, centralBuf, eocd]));
}
