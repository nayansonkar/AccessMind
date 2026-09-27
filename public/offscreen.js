// Offscreen Document for Audio Capture and Speech Recognition in MV3

let recognition = null;
let isListening = false;
let lastTranscript = '';
let commandDispatched = false;
let mediaStream = null;

function detectCommand(text) {
  if (!text) return null;
  const c = text.toLowerCase().trim();
  if (/stop|cancel|quiet|shut up|halt|mute/.test(c)) return 'stop';
  if (/pause|hold on|wait/.test(c)) return 'pause';
  if (/resume|unpause|continue|play|go on|keep reading/.test(c)) return 'resume';
  if (/faster|speed up|increase speed|read faster/.test(c)) return 'faster';
  if (/slower|slow down|decrease speed|read slower/.test(c)) return 'slower';
  if (/read page|read aloud|read this|read to me|start reading|speak|read pdf|read/.test(c)) return 'read';
  if (/summar|tldr|key point|overview|insights/.test(c)) return 'summarize';
  if (/dyslexi|font/.test(c)) return 'dyslexia';
  if (/bionic|speed read|fast read/.test(c)) return 'bionic';
  if (/sepia|tint|contrast|dark mode|color/.test(c)) return 'tint';
  if (/ruler|alternate|lines|guide/.test(c)) return 'ruler';
  if (/menu|toolbar|bar|options|help/.test(c)) return 'toolbar';
  return null;
}

async function startListening() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    console.error("SpeechRecognition API not available in offscreen context.");
    chrome.runtime.sendMessage({ action: "speechError", error: "SpeechRecognition not available" }).catch(() => {});
    return;
  }

  if (recognition) {
    try { recognition.abort(); } catch(e) {}
  }

  isListening = true;
  lastTranscript = '';
  commandDispatched = false;
  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  recognition.onstart = () => {
    chrome.runtime.sendMessage({ action: "speechEngineReady" }).catch(() => {});
  };

  recognition.onresult = (event) => {
    let interim = '';
    let final = '';
    for (let i = 0; i < event.results.length; ++i) {
      if (event.results[i].isFinal) final += event.results[i][0].transcript;
      else interim += event.results[i][0].transcript;
    }

    const fullTranscript = (final + " " + interim).trim();
    if (fullTranscript) {
      lastTranscript = fullTranscript;
      chrome.runtime.sendMessage({ action: "transcriptUpdate", transcript: fullTranscript }).catch(() => {});

      // If a distinct command keyword is recognized during speech, dispatch immediately
      if (!commandDispatched) {
        const matched = detectCommand(fullTranscript);
        if (matched) {
          commandDispatched = true;
          chrome.runtime.sendMessage({ action: "voiceCommand", command: fullTranscript }).catch(() => {});
        }
      }
    }
  };

  recognition.onerror = (e) => {
    if (e.error === 'not-allowed') {
      isListening = false;
      chrome.runtime.sendMessage({ action: "micPermissionNeeded" }).catch(() => {});
      return;
    }
    if (e.error === 'no-speech' || e.error === 'aborted') {
      return;
    }
    chrome.runtime.sendMessage({ action: "speechError", error: e.error }).catch(() => {});
  };

  recognition.onend = () => {
    if (isListening) {
      try { recognition.start(); } catch(e) {}
    }
  };

  try {
    recognition.start();
  } catch(e) {
    isListening = false;
  }
}

function stopListening() {
  isListening = false;
  
  // Allow a 300ms grace period for speech recognition to yield final buffered words
  setTimeout(() => {
    if (recognition) {
      try { recognition.stop(); } catch(e) {}
    }

    if (mediaStream) {
      try {
        mediaStream.getTracks().forEach(t => t.stop());
      } catch(e) {}
      mediaStream = null;
    }

    if (!commandDispatched) {
      if (lastTranscript) {
        commandDispatched = true;
        const cmd = lastTranscript;
        lastTranscript = '';
        chrome.runtime.sendMessage({ action: "voiceCommand", command: cmd }).catch(() => {});
      } else {
        chrome.runtime.sendMessage({ action: "voiceCommandEmpty" }).catch(() => {});
      }
    }
  }, 300);
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "startListening") {
    startListening();
    sendResponse({ success: true });
  } else if (msg.action === "stopListening") {
    stopListening();
    sendResponse({ success: true });
  } else if (msg.action === "toggleVoice") {
    if (isListening) stopListening();
    else startListening();
    sendResponse({ success: true, isListening });
  }
});
