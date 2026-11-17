import { createIcons, icons } from 'lucide';
import { renderLayout } from './components/layout';
import { renderDashboardPage } from './pages/dashboard';
import { renderEstimatePage } from './pages/estimate';
import { renderIdentificationPage } from './pages/identification';
import { renderPlaceholderPage } from './pages/placeholder';
import { renderScanPage } from './pages/scan';
import type { AppState, DemoImage, ScreenId } from './types';

const DEMO_MODE = true;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const demoImages: DemoImage[] = [
  { id: 'demo-1', name: 'Sample photo 1', isDemo: true },
  { id: 'demo-2', name: 'Sample photo 2', isDemo: true },
  { id: 'demo-3', name: 'Sample photo 3', isDemo: true },
];

const state: AppState = {
  screen: 'dashboard',
  selectedImages: demoImages,
  analysisStage: 1,
  uploadError: '',
  toast: '',
  currency: 'USD',
  identification: {
    name: 'Mechanical keyboard, 75% layout',
    brand: 'Keychron',
    model: 'K2',
    category: 'Computer accessories',
    condition: 'Good, light wear',
    attributes: 'Wireless, hot-swappable, RGB',
  },
};

let toastTimer: number | undefined;

function getPageContent(): string {
  if (state.screen === 'dashboard') return renderDashboardPage();
  if (state.screen === 'scan') return renderScanPage(state);
  if (state.screen === 'identification') return renderIdentificationPage(state.identification);
  if (state.screen === 'estimate') return renderEstimatePage(state);
  return renderPlaceholderPage(state.screen);
}

function render(): void {
  const root = document.querySelector<HTMLDivElement>('#app');
  if (!root) throw new Error('App root not found');

  root.innerHTML = renderLayout({
    activeScreen: state.screen,
    content: getPageContent(),
    toast: state.toast,
  });

  createIcons({ icons });
  bindEvents();
}

function showToast(message: string): void {
  state.toast = message;
  window.clearTimeout(toastTimer);
  render();
  toastTimer = window.setTimeout(() => {
    state.toast = '';
    render();
  }, 3200);
}

function setScreen(screen: ScreenId): void {
  state.screen = screen;
  state.uploadError = '';
  state.toast = '';
  render();
}

function bindEvents(): void {
  document.querySelectorAll<HTMLButtonElement>('[data-screen]').forEach((button) => {
    button.addEventListener('click', () => setScreen(button.dataset.screen as ScreenId));
  });

  document.querySelectorAll<HTMLElement>('[data-action]').forEach((element) => {
    element.addEventListener('click', () => handleAction(element.dataset.action ?? '', element));
  });

  document.querySelector<HTMLInputElement>('[data-file-input]')?.addEventListener('change', (event) => {
    const input = event.currentTarget as HTMLInputElement;
    addFiles(input.files);
  });

  document.querySelector<HTMLInputElement>('[data-camera-input]')?.addEventListener('change', (event) => {
    const input = event.currentTarget as HTMLInputElement;
    addFiles(input.files);
  });

  const dropZone = document.querySelector<HTMLElement>('[data-drop-zone]');
  dropZone?.addEventListener('dragover', (event) => {
    event.preventDefault();
    dropZone.classList.add('is-dragging');
  });
  dropZone?.addEventListener('dragleave', () => dropZone.classList.remove('is-dragging'));
  dropZone?.addEventListener('drop', (event) => {
    event.preventDefault();
    dropZone.classList.remove('is-dragging');
    addFiles((event as DragEvent).dataTransfer?.files ?? null);
  });
  dropZone?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      document.querySelector<HTMLInputElement>('[data-file-input]')?.click();
    }
  });

  document.querySelector<HTMLInputElement>('[data-currency]')?.addEventListener('change', (event) => {
    state.currency = (event.currentTarget as HTMLSelectElement).value as AppState['currency'];
    render();
  });

  document.querySelectorAll<HTMLInputElement>('[data-field]').forEach((input) => {
    input.addEventListener('input', () => {
      const field = input.dataset.field as keyof AppState['identification'];
      state.identification[field] = input.value;
    });
  });

  document.querySelector<HTMLFormElement>('[data-search-form]')?.addEventListener('submit', (event) => {
    event.preventDefault();
    showToast(DEMO_MODE ? 'Demo search is not connected to live data.' : 'Search submitted.');
  });
}

function handleAction(action: string, element: HTMLElement): void {
  if (action === 'scan' || action === 'dashboard') {
    setScreen(action === 'scan' ? 'scan' : 'dashboard');
    return;
  }
  if (action === 'open-upload') {
    document.querySelector<HTMLInputElement>('[data-file-input]')?.click();
    return;
  }
  if (action === 'open-camera') {
    document.querySelector<HTMLInputElement>('[data-camera-input]')?.click();
    return;
  }
  if (action === 'remove-image') {
    const index = Number(element.dataset.index);
    state.selectedImages.splice(index, 1);
    state.uploadError = '';
    render();
    return;
  }
  if (action === 'identify') {
    startAnalysis();
    return;
  }
  if (action === 'continue-estimate') {
    setScreen('estimate');
    return;
  }
  if (action === 'generate-listing') {
    showToast('Demo action complete: a listing draft preview is ready for a later phase.');
    return;
  }
  if (action === 'save-inventory') {
    showToast('Demo action complete: this item is ready to save when inventory is connected.');
  }
}

function addFiles(files: FileList | null): void {
  if (!files?.length) return;

  const incoming = Array.from(files);
  const availableSlots = 6 - state.selectedImages.length;
  const accepted: DemoImage[] = [];
  const errors: string[] = [];

  incoming.slice(0, Math.max(0, availableSlots)).forEach((file, index) => {
    if (!ALLOWED_TYPES.has(file.type)) {
      errors.push(`${file.name}: use JPG, PNG, or WebP.`);
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      errors.push(`${file.name}: maximum size is 10 MB.`);
      return;
    }
    accepted.push({
      id: `upload-${Date.now()}-${index}`,
      name: file.name,
      src: URL.createObjectURL(file),
    });
  });

  if (incoming.length > availableSlots) errors.push('You can select up to 6 images.');
  state.selectedImages = [...state.selectedImages, ...accepted];
  state.uploadError = errors.join(' ');
  render();
}

function startAnalysis(): void {
  state.analysisStage = 2;
  render();
  window.setTimeout(() => {
    state.analysisStage = 3;
    render();
  }, 900);
  window.setTimeout(() => {
    state.analysisStage = 1;
    setScreen('identification');
  }, 1800);
}

export function startApp(): void {
  if (!DEMO_MODE) throw new Error('Phase 2 requires demo mode to remain enabled.');
  render();
}
