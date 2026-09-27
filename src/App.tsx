import React from 'react';
import { extAPI, isExtension, setMockActiveDocument, getMockActiveDocument } from './utils/chromeMock';
import { extractPdfFromArrayBuffer, extractPdfFromUrl, isMeaningfulContent } from './utils/pdfExtractor';
import { jsPDF } from 'jspdf';
import { Mic, BookOpen, Settings, FileText, Download, Play, Pause, Square, BrainCircuit, Type, SunMoon, Eye, EyeOff, Globe, Volume2, RefreshCw } from 'lucide-react';
import ShowcaseView from './components/ShowcaseView';

type Tab = 'read' | 'summary' | 'settings';

function renderBionicText(rawText: string) {
  return rawText.split('\n').map((line, lineIdx) => (
    <p key={lineIdx} className="mb-2">
      {line.split(/(\s+)/).map((segment, wordIdx) => {
        if (!segment.trim()) return segment;
        const mid = Math.ceil(segment.length / 2);
        return (
          <React.Fragment key={wordIdx}>
            <b className="font-extrabold">{segment.slice(0, mid)}</b>
            <span>{segment.slice(mid)}</span>
          </React.Fragment>
        );
      })}
    </p>
  ));
}

export default function App() {
  const initialDoc = !isExtension ? getMockActiveDocument() : null;

  const [activeTab, setActiveTab] = React.useState<Tab>('read');
  const [apiKey, setApiKey] = React.useState('');
  
  const [darkMode, setDarkMode] = React.useState(false);

  // Reading Mode State
  const [dyslexiaOn, setDyslexiaOn] = React.useState(false);
  const [tintOn, setTintOn] = React.useState(false);
  const [bionicOn, setBionicOn] = React.useState(false);
  const [alternateLinesOn, setAlternateLinesOn] = React.useState(false);
  const [speechRate, setSpeechRate] = React.useState(0.9);
  
  // Summary State
  const [summary, setSummary] = React.useState('');
  const [loadingSummary, setLoadingSummary] = React.useState(false);
  const [readingSummary, setReadingSummary] = React.useState(false);
  const [pageText, setPageText] = React.useState(initialDoc?.text || '');
  const [pageImages, setPageImages] = React.useState<string[]>([]);
  const summaryContainerRef = React.useRef<HTMLDivElement>(null);

  // PDF Document State
  const [isPdfDoc, setIsPdfDoc] = React.useState(!!initialDoc?.isPdf);
  const [pdfTitle, setPdfTitle] = React.useState(initialDoc?.title || '');
  const [pdfTotalPages, setPdfTotalPages] = React.useState(initialDoc?.totalPages || 0);
  const [pdfLoading, setPdfLoading] = React.useState(false);
  const [showPdfReaderView, setShowPdfReaderView] = React.useState(false);
  
  // Voices State
  const [voices, setVoices] = React.useState<any[]>([]);
  const [selectedVoiceName, setSelectedVoiceName] = React.useState<string>('');
  
  // Voice State
  const [voiceActive, setVoiceActive] = React.useState(false);
  const [reading, setReading] = React.useState(false);
  const [isPaused, setIsPaused] = React.useState(false);
  const [readProgress, setReadProgress] = React.useState(0);
  const [liveTranscript, setLiveTranscript] = React.useState('');

  // Responsive desktop detection for interactive preview showcase
  const [isWideScreen, setIsWideScreen] = React.useState<boolean>(
    typeof window !== 'undefined' ? window.innerWidth >= 850 : false
  );

  React.useEffect(() => {
    const handleResize = () => {
      setIsWideScreen(window.innerWidth >= 850);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleUpdateSampleText = (text: string, title: string) => {
    // If audio was playing, stop it cleanly on document change
    if (reading) {
      stopReading();
    }
    setPageText(text);
    setPdfTitle(title);
    setSummary(''); // Clear previous document's summary
    const isPdf = title.toLowerCase().includes('.pdf') || title.toLowerCase().includes('pdf document') || text.includes('--- Page');
    setIsPdfDoc(isPdf);
    let totalPages = 0;
    if (isPdf) {
      const pageMatches = text.match(/---\s*Page\s*\d+\s*---/gi);
      totalPages = pageMatches ? pageMatches.length : 3;
      setPdfTotalPages(totalPages);
    } else {
      setPdfTotalPages(0);
    }

    // Keep mock environment state 100% synchronized
    setMockActiveDocument({
      title,
      text,
      isPdf,
      totalPages: isPdf ? totalPages : 1,
      url: isPdf ? 'https://example.com/sample-paper.pdf' : 'https://accessmind.example.com/article'
    });
  };

  const loadPdfFromUrl = async (url: string, title?: string) => {
    setPdfLoading(true);
    try {
      const res = await extAPI.runtime.sendMessage({ action: "extractPdfText", url, title });
      if (res && res.success && res.text && isMeaningfulContent(res.text)) {
        setIsPdfDoc(true);
        setPdfTitle(res.title || title || url.split('/').pop()?.split('#')[0]?.split('?')[0] || 'PDF Document');
        setPdfTotalPages(res.totalPages || 1);
        setPageText(res.text);
        setPageImages([]);
      } else {
        const data = await extractPdfFromUrl(url, title);
        if (data && data.text && isMeaningfulContent(data.text)) {
          setIsPdfDoc(true);
          setPdfTitle(data.title);
          setPdfTotalPages(data.totalPages);
          setPageText(data.text);
          setPageImages([]);
        }
      }
    } catch (err: any) {
      console.warn("Could not extract PDF from url:", err);
      setLiveTranscript("⚠️ " + (err.message || "Could not load PDF"));
      setTimeout(() => setLiveTranscript(''), 4000);
    } finally {
      setPdfLoading(false);
    }
  };

  React.useEffect(() => {
    extAPI.storage.local.get(['apiKey', 'dyslexiaOn', 'tintOn', 'bionicOn', 'alternateLinesOn', 'speechRate', 'darkMode', 'selectedVoiceName']).then((res: any) => {
      if (res.apiKey) setApiKey(res.apiKey);
      if (res.dyslexiaOn) setDyslexiaOn(res.dyslexiaOn);
      if (res.tintOn) setTintOn(res.tintOn);
      if (res.bionicOn) setBionicOn(res.bionicOn);
      if (res.alternateLinesOn) setAlternateLinesOn(res.alternateLinesOn);
      if (res.speechRate) setSpeechRate(res.speechRate);
      if (res.darkMode !== undefined) setDarkMode(res.darkMode);
      if (res.selectedVoiceName) setSelectedVoiceName(res.selectedVoiceName);
    });
    
    if (extAPI.tts && extAPI.tts.getVoices) {
      extAPI.tts.getVoices((resVoices: any[]) => {
        setVoices(resVoices || []);
      });
    } else if (typeof window !== 'undefined' && window.speechSynthesis) {
       const updateVoices = () => setVoices(window.speechSynthesis.getVoices());
       updateVoices();
       window.speechSynthesis.onvoiceschanged = updateVoices;
    }
    
    // Extract text on load for active page or PDF document
    extAPI.tabs.query({ active: true, currentWindow: true }).then((tabs: any) => {
      if (tabs && tabs[0]) {
        const activeTab = tabs[0];
        const isPdf = !!(
          (activeTab.url && (activeTab.url.toLowerCase().includes('.pdf') || activeTab.url.toLowerCase().includes('/pdf/'))) ||
          (activeTab.title && (activeTab.title.toLowerCase().endsWith('.pdf') || activeTab.title.toLowerCase().includes('.pdf') || activeTab.title.toLowerCase() === 'pdf document'))
        );

        if (isPdf) {
          setIsPdfDoc(true);
          const initialTitle = activeTab.title && !activeTab.title.toLowerCase().endsWith('.pdf') && activeTab.title.toLowerCase() !== 'pdf document'
            ? activeTab.title 
            : activeTab.url?.split('/').pop()?.split('#')[0]?.split('?')[0] || 'PDF Document';
          setPdfTitle(initialTitle);
          setPdfLoading(true);
        }

        extAPI.tabs.sendMessage(activeTab.id, { action: "extractText" }).then((res: any) => {
          if (res && res.text && isMeaningfulContent(res.text)) {
            setPageText(res.text);
            if (res.images) setPageImages(res.isPdf ? [] : res.images);
            if (res.title) setPdfTitle(res.title);
            if (res.isPdf) {
              setIsPdfDoc(true);
              setPdfTitle(res.title || activeTab.title || 'PDF Document');
              setPdfTotalPages(res.totalPages || 1);
            }
            setPdfLoading(false);
          } else if (isPdf && activeTab.url) {
            loadPdfFromUrl(activeTab.url, activeTab.title);
          } else {
            setPdfLoading(false);
          }
        }).catch(() => {
          if (isPdf && activeTab.url) {
            loadPdfFromUrl(activeTab.url, activeTab.title);
          } else {
            setPdfLoading(false);
          }
        });
      }
    });

    const msgListener = (msg: any) => {
      if (msg.action === "transcriptForward") {
        setLiveTranscript(msg.transcript);
        // auto-clear after silence
        setTimeout(() => setLiveTranscript(''), 4000);
      } else if (msg.action === "ttsProgress") {
        if (msg.type === 'end' || msg.type === 'interrupted' || msg.type === 'error') {
          setReading(false);
          setReadingSummary(false);
          setIsPaused(false);
          setReadProgress(0);
        } else if (msg.charIndex && msg.totalLength && msg.totalLength > 0) {
          setReading(true);
          const pct = Math.min(100, Math.max(0, (msg.charIndex / msg.totalLength) * 100));
          setReadProgress(pct);
        }
      } else if (msg.action === "ttsPaused") {
        setIsPaused(true);
      } else if (msg.action === "ttsResumed") {
        setIsPaused(false);
      } else if (msg.action === "ttsStopped") {
        setReading(false);
        setReadingSummary(false);
        setIsPaused(false);
        setReadProgress(0);
      } else if (msg.action === "syncUI") {
        extAPI.storage.local.get(['dyslexiaOn', 'tintOn', 'bionicOn', 'alternateLinesOn']).then((res: any) => {
          if (res.dyslexiaOn !== undefined) setDyslexiaOn(res.dyslexiaOn);
          if (res.tintOn !== undefined) setTintOn(res.tintOn);
          if (res.bionicOn !== undefined) setBionicOn(res.bionicOn);
          if (res.alternateLinesOn !== undefined) setAlternateLinesOn(res.alternateLinesOn);
        });
      } else if (msg.action === "triggerUI_summarize") {
        setActiveTab('read'); // Changed to read since summary tab is removed
        generateSummary(msg.text, msg.images, msg.isPdf);
      }
    };
    extAPI.runtime.onMessage.addListener(msgListener);
    return () => extAPI.runtime.onMessage.removeListener(msgListener);
  }, []);

  const saveSettings = (updates: any) => {
    extAPI.storage.local.set(updates);
  };

  const toggleDyslexia = async () => {
    const val = !dyslexiaOn;
    setDyslexiaOn(val);
    saveSettings({ dyslexiaOn: val });
    const tabs = await extAPI.tabs.query({ active: true, currentWindow: true });
    if(tabs[0]) {
      extAPI.tabs.sendMessage(tabs[0].id, { action: "toggleDyslexia", enabled: val }).catch((err: any) => console.log("Content script not ready", err));
    }
  };

  const toggleTint = async () => {
    const val = !tintOn;
    setTintOn(val);
    saveSettings({ tintOn: val });
    const tabs = await extAPI.tabs.query({ active: true, currentWindow: true });
    if(tabs[0]) {
      extAPI.tabs.sendMessage(tabs[0].id, { action: "toggleTint", enabled: val }).catch((err: any) => console.log("Content script not ready", err));
    }
  };

  const toggleBionic = async () => {
    const val = !bionicOn;
    setBionicOn(val);
    saveSettings({ bionicOn: val });
    const tabs = await extAPI.tabs.query({ active: true, currentWindow: true });
    if(tabs[0]) {
      extAPI.tabs.sendMessage(tabs[0].id, { action: "toggleBionic", enabled: val }).catch((err: any) => console.log("Content script not ready", err));
    }
  };

  const toggleAlternateLines = async () => {
    const val = !alternateLinesOn;
    setAlternateLinesOn(val);
    saveSettings({ alternateLinesOn: val });
    const tabs = await extAPI.tabs.query({ active: true, currentWindow: true });
    if(tabs[0]) {
      extAPI.tabs.sendMessage(tabs[0].id, { action: "toggleAlternateLines", enabled: val }).catch((err: any) => console.log("Content script not ready", err));
    }
  };

  const recognitionRef = React.useRef<any>(null);
  const wasReadingBeforeVoiceRef = React.useRef<boolean>(false);
  const voiceCommandExecutedRef = React.useRef<boolean>(false);
  const lastSpokenTranscriptRef = React.useRef<string>('');

  const handleAppVoiceCommand = (raw: string) => {
    const cmd = raw.toLowerCase().trim();
    console.log("App voice command executed:", cmd);
    voiceCommandExecutedRef.current = true;
    const shouldResume = wasReadingBeforeVoiceRef.current;

    if (/stop|cancel|quiet|shut up|halt|mute/.test(cmd)) {
      wasReadingBeforeVoiceRef.current = false;
      stopReading();
      setLiveTranscript("⏹️ Reading Stopped");
      setTimeout(() => setLiveTranscript(""), 2000);
    } else if (/pause|hold on|wait/.test(cmd)) {
      wasReadingBeforeVoiceRef.current = false;
      if (reading && !isPaused) pauseReading();
      setLiveTranscript("⏸️ Reading Paused");
      setTimeout(() => setLiveTranscript(""), 2000);
    } else if (/resume|unpause|continue|play|go on|keep reading/.test(cmd)) {
      wasReadingBeforeVoiceRef.current = false;
      if (isPaused) resumeReading();
      else if (!reading) startReading();
      setLiveTranscript("▶️ Reading Resumed");
      setTimeout(() => setLiveTranscript(""), 2000);
    } else if (/read page|read aloud|read this|read to me|start reading|speak|read/.test(cmd)) {
      wasReadingBeforeVoiceRef.current = false;
      if (!reading) startReading();
      else if (isPaused) resumeReading();
      setLiveTranscript("🔊 Reading Aloud");
      setTimeout(() => setLiveTranscript(""), 2000);
    } else if (/summar|tldr|key point|overview|insights/.test(cmd)) {
      wasReadingBeforeVoiceRef.current = false;
      generateSummary();
      setLiveTranscript("✨ Generating Summary");
      setTimeout(() => setLiveTranscript(""), 2000);
    } else if (/dyslexi|font/.test(cmd)) {
      toggleDyslexia();
      setLiveTranscript("🔤 Dyslexia Font toggled");
      if (shouldResume) {
        wasReadingBeforeVoiceRef.current = false;
        setTimeout(() => { if (isPaused) resumeReading(); }, 350);
      }
      setTimeout(() => setLiveTranscript(""), 2000);
    } else if (/bionic|speed read|fast read/.test(cmd)) {
      toggleBionic();
      setLiveTranscript("👁️ Bionic Reading toggled");
      if (shouldResume) {
        wasReadingBeforeVoiceRef.current = false;
        setTimeout(() => { if (isPaused) resumeReading(); }, 350);
      }
      setTimeout(() => setLiveTranscript(""), 2000);
    } else if (/tint|sepia|contrast|dark mode|color/.test(cmd)) {
      toggleTint();
      setLiveTranscript("🎨 Color Tint toggled");
      if (shouldResume) {
        wasReadingBeforeVoiceRef.current = false;
        setTimeout(() => { if (isPaused) resumeReading(); }, 350);
      }
      setTimeout(() => setLiveTranscript(""), 2000);
    } else if (/faster|speed up|increase speed|read faster/.test(cmd)) {
      const next = Math.min(2.0, Math.round((speechRate + 0.2) * 10) / 10);
      setSpeechRate(next);
      saveSettings({ speechRate: next });
      setLiveTranscript(`⚡ Speed: ${next}x`);
      setTimeout(() => setLiveTranscript(""), 2000);
    } else if (/slower|slow down|decrease speed|read slower/.test(cmd)) {
      const next = Math.max(0.5, Math.round((speechRate - 0.2) * 10) / 10);
      setSpeechRate(next);
      saveSettings({ speechRate: next });
      setLiveTranscript(`🐢 Speed: ${next}x`);
      setTimeout(() => setLiveTranscript(""), 2000);
    } else if (/ruler|lines|alternate|guide/.test(cmd)) {
      toggleAlternateLines();
      setLiveTranscript("📏 Reading Ruler toggled");
      if (shouldResume) {
        wasReadingBeforeVoiceRef.current = false;
        setTimeout(() => { if (isPaused) resumeReading(); }, 350);
      }
      setTimeout(() => setLiveTranscript(""), 2000);
    } else {
      setLiveTranscript(`🎙️ "${raw}"`);
      if (shouldResume) {
        wasReadingBeforeVoiceRef.current = false;
        setTimeout(() => { if (isPaused) resumeReading(); }, 350);
      }
      setTimeout(() => setLiveTranscript(""), 2000);
    }
  };

  const startVoiceControl = async () => {
    if (voiceActive) {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }
      setVoiceActive(false);
      return;
    }

    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      setLiveTranscript("Speech recognition not supported in this browser");
      return;
    }

    try {
      // If reading is in progress, duck/pause it immediately so microphone is clean
      if (reading && !isPaused) {
        wasReadingBeforeVoiceRef.current = true;
        pauseReading();
      } else {
        wasReadingBeforeVoiceRef.current = false;
      }
      voiceCommandExecutedRef.current = false;
      lastSpokenTranscriptRef.current = '';

      extAPI.runtime.sendMessage({ action: "startVoice" }).catch(() => {});

      const rec = new SpeechRec();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'en-US';

      rec.onstart = () => {
        setVoiceActive(true);
        setLiveTranscript("🎙️ Listening... speak your command");
      };

      rec.onresult = (event: any) => {
        let interim = '';
        let final = '';
        for (let i = 0; i < event.results.length; i++) {
          if (event.results[i].isFinal) final += event.results[i][0].transcript;
          else interim += event.results[i][0].transcript;
        }
        const fullTranscript = (final + " " + interim).trim();
        if (fullTranscript) {
          lastSpokenTranscriptRef.current = fullTranscript;
          setLiveTranscript(`🎙️ "${fullTranscript}"`);

          // Quick command pattern match during speech
          if (!voiceCommandExecutedRef.current) {
            const low = fullTranscript.toLowerCase();
            if (/stop|cancel|quiet|pause|resume|unpause|read|summar|dyslexi|bionic|tint|sepia|ruler|lines/.test(low)) {
              handleAppVoiceCommand(fullTranscript);
            }
          }
        }
      };

      rec.onerror = (e: any) => {
        if (e.error === 'not-allowed') {
          extAPI.runtime.sendMessage({ action: "requestMicPermission" }).catch(() => {});
          setLiveTranscript("🎙️ Please click 'Allow' in the tab that just opened to enable microphone.");
          setVoiceActive(false);
          return;
        }
        if (e.error === 'no-speech' || e.error === 'aborted') {
          setVoiceActive(false);
          return;
        }
        setLiveTranscript(`⚠️ Voice notice: ${e.error}`);
        setVoiceActive(false);
        if (wasReadingBeforeVoiceRef.current) {
          wasReadingBeforeVoiceRef.current = false;
          if (isPaused) resumeReading();
        }
      };

      rec.onend = () => {
        setVoiceActive(false);
        extAPI.runtime.sendMessage({ action: "stopVoice" }).catch(() => {});
        if (!voiceCommandExecutedRef.current) {
          if (lastSpokenTranscriptRef.current.trim()) {
            handleAppVoiceCommand(lastSpokenTranscriptRef.current);
          } else if (wasReadingBeforeVoiceRef.current) {
            wasReadingBeforeVoiceRef.current = false;
            if (isPaused) resumeReading();
            setLiveTranscript("");
          }
        }
      };

      recognitionRef.current = rec;
      rec.start();
    } catch (err) {
      setVoiceActive(false);
      if (wasReadingBeforeVoiceRef.current) {
        wasReadingBeforeVoiceRef.current = false;
        if (isPaused) resumeReading();
      }
    }
  };

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName || '').toUpperCase();
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return;
      if (e.code === 'Space' && !e.repeat && !voiceActive) {
        e.preventDefault();
        startVoiceControl();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName || '').toUpperCase();
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return;
      if (e.code === 'Space') {
        e.preventDefault();
        if (recognitionRef.current) {
          try { recognitionRef.current.stop(); } catch (err) {}
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [voiceActive, reading, isPaused, dyslexiaOn, tintOn, bionicOn, alternateLinesOn]);

  React.useEffect(() => {
    if (typeof window !== 'undefined' && window.location.search.includes('requestMic=1')) {
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
          stream.getTracks().forEach(t => t.stop());
          startVoiceControl();
        })
        .catch(e => console.error("Mic permission denied", e));
    }
  }, []);
  
  const startReading = async () => {
    let textToSpeak = pageText;

    // Guard: If this is a PDF and text has no meaningful content, extract dynamically first
    if (isPdfDoc && !isMeaningfulContent(textToSpeak)) {
      setLiveTranscript("📄 Extracting PDF content for speech...");
      setPdfLoading(true);
      try {
        const tabs = await extAPI.tabs.query({ active: true, currentWindow: true });
        if (tabs && tabs[0]) {
          const res = await extAPI.tabs.sendMessage(tabs[0].id, { action: "extractText" });
          if (res && res.text && isMeaningfulContent(res.text)) {
            textToSpeak = res.text;
            setPageText(res.text);
            if (res.title) setPdfTitle(res.title);
            if (res.totalPages) setPdfTotalPages(res.totalPages);
          } else if (tabs[0].url) {
            const data = await extractPdfFromUrl(tabs[0].url, tabs[0].title);
            if (data && data.text && isMeaningfulContent(data.text)) {
              textToSpeak = data.text;
              setPageText(data.text);
              setPdfTitle(data.title);
              setPdfTotalPages(data.totalPages);
            }
          }
        }
      } catch (err) {
        console.warn("Could not extract PDF before startReading:", err);
      } finally {
        setPdfLoading(false);
      }
    }

    if (!isMeaningfulContent(textToSpeak)) {
      setLiveTranscript("⚠️ No readable text found in document. Try On-Page View or reload.");
      setTimeout(() => setLiveTranscript(''), 3500);
      return;
    }

    setReading(true);
    setIsPaused(false);
    try {
      await extAPI.runtime.sendMessage({ 
        action: "readAloudTriggered", 
        text: textToSpeak.substring(0, 30000), 
        title: pdfTitle || undefined,
        isPdf: isPdfDoc,
        images: isPdfDoc ? [] : pageImages 
      });
    } catch (err) {
      console.log(err);
      setReading(false);
      setIsPaused(false);
    }
  };

  const pauseReading = async () => {
    try {
      await extAPI.runtime.sendMessage({ action: "pauseTts" });
    } catch (err) {
      console.log(err);
    }
    setIsPaused(true);
  };

  const resumeReading = async () => {
    try {
      await extAPI.runtime.sendMessage({ action: "resumeTts" });
    } catch (err) {
      console.log(err);
    }
    setIsPaused(false);
  };

  const stopReading = async () => {
    try {
      await extAPI.runtime.sendMessage({ action: "stopTts" });
    } catch (err) {
      console.log(err);
    }
    setReading(false);
    setReadingSummary(false);
    setIsPaused(false);
    setReadProgress(0);
  };

  const togglePause = () => {
    if (isPaused) {
      resumeReading();
    } else {
      pauseReading();
    }
  };

  const toggleTTS = async () => {
    if (reading) {
      stopReading();
    } else {
      startReading();
    }
  };

  const speakSummary = (textToSpeak?: any) => {
    const content = typeof textToSpeak === 'string' ? textToSpeak : summary;
    if (!content) return;
    if (reading) {
      stopReading();
    }
    setReadingSummary(true);
    setReading(true);
    setIsPaused(false);
    extAPI.runtime.sendMessage({
      action: "readAloudTriggered",
      text: content,
      rate: speechRate,
      voiceName: selectedVoiceName
    });
  };

  const generateSummary = async (overrideText?: any, overrideImages?: any, overrideIsPdf?: any) => {
    // 1. Immediately stop any active reading/TTS session
    stopReading();

    // 2. Ensure user is in Home/Read tab to see summary automatically
    setActiveTab('read');

    if (!apiKey && isExtension) {
      setLiveTranscript("🔑 Please enter your Gemini API key in Settings.");
      setActiveTab('settings');
      setTimeout(() => setLiveTranscript(''), 4000);
      return;
    }

    const textArg = typeof overrideText === 'string' && overrideText.trim().length > 0 ? overrideText : undefined;
    const imagesArg = Array.isArray(overrideImages) ? overrideImages : undefined;
    const isPdfArg = typeof overrideIsPdf === 'boolean' ? overrideIsPdf : undefined;

    const isPdfTarget = isPdfArg !== undefined ? isPdfArg : isPdfDoc;
    let textToSummarize = textArg || pageText;

    // If PDF text is not yet loaded, extract it first
    if (isPdfTarget && !isMeaningfulContent(textToSummarize)) {
      try {
        const tabs = await extAPI.tabs.query({ active: true, currentWindow: true });
        if (tabs && tabs[0]?.url) {
          const data = await extractPdfFromUrl(tabs[0].url, tabs[0].title);
          if (data && data.text && isMeaningfulContent(data.text)) {
            textToSummarize = data.text;
            setPageText(data.text);
            setPdfTitle(data.title);
            setPdfTotalPages(data.totalPages);
          }
        }
      } catch (e) {
        console.warn("Could not extract PDF before summarize:", e);
      }
    }

    const imagesToSummarize = isPdfTarget ? [] : (imagesArg || pageImages);

    setLoadingSummary(true);
    try {
      const res = await extAPI.runtime.sendMessage({ 
        action: "summarize", 
        text: textToSummarize,
        title: pdfTitle || undefined,
        isPdf: isPdfTarget,
        images: imagesToSummarize,
        apiKey: apiKey
      });
      if (res && res.success && res.summary) {
        setSummary(res.summary);
        
        // 3. Automatically scroll down to summary so it's fully visible in the window
        setTimeout(() => {
          summaryContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 150);

        // 4. Automatically start reading the summary aloud
        setReadingSummary(true);
        setReading(true);
        setIsPaused(false);
        extAPI.runtime.sendMessage({
          action: "readAloudTriggered",
          text: res.summary,
          rate: speechRate,
          voiceName: selectedVoiceName
        });
      } else {
        setSummary("Error: " + (res?.error || "Unknown error"));
      }
    } catch (e: any) {
      setSummary("Error: " + e.message);
    }
    setLoadingSummary(false);
  };

  const exportPdf = () => {
    if (!summary) return;
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("AccessMind Summary", 14, 18);
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    const dateStr = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    doc.text(`Generated on ${dateStr} · AccessMind Universal Accessibility`, 14, 25);
    
    doc.setDrawColor(200, 200, 200);
    doc.line(14, 28, 196, 28);

    doc.setFontSize(11);
    doc.setTextColor(30, 30, 30);
    const splitText = doc.splitTextToSize(summary, 182);
    
    let cursorY = 36;
    const pageHeight = doc.internal.pageSize.height;
    for (let i = 0; i < splitText.length; i++) {
      if (cursorY > pageHeight - 20) {
        doc.addPage();
        cursorY = 20;
      }
      doc.text(splitText[i], 14, cursorY);
      cursorY += 6;
    }
    
    const safeTitle = (pdfTitle || 'accessmind-summary').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    doc.save(`${safeTitle}.pdf`);
  };

  const popupCard = (
    <div className={`w-full max-w-[360px] min-h-[480px] font-sans flex flex-col transition-colors relative ${darkMode ? 'dark' : ''} bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100`}>
      {/* Header */}
      <div className="bg-indigo-600 dark:bg-indigo-800 text-white p-4 flex items-center justify-between shadow-md z-10 relative">
        <div className="flex items-center gap-2">
          <BrainCircuit className="w-6 h-6" />
          <h1 className="text-xl font-bold tracking-tight">AccessMind</h1>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={startVoiceControl}
            className={`p-2 rounded-full transition-all flex items-center justify-center ${voiceActive ? 'bg-rose-500 text-white shadow-[0_0_12px_rgba(244,63,94,0.6)]' : 'bg-white/20 hover:bg-white/30 text-white'}`}
            title="Enable Voice Commands (then hold Spacebar)"
          >
            <Mic className={`w-4 h-4 ${voiceActive ? 'animate-pulse' : ''}`} />
          </button>
          {!isExtension && (
            <span className="text-[10px] bg-white/20 px-2 py-1 rounded-full uppercase tracking-wider font-semibold">
              Preview
            </span>
          )}
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 z-10 relative">
        <TabButton active={activeTab === 'read'} onClick={() => setActiveTab('read')} icon={<BookOpen className="w-4 h-4" />} label="Home" />
        <TabButton active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon={<Settings className="w-4 h-4" />} label="Settings" />
      </div>

      {/* Content Area */}
      <div className="flex-1 p-4 overflow-y-auto pb-12 relative z-0">
        {!isExtension && (
          <div className="mb-4 text-xs p-2 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 rounded border border-amber-200 dark:border-amber-800">
            <strong>Dev Mode:</strong> You are viewing the UI preview. To use the full extension, build the project and load the `dist` folder into Chrome.
          </div>
        )}

        {/* --- READ TAB --- */}
        {activeTab === 'read' && (
          <div className="space-y-4">
            {/* Active Document Card */}
            {pdfLoading ? (
              <div className="p-3.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800/70 flex items-center justify-center gap-2.5 text-xs text-indigo-700 dark:text-indigo-300 font-medium">
                <span className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin shrink-0"></span>
                <span>Extracting accessible content from active tab...</span>
              </div>
            ) : (
              <div className="p-3.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/60 shadow-xs">
                <div className="flex items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-indigo-600 dark:bg-indigo-700 text-white flex items-center justify-center shrink-0 shadow-xs">
                      {isPdfDoc ? <FileText className="w-4 h-4" /> : <Globe className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-200/80 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 uppercase tracking-wider">
                          {isPdfDoc ? 'PDF Document' : 'Web Page'}
                        </span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          {isPdfDoc && pdfTotalPages > 0 ? `${pdfTotalPages} page${pdfTotalPages > 1 ? 's' : ''} · ` : ''}
                          {pageText ? `${Math.round(pageText.trim().split(/\s+/).length).toLocaleString()} words` : 'Active Tab'}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate mt-0.5" title={pdfTitle || (isPdfDoc ? 'PDF Document' : 'Current Tab')}>
                        {pdfTitle || (isPdfDoc ? 'PDF Document' : 'Current Tab')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {isPdfDoc && (
                      <button
                        onClick={async () => {
                          const tabs = await extAPI.tabs.query({ active: true, currentWindow: true });
                          if (tabs[0]?.id) {
                            extAPI.tabs.sendMessage(tabs[0].id, { action: "togglePdfOverlay" }).catch(() => {});
                          }
                        }}
                        className="flex items-center gap-1 text-[11px] font-medium px-2 py-1 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-lg transition shadow-2xs"
                        title="Open Accessible PDF reader overlay on the page"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>On-Page View</span>
                      </button>
                    )}
                    {isPdfDoc && !isMeaningfulContent(pageText) && !pdfLoading && (
                      <button
                        onClick={async () => {
                          const tabs = await extAPI.tabs.query({ active: true, currentWindow: true });
                          if (tabs[0]?.url) {
                            loadPdfFromUrl(tabs[0].url, tabs[0].title);
                          }
                        }}
                        className="flex items-center gap-1 text-[11px] font-medium px-2 py-1 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 rounded-lg transition shadow-2xs"
                        title="Reload PDF text extraction"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Extract</span>
                      </button>
                    )}
                    {pageText && isMeaningfulContent(pageText) && (
                      <button
                        onClick={() => setShowPdfReaderView(!showPdfReaderView)}
                        className="flex items-center gap-1 text-[11px] font-medium px-2 py-1 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg transition shadow-2xs"
                        title={showPdfReaderView ? "Hide formatted preview" : "Show formatted preview"}
                      >
                        {showPdfReaderView ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        <span>{showPdfReaderView ? 'Hide' : 'Preview'}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Formatted Accessible Text Preview (if toggled) */}
                {showPdfReaderView && pageText && (
                  <div className={`mt-3 p-3 rounded-lg border text-xs max-h-56 overflow-y-auto ${
                    tintOn ? 'bg-[#fdf6e3] text-[#2c2518] border-amber-200' : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                  } ${dyslexiaOn ? 'font-[OpenDyslexic,"Comic_Sans_MS",sans-serif]' : ''}`}>
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200/60 dark:border-slate-700/60 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                      <span>📑 Accessible Content Preview</span>
                      <span className="text-[10px] text-slate-400 font-normal">
                        {Math.round(pageText.trim().split(/\s+/).length).toLocaleString()} words
                      </span>
                    </div>
                    <div className={alternateLinesOn ? 'leading-relaxed select-text space-y-1' : 'leading-relaxed select-text'}>
                      {bionicOn ? renderBionicText(pageText) : <pre className="font-inherit whitespace-pre-wrap font-sans text-xs">{pageText}</pre>}
                    </div>
                  </div>
                )}
              </div>
            )}

            <h2 className="font-semibold text-slate-700 dark:text-slate-300 uppercase text-xs tracking-wider mb-2">Cognitive Modes</h2>
            <div className="space-y-3">
              <ToggleRow 
                icon={<Type className="w-5 h-5 text-blue-500" />}
                title="Dyslexia Font" 
                desc="Use OpenDyslexic font" 
                checked={dyslexiaOn} 
                onChange={toggleDyslexia} 
              />
              <ToggleRow 
                icon={<SunMoon className="w-5 h-5 text-orange-500" />}
                title="Sepia Tint" 
                desc="Reduce eye strain" 
                checked={tintOn} 
                onChange={toggleTint} 
              />
              <ToggleRow 
                icon={<BookOpen className="w-5 h-5 text-indigo-500" />}
                title="Bionic Reading" 
                desc="Highlight word roots" 
                checked={bionicOn} 
                onChange={toggleBionic} 
              />
              <ToggleRow 
                icon={<BookOpen className="w-5 h-5 text-emerald-500" />}
                title="Reading Ruler" 
                desc="Alternate line highlights" 
                checked={alternateLinesOn} 
                onChange={toggleAlternateLines} 
              />
            </div>
            
            <div className="h-px bg-slate-200 dark:bg-slate-700 my-4"></div>
            
            <h2 className="font-semibold text-slate-700 dark:text-slate-300 uppercase text-xs tracking-wider mb-2">Auditory Assistance</h2>
            
            <div className="mb-4 bg-white dark:bg-slate-800 p-3 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm hover:border-indigo-200 dark:hover:border-indigo-500/50 transition-colors">
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Speech Rate</label>
                <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/50 px-2 py-0.5 rounded-md">{speechRate.toFixed(1)}x</span>
              </div>
              <input 
                type="range" 
                min="0.5" max="2.0" step="0.1" 
                value={speechRate} 
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setSpeechRate(val);
                  saveSettings({ speechRate: val });
                }}
                className="w-full accent-indigo-600 cursor-pointer"
              />
            </div>

            <div className="flex flex-col gap-2.5">
              {reading ? (
                <div className="flex items-center gap-2">
                  <button 
                    id="btn-pause-resume"
                    onClick={togglePause}
                    className={`flex-1 py-3 px-3 rounded-xl flex items-center justify-center gap-2 font-medium transition-all shadow-sm ${
                      isPaused 
                        ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-200 dark:hover:bg-emerald-900/70 border border-emerald-300/60 dark:border-emerald-700/60' 
                        : 'bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200 hover:bg-amber-200 dark:hover:bg-amber-900/70 border border-amber-300/60 dark:border-amber-700/60'
                    }`}
                    title={isPaused ? "Resume Reading" : "Pause Reading"}
                  >
                    {isPaused ? <Play className="w-4 h-4 fill-current" /> : <Pause className="w-4 h-4 fill-current" />}
                    <span>{isPaused ? 'Resume' : 'Pause'}</span>
                  </button>

                  <button 
                    id="btn-stop-reading"
                    onClick={stopReading}
                    className="flex-1 py-3 px-3 rounded-xl flex items-center justify-center gap-2 font-medium transition-all shadow-sm bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300 hover:bg-rose-200 dark:hover:bg-rose-900/70 border border-rose-300/60 dark:border-rose-700/60"
                    title="Stop Reading"
                  >
                    <Square className="w-4 h-4 fill-current" />
                    <span>Stop</span>
                  </button>
                </div>
              ) : (
                <button 
                  id="btn-read-aloud"
                  onClick={startReading}
                  className="w-full py-3 px-4 rounded-xl flex items-center justify-center gap-2 font-medium transition-all bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-900/70 shadow-sm border border-indigo-200/60 dark:border-indigo-800/40"
                  title={isPdfDoc ? "Read PDF Aloud" : "Read Page Aloud"}
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>{isPdfDoc ? 'Read PDF Aloud' : 'Read Page Aloud'}</span>
                </button>
              )}
              
              {reading && (
                <div className="space-y-1.5 mt-0.5">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 px-1">
                    <span className="flex items-center gap-1.5 font-medium">
                      <span className={`w-2 h-2 rounded-full ${isPaused ? 'bg-amber-500' : 'bg-emerald-500 animate-pulse'}`}></span>
                      <span>{isPaused ? 'Reading Paused' : isPdfDoc ? 'Reading PDF Aloud...' : 'Reading in progress...'}</span>
                    </span>
                    <span className="font-semibold text-slate-600 dark:text-slate-300">{Math.round(readProgress)}%</span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-300 ease-out ${isPaused ? 'bg-amber-500' : 'bg-indigo-500'}`} 
                      style={{ width: `${readProgress}%` }}
                    ></div>
                  </div>
                </div>
              )}
            </div>
            
            <div className="h-px bg-slate-200 dark:bg-slate-700 my-4"></div>
            
            <div ref={summaryContainerRef} className="scroll-mt-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-semibold text-slate-700 dark:text-slate-300 uppercase text-xs tracking-wider">AI Summary</h2>
                {reading && readingSummary && (
                  <span className="flex items-center gap-1.5 text-[11px] font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800">
                    <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping"></span>
                    <span>Reading Summary...</span>
                  </span>
                )}
              </div>
              <div className="flex gap-2 mb-3">
                <button 
                  onClick={generateSummary}
                  disabled={loadingSummary}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loadingSummary ? (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  ) : (
                    <BrainCircuit className="w-4 h-4" />
                  )}
                  {loadingSummary ? 'Thinking...' : isPdfDoc ? 'Summarize PDF' : 'Summarize Page'}
                </button>
                {summary && (
                  <>
                    <button 
                      onClick={() => {
                        if (reading && readingSummary) {
                          stopReading();
                        } else {
                          speakSummary();
                        }
                      }}
                      className={`p-2 rounded-lg transition-colors border ${
                        reading && readingSummary
                          ? 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700 shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700'
                      }`}
                      title={reading && readingSummary ? "Stop reading summary" : "Read summary aloud"}
                    >
                      {reading && readingSummary ? <Square className="w-5 h-5 text-red-500" /> : <Volume2 className="w-5 h-5" />}
                    </button>
                    <button 
                      onClick={exportPdf}
                      className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors border border-slate-200 dark:border-slate-700"
                      title="Export to PDF"
                    >
                      <Download className="w-5 h-5" />
                    </button>
                  </>
                )}
              </div>
              
              {summary && (
                <div className={`border rounded-lg p-3 overflow-y-auto text-sm shadow-inner max-h-[250px] transition-all ${
                  reading && readingSummary
                    ? 'bg-indigo-50/50 dark:bg-indigo-950/30 border-indigo-300 dark:border-indigo-700 ring-2 ring-indigo-500/20'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                }`}>
                  <div className="whitespace-pre-wrap text-slate-700 dark:text-slate-300 leading-relaxed">{summary}</div>
                </div>
              )}
            </div>
            
            <div className="mt-4 flex items-start gap-2 bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-lg border border-indigo-100 dark:border-indigo-800/50">
               <Mic className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
               <p className="text-[11px] leading-tight text-indigo-700 dark:text-indigo-300">
                 <strong>Push-to-Talk:</strong> Hold <strong>Spacebar</strong> {isPdfDoc ? 'on this PDF' : 'on any page'} to speak commands (e.g. <em>"read page"</em>, <em>"pause"</em>, <em>"resume"</em>, <em>"summarize"</em>). Or press <strong>Alt+A</strong> for the quick toolbar.
               </p>
            </div>
          </div>
        )}

        {/* --- SETTINGS TAB --- */}
        {activeTab === 'settings' && (
          <div className="space-y-4">
            <h2 className="font-semibold text-slate-700 dark:text-slate-300 uppercase text-xs tracking-wider mb-2">Configuration</h2>
            
            <div className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm mb-4">
              <div className="flex flex-col">
                <span className="font-medium text-slate-800 dark:text-slate-200 text-sm">Dark Mode</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">Toggle dark theme</span>
              </div>
              <div 
                onClick={() => {
                  const val = !darkMode;
                  setDarkMode(val);
                  saveSettings({ darkMode: val });
                }}
                className={`w-11 h-6 rounded-full transition-colors flex items-center cursor-pointer ${darkMode ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-600'}`}
              >
                <div className={`w-4 h-4 rounded-full bg-white shadow-sm transform transition-transform mx-1 ${darkMode ? 'translate-x-5' : 'translate-x-0'}`}></div>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Reading Voice
              </label>
              <select 
                value={selectedVoiceName}
                onChange={(e) => {
                  setSelectedVoiceName(e.target.value);
                  saveSettings({ selectedVoiceName: e.target.value });
                }}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm appearance-none"
              >
                <option value="">Default System Voice</option>
                {voices.map((v, i) => (
                  <option key={i} value={v.voiceName || v.name}>{v.voiceName || v.name} {v.lang ? `(${v.lang})` : ''}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Gemini API Key
              </label>
              <input 
                type="password" 
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  saveSettings({ apiKey: e.target.value });
                }}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                placeholder="AIzaSy..."
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                Required for Generative AI Summarization. Get your key from <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:underline">Google AI Studio</a>.
              </p>
            </div>
            
            <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
              <h2 className="font-semibold text-slate-700 dark:text-slate-300 uppercase text-xs tracking-wider mb-3">Keyboard Shortcuts</h2>
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 shadow-sm mb-3">
                <ul className="text-xs text-slate-600 space-y-2.5">
                  <li className="flex justify-between items-center">
                    <span className="dark:text-slate-300">Push-to-Talk Voice</span> 
                    <kbd className="bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded border border-slate-300 dark:border-slate-600 font-mono text-[10px] font-semibold text-slate-700 dark:text-slate-300">Hold Spacebar</kbd>
                  </li>
                  <li className="flex justify-between items-center">
                    <span className="dark:text-slate-300">Open Assistant / Toolbar</span> 
                    <kbd className="bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded border border-slate-300 dark:border-slate-600 font-mono text-[10px] font-semibold text-slate-700 dark:text-slate-300">Alt+A / Ctrl+Shift+X</kbd>
                  </li>
                  <li className="flex justify-between items-center">
                    <span className="dark:text-slate-300">Read Page Aloud</span> 
                    <kbd className="bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded border border-slate-300 dark:border-slate-600 font-mono text-[10px] font-semibold text-slate-700 dark:text-slate-300">Alt+S / Ctrl+Shift+S</kbd>
                  </li>
                  <li className="flex justify-between items-center">
                    <span className="dark:text-slate-300">Dyslexia Font</span> 
                    <kbd className="bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded border border-slate-300 dark:border-slate-600 font-mono text-[10px] font-semibold text-slate-700 dark:text-slate-300">Alt+D</kbd>
                  </li>
                  <li className="flex justify-between items-center">
                    <span className="dark:text-slate-300">Bionic Reading</span> 
                    <kbd className="bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded border border-slate-300 dark:border-slate-600 font-mono text-[10px] font-semibold text-slate-700 dark:text-slate-300">Alt+B</kbd>
                  </li>
                  <li className="flex justify-between items-center">
                    <span className="dark:text-slate-300">Color Tint</span> 
                    <kbd className="bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded border border-slate-300 dark:border-slate-600 font-mono text-[10px] font-semibold text-slate-700 dark:text-slate-300">Alt+T</kbd>
                  </li>
                  <li className="flex justify-between items-center">
                    <span className="dark:text-slate-300">Reading Ruler</span> 
                    <kbd className="bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded border border-slate-300 dark:border-slate-600 font-mono text-[10px] font-semibold text-slate-700 dark:text-slate-300">Alt+R</kbd>
                  </li>
                  <li className="flex justify-between items-center">
                    <span className="dark:text-slate-300">Stop Reading</span> 
                    <kbd className="bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded border border-slate-300 dark:border-slate-600 font-mono text-[10px] font-semibold text-slate-700 dark:text-slate-300">Escape</kbd>
                  </li>
                </ul>
              </div>
              <button 
                onClick={() => {
                  if (isExtension) {
                    extAPI.tabs.create({url: 'chrome://extensions/shortcuts'});
                  } else {
                    setLiveTranscript("In Chrome, configure shortcuts at chrome://extensions/shortcuts");
                    setTimeout(() => setLiveTranscript(''), 3500);
                  }
                }}
                className="w-full py-2 bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-md text-xs font-medium transition-colors border border-slate-200 dark:border-slate-600"
              >
                Configure in Chrome
              </button>
            </div>
          </div>
        )}
      </div>
      
      {/* Live Transcript Overlay */}
      <div className={`absolute bottom-4 left-4 right-4 z-50 transition-all duration-300 ${liveTranscript ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-2 pointer-events-none'}`}>
         <div 
           onClick={() => {
             if (liveTranscript.includes("Allow") || liveTranscript.includes("allow") || liveTranscript.includes("permission") || liveTranscript.includes("Microphone") || liveTranscript.includes("blocked")) {
               extAPI.runtime.sendMessage({ action: "requestMicPermission" }).catch(() => {});
               setLiveTranscript("🎙️ Opening permission page in a new tab... click 'Allow'");
             }
           }}
           className="bg-slate-900/95 dark:bg-slate-100/95 backdrop-blur text-white dark:text-slate-900 rounded-lg p-3 text-xs font-medium shadow-lg border border-slate-700 dark:border-slate-200 cursor-pointer"
         >
            <div className="flex items-center gap-2 mb-1">
               <Mic className="w-3 h-3 text-rose-400 dark:text-rose-600 animate-pulse" />
               <span className="text-[9px] uppercase tracking-wider text-slate-300 dark:text-slate-600 font-semibold">
                 {voiceActive ? "Listening..." : "Voice Assistant"}
               </span>
            </div>
            <div>{liveTranscript}</div>
         </div>
      </div>
    </div>
  );

  if (!isExtension) {
    return (
      <ShowcaseView
        dyslexiaOn={dyslexiaOn}
        tintOn={tintOn}
        bionicOn={bionicOn}
        alternateLinesOn={alternateLinesOn}
        reading={reading}
        isPaused={isPaused}
        readProgress={readProgress}
        speechRate={speechRate}
        darkMode={darkMode}
        onToggleDyslexia={toggleDyslexia}
        onToggleTint={toggleTint}
        onToggleBionic={toggleBionic}
        onToggleAlternateLines={toggleAlternateLines}
        onToggleTTS={toggleTTS}
        onTogglePause={togglePause}
        onStopTTS={stopReading}
        onStartVoice={startVoiceControl}
        onUpdateSampleText={handleUpdateSampleText}
        onTriggerSummarize={() => generateSummary()}
        onSimulateVoiceCommand={handleAppVoiceCommand}
      >
        {popupCard}
      </ShowcaseView>
    );
  }

  return (
    <div className="min-h-screen">
      {popupCard}
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={`flex-1 flex flex-col items-center justify-center py-3 gap-1 text-[11px] font-medium transition-colors ${
        active ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400 bg-indigo-50/30 dark:bg-indigo-900/20' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-700 dark:hover:text-slate-300'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function ToggleRow({ icon, title, desc, checked, onChange }: { icon: React.ReactNode, title: string, desc: string, checked: boolean, onChange: () => void }) {
  return (
    <div className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm hover:border-indigo-200 dark:hover:border-indigo-500/50 transition-colors cursor-pointer" onClick={onChange}>
      <div className="flex items-center gap-3">
        <div className="p-2 bg-slate-50 dark:bg-slate-700/50 rounded-lg">{icon}</div>
        <div>
          <div className="font-medium text-slate-800 dark:text-slate-200 text-sm">{title}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">{desc}</div>
        </div>
      </div>
      
      {/* Toggle switch */}
      <div className={`w-11 h-6 rounded-full transition-colors flex items-center ${checked ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-600'}`}>
        <div className={`w-4 h-4 rounded-full bg-white shadow-sm transform transition-transform mx-1 ${checked ? 'translate-x-5' : 'translate-x-0'}`}></div>
      </div>
    </div>
  );
}
