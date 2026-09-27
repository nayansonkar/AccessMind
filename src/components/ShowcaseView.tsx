import React, { useState, useEffect } from 'react';
import { 
  Download, 
  ExternalLink, 
  Sparkles, 
  BookOpen, 
  HelpCircle, 
  Check, 
  Copy, 
  Volume2, 
  Mic, 
  Laptop, 
  Zap, 
  SunMoon, 
  Type, 
  FileText, 
  CheckCircle2, 
  X,
  Play,
  Pause,
  Square,
  RefreshCw
} from 'lucide-react';
import { downloadExtensionZip } from '../utils/extensionDownloader';
import { extAPI } from '../utils/chromeMock';

interface ShowcaseViewProps {
  children: React.ReactNode;
  dyslexiaOn: boolean;
  tintOn: boolean;
  bionicOn: boolean;
  alternateLinesOn: boolean;
  reading: boolean;
  isPaused: boolean;
  readProgress: number;
  speechRate: number;
  darkMode: boolean;
  onToggleDyslexia: () => void;
  onToggleTint: () => void;
  onToggleBionic: () => void;
  onToggleAlternateLines: () => void;
  onToggleTTS: () => void;
  onTogglePause: () => void;
  onStopTTS: () => void;
  onStartVoice: () => void;
  onUpdateSampleText: (text: string, title: string) => void;
  onTriggerSummarize: () => void;
  onSimulateVoiceCommand?: (cmd: string) => void;
}

const SAMPLE_DOCS = [
  {
    id: 'guide',
    title: 'Cognitive Ergonomics & Web Accessibility Guide',
    tag: 'Web Accessibility',
    author: 'AccessMind Research Group',
    readTime: '4 min read',
    content: `Chapter 1: Understanding Cognitive Ergonomics in Digital Interfaces

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

Combining simultaneous visual reading with natural text-to-speech doubles comprehension rates. By leveraging native Chrome TTS with zero latency and spacebar push-to-talk voice commands, readers navigate and interact with complex content completely hands-free.`
  },
  {
    id: 'deepwork',
    title: 'Focus Strategies & Low-Friction Information Processing',
    tag: 'Cognitive Science',
    author: 'Dr. Elena Vance, Cognitive Neuroscientist',
    readTime: '3 min read',
    content: `The Architecture of Focused Attention

Attention is not a static reserve; it is an active filter constantly filtering extraneous visual noise. When an interface contains cluttered sidebars, inconsistent column widths, and low-contrast palettes, the prefrontal cortex spends precious executive energy filtering distractions rather than absorbing concepts.

Key Principles for Cognitive Accessibility:
• Zero-Resistance Voice Navigation: Eliminating manual clicks and context-switching through push-to-talk speech control allows thought-speed exploration.
• Instant Key Takeaways: Instead of wading through pages of verbose text, AI synthesis condenses complex arguments into actionable bulleted insights.
• Multi-Modal Pacing: Adjusting speech rate between 0.8x and 1.5x allows readers to match information intake to their personal cognitive tempo.

When technology adapts to human neurology rather than forcing humans to adapt to rigid interfaces, learning becomes universally accessible.`
  },
  {
    id: 'pdf-sample',
    title: 'Research Paper: Multi-Modal Reading Ergonomics & Assistive Technology.pdf',
    tag: 'PDF Document (3 Pages)',
    author: 'Journal of Neurodiversity & Assistive Tech',
    readTime: '5 min read',
    content: `--- Page 1 ---
Research Paper: Multi-Modal Reading Ergonomics & Assistive Technology

Abstract:
We present an empirical study evaluating the effectiveness of multi-modal cognitive reading aids—specifically OpenDyslexic typography, Irlen chromatic attenuation (Sepia Tint), Saccadic Guidance (Bionic Reading fixations), and dynamic horizontal Line Rulers—across academic documents and PDF research papers.

1. Introduction
Portable Document Format (PDF) files constitute over 65% of all scholarly and technical reading materials. However, traditional PDF viewers lack native accommodations for readers with visual stress, dyslexia, ADHD, or visual crowding. In this study, we investigate the quantifiable benefits of real-time cognitive overlays applied to PDF documents.

--- Page 2 ---
2. Experimental Methodology
Participants (N=142) were assigned reading comprehension tasks on identical academic PDF articles under four distinct conditions:
• Condition A: Standard Times New Roman rendering without assistive filters.
• Condition B: Bionic Saccadic Guidance bolding on word-initial phonemes.
• Condition C: Chromatic warm sepia tinting (55% attenuation) combined with OpenDyslexic weighted font.
• Condition D: Full-spectrum assistance including active tracking Line Ruler.

Results demonstrate a 38.4% reduction in saccadic regression errors under Condition B, and a 42.1% decrease in subjective visual fatigue scores under Condition C. When readers engaged simultaneous zero-latency speech narration, reading comprehension scores increased by 2.3 standard deviations.

--- Page 3 ---
3. Discussion & Clinical Implications
The findings confirm that cognitive accessibility features must not be restricted to simple HTML web pages; they must function with equal fidelity across PDF documents and digital manuscripts. 

Conclusion:
Implementing assistive typographic weights, chromatic tinting, word-fixation bolding, and physical line guides transforms static PDF documents into barrier-free cognitive environments.`
  }
];

