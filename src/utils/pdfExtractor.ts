import { getDocumentProxy } from 'unpdf';

export interface ExtractedPdf {
  title: string;
  totalPages: number;
  text: string;
  pages: string[];
}

/**
 * Validates if an extracted text string contains genuine substantive content,
 * rather than just empty page headers, boilerplate, or "PDF Document" labels.
 */
export function isMeaningfulContent(raw: string | null | undefined): boolean {
  if (!raw || typeof raw !== 'string') return false;
  const stripped = raw
    .replace(/^(Page Title|Document Title):\s*.*?(\n|$)/gim, '')
    .replace(/^Total Pages:\s*\d+\s*(\n|$)/gim, '')
    .replace(/---\s*Page\s*\d+\s*---\s*/gi, '')
    .replace(/\[(No readable text|Page text could not be read|Visual Infographic|Image_|Visual Diagram)[^\]]*\]/gi, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[*#_`~>|]/g, ' ')
    .replace(/\b(pdf document|pdf|document)\b/gi, '')
    .trim();
  
  // Must contain at least 15 characters of real substance and multiple words
  return stripped.length >= 15 && stripped.split(/\s+/).filter(w => w.length > 1).length >= 3;
}

// In-memory caches to make repeated queries instant (0ms)
const memoryBufferCache = new Map<string, ExtractedPdf>();
const urlExtractCache = new Map<string, { data: ExtractedPdf; timestamp: number }>();
const inFlightUrlPromises = new Map<string, Promise<ExtractedPdf>>();

function computeBufferKey(buffer: ArrayBuffer, title: string): string {
  const len = buffer.byteLength;
  const sample = Math.min(64, len);
  const u8 = new Uint8Array(buffer, 0, sample);
  let hash = len;
  for (let i = 0; i < sample; i++) {
    hash = ((hash << 5) - hash + u8[i]) | 0;
  }
  return `${title}_${len}_${hash}`;
}

/**
 * High-performance extraction of text and metadata from an ArrayBuffer of a PDF
 */
export async function extractPdfFromArrayBuffer(buffer: ArrayBuffer | Uint8Array, fallbackTitle = 'PDF Document'): Promise<ExtractedPdf> {
  const uint8Array = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const cacheKey = computeBufferKey(uint8Array.buffer, fallbackTitle);
  const cached = memoryBufferCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  let title = fallbackTitle;
  let totalPages = 1;

  try {
    const pdf = await getDocumentProxy(uint8Array, {
      disableWorker: true,
      isEvalSupported: false,
      useSystemFonts: true
    } as any);
    totalPages = pdf.numPages || 1;

    // Fast metadata lookup
    try {
      const meta = await pdf.getMetadata();
      const info = meta?.info as Record<string, any> | undefined;
      if (info?.Title && typeof info.Title === 'string' && info.Title.trim()) {
        title = info.Title.trim();
      }
    } catch {
      // Ignore metadata error
    }

    // Helper to extract a single page's text cleanly
    const extractSinglePage = async (pageNum: number): Promise<string> => {
      try {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent({ includeMarkedContent: false } as any);
        let pageStr = '';
        let lastY: number | null = null;

        for (const item of textContent.items as any[]) {
          if (item && typeof item.str === 'string') {
            if (item.hasEOL) {
              pageStr += item.str + '\n';
            } else if (lastY !== null && item.transform && Math.abs(item.transform[5] - lastY) > 6) {
              pageStr += '\n' + item.str;
            } else {
              pageStr += (pageStr.endsWith(' ') || pageStr.endsWith('\n') || !pageStr ? '' : ' ') + item.str;
            }
            if (item.transform && Array.isArray(item.transform)) {
              lastY = item.transform[5];
            }
          }
        }

        const cleanPage = pageStr.trim();
        return `--- Page ${pageNum} ---\n${cleanPage || '[No readable text on this page]'}`;
      } catch (pageErr) {
        console.warn(`Could not extract page ${pageNum}:`, pageErr);
        return `--- Page ${pageNum} ---\n[Page text could not be read]`;
      }
    };

    // Parallel page extraction with concurrent chunking for 5x-10x speedup
    const BATCH_SIZE = 8;
    const pages: string[] = new Array(totalPages);
    for (let i = 0; i < totalPages; i += BATCH_SIZE) {
      const batchPromises: Promise<void>[] = [];
      const end = Math.min(i + BATCH_SIZE, totalPages);
      for (let p = i + 1; p <= end; p++) {
        const pageIndex = p - 1;
        batchPromises.push(
          extractSinglePage(p).then((res) => {
            pages[pageIndex] = res;
          })
        );
      }
      await Promise.all(batchPromises);
    }

    try {
      if (pdf.cleanup) await pdf.cleanup();
      if ((pdf as any).destroy) await (pdf as any).destroy();
    } catch {}

    const fullText = `Document Title: ${title}\nTotal Pages: ${totalPages}\n\n` + pages.join('\n\n');

    const result: ExtractedPdf = {
      title,
      totalPages,
      text: fullText.trim(),
      pages
    };

    memoryBufferCache.set(cacheKey, result);
    return result;
  } catch (err: any) {
    console.error('Failed to extract PDF with unpdf:', err);

    // Fallback: fast regex text extraction for raw text streams
    try {
      const fallbackResult = extractRawPdfFallback(buffer, fallbackTitle);
      if (fallbackResult && fallbackResult.text && fallbackResult.text.length > 50) {
        memoryBufferCache.set(cacheKey, fallbackResult);
        return fallbackResult;
      }
    } catch {
      // Fallback failed
    }

    throw new Error(err?.message || 'Could not parse PDF file. Ensure the file is not corrupted or password-protected.');
  }
}

/**
 * Fallback raw text extractor for uncompressed or simple text streams
 */
function extractRawPdfFallback(buffer: ArrayBuffer | Uint8Array, fallbackTitle: string): ExtractedPdf | null {
  try {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    let str = '';
    for (let i = 0; i < bytes.length; i++) {
      const b = bytes[i];
      if ((b >= 32 && b <= 126) || b === 10 || b === 13) {
        str += String.fromCharCode(b);
      } else {
        str += ' ';
      }
    }

    const textChunks: string[] = [];
    // 1. Match standard (Text) Tj operators
    const tjRegex = /\(([^()]{1,2000})\)\s*Tj/g;
    let match: RegExpExecArray | null;
    while ((match = tjRegex.exec(str)) !== null) {
      const cleaned = match[1].trim();
      if (cleaned.length > 0) textChunks.push(cleaned);
    }

    // 2. Match [(Text) 12 (More)] TJ kerning array operators
    const tjArrayRegex = /\[([^\[\]]{1,4000})\]\s*TJ/gi;
    while ((match = tjArrayRegex.exec(str)) !== null) {
      const arrayContent = match[1];
      const subRegex = /\(([^()]+)\)/g;
      let subMatch: RegExpExecArray | null;
      let combined = '';
      while ((subMatch = subRegex.exec(arrayContent)) !== null) {
        combined += (combined ? ' ' : '') + subMatch[1];
      }
      if (combined.trim().length > 0) textChunks.push(combined.trim());
    }

    if (textChunks.length > 0) {
      const rawText = textChunks.join(' ').replace(/\s+/g, ' ').trim();
      if (rawText.length > 20) {
        return {
          title: fallbackTitle,
          totalPages: 1,
          text: `Document Title: ${fallbackTitle}\n\n--- Page 1 ---\n` + rawText,
          pages: [`--- Page 1 ---\n` + rawText]
        };
      }
    }
  } catch {
    // Ignore fallback errors
  }
  return null;
}

/**
 * Extracts text from a URL pointing to a PDF file with in-flight deduplication and caching
 */
export async function extractPdfFromUrl(url: string, title?: string): Promise<ExtractedPdf> {
  const cached = urlExtractCache.get(url);
  if (cached && (Date.now() - cached.timestamp < 1000 * 60 * 30)) {
    return cached.data;
  }

  const existing = inFlightUrlPromises.get(url);
  if (existing) {
    return existing;
  }

  const filename = title || url.split('/').pop()?.split('#')[0].split('?')[0] || 'document.pdf';
  const fetchPromise = (async () => {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch PDF (${response.status} ${response.statusText})`);
      }
      const buffer = await response.arrayBuffer();
      const extracted = await extractPdfFromArrayBuffer(buffer, filename);
      urlExtractCache.set(url, { data: extracted, timestamp: Date.now() });
      return extracted;
    } catch (err: any) {
      console.warn(`Direct fetch of PDF URL "${url}" failed:`, err);
      throw new Error(`Could not load PDF "${filename}". ${err.message || ''}`);
    } finally {
      inFlightUrlPromises.delete(url);
    }
  })();

  inFlightUrlPromises.set(url, fetchPromise);
  return fetchPromise;
}

// Ensure global attachment for ServiceWorker importScripts
if (typeof self !== 'undefined') {
  (self as any).AccessMindPDF = { extractPdfFromArrayBuffer, extractPdfFromUrl, isMeaningfulContent };
}
if (typeof globalThis !== 'undefined') {
  (globalThis as any).AccessMindPDF = { extractPdfFromArrayBuffer, extractPdfFromUrl, isMeaningfulContent };
}

