import { useNavigate, useParams } from "react-router";
import { useEffect, useState } from "react";
import { API_ENDPOINTS } from "../utils/api-endpoints";
import { normalizeBook } from "../utils/api-shapes";
import {
  isSourceDocumentOnlyBook,
  normalizeBookForReader,
} from "../utils/reader-book";
import axiosInstance from "../lib/axios";
import { Book } from "lucide-react";
import { BookView } from "../components";
import toast from "react-hot-toast";

const SKELETON_LINE_WIDTHS = [92, 84, 97, 78, 88, 95, 81, 90, 76, 93, 86, 99];

const BookViewSkeleton = () => (
  <div className="h-screen bg-[#faf8f4] flex">
    {/* Sidebar skeleton */}
    <div className="w-72 h-full bg-[#f3efe8] border-r border-[#e8e0d0] flex-shrink-0 animate-pulse">
      <div className="p-6 border-b border-[#e8e0d0]">
        <div className="h-4 bg-[#ddd5c4] rounded mb-3 w-3/4" />
        <div className="h-3 bg-[#ddd5c4] rounded w-1/2" />
      </div>
      <div className="p-4 space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-10 bg-[#ddd5c4] rounded-lg" />
        ))}
      </div>
    </div>

    {/* Main content skeleton */}
    <div className="flex-1 flex flex-col animate-pulse">
      <div className="h-14 border-b border-[#e8e0d0] bg-[#faf8f4] px-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="h-4 bg-[#ddd5c4] rounded w-24" />
          <div className="h-4 bg-[#ddd5c4] rounded w-48" />
        </div>
        <div className="h-4 bg-[#ddd5c4] rounded w-20" />
      </div>
      <div className="flex-1 p-8 max-w-2xl mx-auto w-full">
        <div className="h-8 bg-[#ddd5c4] rounded mb-8 w-2/3" />
        <div className="space-y-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="h-4 bg-[#ddd5c4] rounded"
              style={{ width: `${SKELETON_LINE_WIDTHS[i]}%` }}
            />
          ))}
        </div>
      </div>
    </div>
  </div>
);

function BookPage() {
  const { bookId } = useParams();
  const navigate = useNavigate();

  const [book, setBook] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchBook = async () => {
      try {
        const { data } = await axiosInstance.get(
          `${API_ENDPOINTS.BOOKS.GET_BY_ID}/${bookId}`
        );
        const nextBook = normalizeBook(data?.book);

        if (isSourceDocumentOnlyBook(nextBook)) {
          toast.error("This book is not available to read.", { duration: 5000 });
          navigate("/dashboard");
          return;
        }

        setBook(normalizeBookForReader(nextBook));
      } catch (error) {
        console.error("Error fetching book:", error);
        toast.error("Failed to fetch book details!", { duration: 5000 });
        navigate("/dashboard");
      } finally {
        setIsLoading(false);
      }
    };

    fetchBook();
  }, [bookId, navigate]);

  if (isLoading) return <BookViewSkeleton />;

  if (!book) {
    return (
      <div className="h-screen bg-[#faf8f4] flex justify-center items-center">
        <section className="text-center border-2 border-dashed border-[#ddd5c4] rounded-xl px-8 py-14">
          <div className="size-16 bg-[#f3efe8] rounded-full mb-4 mx-auto flex justify-center items-center">
            <Book className="size-8 text-[#b8a98a]" />
          </div>
          <h3 className="text-[#2c2416] text-lg font-semibold mb-2">
            Book Not Found
          </h3>
          <p className="max-w-md text-[#8c7a62] text-sm">
            The book you are looking for either does not exist or you do not
            have permission to view it.
          </p>
        </section>
      </div>
    );
  }

  return <BookView book={book} />;
}

export default BookPage;
