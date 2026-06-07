import { X } from "lucide-react";
import { useEffect } from "react";

const Modal = ({
  isOpen,
  onClose,
  title,
  children,
  sizeClassName = "max-w-md",
  footer = null,
  contentRef = null,
}) => {
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === "Escape" && isOpen) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);

    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-center items-center px-3 py-6 sm:px-4 sm:py-10"
      role="presentation"
    >
      <div
        onClick={onClose}
        className="bg-slate-950/60 backdrop-blur-sm absolute inset-0 animate-in fade-in duration-200"
        aria-hidden="true"
      />

      <article
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={`${sizeClassName} w-full h-fit max-h-[calc(100dvh-3rem)] sm:max-h-[calc(100dvh-5rem)] bg-white text-left rounded-2xl shadow-2xl relative z-10 animate-in zoom-in-95 duration-200 flex flex-col overflow-hidden`}
      >
        <header className="shrink-0 flex items-center justify-between gap-4 px-5 py-4 border-b border-slate-100">
          <h3
            id="modal-title"
            className="text-slate-900 text-base md:text-lg font-semibold truncate"
          >
            {title}
          </h3>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="text-slate-400 rounded-lg p-1.5 transition-colors duration-200 hover:bg-slate-100 hover:text-slate-700 focus-visible:bg-slate-100 focus-visible:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
          >
            <X className="size-4 md:size-5" />
          </button>
        </header>

        <div
          ref={contentRef}
          className="min-h-0 overflow-y-auto overscroll-contain px-5 py-3 text-sm md:text-base"
        >
          {children}
        </div>

        {footer && (
          <footer className="shrink-0 border-t border-slate-100 bg-white px-5 py-3">
            {footer}
          </footer>
        )}
      </article>
    </div>
  );
};

export default Modal;
