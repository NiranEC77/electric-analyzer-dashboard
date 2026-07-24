/**
 * Runs entirely in the browser — the PDF bytes never leave the client, per
 * the project's client-side-parsing decision. Adapters (packages/adapters)
 * only ever see already-extracted text, so this is the one browser-only
 * seam between "a file" and "a UtilityAdapter". pdfjs-dist is dynamically
 * imported so its ~2MB worker only loads when a PDF is actually uploaded,
 * and so it's never evaluated during Astro's static prerender pass.
 */

/** The subset of a pdf.js TextItem this module needs. */
export interface GlyphItem {
  str: string;
  /** pdf.js transform matrix [a, b, c, d, e, f]; e=x, f=y (PDF coords, y up). */
  transform: number[];
  width: number;
  height: number;
}

/**
 * Reconstruct readable text from positioned glyph/word items. pdf.js emits
 * items in content-stream order — for many utility bills that's one glyph at
 * a time, and a naive join(" ") yields "T o t a l". Instead we group items
 * into visual lines by y, sort by x, and insert a space only on a real
 * horizontal gap — recovering "label … value" adjacency across the bill's
 * multi-column layout so the deterministic adapters can match.
 */
export function reconstructText(items: GlyphItem[]): string {
  const glyphs = items
    .filter((it) => it.str.length > 0)
    .map((it) => ({
      str: it.str,
      x: it.transform[4] ?? 0,
      y: it.transform[5] ?? 0,
      w: it.width,
      h: it.height || Math.abs(it.transform[3] ?? 0) || 8,
    }));

  // Sort into reading order: top-to-bottom (PDF y decreases downward), then left-to-right.
  glyphs.sort((a, b) => (Math.abs(a.y - b.y) > 2 ? b.y - a.y : a.x - b.x));

  const lines: Array<{ y: number; items: typeof glyphs }> = [];
  let current: { y: number; items: typeof glyphs } | null = null;
  for (const g of glyphs) {
    if (!current || Math.abs(g.y - current.y) > Math.max(2, g.h * 0.5)) {
      current = { y: g.y, items: [g] };
      lines.push(current);
    } else {
      current.items.push(g);
    }
  }

  return lines
    .map((line) => {
      line.items.sort((a, b) => a.x - b.x);
      let out = "";
      let prevEnd: number | null = null;
      for (const g of line.items) {
        if (prevEnd !== null && g.x - prevEnd > g.h * 0.2) out += " ";
        out += g.str;
        prevEnd = g.x + g.w;
      }
      return out;
    })
    .join("\n");
}

export async function extractPdfText(file: File): Promise<string> {
  const [pdfjsLib, { default: pdfjsWorker }] = await Promise.all([
    import("pdfjs-dist"),
    import("pdfjs-dist/build/pdf.worker.mjs?url"),
  ]);
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

  const buffer = await file.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: buffer }).promise;
  const pageTexts: string[] = [];

  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
    const page = await doc.getPage(pageNumber);
    const content = await page.getTextContent();
    const items = content.items.filter((it): it is typeof it & { str: string } => "str" in it);
    pageTexts.push(reconstructText(items as GlyphItem[]));
  }

  return pageTexts.join("\n");
}
