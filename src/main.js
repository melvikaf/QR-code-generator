import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';
import './style.css';

const contentInput = document.querySelector('#content');
const canvas = document.querySelector('#qr-canvas');
const emptyState = document.querySelector('#empty-state');
const downloadButton = document.querySelector('#download-button');
const statusMessage = document.querySelector('#status-message');
const characterCount = document.querySelector('#character-count');
const foregroundInput = document.querySelector('#foreground');
const backgroundInput = document.querySelector('#background');
const sizeButtons = document.querySelectorAll('[data-size]');
const formatButtons = document.querySelectorAll('[data-format]');
const frameButtons = document.querySelectorAll('[data-frame]');
const downloadFormat = document.querySelector('.download-format');
const artworkLabelInput = document.querySelector('#artwork-label');

const defaults = {
  content: 'https://example.com',
  foreground: '#1d2942',
  background: '#ffffff',
  size: 512,
  frame: 'none',
  label: '',
};

let exportSize = defaults.size;
let exportFormat = 'png';
let frameStyle = defaults.frame;
let renderVersion = 0;

function updateColorLabel(input, labelId) {
  document.querySelector(labelId).textContent = input.value.toUpperCase();
}

function updateCharacterCount() {
  characterCount.textContent = `${contentInput.value.length} / 2000`;
}

function escapeXml(value) {
  return value.replace(/[<>&"']/g, (character) => ({
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    '"': '&quot;',
    "'": '&apos;',
  })[character]);
}

async function createArtworkSvg(value, size) {
  const qrSvg = await QRCode.toString(value, {
    type: 'svg',
    margin: 2,
    errorCorrectionLevel: 'H',
    color: {
      dark: foregroundInput.value,
      light: backgroundInput.value,
    },
  });
  const normalizedQrSvg = qrSvg.trim();
  const viewBox = normalizedQrSvg.match(/viewBox="([^"]+)"/)?.[1];
  const qrContents = normalizedQrSvg.match(/^<svg[^>]*>([\s\S]*)<\/svg>$/)?.[1];

  if (!viewBox || !qrContents) {
    throw new Error('The QR code could not be prepared for export.');
  }

  const label = artworkLabelInput.value.trim();
  const qrSize = size * (label ? 0.71 : 0.84);
  const qrX = (size - qrSize) / 2;
  const qrY = label ? size * 0.045 : (size - qrSize) / 2;
  const frameWeight = frameStyle === 'bold' ? size * 0.012 : frameStyle === 'thin' ? size * 0.004 : 0;
  const frameInset = size * 0.035;
  const labelFontSize = Math.min(size * 0.036, size * 0.84 / (Math.max(label.length, 1) * 0.62));
  const labelMarkup = label
    ? `<text x="${size / 2}" y="${size * 0.91}" fill="${foregroundInput.value}" font-family="Arial, sans-serif" font-size="${labelFontSize}" font-weight="600" text-anchor="middle">${escapeXml(label)}</text>`
    : '';
  const frameMarkup = frameWeight
    ? `<rect x="${frameInset}" y="${frameInset}" width="${size - frameInset * 2}" height="${size - frameInset * 2}" rx="${size * 0.025}" fill="none" stroke="${foregroundInput.value}" stroke-width="${frameWeight}"/>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" fill="${backgroundInput.value}"/><svg x="${qrX}" y="${qrY}" width="${qrSize}" height="${qrSize}" viewBox="${viewBox}" shape-rendering="crispEdges">${qrContents}</svg>${labelMarkup}${frameMarkup}</svg>`;
}

function drawSvgToCanvas(svg, size) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const output = document.createElement('canvas');
      output.width = size;
      output.height = size;
      const context = output.getContext('2d');
      if (!context) {
        reject(new Error('Canvas is not available in this browser.'));
        return;
      }
      context.drawImage(image, 0, 0, size, size);
      resolve(output);
    };
    image.onerror = () => reject(new Error('The QR artwork could not be rendered.'));
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}

