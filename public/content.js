// AccessMind Content Script

let isBionicEnabled = false;
let dyslexiaEnabled = false;
let tintEnabled = false;
let alternateLinesEnabled = false;
let isSpacebarPressed = false;
let hudElement = null;
let toastElement = null;
let quickBarElement = null;
let toastTimeout = null;

// PDF Document State
let cachedPdfData = null;
let isPdfExtracting = false;
let pdfOverlayElement = null;

function isMeaningfulContent(raw) {
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
  return stripped.length >= 15 && stripped.split(/\s+/).filter(w => w.length > 1).length >= 3;
}

function getPdfTargetUrl() {
  const current = window.location.href || '';
  // If the browser tab URL is a PDF, that is always the ground truth
  if (current && (current.toLowerCase().endsWith('.pdf') || current.toLowerCase().includes('.pdf?') || current.toLowerCase().includes('.pdf#') || current.toLowerCase().includes('/pdf/'))) {
    return current;
  }
  // Otherwise check for embeds with actual PDF sources (avoiding internal chrome-extension:// or about: wrappers)
  const embed = document.querySelector('embed[type="application/pdf"], embed[src*=".pdf"], object[type="application/pdf"], object[data*=".pdf"], iframe[src*=".pdf"]');
  if (embed) {
    const src = embed.src || embed.getAttribute('src') || embed.data || embed.getAttribute('data');
    if (src && !src.startsWith('chrome-extension://') && !src.startsWith('about:')) {
      return src;
    }
  }
  return current;
}

function isPdfPage() {
  const isEmbedPdf = !!document.querySelector('embed[type="application/pdf"], embed[type="application/x-google-chrome-pdf"], object[type="application/pdf"], iframe[src*=".pdf"]');
  const isPdfUrl = window.location.pathname.toLowerCase().endsWith('.pdf') || 
                   window.location.href.toLowerCase().includes('.pdf') ||
                   window.location.href.toLowerCase().includes('/pdf/');
  const isPdfMime = document.contentType === 'application/pdf';
  const isPdfTitle = !!(document.title && (document.title.toLowerCase().endsWith('.pdf') || document.title.toLowerCase().includes('.pdf')));
  return isEmbedPdf || isPdfUrl || isPdfMime || isPdfTitle;
}

function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i += 8192) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + 8192, len)));
  }
  return btoa(binary);
}

async function fetchPdfBufferInTab(url) {
  const candidates = [url];
  if (window.location.href && !candidates.includes(window.location.href)) {
    candidates.push(window.location.href);
  }
  for (const u of candidates) {
    try {
      const res = await fetch(u, { credentials: 'same-origin' });
      if (res.ok) {
        const buf = await res.arrayBuffer();
        if (buf && buf.byteLength > 100) return buf;
      }
    } catch (e) {}

    try {
      const buf = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', u, true);
        xhr.responseType = 'arraybuffer';
        xhr.onload = () => (xhr.status === 200 || xhr.status === 0) ? resolve(xhr.response) : reject();
        xhr.onerror = reject;
        xhr.send();
      });
      if (buf && buf.byteLength > 100) return buf;
    } catch (e) {}
  }
  return null;
}

async function extractPdfTextInTab() {
  if (cachedPdfData && cachedPdfData.text && isMeaningfulContent(cachedPdfData.text)) {
    return cachedPdfData;
  }

  const targetUrl = getPdfTargetUrl();
  const rawTitle = document.title || '';
  const title = (rawTitle && !rawTitle.toLowerCase().endsWith('.pdf') && rawTitle.toLowerCase() !== 'pdf document') 
    ? rawTitle 
    : targetUrl.split('/').pop()?.split('#')[0].split('?')[0] || 'PDF Document';

  // 1. Try local AccessMindPDF library in tab context
  const pdfLib = (typeof self !== 'undefined' && self.AccessMindPDF) ||
                 (typeof window !== 'undefined' && window.AccessMindPDF) ||
                 (typeof globalThis !== 'undefined' && globalThis.AccessMindPDF);

  if (pdfLib && pdfLib.extractPdfFromArrayBuffer) {
    try {
      const buffer = await fetchPdfBufferInTab(targetUrl);
      if (buffer) {
        const extracted = await pdfLib.extractPdfFromArrayBuffer(buffer, title);
        if (extracted && extracted.text && isMeaningfulContent(extracted.text)) {
          cachedPdfData = extracted;
          updatePdfOverlayContent(extracted);
          return extracted;
        }
      }
    } catch (libErr) {
      console.warn("Direct tab PDF extraction attempt notice:", libErr);
    }
  }

  // 2. Request from background worker with safety timeout
  return new Promise((resolve) => {
    let completed = false;
    const timer = setTimeout(() => {
      if (!completed) {
        completed = true;
        resolve(cachedPdfData || null);
      }
    }, 7000);

    chrome.runtime.sendMessage({ 
      action: "extractPdfText", 
      url: targetUrl, 
      title: title 
    }, (res) => {
      if (completed) return;
      completed = true;
      clearTimeout(timer);
      if (res && res.success && res.text && isMeaningfulContent(res.text)) {
        cachedPdfData = res;
        updatePdfOverlayContent(res);
        resolve(res);
      } else {
        resolve(null);
      }
    });
  });
}

// Proactive background pre-extraction of PDF pages on load
function preExtractPdfIfApplicable() {
  if (isPdfPage() && !cachedPdfData && !isPdfExtracting) {
    isPdfExtracting = true;
    extractPdfTextInTab().then((res) => {
      isPdfExtracting = false;
      if (res && res.text && res.text.length > 20) {
        cachedPdfData = res;
        updatePdfOverlayContent(res);
      }
    }).catch(() => {
      isPdfExtracting = false;
    });
  }
}

if (document.readyState === 'complete' || document.readyState === 'interactive') {
  setTimeout(preExtractPdfIfApplicable, 200);
} else {
  window.addEventListener('DOMContentLoaded', () => setTimeout(preExtractPdfIfApplicable, 200));
}

let tintOverlayElement = null;
let readingRulerElement = null;

function getOrCreateTintOverlay() {
  if (!tintOverlayElement) {
    tintOverlayElement = document.createElement('div');
    tintOverlayElement.id = 'accessmind-tint-overlay';
    tintOverlayElement.className = 'tint-hidden';
    document.body.appendChild(tintOverlayElement);
  }
  return tintOverlayElement;
}

function getOrCreateReadingRuler() {
  if (!readingRulerElement) {
    readingRulerElement = document.createElement('div');
    readingRulerElement.id = 'accessmind-reading-ruler-bar';
    readingRulerElement.className = 'ruler-hidden';
    readingRulerElement.innerHTML = `
      <div class="accessmind-ruler-focus"></div>
    `;
    document.body.appendChild(readingRulerElement);

    window.addEventListener('mousemove', (e) => {
      if (readingRulerElement && !readingRulerElement.classList.contains('ruler-hidden')) {
        readingRulerElement.style.top = `${e.clientY - 24}px`;
      }
    }, { passive: true });
  }
  return readingRulerElement;
}

