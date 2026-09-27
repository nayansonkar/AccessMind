declare const chrome: any;

export const isExtension = typeof chrome !== 'undefined' && !!chrome.runtime && !!chrome.runtime.id;

class ChromeStorageMock {
  public data: Record<string, any> = {
    speechRate: 0.9,
    darkMode: false,
    dyslexiaOn: false,
    tintOn: false,
    bionicOn: false,
    alternateLinesOn: false
  };
  async get(keys: string | string[] | Record<string, any> | null) {
    if (typeof keys === 'string') {
      return { [keys]: this.data[keys] };
    } else if (Array.isArray(keys)) {
      const res: any = {};
      keys.forEach(k => res[k] = this.data[k]);
      return res;
    }
    return { ...this.data };
  }
  async set(items: Record<string, any>) {
    Object.assign(this.data, items);
    broadcastMockMessage({ action: "storageChanged", data: this.data });
    broadcastMockMessage({ action: "syncUI" });
  }
}

const mockStorage = new ChromeStorageMock();

const mockListeners = new Set<(msg: any) => void>();

function broadcastMockMessage(msg: any) {
  mockListeners.forEach(listener => {
    try {
      listener(msg);
    } catch (e) {
      console.warn("Mock listener error:", e);
    }
  });
}

export function buildVisualNarrationScript(rawText: string, title?: string, isPdf?: boolean): string {
  if (!rawText) return "Unable to read this document. Please ensure the document contains readable text.";

  const isPdfDoc = isPdf || /---\s*Page\s*\d+\s*---/i.test(rawText) || (title && (title.toLowerCase().endsWith('.pdf') || title.toLowerCase().includes('pdf')));
  const cleanTitle = (title && !title.toLowerCase().endsWith('.pdf') && title.toLowerCase() !== 'pdf document') 
    ? title 
    : (rawText.match(/^([^\n]+)/)?.[1]?.replace(/^Document Title:\s*/i, '').trim() || 'the document');

  // Specific high-fidelity narration for the Research Paper sample
  if (rawText.includes('Research Paper: Multi-Modal Reading Ergonomics') || cleanTitle.toLowerCase().includes('reading ergonomics')) {
    return `Visual Audio Narration for Research Paper: Multi-Modal Reading Ergonomics and Assistive Technology. Let's orient ourselves to this document's visual architecture across three distinct pages.
On Page 1, the document establishes the conceptual problem. To visualize the challenge: picture over sixty-five percent of digital scholarly reading locked inside rigid, static PDF documents that offer no native sensory adaptations for readers with visual stress, dyslexia, or ADHD. The paper introduces an empirical study evaluating four cognitive interventions: OpenDyslexic typography, warm Irlen sepia attenuation, Bionic saccadic guidance, and dynamic line rulers.
Moving to Page 2, let's visualize the experimental methodology. Imagine a comparative study matrix testing one hundred and forty-two participants across four reading conditions: Condition A as the standard Times New Roman baseline, Condition B introducing bold fixation anchors on word roots, Condition C combining warm sepia tinting with weighted character bases, and Condition D engaging full-spectrum line guidance. A striking data visualization emerges: saccadic regression errors drop by thirty-eight point four percent under Bionic guidance, while visual fatigue decreases by forty-two point one percent with sepia tinting. Simultaneous speech narration boosts overall comprehension by over two standard deviations.
Finally, on Page 3, the clinical discussion brings the framework together. To visualize the conclusion, picture assistive cognitive features not as an afterthought, but as an essential sensory bridge transforming static digital manuscripts into barrier-free cognitive environments.`;
  }

  // If it's a multi-page PDF or document
  if (isPdfDoc) {
    const pageMatches = rawText.match(/---\s*Page\s*(\d+)\s*---/gi) || [];
    const totalPages = pageMatches.length || 1;
    
    // Clean text of internal metadata
    const cleaned = rawText
      .replace(/^(Document Title|Page Title):\s*.*?(\n|$)/gim, "")
      .replace(/^Total Pages:\s*\d+\s*(\n|$)/gim, "")
      .replace(/\[Visual Infographic \/ Image \d+: ([^\]]+)\]/gi, " Accompanying this is an infographic illustrating $1. ")
      .replace(/\[Visual Diagram \/ Infographic: ([^\]]+)\]/gi, " Here, a visual diagram shows $1. ")
      .replace(/\[Visual Content: ([^\]]+)\]/gi, " Visually, this depicts $1. ")
      .replace(/\[[^\]]*\]/g, " ")
      .trim();

    const pages = cleaned.split(/(?=---\s*Page\s*\d+\s*---)/i);
    let narration = `Visual Audio Narration for ${cleanTitle}. Let's orient ourselves to the visual layout of this ${totalPages > 1 ? `${totalPages}-page` : ''} document. `;

    pages.forEach((p, idx) => {
      const pNumMatch = p.match(/^---\s*Page\s*(\d+)\s*---/i);
      const pageNum = pNumMatch ? pNumMatch[1] : (idx + 1);
      const content = p.replace(/^---\s*Page\s*\d+\s*---\s*/i, '').trim();
      if (!content) return;

      if (idx === 0) {
        narration += `Beginning on Page ${pageNum}, the document opens with its conceptual foundation. `;
      } else {
        narration += `\n\nTurning to Page ${pageNum}, `;
      }

      const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      let currentSection = "";
      for (const line of lines) {
        if (/^(abstract|introduction|background|methodology|experimental|results|discussion|conclusion|key findings|overview|chapter)/i.test(line)) {
          currentSection = line.replace(/[:.]\s*$/, '');
          narration += `In the section on ${currentSection}, to visualize the core concepts, `;
          break;
        }
      }

      const hasBullets = content.includes('•') || content.includes('- ') || /condition [a-d]/i.test(content);
      if (hasBullets) {
        narration += `a structured comparative framework is presented. Picture several interconnected pillars: `;
      }

      const cleanBody = content
        .replace(/^[0-9.]+\s*(introduction|methodology|results|discussion|conclusion|abstract):?/gim, '')
        .replace(/•/g, ', and ')
        .replace(/[*#_`~>|]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      narration += cleanBody.substring(0, 500);
      if (cleanBody.length > 500) narration += "...";
    });

    narration += "\n\nThis completes the visual audio narration of the document.";
    return narration;
  }

  // Webpage fallback: Add spatial visual scene orientation and infographic descriptions
  const cleaned = rawText
    .replace(/\[Visual Infographic \/ Image \d+: ([^\]]+)\]/gi, " Accompanying this is an infographic illustrating $1. ")
    .replace(/\[Visual Diagram \/ Infographic: ([^\]]+)\]/gi, " Here, a visual diagram shows $1. ")
    .replace(/\[Visual Content: ([^\]]+)\]/gi, " Visually, this depicts $1. ")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/[*#_`~>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return `Visual Audio Narration for ${cleanTitle}. Visualizing page architecture and core insights.\n\n${cleaned}`;
}

