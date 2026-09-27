import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';

async function pack() {
  const distDir = path.resolve('dist');
  if (!fs.existsSync(distDir)) {
    console.error('dist directory does not exist! Run vite build first.');
    process.exit(1);
  }

  const zip = new JSZip();

  function addDirRecursively(currentDir, currentZip) {
    const items = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const item of items) {
      if (item.name === 'AccessMind-Chrome-Extension.zip') continue;
      const fullPath = path.join(currentDir, item.name);
      if (item.isDirectory()) {
        const subZip = currentZip.folder(item.name);
        addDirRecursively(fullPath, subZip);
      } else {
        const fileData = fs.readFileSync(fullPath);
        currentZip.file(item.name, fileData);
      }
    }
  }

  console.log('Packing dist/ directory into AccessMind-Chrome-Extension.zip...');
  addDirRecursively(distDir, zip);

  const buffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 }
  });

  // Write to both public and dist so it can be downloaded via fetch or used directly
  fs.writeFileSync(path.resolve('public/AccessMind-Chrome-Extension.zip'), buffer);
  fs.writeFileSync(path.resolve('dist/AccessMind-Chrome-Extension.zip'), buffer);

  console.log(`Successfully generated AccessMind-Chrome-Extension.zip (${(buffer.length / 1024).toFixed(1)} KB)`);
}

pack().catch(err => {
  console.error('Failed to pack extension:', err);
  process.exit(1);
});
