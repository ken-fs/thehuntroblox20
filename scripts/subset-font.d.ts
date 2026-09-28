declare module 'subset-font' {
  /**
   * Local declaration — subset-font ships no types. Subsets the glyphs of an
   * SFNT/WOFF/WOFF2 font buffer down to the given text (harfbuzzjs WASM).
   * `targetFormat: 'sfnt'` outputs TTF/OTF-shaped buffers, which is what
   * satori requires (it rejects WOFF2).
   */
  export default function subsetFont(
    input: Buffer,
    text: string,
    options?: { targetFormat?: 'sfnt' | 'woff' | 'woff2' },
  ): Promise<Buffer>;
}