function getOrCreatePdfOverlay() {
  if (!pdfOverlayElement) {
    pdfOverlayElement = document.createElement('div');
    pdfOverlayElement.id = 'accessmind-pdf-overlay';
    pdfOverlayElement.className = 'pdf-overlay-hidden';
    pdfOverlayElement.innerHTML = `
      <div class="accessmind-pdf-header">
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="font-weight:700; color:#4338ca; font-size:13px;">🧠 AccessMind Accessible PDF</span>
          <span id="accessmind-pdf-page-badge" class="accessmind-pdf-badge">Loading...</span>
        </div>
        <div style="display:flex; align-items:center; gap:5px; flex-wrap:wrap;">
          <button class="accessmind-btn" id="ambtn-pdf-read" style="background:#4338ca; color:#fff;" title="Read PDF Aloud">🔊 Read</button>
          <button class="accessmind-btn" id="ambtn-pdf-summarize" style="background:rgba(0,0,0,0.06); color:#334155;" title="Summarize PDF with Gemini AI">📝 Summarize</button>
          <button class="accessmind-btn" id="ambtn-pdf-dyslexia" style="background:rgba(0,0,0,0.06); color:#334155;" title="Toggle OpenDyslexic / Lexend font">🔤 Dyslexia</button>
          <button class="accessmind-btn" id="ambtn-pdf-bionic" style="background:rgba(0,0,0,0.06); color:#334155;" title="Toggle Bionic Reading word-root bolding">👁️ Bionic</button>
          <button class="accessmind-btn" id="ambtn-pdf-tint" style="background:rgba(0,0,0,0.06); color:#334155;" title="Toggle warm Sepia / Irlen tint">🎨 Tint</button>
          <button class="accessmind-btn" id="ambtn-pdf-ruler" style="background:rgba(0,0,0,0.06); color:#334155;" title="Toggle Reading Ruler & alternating lines">📏 Ruler</button>
          <button class="accessmind-btn" id="ambtn-pdf-expand" style="background:rgba(0,0,0,0.06); color:#334155;" title="Toggle Full Width or Split View">⛶ Expand</button>
          <button class="accessmind-btn" id="ambtn-pdf-pause" style="background:#d97706; color:#fff;" title="Pause Reading">⏸️</button>
          <button class="accessmind-btn" id="ambtn-pdf-stop" style="background:#e11d48; color:#fff;" title="Stop Reading">⏹️</button>
          <button class="accessmind-btn" id="ambtn-pdf-close" style="color:#64748b; background:transparent;" title="Close Overlay">✕</button>
        </div>
      </div>
      <div id="accessmind-pdf-body" class="accessmind-pdf-content">
        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:45px 20px; text-align:center; color:#4338ca;">
          <div style="width:34px; height:34px; border:3px solid #e0e7ff; border-top-color:#4338ca; border-radius:50%; animation:accessmind-spin 0.8s linear infinite; margin-bottom:14px;"></div>
          <div style="font-weight:700; font-size:15px; margin-bottom:6px;">Extracting Accessible PDF Content...</div>
          <div style="font-size:12px; color:#64748b; max-width:320px;">Structuring document pages and text for dyslexia, bionic, and line ruler reading.</div>
        </div>
      </div>
    `;
    document.body.appendChild(pdfOverlayElement);

    document.getElementById('ambtn-pdf-read')?.addEventListener('click', toggleReadPage);
    document.getElementById('ambtn-pdf-summarize')?.addEventListener('click', triggerSummarize);
    document.getElementById('ambtn-pdf-dyslexia')?.addEventListener('click', toggleDyslexia);
    document.getElementById('ambtn-pdf-bionic')?.addEventListener('click', toggleBionic);
    document.getElementById('ambtn-pdf-tint')?.addEventListener('click', toggleTint);
    document.getElementById('ambtn-pdf-ruler')?.addEventListener('click', toggleAlternateLines);
    document.getElementById('ambtn-pdf-expand')?.addEventListener('click', () => {
      pdfOverlayElement.classList.toggle('pdf-overlay-expanded');
      const isExpanded = pdfOverlayElement.classList.contains('pdf-overlay-expanded');
      const expandBtn = document.getElementById('ambtn-pdf-expand');
      if (expandBtn) expandBtn.textContent = isExpanded ? '🗗 Split' : '⛶ Expand';
    });
    document.getElementById('ambtn-pdf-pause')?.addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: "pauseTts" }).catch(() => {});
      showToast("⏸️ Reading Paused");
    });
    document.getElementById('ambtn-pdf-stop')?.addEventListener('click', stopReading);
    document.getElementById('ambtn-pdf-close')?.addEventListener('click', () => {
      pdfOverlayElement.classList.add('pdf-overlay-hidden');
    });

    updateOverlayButtonStates();
  }
  return pdfOverlayElement;
}

function updateOverlayButtonStates() {
  chrome.storage.local.get(['dyslexiaOn', 'tintOn', 'bionicOn', 'alternateLinesOn'], (res) => {
    const isDys = dyslexiaEnabled || !!res.dyslexiaOn;
    const isBio = isBionicEnabled || !!res.bionicOn;
    const isTint = tintEnabled || !!res.tintOn;
    const isRuler = alternateLinesEnabled || !!res.alternateLinesOn;

    const btnDys = document.getElementById('ambtn-pdf-dyslexia');
    const btnBio = document.getElementById('ambtn-pdf-bionic');
    const btnTint = document.getElementById('ambtn-pdf-tint');
    const btnRuler = document.getElementById('ambtn-pdf-ruler');

    if (btnDys) btnDys.className = `accessmind-btn ${isDys ? 'accessmind-btn-active' : ''}`;
    if (btnBio) btnBio.className = `accessmind-btn ${isBio ? 'accessmind-btn-active' : ''}`;
    if (btnTint) btnTint.className = `accessmind-btn ${isTint ? 'accessmind-btn-active' : ''}`;
    if (btnRuler) btnRuler.className = `accessmind-btn ${isRuler ? 'accessmind-btn-active' : ''}`;

    const qDys = document.getElementById('ambtn-dyslexia');
    const qBio = document.getElementById('ambtn-bionic');
    const qTint = document.getElementById('ambtn-tint');
    const qRuler = document.getElementById('ambtn-ruler');

    if (qDys) qDys.className = `accessmind-btn ${isDys ? 'accessmind-btn-active' : ''}`;
    if (qBio) qBio.className = `accessmind-btn ${isBio ? 'accessmind-btn-active' : ''}`;
    if (qTint) qTint.className = `accessmind-btn ${isTint ? 'accessmind-btn-active' : ''}`;
    if (qRuler) qRuler.className = `accessmind-btn ${isRuler ? 'accessmind-btn-active' : ''}`;
  });
}

