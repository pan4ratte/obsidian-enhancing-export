/* Whether this device can run pandoc's wasm build at all, asked before anything is downloaded. */

/**
 * A module whose only unusual instruction is `try_table` (opcode 0x1f) — wasm exception handling, which pandoc's
 * binary is built with and which older engines reject with nothing but a compile error at some byte offset.
 *
 * Shipped in Chrome 137, Firefox 131 and Safari 18.4, so what this really asks is whether the device is recent
 * enough: an iPhone on iOS 18.3 will say no.
 */
const EXCEPTION_HANDLING = new Uint8Array([
  0x00,
  0x61,
  0x73,
  0x6d,
  0x01,
  0x00,
  0x00,
  0x00, // header
  0x01,
  0x04,
  0x01,
  0x60,
  0x00,
  0x00, // type: [] -> []
  0x03,
  0x02,
  0x01,
  0x00, // one function of that type
  0x0a,
  0x0d,
  0x01,
  0x0b,
  0x00, // code section, one body, no locals
  0x02,
  0x40, // block
  0x1f,
  0x40,
  0x01,
  0x02,
  0x00, // try_table, catching everything
  0x0b,
  0x0b,
  0x0b, // end, end, end
]);

let cached: boolean | undefined;

/** Whether the engine understands everything pandoc's binary is made of. */
export async function supportsPandocWasm(): Promise<boolean> {
  if (cached === undefined) {
    try {
      await WebAssembly.compile(EXCEPTION_HANDLING);
      cached = true;
    } catch {
      cached = false;
    }
  }
  return cached;
}