export function generateDocumentSummary(rawText: string, title?: string, isPdf?: boolean): string {
  if (!rawText || rawText.trim().length === 0) {
    return "No document text available to summarize. Please select or paste content to generate a summary.";
  }

  const clean = rawText
    .replace(/^(Document Title|Page Title):\s*.*?(\n|$)/gim, "")
    .replace(/^Total Pages:\s*\d+\s*(\n|$)/gim, "")
    .replace(/---\s*Page\s*\d+\s*---\s*/gi, "")
    .replace(/\[Visual[^\]]*\]/g, "")
    .replace(/\[[^\]]*\]/g, "")
    .trim();

  // Research paper specific summary
  if (/research paper|reading ergonomics|saccadic|condition [a-d]|n=142/i.test(clean)) {
    return `📄 Executive Summary: Multi-Modal Reading Ergonomics & Assistive Technology (Empirical Study)

🎯 Central Thesis:
Portable Document Format (PDF) files constitute over 65% of all scholarly reading, yet traditional viewers lack native sensory adaptations for readers with dyslexia, ADHD, or visual stress. This peer-reviewed study (N=142) evaluates real-time cognitive overlays.

📊 Key Empirical Findings:
• Condition A (Baseline Control): Standard Times New Roman without assistive filtering exhibited the highest visual crowding and saccadic regression rates.
• Condition B (Bionic Reading): Word-initial phoneme fixation anchors reduced saccadic regression re-reading errors by 38.4%.
• Condition C (Sepia Tint + OpenDyslexic): Chromatic 55% attenuation combined with weighted character apertures decreased subjective visual fatigue scores by 42.1%.
• Condition D (Full-Spectrum Support): Active horizontal line guidance and simultaneous zero-latency speech narration yielded a +2.3 Standard Deviation comprehension gain.

💡 Practical Conclusions:
Cognitive accessibility features must not be restricted to simple HTML web pages. Embedding assistive typographic weights, chromatic tinting, fixation anchors, and line guides directly onto PDF documents creates barrier-free cognitive environments.`;
  }

  // Cognitive Ergonomics guide specific summary
  if (/cognitive ergonomics|digital interfaces|sensory bridge|four fundamental/i.test(clean)) {
    return `📄 Executive Summary: Cognitive Ergonomics & Web Accessibility Guide

🎯 Central Problem:
Modern digital environments impose heavy cognitive loads on neurodivergent readers. Wall-of-text formatting triggers eye fatigue, line-skipping, and loss of reading thread.

💡 Four Fundamental Cognitive Layers:
• Dynamic Saccadic Guidance (Bionic): Deliberately bolded initial phonemes lock visual cortex anchors so the eye glides smoothly from word to word.
• OpenDyslexic Typography: Heavy gravity bases and distinct apertures prevent character flipping (b, d, p, q) in dyslexic perception.
• Warm Chromatic Attenuation: Soft Irlen sepia and parchment tones eliminate optical vibration and photophobic glare.
• Horizontal Visual Rulers: Steady cognitive tracks prevent saccadic regression where readers re-read the previous line.
• Multi-Modal Speech Reinforcement: Simultaneous visual reading with natural speech narration doubles comprehension rates.`;
  }

  // Deep work study specific summary
  if (/focused attention|prefrontal cortex|friction/i.test(clean)) {
    return `📄 Executive Summary: Focus Strategies & Low-Friction Information Processing

🎯 Core Insights:
• Attention is an active cognitive filter; visual clutter and inconsistent column widths drain executive energy from the prefrontal cortex.
• Zero-resistance hands-free voice commands enable thought-speed navigation without context switching.
• Pacing speech audio between 0.8x and 1.5x allows readers to match information intake to their personal cognitive tempo.`;
  }

  // Custom document dynamic extraction
  const paragraphs = clean.split(/\n\s*\n/).map(p => p.trim()).filter(p => p.length > 20);
  const keyPoints = paragraphs.slice(0, 4).map(p => {
    const firstSentence = p.split(/[.!?]\s+/)[0].replace(/^[-•*]\s*/, '');
    return `• ${firstSentence}.`;
  });

  return `📄 Executive Summary: ${title || "Active Document"}

🎯 Key Takeaways:
${keyPoints.length > 0 ? keyPoints.join('\n') : '• Core document concepts extracted and formatted for cognitive accessibility.'}

💡 Practical Impact:
Multi-modal cognitive reading aids (OpenDyslexic typography, Irlen sepia tinting, bionic saccadic bolding, and speech narration) transform dense text into low-friction, accessible learning.`;
}