function renderAccessiblePdfContent() {
  if (!cachedPdfData || !cachedPdfData.text || !isMeaningfulContent(cachedPdfData.text)) return;
  const overlay = getOrCreatePdfOverlay();
  const badge = overlay.querySelector('#accessmind-pdf-page-badge');
  const body = overlay.querySelector('#accessmind-pdf-body');
  if (!body) return;

  if (badge) {
    badge.textContent = `${cachedPdfData.totalPages || 1} Page${(cachedPdfData.totalPages || 1) > 1 ? 's' : ''}`;
  }

  if (dyslexiaEnabled) overlay.classList.add('accessmind-overlay-dyslexia');
  else overlay.classList.remove('accessmind-overlay-dyslexia');

  if (tintEnabled) overlay.classList.add('accessmind-overlay-tint');
  else overlay.classList.remove('accessmind-overlay-tint');

  if (alternateLinesEnabled) {
    overlay.classList.add('accessmind-overlay-ruler');
    body.classList.add('accessmind-alternate-lines');
  } else {
    overlay.classList.remove('accessmind-overlay-ruler');
    body.classList.remove('accessmind-alternate-lines');
  }

  updateOverlayButtonStates();

  // Parse into structured pages and paragraphs
  const pages = cachedPdfData.pages && cachedPdfData.pages.length > 0 
    ? cachedPdfData.pages 
    : cachedPdfData.text.split(/(?=---\s*Page\s*\d+\s*---)/i);

  body.innerHTML = '';
  const totalPages = cachedPdfData.totalPages || pages.length || 1;
  const docTitle = cachedPdfData.title && !cachedPdfData.title.toLowerCase().endsWith('.pdf') && cachedPdfData.title.toLowerCase() !== 'pdf document'
    ? cachedPdfData.title
    : (document.title && !document.title.toLowerCase().endsWith('.pdf') ? document.title : 'PDF Document');

  function renderBionicOrPlain(textToFormat) {
    if (!isBionicEnabled) {
      const span = document.createElement('span');
      span.textContent = textToFormat;
      return span;
    }
    const frag = document.createDocumentFragment();
    const words = textToFormat.split(/(\s+)/);
    words.forEach(w => {
      if (w.trim().length > 0) {
        const mid = Math.ceil(w.length / 2);
        const b = document.createElement('b');
        b.className = 'accessmind-bionic-bold';
        b.textContent = w.slice(0, mid);
        frag.appendChild(b);
        frag.appendChild(document.createTextNode(w.slice(mid)));
      } else {
        frag.appendChild(document.createTextNode(w));
      }
    });
    return frag;
  }

  pages.forEach((pageContent, idx) => {
    const pageSheet = document.createElement('div');
    pageSheet.className = 'accessmind-pdf-sheet';

    const pageHeaderMatch = pageContent.match(/^---\s*Page\s*(\d+)\s*---/i);
    const pageNum = pageHeaderMatch ? pageHeaderMatch[1] : (idx + 1);

    // Sheet Header
    const sheetHeader = document.createElement('div');
    sheetHeader.className = 'accessmind-pdf-sheet-header';
    sheetHeader.innerHTML = `
      <span>📄 ${docTitle}</span>
      <span>Page ${pageNum} of ${totalPages}</span>
    `;
    pageSheet.appendChild(sheetHeader);

    let pageText = pageContent.replace(/^---\s*Page\s*\d+\s*---\s*/i, '');

    // Clean internal metadata headers from display
    pageText = pageText
      .replace(/^Document Title:\s*.*?(\n|$)/i, '')
      .replace(/^Total Pages:\s*\d+\s*(\n|$)/gim, '')
      .trim();

    if (!pageText || pageText === '[No readable text on this page]' || pageText === '[Page text could not be read]') {
      const emptyNote = document.createElement('div');
      emptyNote.style.cssText = 'color:#94a3b8; font-style:italic; font-size:13px; padding:16px 0; text-align:center;';
      emptyNote.textContent = '(Visual or graphic page content - no selectable text layer detected)';
      pageSheet.appendChild(emptyNote);
      body.appendChild(pageSheet);
      return;
    }

    // If Page 1, render formatted Title if present
    if (idx === 0) {
      const titleElem = document.createElement('h1');
      titleElem.className = 'accessmind-pdf-title';
      titleElem.appendChild(renderBionicOrPlain(docTitle));
      pageSheet.appendChild(titleElem);
    }

    const paragraphs = pageText
      .split(/\n\s*\n/)
      .map(p => p.trim())
      .filter(p => p.length > 0);

    if (paragraphs.length === 0 && pageText.trim()) {
      paragraphs.push(pageText.trim());
    }

    paragraphs.forEach((pText) => {
      // Check if paragraph is a heading (Abstract:, 1. Introduction, Conclusion, etc.)
      const isHeading = /^(abstract|introduction|background|methodology|experimental|results|discussion|conclusion|key findings|overview|chapter|[0-9.]+\s+[A-Z])/i.test(pText) && pText.length < 90;
      const isBullet = /^[•\-\*]/.test(pText) || /^condition [a-d]/i.test(pText);

      if (isHeading) {
        const heading = document.createElement('h3');
        heading.className = 'accessmind-pdf-heading';
        heading.appendChild(renderBionicOrPlain(pText));
        pageSheet.appendChild(heading);
      } else if (isBullet) {
        const bulletItem = document.createElement('div');
        bulletItem.className = 'accessmind-pdf-bullet-item';
        const dot = document.createElement('span');
        dot.className = 'accessmind-bullet-dot';
        dot.textContent = '•';
        const textWrapper = document.createElement('div');
        textWrapper.appendChild(renderBionicOrPlain(pText.replace(/^[•\-\*]\s*/, '')));
        bulletItem.appendChild(dot);
        bulletItem.appendChild(textWrapper);
        pageSheet.appendChild(bulletItem);
      } else {
        const p = document.createElement('p');
        p.className = 'accessmind-pdf-para';
        p.appendChild(renderBionicOrPlain(pText));
        pageSheet.appendChild(p);
      }
    });

    // Sheet Footer
    const sheetFooter = document.createElement('div');
    sheetFooter.className = 'accessmind-pdf-sheet-footer';
    sheetFooter.innerHTML = `
      <span>AccessMind Cognitive Accessibility Reader</span>
      <span>Page ${pageNum}</span>
    `;
    pageSheet.appendChild(sheetFooter);

    body.appendChild(pageSheet);
  });
}

function updatePdfOverlayContent(data) {
  if (!data || !data.text || !isMeaningfulContent(data.text)) return;
  cachedPdfData = data;
  renderAccessiblePdfContent();
}

