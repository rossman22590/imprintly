import { createBrowserRouter, Outlet } from "react-router";
import {
  AdminPage,
  BookPage,
  CreditsPage,
  DashboardPage,
  DocsPage,
  EditBookPage,
  ErrorPage,
  ForgotPasswordPage,
  KDPStudioPage,
  LandingPage,
  PricingPage,
  ProfilePage,
  PublicBookshelfPage,
  PublicBookPreviewPage,
  PublicSharePage,
  ResetPasswordPage,
  RunsPage,
  SignInPage,
  SignUpPage,
} from "../pages";
import ProtectedRoute from "./ProtectedRoute";
import PublicRoute from "./PublicRoute";

const router = createBrowserRouter([
  {
    path: "/",
    element: <Outlet />,
    // root error boundary catches all errors
    errorElement: <ErrorPage />,
    children: [
      {
        index: true,
        element: <LandingPage />,
      },
      {
        path: "pricing",
        element: <PricingPage />,
      },
      {
        path: "register",
        element: (
          <PublicRoute>
            <SignUpPage />
          </PublicRoute>
        ),
      },
      {
        path: "login",
        element: (
          <PublicRoute>
            <SignInPage />
          </PublicRoute>
        ),
      },
      {
        path: "forgot-password",
        element: (
          <PublicRoute>
            <ForgotPasswordPage />
          </PublicRoute>
        ),
      },
      {
        path: "reset-password/:token",
        element: <ResetPasswordPage />,
      },
      {
        path: "shelf/:shareToken",
        element: <PublicBookshelfPage />,
      },
      {
        path: "preview/:shareToken",
        element: <PublicBookPreviewPage />,
      },
      {
        path: ":profileSlug/:shareToken",
        element: <PublicSharePage />,
      },
      {
        path: "dashboard",
        element: (
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "docs",
        element: (
          <ProtectedRoute>
            <DocsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "runs",
        element: (
          <ProtectedRoute>
            <RunsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "books/:bookId",
        element: (
          <ProtectedRoute>
            <BookPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "books/:bookId/edit",
        element: (
          <ProtectedRoute>
            <EditBookPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "books/:bookId/kdp",
        element: (
          <ProtectedRoute>
            <KDPStudioPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "admin",
        element: (
          <ProtectedRoute>
            <AdminPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "credits",
        element: (
          <ProtectedRoute>
            <CreditsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "profile",
        element: (
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
