/**
 * Runs entirely in the browser — the PDF bytes never leave the client, per
 * the project's client-side-parsing decision. Adapters (packages/adapters)
 * only ever see already-extracted text, so this is the one browser-only
 * seam between "a file" and "a UtilityAdapter". pdfjs-dist is dynamically
 * imported so its ~2MB worker only loads when a PDF is actually uploaded,
 * and so it's never evaluated during Astro's static prerender pass.
 */
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
    const pageText = content.items.map((item) => ("str" in item ? item.str : "")).join(" ");
    pageTexts.push(pageText);
  }

  return pageTexts.join("\n");
}