export interface MockDoc {
  id?: string;
  title: string;
  text: string;
  isPdf: boolean;
  totalPages?: number;
  url?: string;
  images?: string[];
}

let activeMockDoc: MockDoc = {
  id: 'guide',
  title: 'Cognitive Ergonomics & Web Accessibility Guide',
  text: `Chapter 1: Understanding Cognitive Ergonomics in Digital Interfaces

Modern digital environments place immense perceptual demands on human cognitive processing. For individuals with dyslexia, ADHD, autism, or visual stress (Irlen syndrome), traditional wall-of-text web formatting can trigger cognitive fatigue, line-skipping, and loss of reading retention.

AccessMind re-architects how information is consumed through four fundamental cognitive layers:

1. Dynamic Fixation & Saccadic Guidance (Bionic Reading)
By deliberately bolding the initial phonemes and root syllables of words, the visual cortex quickly locks onto anchor fixation points. The eye effortlessly glides from word to word without losing the reading thread.

2. OpenDyslexic & Lexend Typographic Weighting
Standard geometric sans-serif fonts feature identical symmetrical shapes (like b, d, p, and q) that frequently rotate or flip in dyslexic perception. OpenDyslexic counters this through heavy gravity bases, distinct character apertures, and generous tracking.

3. Warm Chromatic Attenuation (Irlen Sepia Filter)
High-contrast pure black text on stark white backgrounds often causes optical vibration and photophobic glare. Softening the contrast with warm sepia and parchment tones dramatically reduces ocular strain during extended focus sessions.

4. Alternate Line Rulers & Visual Anchors
Horizontal visual rulers provide steady cognitive tracks, preventing saccadic regression where the reader accidentally re-reads the previous line or skips ahead.

Chapter 2: Multi-Modal Auditory Reinforcement

Combining simultaneous visual reading with natural text-to-speech doubles comprehension rates. By leveraging native Chrome TTS with zero latency and spacebar push-to-talk voice commands, readers navigate and interact with complex content completely hands-free.`,
  isPdf: false,
  totalPages: 1,
  url: 'https://accessmind.example.com/guide'
};

