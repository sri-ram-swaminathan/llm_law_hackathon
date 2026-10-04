/**
 * Minimal ZIP reader (central directory + stored/deflate entries) so "Import CI run" accepts the
 * artifact ZIP as downloaded by `gh run download`, without a dependency.
 */
const u16 = (b: Uint8Array, o: number) => b[o] | (b[o + 1] << 8);
const u32 = (b: Uint8Array, o: number) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === "undefined") throw new Error("This browser cannot unzip files. Extract result.json and import that instead.");
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function readZipEntry(zip: Uint8Array, match: (name: string) => boolean): Promise<Uint8Array | null> {
  // End of central directory record: scan backwards for its signature.
  let eocd = -1;
  for (let i = zip.length - 22; i >= Math.max(0, zip.length - 22 - 65535); i--) {
    if (u32(zip, i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("This file is not a valid ZIP archive.");
  const count = u16(zip, eocd + 10);
  let p = u32(zip, eocd + 16);
  const dec = new TextDecoder();
  for (let n = 0; n < count; n++) {
    if (u32(zip, p) !== 0x02014b50) throw new Error("The ZIP archive is corrupt.");
    const method = u16(zip, p + 10);
    const csize = u32(zip, p + 20);
    const nameLen = u16(zip, p + 28), extraLen = u16(zip, p + 30), commentLen = u16(zip, p + 32);
    const local = u32(zip, p + 42);
    const name = dec.decode(zip.subarray(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extraLen + commentLen;
    if (!match(name) || name.endsWith("/")) continue;
    if (u32(zip, local) !== 0x04034b50) throw new Error("The ZIP archive is corrupt.");
    const start = local + 30 + u16(zip, local + 26) + u16(zip, local + 28);
    const data = zip.subarray(start, start + csize);
    if (method === 0) return data.slice();
    if (method === 8) return inflateRaw(data);
    throw new Error("This ZIP uses an unsupported compression method.");
  }
  return null;
}