async function renderCode() {
  const value = contentInput.value.trim();
  const version = ++renderVersion;

  updateCharacterCount();

  if (!value) {
    canvas.hidden = true;
    emptyState.hidden = false;
    downloadButton.disabled = true;
    statusMessage.textContent = 'Add some content to create your QR code.';
    return;
  }

  try {
    const artworkSvg = await createArtworkSvg(value, 256);
    const nextCanvas = await drawSvgToCanvas(artworkSvg, 256);

    if (version !== renderVersion) return;

    canvas.width = nextCanvas.width;
    canvas.height = nextCanvas.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas is not available in this browser.');
    context.drawImage(nextCanvas, 0, 0);
    document.querySelector('#qr-frame').style.backgroundColor = backgroundInput.value;
    canvas.hidden = false;
    emptyState.hidden = true;
    downloadButton.disabled = false;
    statusMessage.textContent = 'Your code is generated right in your browser.';
  } catch (error) {
    if (version !== renderVersion) return;
    canvas.hidden = true;
    emptyState.hidden = false;
    downloadButton.disabled = true;
    statusMessage.textContent = `Could not create QR code: ${error.message}`;
  }
}

contentInput.addEventListener('input', renderCode);
artworkLabelInput.addEventListener('input', renderCode);

foregroundInput.addEventListener('input', () => {
  updateColorLabel(foregroundInput, '#foreground-value');
  renderCode();
});

backgroundInput.addEventListener('input', () => {
  updateColorLabel(backgroundInput, '#background-value');
  renderCode();
});

frameButtons.forEach((button) => {
  button.addEventListener('click', () => {
    frameStyle = button.dataset.frame;
    frameButtons.forEach((item) => {
      const selected = item === button;
      item.classList.toggle('selected', selected);
      item.setAttribute('aria-pressed', String(selected));
    });
    renderCode();
  });
});

sizeButtons.forEach((button) => {
  button.addEventListener('click', () => {
    exportSize = Number(button.dataset.size);
    sizeButtons.forEach((item) => {
      const selected = item === button;
      item.classList.toggle('selected', selected);
      item.setAttribute('aria-pressed', String(selected));
    });
  });
});

formatButtons.forEach((button) => {
  button.addEventListener('click', () => {
    exportFormat = button.dataset.format;
    formatButtons.forEach((item) => {
      const selected = item === button;
      item.classList.toggle('selected', selected);
      item.setAttribute('aria-pressed', String(selected));
    });
    downloadFormat.textContent = exportFormat.toUpperCase();
  });
});

document.querySelector('#reset-button').addEventListener('click', () => {
  contentInput.value = defaults.content;
  foregroundInput.value = defaults.foreground;
  backgroundInput.value = defaults.background;
  artworkLabelInput.value = defaults.label;
  exportSize = defaults.size;
  exportFormat = 'png';
  frameStyle = defaults.frame;
  updateColorLabel(foregroundInput, '#foreground-value');
  updateColorLabel(backgroundInput, '#background-value');
  sizeButtons.forEach((button) => {
    const selected = Number(button.dataset.size) === defaults.size;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  formatButtons.forEach((button) => {
    const selected = button.dataset.format === exportFormat;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  frameButtons.forEach((button) => {
    const selected = button.dataset.frame === defaults.frame;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  downloadFormat.textContent = exportFormat.toUpperCase();
  renderCode();
});

downloadButton.addEventListener('click', async () => {
  if (!contentInput.value.trim()) return;

  try {
    const value = contentInput.value.trim();
    let blob;
    const artworkSvg = await createArtworkSvg(value, exportSize);

    if (exportFormat === 'svg') {
      blob = new Blob([artworkSvg], { type: 'image/svg+xml;charset=utf-8' });
    } else {
      const exportCanvas = await drawSvgToCanvas(artworkSvg, exportSize);

      if (exportFormat === 'pdf') {
        const pdf = new jsPDF({
          unit: 'pt',
          format: [288, 288],
          compress: true,
        });
        pdf.addImage(exportCanvas.toDataURL('image/png'), 'PNG', 0, 0, 288, 288);
        blob = pdf.output('blob');
      } else {
        const mimeType = exportFormat === 'jpg' ? 'image/jpeg' : 'image/png';
        const blobPromise = new Promise((resolve, reject) => {
          exportCanvas.toBlob(
            (result) => result ? resolve(result) : reject(new Error('The image could not be exported.')),
            mimeType,
            1,
          );
        });
        const response = await blobPromise;
        blob = response;
      }
    }

    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = `qr-code.${exportFormat}`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    statusMessage.textContent = `Downloaded ${exportFormat.toUpperCase()}${exportFormat === 'svg' ? ' vector' : exportFormat === 'pdf' ? ' · 4 × 4 in' : ` · ${exportSize}px`}.`;
  } catch (error) {
    statusMessage.textContent = `Could not download QR code: ${error.message}`;
  }
});

renderCode();
