import React from 'react';
// eslint-disable-next-line react/no-deprecated
import { render } from 'react-dom';
import { App } from './App';
import { DialogProvider } from './components/ui/ConfirmDialog';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { TranslationProvider } from './i18n/TranslationProvider';
import { ThemeProvider } from './theme/ThemeProvider';
import { INSTAGRAM_HOSTNAME } from './constants/constants';
import { isLocalPreview } from './preview/preview-users';

export function bootstrap(): void {
  if (location.hostname !== INSTAGRAM_HOSTNAME && !isLocalPreview) {
    renderHostnameError();
    return;
  }

  document.title = 'InstagramUnfollowers';
  const existing = document.getElementById('iu-root');
  if (existing !== null) {
    existing.remove();
  }
  document.body.innerHTML = '';
  const root = document.createElement('div');
  root.id = 'iu-root';
  document.body.appendChild(root);
  render(
    <ErrorBoundary>
      <ThemeProvider>
        <TranslationProvider>
          <DialogProvider>
            <App />
          </DialogProvider>
        </TranslationProvider>
      </ThemeProvider>
    </ErrorBoundary>,
    root,
  );
}

function renderHostnameError(): void {
  const overlay = document.createElement('div');
  overlay.setAttribute('role', 'alert');
  overlay.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:2147483647',
    'background:rgba(0,0,0,0.92)', 'color:#efefef',
    'display:flex', 'flex-direction:column', 'align-items:center',
    'justify-content:center', 'padding:32px', 'gap:16px',
    'font-family:system-ui,sans-serif', 'font-size:15px',
  ].join(';');
  overlay.innerHTML = [
    '<h2 style="margin:0;font-size:22px;">InstagramUnfollowers</h2>',
    '<p style="max-width:520px;text-align:center;margin:0;line-height:1.5;color:#a3a3a3;">',
    'This script can only run on <strong>www.instagram.com</strong>.',
    ' Open Instagram in another tab and paste the script in the developer console there.',
    '</p>',
  ].join('');
  const close = document.createElement('button');
  close.textContent = 'Dismiss';
  close.style.cssText = [
    'padding:10px 20px', 'border-radius:8px', 'border:1px solid rgba(255,255,255,0.1)',
    'background:#2563eb', 'color:white', 'cursor:pointer', 'font-size:14px',
  ].join(';');
  close.addEventListener('click', () => overlay.remove());
  overlay.appendChild(close);
  document.body.appendChild(overlay);
}
