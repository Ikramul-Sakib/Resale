import type { AppState } from '../types';
import { escapeHtml } from '../utils/html';
import { renderPageHeader } from '../components/page-header';

function renderPreview(image: AppState['selectedImages'][number], index: number): string {
  const body = image.src
    ? `<img src="${image.src}" alt="${escapeHtml(image.name)}" />`
    : `<span>Sample photo ${index + 1}</span>`;
  return `
    <div class="image-preview">
      ${body}
      <button class="icon-button image-remove" type="button" data-action="remove-image" data-index="${index}" aria-label="Remove ${escapeHtml(image.name)}">
        <i data-lucide="x" aria-hidden="true"></i>
      </button>
    </div>
  `;
}

export function renderScanPage(state: AppState, demoMode = false): string {
  const progress = state.scanStatus === 'uploading' ? state.uploadProgress : state.scanStatus === 'identifying' ? 100 : state.scanStatus === 'completed' ? 100 : 0;
  const identifyDisabled = state.selectedImages.length === 0 || state.scanStatus === 'uploading' || state.scanStatus === 'identifying';
  const stepOne = state.scanStatus === 'uploading' ? 'In progress' : state.scanStatus === 'idle' ? 'Waiting' : 'Done';
  const stepTwo = state.scanStatus === 'identifying' ? 'In progress' : state.scanStatus === 'completed' ? 'Done' : 'Waiting';
  const stepThree = state.scanStatus === 'completed' ? 'Done' : 'Waiting';

  return `
    ${renderPageHeader('Scan Product', 'Upload photos and ResaleIQ will identify the item and estimate a resale range.')}

    <section class="upload-zone" data-drop-zone tabindex="0" aria-label="Upload product photos">
      <i data-lucide="image-plus" class="upload-icon" aria-hidden="true"></i>
      <strong>Drag and drop photos here</strong>
      <span>JPG, PNG or WebP, up to 10 MB each, up to 6 images</span>
      <div class="upload-actions">
        <button class="button button-primary" type="button" data-action="open-upload">Upload from device</button>
        <button class="button button-secondary" type="button" data-action="open-camera">Use camera</button>
      </div>
      <input class="visually-hidden" data-file-input type="file" accept="image/jpeg,image/png,image/webp" multiple />
      <input class="visually-hidden" data-camera-input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" />
    </section>
    <p class="field-error" data-upload-error${state.uploadError ? '' : ' hidden'}>${escapeHtml(state.uploadError)}</p>
    <p class="field-error"${state.cameraError ? '' : ' hidden'}>${escapeHtml(state.cameraError)}</p>
    <div class="form-alert form-alert-error" role="alert"${state.scanError ? '' : ' hidden'}>${escapeHtml(state.scanError)}</div>

    <article class="card selected-images-card">
      <div class="card-heading"><h2>Selected images</h2><span class="muted-copy">${state.selectedImages.length}/6</span></div>
      <div class="image-grid">
        ${state.selectedImages.length ? state.selectedImages.map(renderPreview).join('') : '<div class="empty-preview">No photos selected yet.</div>'}
      </div>
    </article>

    <article class="card analysis-card">
      <div class="card-heading"><h2>Analysis status</h2></div>
      <p>Photos are sent to our secure server, which asks Google Gemini to identify the item. Nothing is shared from your browser directly.</p>
      <div class="analysis-progress" aria-hidden="true"><span style="width: ${progress}%"></span></div>
      <ol class="analysis-steps">
        <li><span>1. Upload complete</span><b>${stepOne}</b></li>
        <li><span>2. Gemini identifying product</span><b>${stepTwo}</b></li>
        <li><span>3. Extracting attributes</span><b>${stepThree}</b></li>
      </ol>
    </article>

    <div class="page-actions">
      <button class="button button-primary" type="button" data-action="identify" ${identifyDisabled ? 'disabled' : ''}>
        ${state.scanStatus === 'uploading' ? `Uploading ${state.uploadProgress}%…` : state.scanStatus === 'identifying' ? 'Gemini identifying…' : demoMode ? 'Sign in to identify a real photo' : 'Identify & Estimate Price'}
      </button>
      ${state.scanStatus === 'failed' && state.scanResult?.id ? '<button class="button button-secondary" type="button" data-action="retry-scan">Retry scan</button>' : ''}
    </div>
  `;
}
