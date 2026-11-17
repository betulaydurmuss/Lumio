import type { RouteObject } from 'react-router';
import { Layout } from './components/Layout.js';
import { RequireAuth } from './components/RequireAuth.js';
import { AccountPage } from './pages/AccountPage.js';
import { AdminPage } from './pages/AdminPage.js';
import { CatalogPage } from './pages/CatalogPage.js';
import { CertificatesPage } from './pages/CertificatesPage.js';
import { CourseEditPage } from './pages/CourseEditPage.js';
import { CoursePage } from './pages/CoursePage.js';
import { CheckEmailPage, VerifyEmailPage } from './pages/EmailPages.js';
import { HomePage } from './pages/HomePage.js';
import { InvitePage } from './pages/InvitePage.js';
import { NotFoundPage } from './pages/NotFoundPage.js';
import { ForgotPasswordPage, ResetPasswordPage } from './pages/PasswordPages.js';
import { PlatformPage } from './pages/PlatformPage.js';
import { PlayerPage } from './pages/PlayerPage.js';
import { PrivacyPage } from './pages/PrivacyPage.js';
import { SignInPage } from './pages/SignInPage.js';
import { SignUpPage } from './pages/SignUpPage.js';
import { TranscriptPage } from './pages/TranscriptPage.js';
import { VerifyPage } from './pages/VerifyPage.js';

/**
 * What the browser tab says on each page (WCAG 2.4.2), as a translation key.
 * Course and lesson pages have no key: they name themselves after the course.
 */
export interface RouteHandle {
  title?: string;
}

const titled = (title: string): { handle: RouteHandle } => ({ handle: { title } });

export const routes: RouteObject[] = [
  {
    element: <Layout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'courses', element: <CatalogPage />, ...titled('nav.catalog') },
      { path: 'courses/:slug', element: <CoursePage /> },
      // Public: free preview lessons open without an account.
      { path: 'learn/:slug', element: <PlayerPage /> },
      { path: 'learn/:slug/:lessonId', element: <PlayerPage /> },
      { path: 'learn/:slug/quiz/:quizId', element: <PlayerPage /> },
      // Public: anyone holding a certificate can be checked here.
      { path: 'dogrula', element: <VerifyPage />, ...titled('nav.verify') },
      { path: 'dogrula/:certNo', element: <VerifyPage />, ...titled('nav.verify') },
      { path: 'sign-in', element: <SignInPage />, ...titled('signIn.title') },
      { path: 'sign-up', element: <SignUpPage />, ...titled('signUp.title') },
      { path: 'check-email', element: <CheckEmailPage />, ...titled('checkEmail.title') },
      { path: 'verify-email', element: <VerifyEmailPage />, ...titled('verify.title') },
      { path: 'forgot-password', element: <ForgotPasswordPage />, ...titled('forgot.title') },
      { path: 'reset-password', element: <ResetPasswordPage />, ...titled('reset.title') },
      { path: 'invite', element: <InvitePage />, ...titled('pageTitles.invite') },
      { path: 'privacy', element: <PrivacyPage />, ...titled('nav.privacy') },
      {
        element: <RequireAuth />,
        children: [
          { path: 'account', element: <AccountPage />, ...titled('nav.account') },
          { path: 'admin', element: <AdminPage />, ...titled('nav.admin') },
          { path: 'platform', element: <PlatformPage />, ...titled('nav.platform') },
          {
            path: 'platform/courses/:slug',
            element: <CourseEditPage />,
            ...titled('courseEdit.title'),
          },
          { path: 'certificates', element: <CertificatesPage />, ...titled('nav.certificates') },
          { path: 'transcript', element: <TranscriptPage />, ...titled('transcript.title') },
          {
            path: 'admin/members/:memberId/transcript',
            element: <TranscriptPage />,
            ...titled('transcript.title'),
          },
        ],
      },
      { path: '*', element: <NotFoundPage />, ...titled('pageTitles.notFound') },
    ],
  },
];
