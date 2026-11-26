import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import '@fontsource-variable/fraunces/opsz.css';
import '@fontsource-variable/fraunces/opsz-italic.css';
import './index.css';
import { App, AppErrorBoundary } from './App';
import { AppStoreProvider } from './store/AppStoreProvider';
import { RouterProvider } from './store/RouterProvider';
import { AppDialogsProvider } from './store/AppDialogsProvider';
import { ToastProvider } from './components/ui/toast';
import { ConfirmProvider } from './components/ui/confirm';
import { ThemeController } from './lib/theme';

const container = document.getElementById('root');
if (!container) throw new Error('Daymark could not find its root element.');

createRoot(container).render(
  <StrictMode>
    <AppErrorBoundary>
      <AppStoreProvider>
        <RouterProvider>
          <ThemeController />
          <ToastProvider>
            <ConfirmProvider>
              <AppDialogsProvider>
                <App />
              </AppDialogsProvider>
            </ConfirmProvider>
          </ToastProvider>
        </RouterProvider>
      </AppStoreProvider>
    </AppErrorBoundary>
  </StrictMode>,
);
