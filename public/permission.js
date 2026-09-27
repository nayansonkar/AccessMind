const btn = document.getElementById('enable-btn');
const manualBtn = document.getElementById('manual-btn');
const statusEl = document.getElementById('status');
const testBox = document.getElementById('test-box');
const testTranscript = document.getElementById('test-transcript');

function notifyGranted() {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.set({ micPermissionGranted: true });
    chrome.runtime.sendMessage({ action: "micPermissionGranted" }).catch(() => {});
  }
  try {
    localStorage.setItem('accessmind_mic_granted', 'true');
  } catch (e) {}

  if (statusEl) {
    statusEl.className = 'status success';
    statusEl.textContent = '✅ Microphone access granted! You can now hold Spacebar on any webpage to speak commands.';
  }
  if (btn) btn.style.display = 'none';
  if (manualBtn) manualBtn.style.display = 'none';
  if (testBox) testBox.style.display = 'block';

  // Start a live test with SpeechRecognition so user can test their voice right away
  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SpeechRec) {
    try {
      const rec = new SpeechRec();
      rec.continuous = true;
      rec.interimResults = true;
      rec.onresult = (e) => {
        let t = '';
        for (let i = 0; i < e.results.length; i++) {
          t += e.results[i][0].transcript;
        }
        if (t && testTranscript) {
          testTranscript.textContent = '🎙️ Heard: "' + t + '"';
        }
      };
      rec.start();
    } catch (e) {
      // Quietly ignore test errors
    }
  }
}

async function requestPermission() {
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Requesting access...';
  }
  if (statusEl) statusEl.style.display = 'none';

  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('MediaDevices API not supported in this browser context');
    }

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Prompt dismissed or timed out')), 20000)
    );

    const stream = await Promise.race([
      navigator.mediaDevices.getUserMedia({ audio: true }),
      timeoutPromise
    ]);

    stream.getTracks().forEach(track => track.stop());
    notifyGranted();
  } catch (err) {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Retry Allowing Access';
    }
    if (statusEl) {
      statusEl.className = 'status error';
      statusEl.innerHTML = '⚠️ Access was not granted (' + (err && err.message ? err.message : 'denied') + ').<br/>Please click the <strong>lock / site settings icon</strong> on the left side of your address bar, set <strong>Microphone</strong> to <strong>Allow</strong>, then click Retry.';
    }
  }
}

if (btn) {
  btn.addEventListener('click', requestPermission);
}

if (manualBtn) {
  manualBtn.addEventListener('click', () => {
    notifyGranted();
  });
}

// Check if permission was already granted previously
window.addEventListener('DOMContentLoaded', () => {
  if (navigator.permissions && navigator.permissions.query) {
    navigator.permissions.query({ name: 'microphone' }).then(res => {
      if (res.state === 'granted') {
        notifyGranted();
      }
    }).catch(() => {});
  }
});
