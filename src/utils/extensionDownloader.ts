export async function downloadExtensionZip(): Promise<boolean> {
  try {
    // 1. Try to fetch the pre-packaged complete production build zip
    const prebuiltRes = await fetch('/AccessMind-Chrome-Extension.zip');
    if (prebuiltRes.ok) {
      const blob = await prebuiltRes.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'AccessMind-Chrome-Extension.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      return true;
    }
  } catch (e) {
    console.warn("Could not fetch prebuilt zip, falling back to direct zip...", e);
  }

  try {
    const { default: JSZip } = await import('jszip');
    const zip = new JSZip();

    // Core extension files
    const filesToFetch = [
      'manifest.json',
      'background.js',
      'content.js',
      'content.css',
      'index.html',
      'offscreen.html',
      'offscreen.js',
      'permission.html',
      'permission.js',
      'pdf-extractor.bundle.js',
      'icon16.png',
      'icon48.png',
      'icon128.png'
    ];

    await Promise.all(
      filesToFetch.map(async (filename) => {
        try {
          const res = await fetch('/' + filename);
          if (res.ok) {
            if (filename.endsWith('.png')) {
              const blob = await res.blob();
              zip.file(filename, blob);
            } else {
              const text = await res.text();
              zip.file(filename, text);
            }
          }
        } catch (e) {
          console.warn(`Could not include ${filename} in zip:`, e);
        }
      })
    );

    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'AccessMind-Chrome-Extension.zip';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    return true;
  } catch (err) {
    console.error("Failed to generate extension zip:", err);
    return false;
  }
}
