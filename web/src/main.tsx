import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/poppins/500.css';
import '@fontsource/poppins/600.css';
import '@fontsource/poppins/700.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';

import './styles/tokens.css';
import './styles/base.css';
import './styles/layout.css';
import './styles/pages.css';
import './styles/catalog.css';
import './styles/player.css';
import './styles/certificates.css';
import './i18n/index.js';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { Layout } from './components/Layout.js';
import { RequireAuth } from './components/RequireAuth.js';
import { AccountPage } from './pages/AccountPage.js';
import { AdminPage } from './pages/AdminPage.js';
import { CatalogPage } from './pages/CatalogPage.js';
import { CertificatesPage } from './pages/CertificatesPage.js';
import { CoursePage } from './pages/CoursePage.js';
import { CheckEmailPage, VerifyEmailPage } from './pages/EmailPages.js';
import { ForgotPasswordPage, ResetPasswordPage } from './pages/PasswordPages.js';
import { HomePage } from './pages/HomePage.js';
import { InvitePage } from './pages/InvitePage.js';
import { NotFoundPage } from './pages/NotFoundPage.js';
import { PlatformPage } from './pages/PlatformPage.js';
import { PlayerPage } from './pages/PlayerPage.js';
import { SignInPage } from './pages/SignInPage.js';
import { SignUpPage } from './pages/SignUpPage.js';
import { VerifyPage } from './pages/VerifyPage.js';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } },
});

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'courses', element: <CatalogPage /> },
      { path: 'courses/:slug', element: <CoursePage /> },
      // Public: free preview lessons open without an account.
      { path: 'learn/:slug', element: <PlayerPage /> },
      { path: 'learn/:slug/:lessonId', element: <PlayerPage /> },
      { path: 'learn/:slug/quiz/:quizId', element: <PlayerPage /> },
      // Public: anyone holding a certificate can be checked here.
      { path: 'dogrula', element: <VerifyPage /> },
      { path: 'dogrula/:certNo', element: <VerifyPage /> },
      { path: 'sign-in', element: <SignInPage /> },
      { path: 'sign-up', element: <SignUpPage /> },
      { path: 'check-email', element: <CheckEmailPage /> },
      { path: 'verify-email', element: <VerifyEmailPage /> },
      { path: 'forgot-password', element: <ForgotPasswordPage /> },
      { path: 'reset-password', element: <ResetPasswordPage /> },
      { path: 'invite', element: <InvitePage /> },
      {
        element: <RequireAuth />,
        children: [
          { path: 'account', element: <AccountPage /> },
          { path: 'admin', element: <AdminPage /> },
          { path: 'platform', element: <PlatformPage /> },
          { path: 'certificates', element: <CertificatesPage /> },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);

const root = document.getElementById('root');
if (!root) throw new Error('#root is missing from index.html');

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
