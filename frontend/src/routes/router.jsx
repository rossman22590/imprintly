import { lazy, Suspense } from "react";
import { createBrowserRouter, Navigate, Outlet } from "react-router";
import ErrorPage from "../pages/ErrorPage";
import ProtectedRoute from "./ProtectedRoute";
import PublicRoute from "./PublicRoute";

const AdminPage = lazy(() => import("../pages/AdminPage"));
const ApiDocsPage = lazy(() => import("../pages/ApiDocsPage"));
const BookPage = lazy(() => import("../pages/BookPage"));
const CommunityBookReaderPage = lazy(() =>
  import("../pages/CommunityBookReaderPage")
);
const CommunityBookshelfPage = lazy(() =>
  import("../pages/CommunityBookshelfPage")
);
const CreditsPage = lazy(() => import("../pages/CreditsPage"));
const DashboardPage = lazy(() => import("../pages/DashboardPage"));
const DocsPage = lazy(() => import("../pages/DocsPage"));
const EditBookPage = lazy(() => import("../pages/EditBookPage"));
const ForgotPasswordPage = lazy(() => import("../pages/ForgotPasswordPage"));
const JobsPage = lazy(() => import("../pages/JobsPage"));
const KDPStudioPage = lazy(() => import("../pages/KDPStudioPage"));
const AudiobookStudioPage = lazy(() => import("../pages/AudiobookStudioPage"));
const TranslationStudioPage = lazy(() => import("../pages/TranslationStudioPage"));
const LandingPage = lazy(() => import("../pages/LandingPage"));
const PricingPage = lazy(() => import("../pages/PricingPage"));
const ProfilePage = lazy(() => import("../pages/ProfilePage"));
const PublicBookshelfPage = lazy(() => import("../pages/PublicBookshelfPage"));
const PublicBookPreviewPage = lazy(() =>
  import("../pages/PublicBookPreviewPage")
);
const PublicSharePage = lazy(() => import("../pages/PublicSharePage"));
const ResetPasswordPage = lazy(() => import("../pages/ResetPasswordPage"));
const SignInPage = lazy(() => import("../pages/SignInPage"));
const SignUpPage = lazy(() => import("../pages/SignUpPage"));

const pageFallback = (
  <div className="min-h-screen bg-gray-50 p-6 text-sm text-gray-500">
    Loading...
  </div>
);

function routeElement(element) {
  return <Suspense fallback={pageFallback}>{element}</Suspense>;
}

const router = createBrowserRouter([
  {
    path: "/",
    element: <Outlet />,
    // root error boundary catches all errors
    errorElement: <ErrorPage />,
    children: [
      {
        index: true,
        element: routeElement(<LandingPage />),
      },
      {
        path: "pricing",
        element: routeElement(<PricingPage />),
      },
      {
        path: "register",
        element: routeElement(
          <PublicRoute>
            <SignUpPage />
          </PublicRoute>
        ),
      },
      {
        path: "login",
        element: routeElement(
          <PublicRoute>
            <SignInPage />
          </PublicRoute>
        ),
      },
      {
        path: "forgot-password",
        element: routeElement(
          <PublicRoute>
            <ForgotPasswordPage />
          </PublicRoute>
        ),
      },
      {
        path: "reset-password/:token",
        element: routeElement(<ResetPasswordPage />),
      },
      {
        path: "shelf/:shareToken",
        element: routeElement(<PublicBookshelfPage />),
      },
      {
        path: "preview/:shareToken",
        element: routeElement(<PublicBookPreviewPage />),
      },
      {
        path: "community",
        element: routeElement(<CommunityBookshelfPage />),
      },
      {
        path: "community/books/:bookId",
        element: routeElement(<CommunityBookReaderPage />),
      },
      {
        path: ":profileSlug/:shareToken",
        element: routeElement(<PublicSharePage />),
      },
      {
        path: "dashboard",
        element: routeElement(
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "docs",
        element: routeElement(
          <ProtectedRoute>
            <DocsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "api-docs",
        element: routeElement(<ApiDocsPage />),
      },
      {
        path: "jobs",
        element: routeElement(
          <ProtectedRoute>
            <JobsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "runs",
        element: routeElement(
          <ProtectedRoute>
            <Navigate to="/jobs" replace />
          </ProtectedRoute>
        ),
      },
      {
        path: "books/:bookId",
        element: routeElement(
          <ProtectedRoute>
            <BookPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "books/:bookId/edit",
        element: routeElement(
          <ProtectedRoute>
            <EditBookPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "books/:bookId/kdp",
        element: routeElement(
          <ProtectedRoute>
            <KDPStudioPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "books/:bookId/audiobook",
        element: routeElement(
          <ProtectedRoute>
            <AudiobookStudioPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "books/:bookId/translation",
        element: routeElement(
          <ProtectedRoute>
            <TranslationStudioPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "admin",
        element: routeElement(
          <ProtectedRoute>
            <AdminPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "credits",
        element: routeElement(
          <ProtectedRoute>
            <CreditsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "profile",
        element: routeElement(
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        ),
      },
      // catch-all for 404s
      {
        path: "*",
        element: <ErrorPage />,
      },
    ],
  },
]);

export default router;
