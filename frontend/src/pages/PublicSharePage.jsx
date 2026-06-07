import { useParams } from "react-router";
import ErrorPage from "./ErrorPage";
import PublicBookPreviewPage from "./PublicBookPreviewPage";
import PublicBookshelfPage from "./PublicBookshelfPage";

function PublicSharePage() {
  const { shareToken } = useParams();

  if (String(shareToken || "").startsWith("shelf_")) {
    return <PublicBookshelfPage />;
  }

  if (String(shareToken || "").startsWith("preview_")) {
    return <PublicBookPreviewPage />;
  }

  return <ErrorPage />;
}

export default PublicSharePage;