async function showPdfOverlay() {
  const overlay = getOrCreatePdfOverlay();
  overlay.classList.remove('pdf-overlay-hidden');
  if (cachedPdfData && cachedPdfData.text && isMeaningfulContent(cachedPdfData.text)) {
    renderAccessiblePdfContent();
    return;
  }

  const body = overlay.querySelector('#accessmind-pdf-body');
  if (body) {
    body.innerHTML = `
      <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:45px 20px; text-align:center; color:#4338ca;">
        <div style="width:34px; height:34px; border:3px solid #e0e7ff; border-top-color:#4338ca; border-radius:50%; animation:accessmind-spin 0.8s linear infinite; margin-bottom:14px;"></div>
        <div style="font-weight:700; font-size:15px; margin-bottom:6px;">Extracting Accessible PDF Content...</div>
        <div style="font-size:12px; color:#64748b; max-width:320px;">Structuring document pages and text for dyslexia, bionic, and line ruler reading.</div>
      </div>
    `;
  }

  isPdfExtracting = true;
  try {
    const data = await extractPdfTextInTab();
    isPdfExtracting = false;
    if (data && data.text && isMeaningfulContent(data.text)) {
      cachedPdfData = data;
      renderAccessiblePdfContent();
    } else {
      if (body) {
        body.innerHTML = `
          <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:40px 20px; text-align:center; color:#475569;">
            <div style="font-size:32px; margin-bottom:10px;">📄</div>
            <div style="font-weight:700; font-size:15px; color:#1e293b; margin-bottom:6px;">${document.title && !document.title.toLowerCase().endsWith('.pdf') ? document.title : 'PDF Document'}</div>
            <div style="font-size:12px; color:#64748b; max-width:340px; margin-bottom:16px; line-height:1.5;">
              This PDF may consist of scanned images or protected layers. You can re-extract or trigger text reading below.
            </div>
            <button id="ambtn-pdf-retry" class="accessmind-btn" style="background:#4338ca; color:#fff; padding:8px 18px; border-radius:8px; font-weight:600;">🔄 Reload PDF Text</button>
          </div>
        `;
        document.getElementById('ambtn-pdf-retry')?.addEventListener('click', () => {
          cachedPdfData = null;
          showPdfOverlay();
        });
      }
    }
  } catch (err) {
    isPdfExtracting = false;
    if (body) {
      body.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:40px 20px; text-align:center;">
          <div style="font-size:32px; margin-bottom:10px;">⚠️</div>
          <div style="font-weight:700; font-size:15px; color:#e11d48; margin-bottom:6px;">Could not extract PDF text</div>
          <div style="font-size:12px; color:#64748b; max-width:320px; margin-bottom:16px;">This file may contain scanned image pages or restricted permissions.</div>
          <button id="ambtn-pdf-retry" class="accessmind-btn" style="background:#4338ca; color:#fff; padding:8px 18px; border-radius:8px;">🔄 Retry</button>
        </div>
      `;
      document.getElementById('ambtn-pdf-retry')?.addEventListener('click', () => {
        cachedPdfData = null;
        showPdfOverlay();
      });
    }
  }
}

function togglePdfOverlay() {
  const overlay = getOrCreatePdfOverlay();
  if (overlay.classList.contains('pdf-overlay-hidden')) {
    showPdfOverlay();
  } else {
    overlay.classList.add('pdf-overlay-hidden');
  }
}

let currentTranscript = '';

function getOrCreateHUD() {
  if (!hudElement) {
    hudElement = document.createElement('div');
    hudElement.id = 'accessmind-voice-hud';
    hudElement.className = 'hud-hidden';
    hudElement.innerHTML = `
      <div class="accessmind-pulse-mic"></div>
      <span id="accessmind-voice-text">Listening... Hold Spacebar & speak</span>
    `;
    hudElement.addEventListener('click', () => {
      // If mic permission is needed or user taps HUD, request permission page
      chrome.runtime.sendMessage({ action: "requestMicPermission" }).catch(() => {});
    });
    document.body.appendChild(hudElement);
  }
  return hudElement;
}

function updateHUD(text, isCommand = false) {
  const hud = getOrCreateHUD();
  const textEl = hud.querySelector('#accessmind-voice-text');
  if (textEl) {
    textEl.textContent = text;
  }
  hud.classList.remove('hud-hidden');
}

function hideHUD(delay = 0) {
  setTimeout(() => {
    if (hudElement) {
      hudElement.classList.add('hud-hidden');
    }
  }, delay);
}

function showToast(message) {
  if (!toastElement) {
    toastElement = document.createElement('div');
    toastElement.id = 'accessmind-toast';
    toastElement.className = 'toast-hidden';
    document.body.appendChild(toastElement);
  }
  toastElement.textContent = message;
  toastElement.classList.remove('toast-hidden');
  
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    if (toastElement) {
      toastElement.classList.add('toast-hidden');
    }
  }, 2200);
}

function getOrCreateQuickBar() {
  if (!quickBarElement) {
    quickBarElement = document.createElement('div');
    quickBarElement.id = 'accessmind-quick-bar';
    quickBarElement.className = 'bar-hidden';
    quickBarElement.innerHTML = `
      <span style="font-weight:700; color:#818cf8; font-size:12px; margin-right:4px;">🧠 AccessMind</span>
      <button class="accessmind-btn" id="ambtn-read">🔊 Read Page</button>
      <button class="accessmind-btn" id="ambtn-pdf-view" style="${isPdfPage() ? '' : 'display:none;'}">📑 PDF Reader</button>
      <button class="accessmind-btn" id="ambtn-summarize">📝 Summarize</button>
      <button class="accessmind-btn" id="ambtn-dyslexia">🔤 Dyslexia</button>
      <button class="accessmind-btn" id="ambtn-bionic">👁️ Bionic</button>
      <button class="accessmind-btn" id="ambtn-tint">🎨 Tint</button>
      <button class="accessmind-btn" id="ambtn-ruler">📏 Ruler</button>
      <button class="accessmind-btn" style="padding:4px 8px; color:#94a3b8;" id="ambtn-close">✕</button>
    `;
    document.body.appendChild(quickBarElement);

    document.getElementById('ambtn-read')?.addEventListener('click', toggleReadPage);
    document.getElementById('ambtn-pdf-view')?.addEventListener('click', togglePdfOverlay);
    document.getElementById('ambtn-summarize')?.addEventListener('click', triggerSummarize);
    document.getElementById('ambtn-dyslexia')?.addEventListener('click', toggleDyslexia);
    document.getElementById('ambtn-bionic')?.addEventListener('click', toggleBionic);
    document.getElementById('ambtn-tint')?.addEventListener('click', toggleTint);
    document.getElementById('ambtn-ruler')?.addEventListener('click', toggleAlternateLines);
    document.getElementById('ambtn-close')?.addEventListener('click', () => quickBarElement.classList.add('bar-hidden'));
  }
  return quickBarElement;
}

function toggleQuickBar() {
  const bar = getOrCreateQuickBar();
  if (bar.classList.contains('bar-hidden')) {
    bar.classList.remove('bar-hidden');
    showToast("🧠 AccessMind Bar Opened (Alt+A or Ctrl+Shift+X)");
  } else {
    bar.classList.add('bar-hidden');
  }
}

// Action Handlers
async function toggleReadPage() {
  if (isPdfPage()) {
    if (cachedPdfData && cachedPdfData.text && isMeaningfulContent(cachedPdfData.text)) {
      chrome.runtime.sendMessage({ 
        action: "readAloudTriggered", 
        text: cachedPdfData.text.substring(0, 30000),
        title: cachedPdfData.title || undefined,
        isPdf: true,
        images: []
      });
      showToast("🔊 Reading PDF Aloud...");
      return;
    }
    showToast("📄 Extracting PDF content for speech...");
    try {
      const data = await extractPdfTextInTab();
      if (data && data.text && isMeaningfulContent(data.text)) {
        cachedPdfData = data;
        updatePdfOverlayContent(data);
        chrome.runtime.sendMessage({ 
          action: "readAloudTriggered", 
          text: data.text.substring(0, 30000),
          title: data.title || undefined,
          isPdf: true,
          images: []
        });
        showToast("🔊 Reading PDF Aloud...");
      } else {
        showToast("⚠️ No readable text found in this PDF");
      }
    } catch (e) {
      showToast("⚠️ Could not read this PDF");
    }
    return;
  }
  const extracted = extractRichText();
  chrome.runtime.sendMessage({ 
    action: "readAloudTriggered", 
    text: extracted.text.substring(0, 30000),
    title: document.title || undefined,
    isPdf: false,
    images: extracted.images || []
  });
  showToast("🔊 Reading Page Aloud...");
}

function stopReading() {
  chrome.runtime.sendMessage({ action: "stopTts" });
  showToast("⏹️ Reading Stopped");
}

function applyDyslexiaState(enabled) {
  dyslexiaEnabled = enabled;
  if (enabled) {
    document.body.classList.add("accessmind-dyslexia");
    if (pdfOverlayElement) pdfOverlayElement.classList.add("accessmind-overlay-dyslexia");
    if (isPdfPage()) {
      showPdfOverlay();
      renderAccessiblePdfContent();
    }
  } else {
    document.body.classList.remove("accessmind-dyslexia");
    if (pdfOverlayElement) pdfOverlayElement.classList.remove("accessmind-overlay-dyslexia");
    if (isPdfPage()) {
      renderAccessiblePdfContent();
    }
  }
  updateOverlayButtonStates();
}

function toggleDyslexia() {
  chrome.storage.local.get(['dyslexiaOn'], (res) => {
    const next = !res.dyslexiaOn;
    chrome.storage.local.set({ dyslexiaOn: next });
    applyDyslexiaState(next);
    showToast(next ? "🔤 Dyslexia Font: ON" : "🔤 Dyslexia Font: OFF");
    chrome.runtime.sendMessage({ action: "syncUI" }).catch(() => {});
  });
}

function applyTintState(enabled) {
  tintEnabled = enabled;
  const tint = getOrCreateTintOverlay();
  if (enabled) {
    document.documentElement.classList.add("accessmind-tint");
    document.body.classList.add("accessmind-tint");
    tint.classList.remove("tint-hidden");
    if (pdfOverlayElement) pdfOverlayElement.classList.add("accessmind-overlay-tint");
  } else {
    document.documentElement.classList.remove("accessmind-tint");
    document.body.classList.remove("accessmind-tint");
    tint.classList.add("tint-hidden");
    if (pdfOverlayElement) pdfOverlayElement.classList.remove("accessmind-overlay-tint");
  }
  updateOverlayButtonStates();
}

function toggleTint() {
  chrome.storage.local.get(['tintOn'], (res) => {
    const next = !res.tintOn;
    chrome.storage.local.set({ tintOn: next });
    applyTintState(next);
    showToast(next ? "🎨 Color Tint: ON" : "🎨 Color Tint: OFF");
    chrome.runtime.sendMessage({ action: "syncUI" }).catch(() => {});
  });
}

function applyBionicState(enabled) {
  isBionicEnabled = enabled;
  if (enabled) {
    applyBionic();
    if (isPdfPage()) {
      showPdfOverlay();
      renderAccessiblePdfContent();
    }
  } else {
    removeBionic();
    if (isPdfPage()) {
      renderAccessiblePdfContent();
    }
  }
  updateOverlayButtonStates();
}

function toggleBionic() {
  chrome.storage.local.get(['bionicOn'], (res) => {
    const next = !res.bionicOn;
    chrome.storage.local.set({ bionicOn: next });
    applyBionicState(next);
    showToast(next ? "👁️ Bionic Reading: ON" : "👁️ Bionic Reading: OFF");
    chrome.runtime.sendMessage({ action: "syncUI" }).catch(() => {});
  });
}

function applyAlternateLinesState(enabled) {
  alternateLinesEnabled = enabled;
  const ruler = getOrCreateReadingRuler();
  if (enabled) {
    document.body.classList.add("accessmind-alternate-lines");
    ruler.classList.remove("ruler-hidden");
    if (pdfOverlayElement) {
      pdfOverlayElement.classList.add("accessmind-overlay-ruler");
      const pdfBody = document.getElementById('accessmind-pdf-body');
      if (pdfBody) pdfBody.classList.add("accessmind-alternate-lines");
    }
    if (isPdfPage()) {
      renderAccessiblePdfContent();
    }
  } else {
    document.body.classList.remove("accessmind-alternate-lines");
    ruler.classList.add("ruler-hidden");
    if (pdfOverlayElement) {
      pdfOverlayElement.classList.remove("accessmind-overlay-ruler");
      const pdfBody = document.getElementById('accessmind-pdf-body');
      if (pdfBody) pdfBody.classList.remove("accessmind-alternate-lines");
    }
    if (isPdfPage()) {
      renderAccessiblePdfContent();
    }
  }
  updateOverlayButtonStates();
}

function toggleAlternateLines() {
  chrome.storage.local.get(['alternateLinesOn'], (res) => {
    const next = !res.alternateLinesOn;
    chrome.storage.local.set({ alternateLinesOn: next });
    applyAlternateLinesState(next);
    showToast(next ? "📏 Reading Ruler: ON" : "📏 Reading Ruler: OFF");
    chrome.runtime.sendMessage({ action: "syncUI" }).catch(() => {});
  });
}

function triggerSummarize() {
  showToast("✨ Generating Summary...");
  chrome.runtime.sendMessage({ action: "voiceCommand", command: "summarize" });
}

let wasReadingBeforeLocalVoice = false;
let localCommandExecuted = false;

function detectCommand(text) {
  if (!text) return null;
  const c = text.toLowerCase().trim();
  if (/stop|cancel|quiet|shut up|halt|mute/.test(c)) return 'stop';
  if (/pause|hold on|wait/.test(c)) return 'pause';
  if (/resume|unpause|continue|play|go on|keep reading/.test(c)) return 'resume';
  if (/read page|read aloud|read this|read to me|start reading|speak|read pdf|read/.test(c)) return 'read';
  if (/summar|tldr|key point|overview|insights/.test(c)) return 'summarize';
  if (/dyslexi|font/.test(c)) return 'dyslexia';
  if (/bionic|speed read|fast read/.test(c)) return 'bionic';
  if (/sepia|tint|contrast|dark mode|color/.test(c)) return 'tint';
  if (/ruler|alternate|lines|guide/.test(c)) return 'ruler';
  if (/menu|toolbar|bar|options|help/.test(c)) return 'toolbar';
  return null;
}

function handleVoiceCommandDirectly(raw) {
  const cmd = raw.toLowerCase().trim();
  console.log("AccessMind Voice Command executing:", cmd);
  const shouldResume = wasReadingBeforeLocalVoice;
  
  if (/stop|cancel|quiet|shut up|halt|mute/.test(cmd)) {
    wasReadingBeforeLocalVoice = false;
    stopReading();
    updateHUD("⏹️ Reading Stopped", true);
  }
  else if (/pause|hold on|wait/.test(cmd)) {
    wasReadingBeforeLocalVoice = false;
    chrome.runtime.sendMessage({ action: "pauseTts" }).catch(() => {});
    showToast("⏸️ Reading Paused");
    updateHUD("⏸️ Reading Paused", true);
  }
  else if (/resume|unpause|continue|play|go on|keep reading/.test(cmd)) {
    wasReadingBeforeLocalVoice = false;
    chrome.runtime.sendMessage({ action: "resumeTts" }).catch(() => {});
    showToast("▶️ Reading Resumed");
    updateHUD("▶️ Reading Resumed", true);
  }
  else if (/read page|read aloud|read this|read to me|start reading|speak|read pdf|read/.test(cmd)) {
    wasReadingBeforeLocalVoice = false;
    if (document.body.classList.contains('accessmind-reading-paused')) {
      chrome.runtime.sendMessage({ action: "resumeTts" }).catch(() => {});
      showToast("▶️ Reading Resumed");
      updateHUD("▶️ Reading Resumed", true);
    } else {
      toggleReadPage();
      updateHUD("🔊 Reading Page...", true);
    }
  }
  else if (/summar|tldr|key point|overview|insights/.test(cmd)) {
    wasReadingBeforeLocalVoice = false;
    triggerSummarize();
    updateHUD("✨ Summarizing Page...", true);
  }
  else if (/dyslexi|font/.test(cmd)) {
    toggleDyslexia();
    updateHUD("🔤 Dyslexia Font toggled", true);
    if (shouldResume) {
      wasReadingBeforeLocalVoice = false;
      setTimeout(() => chrome.runtime.sendMessage({ action: "resumeTts" }).catch(() => {}), 400);
    }
  }
  else if (/sepia|tint|contrast|dark mode|color/.test(cmd)) {
    toggleTint();
    updateHUD("🎨 Color Tint toggled", true);
    if (shouldResume) {
      wasReadingBeforeLocalVoice = false;
      setTimeout(() => chrome.runtime.sendMessage({ action: "resumeTts" }).catch(() => {}), 400);
    }
  }
  else if (/bionic|speed read|fast read/.test(cmd)) {
    toggleBionic();
    updateHUD("👁️ Bionic Reading toggled", true);
    if (shouldResume) {
      wasReadingBeforeLocalVoice = false;
      setTimeout(() => chrome.runtime.sendMessage({ action: "resumeTts" }).catch(() => {}), 400);
    }
  }
  else if (/ruler|alternate|lines|guide/.test(cmd)) {
    toggleAlternateLines();
    updateHUD("📏 Reading Ruler toggled", true);
    if (shouldResume) {
      wasReadingBeforeLocalVoice = false;
      setTimeout(() => chrome.runtime.sendMessage({ action: "resumeTts" }).catch(() => {}), 400);
    }
  }
  else if (/menu|toolbar|bar|options|help/.test(cmd)) {
    toggleQuickBar();
    updateHUD("🧠 Toolbar Toggled", true);
    if (shouldResume) {
      wasReadingBeforeLocalVoice = false;
      setTimeout(() => chrome.runtime.sendMessage({ action: "resumeTts" }).catch(() => {}), 400);
    }
  } else {
    // Forward unknown or complex command to background
    chrome.runtime.sendMessage({ action: "voiceCommand", command: cmd }).catch(() => {});
    updateHUD(`🎙️ "${raw}"`, true);
  }
}

// Keyboard shortcuts & Spacebar push-to-talk
document.addEventListener('keydown', (e) => {
  const tag = document.activeElement?.tagName || '';
  const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || document.activeElement?.isContentEditable;

  // Escape key always stops speech and closes overlays
  if (e.key === 'Escape') {
    stopReading();
    if (quickBarElement) quickBarElement.classList.add('bar-hidden');
    hideHUD(0);
    return;
  }

  // Check custom shortcut keys (Alt+... or Ctrl+Shift+...)
  if ((e.altKey && e.code === 'KeyA') || (e.ctrlKey && e.shiftKey && e.code === 'KeyX')) {
    e.preventDefault();
    toggleQuickBar();
    return;
  }
  if ((e.altKey && e.code === 'KeyS') || (e.ctrlKey && e.shiftKey && e.code === 'KeyS')) {
    e.preventDefault();
    toggleReadPage();
    return;
  }
  if ((e.altKey && e.code === 'KeyD') || (e.ctrlKey && e.shiftKey && e.code === 'KeyD')) {
    e.preventDefault();
    toggleDyslexia();
    return;
  }
  if ((e.altKey && e.code === 'KeyB') || (e.ctrlKey && e.shiftKey && e.code === 'KeyB')) {
    e.preventDefault();
    toggleBionic();
    return;
  }
  if ((e.altKey && e.code === 'KeyT') || (e.ctrlKey && e.shiftKey && e.code === 'KeyT')) {
    e.preventDefault();
    toggleTint();
    return;
  }
  if ((e.altKey && e.code === 'KeyR') || (e.ctrlKey && e.shiftKey && e.code === 'KeyR')) {
    e.preventDefault();
    toggleAlternateLines();
    return;
  }

  // Spacebar Push-to-Talk (only if not typing in text fields)
  if (!isInput && e.code === 'Space') {
    if (e.repeat) return; // Prevent key repeat while holding Spacebar
    e.preventDefault();
    if (!isSpacebarPressed) {
      isSpacebarPressed = true;
      currentTranscript = '';

      // If reading is currently active, pause/duck it immediately so speech recognizer doesn't hear computer audio!
      wasReadingBeforeLocalVoice = document.body.classList.contains('accessmind-reading-active') || 
                                  document.body.classList.contains('accessmind-reading-paused');
      if (wasReadingBeforeLocalVoice) {
        chrome.runtime.sendMessage({ action: "pauseTts" }).catch(() => {});
        document.body.classList.add('accessmind-reading-paused');
      }

      updateHUD("🎙️ Listening... Hold Spacebar & speak");
      chrome.runtime.sendMessage({ action: "startVoice" }).catch(() => {});
    }
  }
});

document.addEventListener('keyup', (e) => {
  const tag = document.activeElement?.tagName || '';
  const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || document.activeElement?.isContentEditable;

  if (!isInput && e.code === 'Space' && isSpacebarPressed) {
    e.preventDefault();
    isSpacebarPressed = false;
    chrome.runtime.sendMessage({ action: "stopVoice" }).catch(() => {});
  }
});

// Window blur safety
window.addEventListener('blur', () => {
  if (isSpacebarPressed) {
    isSpacebarPressed = false;
    chrome.runtime.sendMessage({ action: "stopVoice" }).catch(() => {});
    hideHUD(0);
  }
});

// Runtime message handlers
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "showToast") {
    showToast(request.message);
    sendResponse({ success: true });
  }

  if (request.action === "toggleDyslexia") {
    applyDyslexiaState(request.enabled);
    sendResponse({ success: true });
  }
  
  if (request.action === "toggleTint") {
    applyTintState(request.enabled);
    sendResponse({ success: true });
  }
  
  if (request.action === "toggleBionic") {
    applyBionicState(request.enabled);
    sendResponse({ success: true });
  }
  
  if (request.action === "toggleAlternateLines") {
    applyAlternateLinesState(request.enabled);
    sendResponse({ success: true });
  }

  if (request.action === "togglePdfOverlay") {
    togglePdfOverlay();
    sendResponse({ success: true });
  }

  if (request.action === "extractText") {
    if (isPdfPage()) {
      if (cachedPdfData && cachedPdfData.text && isMeaningfulContent(cachedPdfData.text)) {
        sendResponse({ ...cachedPdfData, isPdf: true, pdfUrl: window.location.href });
      } else {
        extractPdfTextInTab().then((data) => {
          if (data && data.text && isMeaningfulContent(data.text)) {
            sendResponse({ ...data, isPdf: true, pdfUrl: window.location.href });
          } else {
            sendResponse({ 
              text: "", 
              images: [], 
              isPdf: true, 
              pdfUrl: window.location.href, 
              title: document.title && !document.title.toLowerCase().endsWith('.pdf') ? document.title : 'PDF Document',
              error: "No readable text layer" 
            });
          }
        }).catch(() => {
          sendResponse({ 
            text: "", 
            images: [], 
            isPdf: true, 
            pdfUrl: window.location.href, 
            title: document.title && !document.title.toLowerCase().endsWith('.pdf') ? document.title : 'PDF Document',
            error: "Could not parse PDF" 
          });
        });
        return true;
      }
    } else {
      sendResponse(extractRichText());
    }
  }

  if (request.action === "fetchPdfBuffer") {
    const targetUrl = getPdfTargetUrl();
    if (cachedPdfData && cachedPdfData.text && isMeaningfulContent(cachedPdfData.text)) {
      sendResponse({ success: true, ...cachedPdfData });
      return;
    }
    fetchPdfBufferInTab(targetUrl).then(buf => {
      if (buf) {
        const b64 = arrayBufferToBase64(buf);
        sendResponse({ success: true, bufferBase64: b64 });
      } else {
        sendResponse({ success: false, error: "Buffer not accessible in tab" });
      }
    }).catch(err => {
      sendResponse({ success: false, error: err.message });
    });
    return true;
  }
  
  if (request.action === "triggerVoiceRead") {
    if (isPdfPage()) {
      if (cachedPdfData && cachedPdfData.text && isMeaningfulContent(cachedPdfData.text)) {
        chrome.runtime.sendMessage({ 
          action: "readAloudTriggered", 
          text: cachedPdfData.text.substring(0, 30000), 
          title: cachedPdfData.title || undefined,
          isPdf: true, 
          tabId: sender.tab?.id,
          images: []
        });
        sendResponse({ success: true });
      } else {
        extractPdfTextInTab().then((data) => {
          if (data && data.text && isMeaningfulContent(data.text)) {
            chrome.runtime.sendMessage({ 
              action: "readAloudTriggered", 
              text: data.text.substring(0, 30000), 
              title: data.title || undefined,
              isPdf: true, 
              tabId: sender.tab?.id,
              images: []
            });
          } else {
            showToast("⚠️ No readable text found in this PDF");
          }
        }).catch(() => {
          showToast("⚠️ Could not extract text from this PDF");
        });
        sendResponse({ success: true });
      }
    } else {
      let extracted = extractRichText();
      let text = extracted.text.substring(0, 30000);
      chrome.runtime.sendMessage({ action: "readAloudTriggered", text: text, title: document.title || undefined, images: extracted.images, tabId: sender.tab?.id });
      sendResponse({ success: true });
    }
  }

  if (request.action === "toggleVoiceCommand") {
    toggleQuickBar();
    sendResponse({ success: true });
  }

  if (request.action === "transcriptUpdate") {
    currentTranscript = request.transcript;
    updateHUD(`🎙️ "${currentTranscript}"`);
    sendResponse({ success: true });
  }

  if (request.action === "speechEngineReady") {
    if (isSpacebarPressed && !currentTranscript) {
      updateHUD("🎙️ Listening... Speak your command");
    }
    sendResponse({ success: true });
  }

  if (request.action === "commandResult") {
    updateHUD(`⚡ ${request.message}`, true);
    hideHUD(1600);
    sendResponse({ success: true });
  }

  if (request.action === "voiceCommandEmpty") {
    updateHUD("⚠️ No command detected. Hold Spacebar & speak");
    hideHUD(1400);
    sendResponse({ success: true });
  }

  if (request.action === "micPermissionNeeded") {
    updateHUD("🎙️ Click here to enable Microphone access", true);
    if (hudElement) {
      hudElement.onclick = () => {
        chrome.runtime.sendMessage({ action: "requestMicPermission" }).catch(() => {});
      };
    }
    sendResponse({ success: true });
  }

  if (request.action === "ttsPaused") {
    document.body.classList.remove('accessmind-reading-active');
    document.body.classList.add('accessmind-reading-paused');
    sendResponse({ success: true });
  }

  if (request.action === "ttsResumed") {
    document.body.classList.remove('accessmind-reading-paused');
    document.body.classList.add('accessmind-reading-active');
    sendResponse({ success: true });
  }

  if (request.action === "ttsStopped") {
    document.body.classList.remove('accessmind-reading-active');
    document.body.classList.remove('accessmind-reading-paused');
    sendResponse({ success: true });
  }

  if (request.action === "ttsEvent") {
    const event = request.event;
    if (event.type === 'word') {
      document.body.classList.add('accessmind-reading-active');
      document.body.classList.remove('accessmind-reading-paused');
    } else if (event.type === 'end' || event.type === 'interrupted' || event.type === 'cancelled') {
      document.body.classList.remove('accessmind-reading-active');
      document.body.classList.remove('accessmind-reading-paused');
    }
  }
});

function isUIElement(el) {
  if (!el) return true;
  if (el.id && el.id.startsWith('accessmind')) return true;
  if (el.closest && el.closest('#accessmind-voice-hud, #accessmind-quick-bar, #accessmind-toast')) return true;

  const uiTags = ['HEADER', 'NAV', 'FOOTER', 'ASIDE', 'BUTTON', 'INPUT', 'TEXTAREA', 'SELECT', 'SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME'];
  if (uiTags.includes(el.tagName)) return true;
  
  if (el.closest && el.closest('header, nav, footer, aside, [role="navigation"], [role="banner"], [role="menu"], [role="dialog"], [aria-modal="true"], .nav, .menu, .sidebar, .cookie, .banner, .advertisement')) {
    return true;
  }
  return false;
}

function extractRichText() {
  if (isPdfPage()) {
    if (cachedPdfData && cachedPdfData.text && isMeaningfulContent(cachedPdfData.text)) {
      return {
        text: cachedPdfData.text,
        images: [],
        isPdf: true,
        totalPages: cachedPdfData.totalPages,
        title: cachedPdfData.title
      };
    }
    // For PDF pages where extraction has not completed, return empty text so caller invokes extraction
    return {
      text: "",
      images: [],
      isPdf: true,
      totalPages: 1,
      title: document.title && !document.title.toLowerCase().endsWith('.pdf') ? document.title : 'PDF Document'
    };
  }

  let text = document.title ? `Page Title: ${document.title}\n\n` : "";
  let images = [];
  const root = document.querySelector('article, main, [role="main"], .post-content, .article-content, .entry-content, #content, #main') || document.body;
  const elements = root.querySelectorAll('p, h1, h2, h3, h4, li, blockquote, figure, img, svg');
  
  elements.forEach(el => {
    if (el.offsetParent === null) return;
    if (isUIElement(el)) return;

    if (el.tagName === 'IMG') {
      const w = el.naturalWidth || el.width || 0;
      const h = el.naturalHeight || el.height || 0;
      // Filter out tiny icons, spacers, avatars
      if (w > 60 && h > 60) {
        const figure = el.closest('figure');
        const figcaption = figure ? figure.querySelector('figcaption')?.innerText?.trim() : '';
        const alt = el.getAttribute('alt')?.trim() || '';
        const title = el.getAttribute('title')?.trim() || '';
        const aria = el.getAttribute('aria-label')?.trim() || '';
        const desc = figcaption || alt || title || aria || 'Webpage visual infographic / diagram';
        
        try {
          const absUrl = new URL(el.currentSrc || el.src, window.location.href).href;
          if (absUrl.startsWith('http') && !images.includes(absUrl)) {
            images.push(absUrl);
            text += `\n[Visual Infographic / Image ${images.length}: ${desc}]\n`;
          }
        } catch (e) {}
      }
    } else if (el.tagName === 'FIGURE') {
      const figcaption = el.querySelector('figcaption')?.innerText?.trim();
      if (figcaption && !text.includes(figcaption)) {
        text += `\n[Visual Infographic Caption: ${figcaption}]\n`;
      }
    } else if (el.tagName === 'SVG') {
      const aria = el.getAttribute('aria-label') || el.querySelector('title')?.textContent || '';
      if (aria.trim().length > 3) {
        text += `\n[Visual Diagram / Infographic: ${aria.trim()}]\n`;
      }
    } else {
      const content = el.innerText ? el.innerText.trim() : '';
      // Skip trivial or button-like strings
      if (content.length > 2 && !['close', 'menu', 'search', 'share', 'sign in', 'log in', 'subscribe'].includes(content.toLowerCase())) {
        text += content + "\n\n";
      }
    }
  });

  return { text: text.trim(), images: images.slice(0, 5) };
}

function applyBionic() {
  if (document.body.dataset.bionicApplied) return;
  document.body.dataset.bionicApplied = "true";
  
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
  let n;
  const nodes = [];
  while(n = walk.nextNode()) {
    if (!n.parentElement) continue;
    const parentTag = (n.parentElement.tagName || '').toUpperCase();
    if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'INPUT', 'TEXTAREA', 'SELECT', 'CODE', 'PRE', 'BUTTON'].includes(parentTag)) continue;
    if (n.parentElement.id?.startsWith('accessmind') || n.parentElement.closest?.('[id^="accessmind"]')) continue;
    if (n.nodeValue.trim() !== '') nodes.push(n);
  }
  
  nodes.forEach(node => {
    const words = node.nodeValue.split(/(\s+)/);
    const fragment = document.createDocumentFragment();
    words.forEach(word => {
      if (word.trim().length > 0) {
        const mid = Math.ceil(word.length / 2);
        const b = document.createElement('b');
        b.className = 'accessmind-bionic-bold';
        b.textContent = word.slice(0, mid);
        fragment.appendChild(b);
        fragment.appendChild(document.createTextNode(word.slice(mid)));
      } else {
        fragment.appendChild(document.createTextNode(word));
      }
    });
    node.parentNode.replaceChild(fragment, node);
  });
}

function removeBionic() {
  if (!document.body.dataset.bionicApplied) return;
  document.body.dataset.bionicApplied = "";
  try {
    const boldNodes = document.querySelectorAll('.accessmind-bionic-bold');
    boldNodes.forEach(b => {
      const parent = b.parentNode;
      if (parent) {
        const textNode = document.createTextNode(b.textContent || '');
        parent.replaceChild(textNode, b);
      }
    });
    document.body.normalize();
  } catch (err) {
    console.warn("Bionic removal notice:", err);
  }
}

// PDF Auto-Detection and Initial Extraction on page load
if (isPdfPage()) {
  document.body.classList.add('accessmind-is-pdf');
  extractPdfTextInTab().then((data) => {
    if (data && data.text && data.text.length > 20) {
      cachedPdfData = data;
      updatePdfOverlayContent(data);
      showToast(`📄 AccessMind: PDF ready (${data.totalPages || 1} pages). Press Ctrl+Shift+S or Spacebar to read.`);
    }
  }).catch(() => {});
}

// Initialize stored cognitive and accessibility settings on load
chrome.storage.local.get(['dyslexiaOn', 'tintOn', 'bionicOn', 'alternateLinesOn'], (res) => {
  if (res.dyslexiaOn) applyDyslexiaState(true);
  if (res.tintOn) applyTintState(true);
  if (res.bionicOn) applyBionicState(true);
  if (res.alternateLinesOn) applyAlternateLinesState(true);
});

