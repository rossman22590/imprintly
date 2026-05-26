import { createBrowserRouter, Outlet } from "react-router";
import {
  AdminPage,
  BookPage,
  CreditsPage,
  DashboardPage,
  DocsPage,
  EditBookPage,
  ErrorPage,
  KDPStudioPage,
  LandingPage,
  ProfilePage,
  PublicBookshelfPage,
  PublicBookPreviewPage,
  PublicSharePage,
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