export default function ShowcaseView({
  children,
  dyslexiaOn,
  tintOn,
  bionicOn,
  alternateLinesOn,
  reading,
  isPaused,
  readProgress,
  speechRate,
  darkMode,
  onToggleDyslexia,
  onToggleTint,
  onToggleBionic,
  onToggleAlternateLines,
  onToggleTTS,
  onTogglePause,
  onStopTTS,
  onStartVoice,
  onUpdateSampleText,
  onTriggerSummarize,
  onSimulateVoiceCommand
}: ShowcaseViewProps) {
  const [selectedDocId, setSelectedDocId] = useState('guide');
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [copiedShortcut, setCopiedShortcut] = useState(false);
  const [customText, setCustomText] = useState('');
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [pdfViewMode, setPdfViewMode] = useState<'sheets' | 'flow'>('sheets');
  const [mobileTab, setMobileTab] = useState<'both' | 'doc' | 'popup'>('both');

  const currentDoc = SAMPLE_DOCS.find(d => d.id === selectedDocId) || SAMPLE_DOCS[0];
  const activeContent = isCustomMode ? (customText || "Paste or type your text here to test AccessMind.") : currentDoc.content;
  const activeTitle = isCustomMode ? "Custom Document" : currentDoc.title;

  useEffect(() => {
    onUpdateSampleText(activeContent, activeTitle);
  }, [selectedDocId, isCustomMode, customText]);

  useEffect(() => {
    const listener = (msg: any) => {
      if (msg.action === 'togglePdfOverlay') {
        setIsCustomMode(false);
        setSelectedDocId('pdf-sample');
        setMobileTab('doc');
      }
    };
    extAPI.runtime.onMessage.addListener(listener);
    return () => extAPI.runtime.onMessage.removeListener(listener);
  }, []);

  const handleDownloadZip = async () => {
    setDownloadingZip(true);
    await downloadExtensionZip();
    setDownloadingZip(false);
  };

  const copyInstallSteps = () => {
    const steps = `1. Download and unzip AccessMind-Chrome-Extension.zip\n2. Open Google Chrome and go to chrome://extensions\n3. Enable "Developer mode" in the top-right corner\n4. Click "Load unpacked" and select the unzipped folder\n5. AccessMind is now ready! Pin it to your toolbar.`;
    navigator.clipboard?.writeText(steps);
    setCopiedShortcut(true);
    setTimeout(() => setCopiedShortcut(false), 2500);
  };

  // Render text with optional Bionic Reading formatting
  const renderDocumentContent = (text: string) => {
    const paragraphs = text.split('\n\n');
    return paragraphs.map((para, pIdx) => {
      const pageMatch = para.trim().match(/^---\s*Page\s*(\d+)\s*---/i);
      if (pageMatch) {
        return (
          <div key={pIdx} className="my-5 pt-3 pb-1 border-t-2 border-dashed border-indigo-200 dark:border-indigo-800/80 flex items-center justify-between text-xs font-mono text-indigo-600 dark:text-indigo-400">
            <span className="font-bold flex items-center gap-1.5 uppercase tracking-wider">
              <span>📄</span> PDF Page {pageMatch[1]}
            </span>
            <span className="text-[10px] bg-indigo-50 dark:bg-indigo-950/80 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800 font-semibold">
              Live Accessibility Overlay Active
            </span>
          </div>
        );
      }
      if (para.trim().startsWith('•') || para.trim().match(/^\d+\./)) {
        return (
          <div key={pIdx} className="my-2.5 pl-4 border-l-2 border-indigo-400/40">
            {renderParagraphText(para)}
          </div>
        );
      }
      return (
        <p key={pIdx} className="mb-4 text-[15px] leading-relaxed">
          {renderParagraphText(para)}
        </p>
      );
    });
  };

  const renderParagraphText = (para: string) => {
    if (!bionicOn) {
      return para;
    }
    return para.split(/(\s+)/).map((segment, sIdx) => {
      if (!segment.trim()) return segment;
      const mid = Math.ceil(segment.length / 2);
      return (
        <React.Fragment key={sIdx}>
          <b className="font-extrabold text-slate-900 dark:text-white">{segment.slice(0, mid)}</b>
          <span>{segment.slice(mid)}</span>
        </React.Fragment>
      );
    });
  };

  const renderPdfToolbar = () => (
    <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-200 dark:border-slate-800 p-3 flex flex-wrap items-center justify-between gap-3 shadow-xs">
      <div className="flex items-center gap-2.5">
        <span className="bg-rose-500 text-white font-extrabold text-[10px] px-2 py-0.5 rounded shadow-xs uppercase tracking-wider">
          PDF
        </span>
        <div>
          <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>Multi-Modal Reading Ergonomics & Assistive Tech.pdf</span>
            <span className="text-[10px] font-mono text-slate-400 font-normal">3 Pages · Academic Paper</span>
          </div>
          <div className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium flex items-center gap-1.5 mt-0.5">
            <Sparkles className="w-3 h-3" />
            <span>Interactive Accessibility Layer: Changes apply directly onto PDF sheets</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {/* Audio / Read Button */}
        <button
          onClick={onToggleTTS}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
            reading 
              ? 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 border border-rose-300/60 dark:border-rose-700/60'
              : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs'
          }`}
          title="Start zero-latency speech narration of PDF"
        >
          {reading ? <Square className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
          <span>{reading ? 'Stop Audio' : 'Read PDF'}</span>
        </button>

        {reading && (
          <button
            onClick={onTogglePause}
            className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700 cursor-pointer"
            title={isPaused ? "Resume" : "Pause"}
          >
            {isPaused ? <Play className="w-3.5 h-3.5 fill-current" /> : <Pause className="w-3.5 h-3.5 fill-current" />}
          </button>
        )}

        {/* Summarize Button */}
        <button
          onClick={onTriggerSummarize}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 transition flex items-center gap-1.5 cursor-pointer"
          title="Generate structured cognitive summary of PDF"
        >
          <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
          <span>Summarize PDF</span>
        </button>

        {/* Quick Toggles */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg text-xs">
          <button
            onClick={onToggleDyslexia}
            className={`px-2 py-1 rounded transition font-medium flex items-center gap-1 cursor-pointer ${
              dyslexiaOn ? 'bg-blue-600 text-white font-bold shadow-2xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
            title="Toggle OpenDyslexic font"
          >
            <span>🔤 Dyslexia</span>
          </button>
          <button
            onClick={onToggleBionic}
            className={`px-2 py-1 rounded transition font-medium flex items-center gap-1 cursor-pointer ${
              bionicOn ? 'bg-indigo-600 text-white font-bold shadow-2xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
            title="Toggle Bionic fixation bolding"
          >
            <span>👁️ Bionic</span>
          </button>
          <button
            onClick={onToggleTint}
            className={`px-2 py-1 rounded transition font-medium flex items-center gap-1 cursor-pointer ${
              tintOn ? 'bg-amber-600 text-white font-bold shadow-2xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
            title="Toggle warm Sepia / Irlen tint"
          >
            <span>🎨 Tint</span>
          </button>
          <button
            onClick={onToggleAlternateLines}
            className={`px-2 py-1 rounded transition font-medium flex items-center gap-1 cursor-pointer ${
              alternateLinesOn ? 'bg-emerald-600 text-white font-bold shadow-2xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
            title="Toggle horizontal reading ruler"
          >
            <span>📏 Ruler</span>
          </button>
        </div>

        {/* Sheets vs Flow Switcher */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg text-xs">
          <button
            onClick={() => setPdfViewMode('sheets')}
            className={`px-2 py-1 rounded font-medium transition cursor-pointer ${pdfViewMode === 'sheets' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 font-bold shadow-xs' : 'text-slate-600 dark:text-slate-400'}`}
            title="Discrete academic document sheets"
          >
            <span>📄 Sheets</span>
          </button>
          <button
            onClick={() => setPdfViewMode('flow')}
            className={`px-2 py-1 rounded font-medium transition cursor-pointer ${pdfViewMode === 'flow' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 font-bold shadow-xs' : 'text-slate-600 dark:text-slate-400'}`}
            title="Continuous reading flow"
          >
            <span>📑 Flow</span>
          </button>
        </div>
      </div>
    </div>
  );

  const renderPdfFormattedDocument = () => {
    // Shared sheet styling based on active accessibility state
    const sheetClass = `rounded-xl border p-7 sm:p-9 shadow-md transition-all duration-300 relative overflow-hidden ${
      tintOn 
        ? 'bg-[#fdf6e3] text-[#2c2518] border-amber-300/80 shadow-amber-900/10' 
        : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 border-slate-300 dark:border-slate-700'
    } ${dyslexiaOn ? 'font-dyslexia tracking-wide' : ''}`;

    const sheetStyle = dyslexiaOn 
      ? { fontFamily: '"OpenDyslexic", "Lexend", "Comic Sans MS", sans-serif', letterSpacing: '0.035em', wordSpacing: '0.06em' } 
      : {};

    const rulerGuide = alternateLinesOn && (
      <div 
        className="pointer-events-none absolute inset-0 z-0 opacity-20"
        style={{
          backgroundImage: 'repeating-linear-gradient(rgba(79, 70, 229, 0.4) 0px, rgba(79, 70, 229, 0.4) 28px, transparent 28px, transparent 56px)'
        }}
      />
    );

    if (pdfViewMode === 'flow') {
      return (
        <div className="space-y-4">
          {renderPdfToolbar()}

          <article className={sheetClass} style={sheetStyle}>
            {rulerGuide}
            <div className="relative z-10">
              <div className="border-b border-slate-200/80 dark:border-slate-800 pb-4 mb-6">
                <span className="text-[10px] uppercase font-bold tracking-widest text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/80 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
                  ORIGINAL RESEARCH ARTICLE · CONTINUOUS FLOW
                </span>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white mt-2.5 mb-2 leading-tight">
                  {renderParagraphText("Research Paper: Multi-Modal Reading Ergonomics & Assistive Technology")}
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  By {currentDoc.author}
                </p>
              </div>
              <div className="prose dark:prose-invert max-w-none">
                {renderDocumentContent(activeContent)}
              </div>
            </div>
          </article>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {renderPdfToolbar()}

        {/* Page 1 Sheet */}
        <div className={sheetClass} style={sheetStyle}>
          {rulerGuide}
          <div className="relative z-10">
            {/* Running header */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2 mb-6 text-[10px] font-mono uppercase tracking-wider text-slate-400">
              <span>JOURNAL OF NEURODIVERSITY & ASSISTIVE TECH · VOL. 14, NO. 2 · PEER REVIEWED</span>
              <span className="font-bold text-indigo-600 dark:text-indigo-400">PAGE 1 OF 3</span>
            </div>

            <div className="mb-6">
              <span className="text-[10px] uppercase font-bold tracking-widest text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/80 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
                ORIGINAL RESEARCH ARTICLE
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white mt-2.5 mb-2 leading-tight">
                {renderParagraphText("Research Paper: Multi-Modal Reading Ergonomics & Assistive Technology")}
              </h1>
              <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                {renderParagraphText("Dr. Elena Vance, Ph.D.¹, Dr. Marcus Chen, M.D.² · ¹Cognitive Accessibility Lab, ²Institute for Human-Computer Interaction")}
              </p>
              <p className="text-[11px] text-slate-400 mt-1 font-mono">
                DOI: 10.1016/j.jneuroassist.2026.04.112 · Open Access Creative Commons Attribution 4.0
              </p>
            </div>

            {/* Abstract Box */}
            <div className={`p-4 rounded-xl mb-6 border ${tintOn ? 'bg-amber-100/40 border-amber-300/80' : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/80'}`}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-600 text-white">
                  ABSTRACT
                </span>
                <span className="text-[11px] text-slate-500">Peer-Reviewed Empirical Study</span>
              </div>
              <p className="text-sm leading-relaxed mb-2.5">
                {renderParagraphText("We present an empirical study evaluating the effectiveness of multi-modal cognitive reading aids—specifically OpenDyslexic typography, Irlen chromatic attenuation (Sepia Tint), Saccadic Guidance (Bionic Reading fixations), and dynamic horizontal Line Rulers—across academic documents and PDF research papers.")}
              </p>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                <b className="font-semibold text-slate-700 dark:text-slate-200">Keywords: </b>
                Cognitive Ergonomics · Dyslexia Accessibility · Saccadic Fixation · Irlen Syndrome · Multi-Modal Reading · PDF Accessibility
              </div>
            </div>

            {/* Section 1 */}
            <div className="space-y-3">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-1.5 flex items-center gap-2">
                <span className="text-indigo-600 dark:text-indigo-400">1.</span>
                <span>{renderParagraphText("Introduction & Background")}</span>
              </h2>
              <p className="text-sm leading-relaxed">
                {renderParagraphText("Portable Document Format (PDF) files constitute over 65% of all scholarly and technical reading materials. However, traditional PDF viewers lack native accommodations for readers with visual stress, dyslexia, ADHD, or visual crowding. In this study, we investigate the quantifiable benefits of real-time cognitive overlays applied to PDF documents.")}
              </p>
              <p className="text-sm leading-relaxed">
                {renderParagraphText("Traditional solutions require converting PDFs into raw, unformatted text files, which completely strips away academic layout, figure relationships, and mathematical matrices. AccessMind preserves full document layout fidelity while injecting real-time neurodivergent reading adaptations directly onto the document canvas.")}
              </p>
            </div>

            {/* Page 1 footer */}
            <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 pt-3 mt-8 text-[10px] font-mono text-slate-400">
              <span>Journal of Neurodiversity & Assistive Tech · ISSN 2411-9822</span>
              <span>Page 1 of 3</span>
            </div>
          </div>
        </div>

        {/* Page 2 Sheet */}
        <div className={sheetClass} style={sheetStyle}>
          {rulerGuide}
          <div className="relative z-10">
            {/* Running header */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2 mb-6 text-[10px] font-mono uppercase tracking-wider text-slate-400">
              <span>RESEARCH ARTICLE · EXPERIMENTAL METHODOLOGY & QUANTITATIVE FINDINGS</span>
              <span className="font-bold text-indigo-600 dark:text-indigo-400">PAGE 2 OF 3</span>
            </div>

            <div className="space-y-4">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-1.5 flex items-center gap-2">
                <span className="text-indigo-600 dark:text-indigo-400">2.</span>
                <span>{renderParagraphText("Experimental Methodology & Testing Matrix")}</span>
              </h2>
              <p className="text-sm leading-relaxed">
                {renderParagraphText("Participants (N=142) were assigned reading comprehension tasks on identical academic PDF articles under four distinct conditions:")}
              </p>

              {/* 4 Conditions Comparison Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-3">
                <div className={`p-3.5 rounded-xl border ${tintOn ? 'bg-amber-50/60 border-amber-300' : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'}`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-xs text-slate-700 dark:text-slate-300">Condition A</span>
                    <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-slate-600 dark:text-slate-300 font-semibold">Baseline Control</span>
                  </div>
                  <p className="text-xs leading-normal">
                    {renderParagraphText("Standard Times New Roman rendering without assistive filters or typographic adjustments.")}
                  </p>
                </div>

                <div className={`p-3.5 rounded-xl border ${tintOn ? 'bg-amber-50/60 border-amber-300' : 'bg-indigo-50/50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800'}`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-xs text-indigo-700 dark:text-indigo-300">Condition B</span>
                    <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-900 rounded text-indigo-700 dark:text-indigo-300 font-semibold">Bionic Reading</span>
                  </div>
                  <p className="text-xs leading-normal">
                    {renderParagraphText("Saccadic Guidance bolding on word-initial phonemes, locking visual cortex anchors.")}
                  </p>
                </div>

                <div className={`p-3.5 rounded-xl border ${tintOn ? 'bg-amber-100/50 border-amber-400' : 'bg-amber-50/50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800'}`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-xs text-amber-800 dark:text-amber-200">Condition C</span>
                    <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900 rounded text-amber-800 dark:text-amber-200 font-semibold">Tint & Dyslexia</span>
                  </div>
                  <p className="text-xs leading-normal">
                    {renderParagraphText("Chromatic warm sepia tinting (55% attenuation) combined with OpenDyslexic weighted font.")}
                  </p>
                </div>

                <div className={`p-3.5 rounded-xl border ${tintOn ? 'bg-emerald-50/60 border-emerald-300' : 'bg-emerald-50/50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800'}`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-xs text-emerald-700 dark:text-emerald-300">Condition D</span>
                    <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-900 rounded text-emerald-700 dark:text-emerald-300 font-semibold">Full Support</span>
                  </div>
                  <p className="text-xs leading-normal">
                    {renderParagraphText("Full-spectrum assistance including active horizontal Line Ruler and simultaneous voice narration.")}
                  </p>
                </div>
              </div>

              {/* Quantitative Results Card */}
              <div className={`p-4 rounded-xl border mt-4 ${tintOn ? 'bg-amber-100/30 border-amber-300' : 'bg-slate-100/80 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700'}`}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-600 text-white">
                    EMPIRICAL RESULTS
                  </span>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-100">Key Statistical Metrics</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
                  <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                    <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400">38.4%</div>
                    <div className="text-[11px] text-slate-500 font-medium mt-0.5">Reduction in Saccadic Errors (Bionic)</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                    <div className="text-2xl font-black text-amber-600 dark:text-amber-400">42.1%</div>
                    <div className="text-[11px] text-slate-500 font-medium mt-0.5">Decrease in Visual Fatigue (Sepia)</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                    <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">+2.3 SD</div>
                    <div className="text-[11px] text-slate-500 font-medium mt-0.5">Comprehension Gain with Speech</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Page 2 footer */}
            <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 pt-3 mt-8 text-[10px] font-mono text-slate-400">
              <span>Journal of Neurodiversity & Assistive Tech · ISSN 2411-9822</span>
              <span>Page 2 of 3</span>
            </div>
          </div>
        </div>

        {/* Page 3 Sheet */}
        <div className={sheetClass} style={sheetStyle}>
          {rulerGuide}
          <div className="relative z-10">
            {/* Running header */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2 mb-6 text-[10px] font-mono uppercase tracking-wider text-slate-400">
              <span>RESEARCH ARTICLE · DISCUSSION, CLINICAL IMPLICATIONS & CONCLUSIONS</span>
              <span className="font-bold text-indigo-600 dark:text-indigo-400">PAGE 3 OF 3</span>
            </div>

            <div className="space-y-4">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-1.5 flex items-center gap-2">
                <span className="text-indigo-600 dark:text-indigo-400">3.</span>
                <span>{renderParagraphText("Discussion & Clinical Implications")}</span>
              </h2>
              <p className="text-sm leading-relaxed">
                {renderParagraphText("The findings confirm that cognitive accessibility features must not be restricted to simple HTML web pages; they must function with equal fidelity across PDF documents and digital manuscripts.")}
              </p>
              <p className="text-sm leading-relaxed">
                {renderParagraphText("When assistive overlays adapt dynamically onto the PDF canvas itself, readers report an immediate elimination of visual crowding. The ability to listen to an immersive Visual Audio Narration while scanning the document enables dual-channel sensory processing, which significantly boosts retention.")}
              </p>

              <h2 className="text-lg font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-1.5 flex items-center gap-2 pt-2">
                <span className="text-indigo-600 dark:text-indigo-400">4.</span>
                <span>{renderParagraphText("Conclusion")}</span>
              </h2>
              <p className="text-sm leading-relaxed">
                {renderParagraphText("Implementing assistive typographic weights, chromatic tinting, word-fixation bolding, and physical line guides transforms static PDF documents into barrier-free cognitive environments.")}
              </p>

              {/* References box */}
              <div className={`p-4 rounded-xl border mt-4 ${tintOn ? 'bg-amber-100/30 border-amber-300' : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/60'}`}>
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Select References & Standards Compliance
                </div>
                <div className="text-xs space-y-1.5 font-mono text-slate-600 dark:text-slate-400">
                  <div>1. Vance, E. (2025). Visual Stress and Digital Typography in Cognitive Ergonomics. Neurotech Press.</div>
                  <div>2. Chen, M., & Rossi, G. (2024). Saccadic Velocity in Assistive Reading Interfaces. IEEE Transactions on Neural Systems.</div>
                  <div>3. W3C WCAG 2.2 Cognitive and Learning Disabilities Accessibility Guidelines (Section 3.1).</div>
                </div>
              </div>
            </div>

            {/* Page 3 footer */}
            <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 pt-3 mt-8 text-[10px] font-mono text-slate-400">
              <span>End of Research Paper · AccessMind Universal Accessibility</span>
              <span>Page 3 of 3</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`min-h-screen flex flex-col font-sans transition-colors ${darkMode ? 'dark bg-slate-950 text-slate-100' : 'bg-slate-100 text-slate-900'}`}>
      
      {/* Top Banner Header */}
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 lg:px-8 py-3.5 shadow-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <Zap className="w-5 h-5 fill-current" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">AccessMind</h1>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700/50">
                  Chrome Extension V3
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
                Zero-Friction Cognitive Accessibility & Speech Narration Simulator
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setShowInstallGuide(true)}
              className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 transition flex items-center gap-1.5 shadow-xs"
              title="How to install in Chrome"
            >
              <HelpCircle className="w-3.5 h-3.5 text-indigo-500" />
              <span className="hidden md:inline">Install in Chrome</span>
              <span className="md:hidden">Guide</span>
            </button>

            <button
              onClick={handleDownloadZip}
              disabled={downloadingZip}
              className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition flex items-center gap-1.5 shadow-sm shadow-indigo-600/25 disabled:opacity-50 cursor-pointer"
              title="Download unpacked ready-to-load extension zip"
            >
              <Download className={`w-3.5 h-3.5 ${downloadingZip ? 'animate-bounce' : ''}`} />
              <span>{downloadingZip ? 'Generating ZIP...' : 'Download (.zip)'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile / Compact Responsive View Switcher */}
      <div className="lg:hidden px-4 pt-3 flex items-center justify-center">
        <div className="bg-slate-200 dark:bg-slate-800 p-1 rounded-xl flex items-center text-xs font-semibold shadow-xs">
          <button
            onClick={() => setMobileTab('doc')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              mobileTab === 'doc'
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            📄 Document Canvas
          </button>
          <button
            onClick={() => setMobileTab('popup')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              mobileTab === 'popup'
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            🧠 Extension Popup
          </button>
          <button
            onClick={() => setMobileTab('both')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              mobileTab === 'both'
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            📱 Both Views
          </button>
        </div>
      </div>

      {/* Main Split-Screen Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT 7-COL: Interactive Sample Webpage & PDF Canvas */}
        <section className={`lg:col-span-7 flex flex-col gap-4 ${mobileTab === 'popup' ? 'hidden lg:flex' : 'flex'}`}>
          
          {/* Document Controls & Switcher */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3.5 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl text-xs font-medium">
              <button
                onClick={() => { setIsCustomMode(false); setSelectedDocId('guide'); }}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${!isCustomMode && selectedDocId === 'guide' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 font-semibold shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'}`}
              >
                Web Article 1
              </button>
              <button
                onClick={() => { setIsCustomMode(false); setSelectedDocId('deepwork'); }}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${!isCustomMode && selectedDocId === 'deepwork' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 font-semibold shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'}`}
              >
                Web Study 2
              </button>
              <button
                onClick={() => { setIsCustomMode(false); setSelectedDocId('pdf-sample'); }}
                className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer ${!isCustomMode && selectedDocId === 'pdf-sample' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 font-semibold shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'}`}
              >
                <FileText className="w-3.5 h-3.5 text-rose-500" />
                <span>PDF Document (3 Pages)</span>
              </button>
              <button
                onClick={() => setIsCustomMode(true)}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${isCustomMode ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 font-semibold shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'}`}
              >
                Custom Text
              </button>
            </div>

            {/* Quick action bar */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={onToggleTTS}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                  reading 
                    ? 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 border border-rose-300/60 dark:border-rose-700/60'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs'
                }`}
                title="Trigger Reading"
              >
                {reading ? <Square className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                <span>{reading ? 'Stop Audio' : selectedDocId === 'pdf-sample' ? 'Read PDF' : 'Read Page'}</span>
              </button>

              {reading && (
                <button
                  onClick={onTogglePause}
                  className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700 cursor-pointer"
                  title={isPaused ? "Resume" : "Pause"}
                >
                  {isPaused ? <Play className="w-3.5 h-3.5 fill-current" /> : <Pause className="w-3.5 h-3.5 fill-current" />}
                </button>
              )}

              <button
                onClick={onTriggerSummarize}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 transition flex items-center gap-1.5 cursor-pointer"
                title="Summarize document"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                <span>Summarize</span>
              </button>
            </div>
          </div>

          {/* Interactive Live Page Filters Ribbon (Clickable!) */}
          <div className="flex flex-wrap items-center gap-2 text-xs bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
            <span className="text-slate-500 dark:text-slate-400 text-[11px] font-semibold mr-1">
              ✨ Live Page Filters (Click to Toggle):
            </span>
            <button
              onClick={onToggleDyslexia}
              className={`px-2.5 py-1 rounded-lg font-semibold text-[11px] border transition cursor-pointer flex items-center gap-1.5 ${
                dyslexiaOn 
                  ? 'bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700 shadow-xs' 
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 border-slate-200 dark:border-slate-700'
              }`}
              title="Click to toggle OpenDyslexic / Lexend typography"
            >
              <span>🔤 Dyslexia Font:</span>
              <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${dyslexiaOn ? 'bg-blue-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}>
                {dyslexiaOn ? 'ON' : 'OFF'}
              </span>
            </button>

            <button
              onClick={onToggleBionic}
              className={`px-2.5 py-1 rounded-lg font-semibold text-[11px] border transition cursor-pointer flex items-center gap-1.5 ${
                bionicOn 
                  ? 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700 shadow-xs' 
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 border-slate-200 dark:border-slate-700'
              }`}
              title="Click to toggle Bionic Reading word-root fixation bolding"
            >
              <span>👁️ Bionic:</span>
              <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${bionicOn ? 'bg-indigo-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}>
                {bionicOn ? 'ON' : 'OFF'}
              </span>
            </button>

            <button
              onClick={onToggleTint}
              className={`px-2.5 py-1 rounded-lg font-semibold text-[11px] border transition cursor-pointer flex items-center gap-1.5 ${
                tintOn 
                  ? 'bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-700 shadow-xs' 
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 border-slate-200 dark:border-slate-700'
              }`}
              title="Click to toggle warm Sepia / Irlen parchment background"
            >
              <span>🎨 Sepia Tint:</span>
              <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${tintOn ? 'bg-amber-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}>
                {tintOn ? 'ON' : 'OFF'}
              </span>
            </button>

            <button
              onClick={onToggleAlternateLines}
              className={`px-2.5 py-1 rounded-lg font-semibold text-[11px] border transition cursor-pointer flex items-center gap-1.5 ${
                alternateLinesOn 
                  ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700 shadow-xs' 
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 border-slate-200 dark:border-slate-700'
              }`}
              title="Click to toggle reading ruler guides"
            >
              <span>📏 Reading Ruler:</span>
              <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${alternateLinesOn ? 'bg-emerald-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}>
                {alternateLinesOn ? 'ON' : 'OFF'}
              </span>
            </button>
          </div>

          {/* Quick Voice Simulation Bar */}
          {onSimulateVoiceCommand && (
            <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 px-3 py-2 rounded-xl text-xs flex flex-wrap items-center gap-2 shadow-2xs">
              <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                <Mic className="w-3.5 h-3.5" />
                <span>Simulate Voice:</span>
              </span>
              <div className="flex flex-wrap items-center gap-1">
                {[
                  { label: "Read Page", cmd: "read page" },
                  { label: "Pause", cmd: "pause" },
                  { label: "Resume", cmd: "resume" },
                  { label: "Summarize", cmd: "summarize" },
                  { label: "Dyslexia", cmd: "dyslexia" },
                  { label: "Bionic", cmd: "bionic" },
                  { label: "Sepia Tint", cmd: "sepia tint" },
                  { label: "Ruler", cmd: "ruler" },
                  { label: "Stop", cmd: "stop" }
                ].map((item) => (
                  <button
                    key={item.cmd}
                    onClick={() => onSimulateVoiceCommand(item.cmd)}
                    className="px-2 py-0.5 rounded bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-900/40 hover:text-indigo-600 dark:hover:text-indigo-300 border border-slate-200 dark:border-slate-600 text-[10px] font-medium transition cursor-pointer"
                  >
                    "{item.label}"
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Reading Progress Indicator */}
          {reading && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-xl shadow-xs">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="flex items-center gap-2 font-semibold text-indigo-600 dark:text-indigo-400">
                  <Volume2 className="w-3.5 h-3.5 animate-pulse" />
                  <span>{isPaused ? 'Speech Paused' : `Reading at ${speechRate.toFixed(1)}x speed...`}</span>
                </span>
                <span className="font-mono text-slate-500">{Math.round(readProgress)}%</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-300 ${isPaused ? 'bg-amber-500' : 'bg-indigo-600'}`}
                  style={{ width: `${readProgress}%` }}
                ></div>
              </div>
            </div>
          )}

          {/* Document Display Canvas */}
          {selectedDocId === 'pdf-sample' && !isCustomMode ? (
            renderPdfFormattedDocument()
          ) : (
            <article 
              className={`rounded-2xl border p-6 sm:p-8 shadow-sm transition-all duration-300 relative overflow-hidden min-h-[500px] ${
                tintOn 
                  ? 'bg-[#fdf6e3] text-[#2c2518] border-amber-300/70 shadow-amber-900/5' 
                  : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 border-slate-200 dark:border-slate-800'
              } ${dyslexiaOn ? 'font-dyslexia tracking-wide' : ''}`}
              style={dyslexiaOn ? { fontFamily: '"OpenDyslexic", "Lexend", "Comic Sans MS", sans-serif', letterSpacing: '0.035em', wordSpacing: '0.06em' } : {}}
            >
              {/* Reading Ruler Background guides */}
              {alternateLinesOn && (
                <div 
                  className="pointer-events-none absolute inset-0 z-0 opacity-20"
                  style={{
                    backgroundImage: 'repeating-linear-gradient(rgba(79, 70, 229, 0.4) 0px, rgba(79, 70, 229, 0.4) 28px, transparent 28px, transparent 56px)'
                  }}
                />
              )}

              <div className="relative z-10">
                {isCustomMode ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                      <h2 className="text-xl font-bold tracking-tight">Custom Text Reader Canvas</h2>
                      <span className="text-xs text-slate-400">Edit below to test filters</span>
                    </div>
                    <textarea
                      value={customText}
                      onChange={(e) => setCustomText(e.target.value)}
                      placeholder="Paste any article, notes, or chapter here to test AccessMind's cognitive filters, TTS speech narration, and Gemini AI summaries..."
                      rows={12}
                      className="w-full p-4 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y leading-relaxed"
                    />
                    <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                      <h3 className="text-xs uppercase font-bold text-slate-400 mb-2">Live Formatted Preview:</h3>
                      {renderDocumentContent(customText || "No text entered yet.")}
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Article Metadata */}
                    <div className="border-b border-slate-200/80 dark:border-slate-800 pb-4 mb-6">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300">
                          {currentDoc.tag}
                        </span>
                        <span className="text-xs text-slate-400">{currentDoc.readTime}</span>
                      </div>
                      <h2 className="text-2xl font-extrabold tracking-tight mb-1 text-slate-900 dark:text-white">
                        {currentDoc.title}
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        By {currentDoc.author}
                      </p>
                    </div>

                    {/* Render Body */}
                    <div className="prose dark:prose-invert max-w-none">
                      {renderDocumentContent(activeContent)}
                    </div>
                  </>
                )}
              </div>
            </article>
          )}
        </section>

        {/* RIGHT 5-COL: AccessMind Chrome Extension Popup Frame */}
        <aside className={`lg:col-span-5 flex flex-col items-center lg:items-end w-full ${mobileTab === 'doc' ? 'hidden lg:flex' : 'flex'}`}>
          <div className="sticky top-20 w-full max-w-[370px]">
            {/* Chrome Browser Toolbar Frame simulation */}
            <div className="bg-slate-200 dark:bg-slate-800 rounded-t-2xl px-3.5 py-2.5 flex items-center justify-between border border-b-0 border-slate-300 dark:border-slate-700 shadow-sm">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-rose-400"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-amber-400"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400"></div>
              </div>
              <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <span>chrome://extensions/accessmind</span>
              </div>
              <div className="flex items-center gap-1 text-slate-400">
                <span className="text-[10px] font-semibold bg-slate-300 dark:bg-slate-700 px-1.5 py-0.5 rounded">V3</span>
              </div>
            </div>

            {/* Extension Popup Container */}
            <div className="bg-white dark:bg-slate-900 rounded-b-2xl border border-slate-300 dark:border-slate-700 shadow-2xl overflow-hidden">
              {children}
            </div>

            {/* Quick Keyboard Tip Card below popup */}
            <div className="mt-4 p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 shadow-xs">
              <div className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                <Mic className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>Hands-Free Spacebar Push-to-Talk</span>
              </div>
              <p className="text-[11px] leading-relaxed mb-2">
                In Chrome, hold down the <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-mono text-[10px]">Spacebar</kbd> anywhere to speak commands like <em>"read page"</em>, <em>"pause"</em>, or <em>"summarize"</em>.
              </p>
              <div className="flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-100 dark:border-slate-800/80 pt-2">
                <span>Popup shortcut: Alt+A / Ctrl+Shift+X</span>
                <span className="text-indigo-600 dark:text-indigo-400 font-medium">Zero-Latency</span>
              </div>
            </div>
          </div>
        </aside>

      </main>

      {/* Installation Guide Modal */}
      {showInstallGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setShowInstallGuide(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <Laptop className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Load AccessMind into Chrome</h2>
                <p className="text-xs text-slate-500">Takes less than 15 seconds to set up</p>
              </div>
            </div>

            <ol className="space-y-3.5 text-xs text-slate-600 dark:text-slate-300">
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center shrink-0 text-[10px]">1</span>
                <div>
                  <strong>Download Extension ZIP</strong>
                  <p className="text-slate-500 dark:text-slate-400 mt-0.5">Click the "Download (.zip)" button and extract the contents to a folder on your computer.</p>
                </div>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center shrink-0 text-[10px]">2</span>
                <div>
                  <strong>Open Chrome Extensions Page</strong>
                  <p className="text-slate-500 dark:text-slate-400 mt-0.5">In Google Chrome, navigate to <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-indigo-600 dark:text-indigo-400">chrome://extensions</code></p>
                </div>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center shrink-0 text-[10px]">3</span>
                <div>
                  <strong>Enable Developer Mode & Load Unpacked</strong>
                  <p className="text-slate-500 dark:text-slate-400 mt-0.5">Toggle <strong>Developer mode</strong> (top-right), click <strong>Load unpacked</strong>, and select the extracted folder (the folder containing <code className="text-indigo-600 dark:text-indigo-400">manifest.json</code> and <code className="text-indigo-600 dark:text-indigo-400">assets/</code>). If updating, click the Refresh icon on the AccessMind card in <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-indigo-600 dark:text-indigo-400">chrome://extensions</code>.</p>
                </div>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center shrink-0 text-[10px]">✓</span>
                <div>
                  <strong>Ready to use!</strong>
                  <p className="text-slate-500 dark:text-slate-400 mt-0.5">Pin AccessMind to your Chrome toolbar. Test it on any webpage or PDF file!</p>
                </div>
              </li>
            </ol>

            <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
              <button
                onClick={copyInstallSteps}
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5 transition"
              >
                {copiedShortcut ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedShortcut ? 'Copied!' : 'Copy Steps'}</span>
              </button>

              <button
                onClick={handleDownloadZip}
                disabled={downloadingZip}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{downloadingZip ? 'Preparing...' : 'Download ZIP'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
