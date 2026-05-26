import { X } from "lucide-react";
import { useEffect } from "react";

function Modal({ isOpen, onClose, title, children, sizeClassName = "max-w-md" }) {
  // Escape key handler
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);

    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }

    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div className="h-dvh px-2.5 sm:px-4 py-2.5 sm:py-4 flex justify-center items-center">
        <div
          onClick={onClose}
          className="bg-black/50 backdrop-blur-sm fixed inset-0 animate-in fade-in duration-200"
          aria-hidden="true"
        />

        {/* Modal container */}
        <article
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          className={`${sizeClassName} w-full max-h-[calc(100dvh-1.25rem)] sm:max-h-[calc(100dvh-2rem)] bg-white text-left rounded-xl shadow-xl relative animate-in zoom-in-95 duration-200 flex flex-col overflow-hidden`}
        >
          {/* Header */}
          <header className="shrink-0 px-4 pt-4 pb-3 sm:px-5 md:px-6 md:pt-5 flex justify-between items-start gap-x-4 border-b border-slate-100">
            <h3
              id="modal-title"
              className="text-gray-900 text-base md:text-lg font-semibold pr-8 min-w-0"
            >
              {title}
            </h3>

            {/* Close button */}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close modal"
              className="text-gray-400 rounded-lg p-1.5 transition-colors duration-200 hover:bg-gray-100 hover:text-gray-600 focus-visible:bg-gray-100 focus-visible:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 absolute top-4 md:top-5 right-4 md:right-5"
            >
              <X className="size-4 md:size-5" />
            </button>
          </header>

          {/* Content area */}
          <div className="min-h-0 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5 md:px-6 md:py-5 text-sm md:text-base">
            {children}
          </div>
        </article>
      </div>
    </div>
  );
}

export default Modal;