export function setMockActiveDocument(doc: Partial<MockDoc> & { text: string; title: string }) {
  const isPdfDoc = doc.isPdf !== undefined 
    ? doc.isPdf 
    : (doc.title.toLowerCase().includes('.pdf') || doc.title.toLowerCase().includes('pdf document') || doc.text.includes('--- Page'));

  let totalPages = doc.totalPages;
  if (!totalPages) {
    if (isPdfDoc) {
      const matches = doc.text.match(/---\s*Page\s*\d+\s*---/gi);
      totalPages = matches ? matches.length : 3;
    } else {
      totalPages = 1;
    }
  }

  activeMockDoc = {
    ...activeMockDoc,
    ...doc,
    isPdf: isPdfDoc,
    totalPages,
    url: doc.url || (isPdfDoc ? 'https://example.com/sample-paper.pdf' : 'https://accessmind.example.com/article')
  };
  broadcastMockMessage({ action: "mockDocChanged", doc: activeMockDoc });
}

export function getMockActiveDocument(): MockDoc {
  return activeMockDoc;
}

export const extAPI = isExtension ? chrome : {
  storage: { local: mockStorage },
  tabs: {
    query: async () => [{ 
      id: 1, 
      url: activeMockDoc.url || (activeMockDoc.isPdf ? 'https://example.com/sample-paper.pdf' : 'https://accessmind.example.com/article'), 
      title: activeMockDoc.title 
    }],
    create: async (opts: { url: string }) => {
      console.log('Mock tabs.create:', opts);
      if (typeof window !== 'undefined' && opts?.url && !opts.url.startsWith('chrome://')) {
        window.open(opts.url, '_blank');
      }
      return { id: 2, url: opts?.url };
    },
    sendMessage: async (tabId: number, msg: any) => {
      console.log('Mock sendMessage:', msg);
      if (msg.action === 'extractText') {
        return { 
          text: activeMockDoc.text,
          isPdf: activeMockDoc.isPdf,
          totalPages: activeMockDoc.totalPages || 1,
          title: activeMockDoc.title,
          images: activeMockDoc.images || []
        };
      }
      if (msg.action === 'toggleDyslexia' || msg.action === 'toggleTint' || msg.action === 'toggleBionic' || msg.action === 'toggleAlternateLines') {
        return { success: true };
      }
      if (msg.action === 'togglePdfOverlay') {
        broadcastMockMessage({ action: "togglePdfOverlay" });
        return { success: true };
      }
      return { success: true };
    }
  },
  tts: {
    speak: (text: string, options: any) => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(text);
        if (options?.rate) utter.rate = options.rate;
        if (options?.voiceName) {
          const v = window.speechSynthesis.getVoices().find(voice => voice.name === options.voiceName);
          if (v) utter.voice = v;
        }
        if (options?.onEvent) {
          utter.onboundary = (e) => options.onEvent({ type: 'word', charIndex: e.charIndex });
          utter.onend = () => options.onEvent({ type: 'end' });
          utter.onerror = () => options.onEvent({ type: 'error' });
        }
        window.speechSynthesis.speak(utter);
      }
    },
    stop: () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    },
    pause: () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.pause();
      }
    },
    resume: () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.resume();
      }
    },
    getVoices: (cb: any) => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        let v = window.speechSynthesis.getVoices();
        if (v && v.length > 0) {
          cb(v.map(voice => ({ voiceName: voice.name, lang: voice.lang })));
          return;
        }
        window.speechSynthesis.onvoiceschanged = () => {
          v = window.speechSynthesis.getVoices();
          cb(v.map(voice => ({ voiceName: voice.name, lang: voice.lang })));
        };
      }
      cb([{ voiceName: 'System Voice (Default)', lang: 'en-US' }]);
    }
  },
  runtime: {
    getURL: (path: string) => path,
    onMessage: {
      addListener: (cb: any) => { 
        if (typeof cb === 'function') mockListeners.add(cb);
      },
      removeListener: (cb: any) => { 
        if (typeof cb === 'function') mockListeners.delete(cb);
      }
    },
    sendMessage: async (msg: any) => {
      console.log('Mock runtime sendMessage:', msg);
      if (msg.action === 'extractPdfText') {
        return {
          success: true,
          title: activeMockDoc.title,
          totalPages: activeMockDoc.totalPages || 3,
          text: activeMockDoc.text
        };
      }
      if (msg.action === 'summarize') {
        const textToSummarize = msg.text || activeMockDoc.text || '';
        const titleToSummarize = msg.title || activeMockDoc.title;
        const isPdfTarget = msg.isPdf !== undefined ? msg.isPdf : activeMockDoc.isPdf;
        if (msg.apiKey && textToSummarize) {
          try {
            const prompt = isPdfTarget
              ? "You are AccessMind's expert document summarizer. Summarize ONLY the substantive content, core arguments, research findings, and conclusions of this PDF. Do NOT describe the visual appearance, formatting, white pages, or styling. Provide clear, structured, accessible takeaways."
              : "You are AccessMind, an empathetic cognitive accessibility assistant for neurodivergent readers. Provide a clear, highly structured summary with 4-5 key takeaway bullet points, simple vocabulary, and practical insights.";
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${msg.apiKey}`;
            const res = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: `${prompt}\n\nDocument text:\n${textToSummarize.substring(0, 15000)}` }] }]
              })
            });
            const data = await res.json();
            const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text && text.trim().length > 15) {
              return { success: true, summary: text };
            }
          } catch (e) {
            console.warn("Gemini mock fallback:", e);
          }
        }

        // Instant structured cognitive summary of the active document
        const summary = generateDocumentSummary(textToSummarize, titleToSummarize, isPdfTarget);
        return { success: true, summary };
      }

      if (msg.action === 'readAloudTriggered') {
        if (typeof window !== 'undefined' && window.speechSynthesis) {
          // 1. Immediately cancel any prior speech session & intervals
          if ((window as any).__accessMindProgressTimer) {
            clearInterval((window as any).__accessMindProgressTimer);
            (window as any).__accessMindProgressTimer = null;
          }
          window.speechSynthesis.cancel();
          if (window.speechSynthesis.paused) {
            window.speechSynthesis.resume();
          }

          const rawText = (typeof msg.text === 'string' && msg.text.trim()) ? msg.text : (activeMockDoc.text || '');
          const isAlreadySummary = /^(📄|✨|Error:|Executive Summary)/i.test(rawText.trim());
          const isPdfTarget = msg.isPdf !== undefined ? msg.isPdf : activeMockDoc.isPdf;
          const docTitle = msg.title || activeMockDoc.title;

          // 2. Instantly build the narration script
          const narrationText = isAlreadySummary
            ? rawText
            : buildVisualNarrationScript(rawText, docTitle, isPdfTarget);
          
          const utter = new SpeechSynthesisUtterance(narrationText);
          (window as any).__accessMindActiveUtterance = utter; // Prevent Chrome GC bug

          // Apply rate and voice immediately and synchronously
          const rate = msg.rate || mockStorage.data?.speechRate || 0.9;
          utter.rate = rate;
          const voiceName = msg.voiceName || mockStorage.data?.selectedVoiceName;
          if (voiceName) {
            const v = window.speechSynthesis.getVoices().find(voice => voice.name === voiceName);
            if (v) utter.voice = v;
          }

          let charIdx = 1;
          const totalLen = narrationText.length;
          // Approximate speaking speed: ~15 chars per second at 1.0x rate
          const charsPerSec = Math.max(12, Math.round(15 * rate));

          const clearTimer = () => {
            if ((window as any).__accessMindProgressTimer) {
              clearInterval((window as any).__accessMindProgressTimer);
              (window as any).__accessMindProgressTimer = null;
            }
          };

          utter.onstart = () => {
            clearTimer();
            broadcastMockMessage({
              action: "ttsProgress",
              charIndex: 1,
              totalLength: totalLen,
              type: "word"
            });
            (window as any).__accessMindProgressTimer = setInterval(() => {
              charIdx = Math.min(totalLen - 2, charIdx + Math.round(charsPerSec * 0.25));
              broadcastMockMessage({
                action: "ttsProgress",
                charIndex: charIdx,
                totalLength: totalLen,
                type: "word"
              });
            }, 250);
          };

          utter.onboundary = (e) => {
            charIdx = Math.max(charIdx, e.charIndex);
            broadcastMockMessage({
              action: "ttsProgress",
              charIndex: charIdx,
              totalLength: totalLen,
              type: "word"
            });
          };

          utter.onend = () => {
            clearTimer();
            (window as any).__accessMindActiveUtterance = null;
            broadcastMockMessage({ action: "ttsProgress", charIndex: totalLen, totalLength: totalLen, type: "end" });
            broadcastMockMessage({ action: "ttsStopped" });
          };

          utter.onerror = () => {
            clearTimer();
            (window as any).__accessMindActiveUtterance = null;
            broadcastMockMessage({ action: "ttsProgress", type: "error" });
            broadcastMockMessage({ action: "ttsStopped" });
          };

          // 3. Trigger immediate speech output
          setTimeout(() => {
            window.speechSynthesis.speak(utter);
            broadcastMockMessage({
              action: "ttsProgress",
              charIndex: 1,
              totalLength: totalLen,
              type: "word"
            });
          }, 10);
        }
        return { success: true };
      }
      if (msg.action === 'stopTts') {
        if ((window as any).__accessMindProgressTimer) {
          clearInterval((window as any).__accessMindProgressTimer);
          (window as any).__accessMindProgressTimer = null;
        }
        if (typeof window !== 'undefined' && window.speechSynthesis) {
          window.speechSynthesis.cancel();
        }
        broadcastMockMessage({ action: "ttsStopped" });
        return { success: true };
      }
      if (msg.action === 'pauseTts') {
        if ((window as any).__accessMindProgressTimer) {
          clearInterval((window as any).__accessMindProgressTimer);
          (window as any).__accessMindProgressTimer = null;
        }
        if (typeof window !== 'undefined' && window.speechSynthesis) {
          window.speechSynthesis.pause();
        }
        broadcastMockMessage({ action: "ttsPaused" });
        return { success: true };
      }
      if (msg.action === 'resumeTts') {
        if (typeof window !== 'undefined' && window.speechSynthesis) {
          window.speechSynthesis.resume();
        }
        broadcastMockMessage({ action: "ttsResumed" });
        return { success: true };
      }
      if (msg.action === 'startVoice') {
        if (typeof window !== 'undefined' && window.speechSynthesis && window.speechSynthesis.speaking) {
          window.speechSynthesis.pause();
          broadcastMockMessage({ action: "ttsPaused" });
        }
        return { success: true };
      }
      if (msg.action === 'stopVoice') {
        return { success: true };
      }
      if (msg.action === 'requestMicPermission') {
        if (typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
            stream.getTracks().forEach(t => t.stop());
            broadcastMockMessage({ action: "micPermissionGranted" });
          }).catch(() => {});
        }
        return { success: true };
      }
      if (msg.action === 'voiceCommand') {
        const cmd = (msg.command || '').toLowerCase().trim();
        if (/stop|cancel|quiet|shut up|halt|mute/.test(cmd)) {
          if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel();
          broadcastMockMessage({ action: "ttsStopped" });
          broadcastMockMessage({ action: "commandResult", message: "⏹️ Reading Stopped" });
        } else if (/pause|hold on|wait/.test(cmd)) {
          if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.pause();
          broadcastMockMessage({ action: "ttsPaused" });
          broadcastMockMessage({ action: "commandResult", message: "⏸️ Reading Paused" });
        } else if (/resume|unpause|continue|play|go on|keep reading/.test(cmd)) {
          if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.resume();
          broadcastMockMessage({ action: "ttsResumed" });
          broadcastMockMessage({ action: "commandResult", message: "▶️ Reading Resumed" });
        } else if (/faster|speed up|increase speed|read faster/.test(cmd)) {
          broadcastMockMessage({ action: "commandResult", message: "⚡ Speed increased" });
        } else if (/slower|slow down|decrease speed|read slower/.test(cmd)) {
          broadcastMockMessage({ action: "commandResult", message: "🐢 Speed decreased" });
        } else if (/read|speak|listen/.test(cmd)) {
          broadcastMockMessage({ action: "commandResult", message: "🔊 Reading Aloud..." });
        } else if (/dyslexi|font/.test(cmd)) {
          broadcastMockMessage({ action: "commandResult", message: "🔤 Dyslexia Font toggled" });
        } else if (/bionic|speed read|fast read/.test(cmd)) {
          broadcastMockMessage({ action: "commandResult", message: "👁️ Bionic Reading toggled" });
        } else if (/sepia|tint|contrast|dark mode|color/.test(cmd)) {
          broadcastMockMessage({ action: "commandResult", message: "🎨 Color Tint toggled" });
        } else if (/ruler|alternate|lines|guide/.test(cmd)) {
          broadcastMockMessage({ action: "commandResult", message: "📏 Reading Ruler toggled" });
        } else if (/summar|tldr|key point|overview|insights/.test(cmd)) {
          broadcastMockMessage({ action: "commandResult", message: "✨ Summarizing Page..." });
        }
        return { success: true };
      }
      return { success: true };
    }
  }
} as any;
