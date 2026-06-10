import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  Languages,
  Loader2,
  Sparkles,
  RefreshCw,
  Trash2,
  CheckCircle2,
  XCircle,
  Coins,
  Globe,
  Settings,
  Play,
  Pause,
  Download,
  Volume2,
  Plus,
  BookOpen,
  Headphones,
  Search,
  Check
} from "lucide-react";
import DashboardLayout from "../layouts/DashboardLayout";
import axiosInstance from "../lib/axios";
import { API_ENDPOINTS } from "../utils/api-endpoints";
import Button from "../components/ui/Button";

const SUPPORTED_LANGUAGES = [
  "Afrikaans", "Arabic", "Bengali", "Bulgarian", "Catalan", 
  "Chinese (Simplified)", "Chinese (Traditional)", "Croatian", "Czech", "Danish", 
  "Dutch", "Estonian", "Filipino", "Finnish", "French", 
  "German", "Greek", "Gujarati", "Hebrew", "Hindi", 
  "Hungarian", "Indonesian", "Italian", "Japanese", "Kannada", 
  "Korean", "Latvian", "Lithuanian", "Malay", "Malayalam", 
  "Marathi", "Norwegian", "Polish", "Portuguese", "Romanian", 
  "Russian", "Serbian", "Slovak", "Slovenian", "Spanish", 
  "Swahili", "Swedish", "Tamil", "Telugu", "Thai", 
  "Turkish", "Ukrainian", "Urdu", "Vietnamese"
];

const ENGINES = {
  gemini: {
    name: "Google Gemini",
    models: [
      { id: "gemini-3.5-flash", name: "Gemini 3.5 Flash" }
    ]
  },
  groq: {
    name: "Groq",
    models: [
      { id: "openai/gpt-oss-20b", name: "GPT-OSS 20B" }
    ]
  }
};

const AUDIOBOOK_MODELS = [
  { id: "eleven_v3", label: "Eleven Multilingual v3" },
  { id: "eleven_monolingual_v1", label: "Eleven Monolingual v1" }
];

function TranslationStudioPage() {
  const { bookId } = useParams();
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(true);
  const [book, setBook] = useState(null);
  const [translations, setTranslations] = useState([]);
  const [selectedTranslation, setSelectedTranslation] = useState(null);
  const [activeTab, setActiveTab] = useState("translate"); // "translate" or "audiobook"

  // Translated title/subtitle state
  const [translatedTitle, setTranslatedTitle] = useState("");
  const [translatedSubtitle, setTranslatedSubtitle] = useState("");
  const [savingDetails, setSavingDetails] = useState(false);
  const [autoTranslatingDetails, setAutoTranslatingDetails] = useState(false);

  // Audio state
  const [audiobookState, setAudiobookState] = useState({ status: "empty", chapters: [] });
  const [voices, setVoices] = useState([]);
  const [voiceSearch, setVoiceSearch] = useState("");
  const [voicesLoading, setVoicesLoading] = useState(false);
  const [selectedVoiceId, setSelectedVoiceId] = useState("");
  const [selectedVoiceName, setSelectedVoiceName] = useState("");
  const [selectedAudiobookModelId, setSelectedAudiobookModelId] = useState("eleven_v3");
  const [audiobookStateLoading, setAudiobookStateLoading] = useState(false);

  // Translation creation form state
  const [isCreating, setIsCreating] = useState(false);
  const [newLanguage, setNewLanguage] = useState(SUPPORTED_LANGUAGES[0]);
  const [newEngine, setNewEngine] = useState("gemini");
  const [newModel, setNewModel] = useState(ENGINES.gemini.models[0].id);

  // Estimates state
  const [chapterEstimates, setChapterEstimates] = useState({});
  const [bookEstimate, setBookEstimate] = useState({ estimatedCredits: 0, baseUsd: 0 });
  const [estimatesLoading, setEstimatesLoading] = useState(false);

  // Processing states
  const [isTranslatingChapter, setIsTranslatingChapter] = useState({});
  const [isTranslatingBook, setIsTranslatingBook] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState({});
  const [savingAudiobookSettings, setSavingAudiobookSettings] = useState(false);
  const [showTranslateBookDialog, setShowTranslateBookDialog] = useState(false);

  // Preview audio player
  const previewAudioRef = useRef(null);
  const [playingPreviewUrl, setPlayingPreviewUrl] = useState(null);

  // Sync translation details
  useEffect(() => {
    if (selectedTranslation) {
      setTranslatedTitle(selectedTranslation.title || "");
      setTranslatedSubtitle(selectedTranslation.subtitle || "");
    } else {
      setTranslatedTitle("");
      setTranslatedSubtitle("");
    }
  }, [selectedTranslation?._id]);

  // Load Book and its Translations
  const loadData = useCallback(async () => {
    try {
      const bookRes = await axiosInstance.get(`${API_ENDPOINTS.BOOKS.GET_BY_ID}/${bookId}?raw=true`);
      if (bookRes.data?.book) {
        setBook(bookRes.data.book);
      }

      const transRes = await axiosInstance.get(API_ENDPOINTS.TRANSLATION.GET_ALL(bookId));
      const transList = transRes.data?.translations || [];
      setTranslations(transList);

      // Keep selected translation updated
      if (transList.length > 0) {
        if (selectedTranslation) {
          const updated = transList.find(t => t._id === selectedTranslation._id);
          setSelectedTranslation(updated || transList[0]);
        } else {
          setSelectedTranslation(transList[0]);
        }
      } else {
        setSelectedTranslation(null);
      }
    } catch (err) {
      console.error("Error loading book and translations:", err);
      toast.error("Failed to load book data.");
    }
  }, [bookId, selectedTranslation]);

  // Initial load
  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      await loadData();
      setIsLoading(false);
    };
    init();
  }, [bookId]);

  // Handle engine change in creation form
  useEffect(() => {
    setNewModel(ENGINES[newEngine].models[0].id);
  }, [newEngine]);

  // Load selected translation details (Estimates, Audiobook state, Voices)
  useEffect(() => {
    if (!selectedTranslation) {
      setChapterEstimates({});
      setBookEstimate({ estimatedCredits: 0, baseUsd: 0 });
      setVoices([]);
      setAudiobookState({ status: "empty", chapters: [] });
      return;
    }

    const tId = selectedTranslation._id;

    // Fetch audiobook state
    const fetchAudiobookState = async () => {
      setAudiobookStateLoading(true);
      try {
        const res = await axiosInstance.get(API_ENDPOINTS.TRANSLATION.AUDIOBOOK_STATE(bookId, tId));
        setAudiobookState(res.data || { status: "empty", chapters: [] });
        if (res.data?.voiceId) {
          setSelectedVoiceId(res.data.voiceId);
          setSelectedVoiceName(res.data.voiceName || "");
        }
      } catch (err) {
        console.error("Error fetching audiobook state:", err);
      } finally {
        setAudiobookStateLoading(false);
      }
    };

    // Fetch voices list
    const fetchVoices = async () => {
      setVoicesLoading(true);
      try {
        const res = await axiosInstance.get(API_ENDPOINTS.TRANSLATION.AUDIOBOOK_VOICES(bookId, tId));
        setVoices(res.data?.voices || []);
      } catch (err) {
        console.error("Error fetching voices:", err);
      } finally {
        setVoicesLoading(false);
      }
    };

    // Fetch Estimates
    const fetchEstimates = async () => {
      setEstimatesLoading(true);
      try {
        // Book estimate
        const bookEstRes = await axiosInstance.get(API_ENDPOINTS.TRANSLATION.ESTIMATE_BOOK(bookId, tId));
        setBookEstimate(bookEstRes.data || { estimatedCredits: 0, baseUsd: 0 });

        // Chapter estimates
        const ests = {};
        if (book && book.chapters) {
          await Promise.all(
            book.chapters.map(async (ch) => {
              try {
                const chEstRes = await axiosInstance.get(
                  API_ENDPOINTS.TRANSLATION.ESTIMATE_CHAPTER(bookId, tId, ch._id)
                );
                ests[ch._id] = chEstRes.data?.estimatedCredits ?? 0;
              } catch (e) {
                console.error(`Error estimating chapter ${ch._id}:`, e);
                ests[ch._id] = 0;
              }
            })
          );
        }
        setChapterEstimates(ests);
      } catch (err) {
        console.error("Error fetching estimates:", err);
      } finally {
        setEstimatesLoading(false);
      }
    };

    fetchAudiobookState();
    fetchVoices();
    fetchEstimates();
  }, [selectedTranslation?._id, selectedTranslation?.engine, book?.chapters?.length]);

  // Create new translation config
  const handleCreateTranslation = async (e) => {
    e.preventDefault();
    const isLangTaken = translations.some(t => t.targetLanguage === newLanguage);
    if (isLangTaken) {
      toast.error(`A translation for ${newLanguage} already exists.`);
      return;
    }

    const loadToast = toast.loading("Creating translation configuration...");
    try {
      const res = await axiosInstance.post(API_ENDPOINTS.TRANSLATION.CREATE(bookId), {
        targetLanguage: newLanguage,
        engine: newEngine,
        model: newModel
      });

      toast.dismiss(loadToast);
      toast.success(`Translation for ${newLanguage} created!`);
      setIsCreating(false);
      
      const created = res.data?.translation;
      await loadData();
      if (created) {
        setSelectedTranslation(created);
      }
    } catch (err) {
      toast.dismiss(loadToast);
      console.error(err);
      toast.error(err.response?.data?.error || "Failed to create translation config.");
    }
  };

  // Toggle active translation
  const handleToggleActive = async () => {
    if (!selectedTranslation) return;
    const tId = selectedTranslation._id;
    const nextActive = !selectedTranslation.isActive;

    const loadToast = toast.loading(nextActive ? "Activating translation..." : "Deactivating translation...");
    try {
      await axiosInstance.patch(API_ENDPOINTS.TRANSLATION.TOGGLE_ACTIVE(bookId, tId), {
        isActive: nextActive
      });
      toast.dismiss(loadToast);
      toast.success(nextActive ? `${selectedTranslation.targetLanguage} translation is now active!` : "Translation deactivated.");
      await loadData();
    } catch (err) {
      toast.dismiss(loadToast);
      console.error(err);
      toast.error("Failed to update active state.");
    }
  };

  // Delete translation
  const handleDeleteTranslation = async () => {
    if (!selectedTranslation) return;
    if (!window.confirm(`Are you sure you want to delete the ${selectedTranslation.targetLanguage} translation? This will permanently delete all translated chapters and generated audio.`)) {
      return;
    }

    const loadToast = toast.loading("Deleting translation...");
    try {
      await axiosInstance.delete(API_ENDPOINTS.TRANSLATION.DELETE(bookId, selectedTranslation._id));
      toast.dismiss(loadToast);
      toast.success(`${selectedTranslation.targetLanguage} translation deleted.`);
      setSelectedTranslation(null);
      await loadData();
    } catch (err) {
      toast.dismiss(loadToast);
      console.error(err);
      toast.error("Failed to delete translation.");
    }
  };

  const handleSaveDetails = async (e) => {
    e.preventDefault();
    if (!selectedTranslation) return;
    setSavingDetails(true);
    const loadToast = toast.loading("Saving translation details...");
    try {
      await axiosInstance.patch(
        API_ENDPOINTS.TRANSLATION.UPDATE_DETAILS(bookId, selectedTranslation._id),
        { title: translatedTitle, subtitle: translatedSubtitle }
      );
      toast.dismiss(loadToast);
      toast.success("Translation details saved!");
      await loadData();
    } catch (err) {
      toast.dismiss(loadToast);
      console.error(err);
      toast.error("Failed to save details.");
    } finally {
      setSavingDetails(false);
    }
  };

  const handleAutoTranslateDetails = async () => {
    if (!selectedTranslation) return;
    if (!window.confirm("Auto-translate title and subtitle? This will overwrite current translated details.")) {
      return;
    }
    setAutoTranslatingDetails(true);
    const loadToast = toast.loading("Auto-translating details...");
    try {
      const res = await axiosInstance.patch(
        API_ENDPOINTS.TRANSLATION.UPDATE_DETAILS(bookId, selectedTranslation._id),
        { autoTranslate: true }
      );
      toast.dismiss(loadToast);
      toast.success("Details auto-translated!");
      const updated = res.data?.translation;
      if (updated) {
        setTranslatedTitle(updated.title || "");
        setTranslatedSubtitle(updated.subtitle || "");
      }
      await loadData();
    } catch (err) {
      toast.dismiss(loadToast);
      console.error(err);
      toast.error("Failed to auto-translate details.");
    } finally {
      setAutoTranslatingDetails(false);
    }
  };

  // Change engine/provider for the selected translation
  const handleChangeEngine = async (newEngine) => {
    if (!selectedTranslation || selectedTranslation.engine === newEngine) return;
    const ENGINE_MODEL = { gemini: "gemini-3.5-flash", groq: "openai/gpt-oss-20b" };
    const loadToast = toast.loading(`Switching to ${newEngine === "gemini" ? "Gemini" : "Groq"}...`);
    try {
      await axiosInstance.patch(
        API_ENDPOINTS.TRANSLATION.UPDATE_DETAILS(bookId, selectedTranslation._id),
        { engine: newEngine }
      );
      toast.dismiss(loadToast);
      toast.success(`Provider changed to ${newEngine === "gemini" ? "Gemini" : "Groq"}!`);
      // Optimistically update state immediately so estimates re-fetch right away
      setSelectedTranslation(prev => prev ? { ...prev, engine: newEngine, model: ENGINE_MODEL[newEngine] } : prev);
      // Also sync into the full translations list
      setTranslations(prev => prev.map(t =>
        t._id === selectedTranslation._id ? { ...t, engine: newEngine, model: ENGINE_MODEL[newEngine] } : t
      ));
    } catch (err) {
      toast.dismiss(loadToast);
      console.error(err);
      toast.error("Failed to change provider.");
    }
  };

  // Translate a single chapter
  const handleTranslateChapter = async (chapterId, title) => {
    if (!selectedTranslation) return;
    const tId = selectedTranslation._id;

    setIsTranslatingChapter(prev => ({ ...prev, [chapterId]: true }));
    const loadToast = toast.loading(`Translating chapter "${title}"...`);

    try {
      await axiosInstance.post(API_ENDPOINTS.TRANSLATION.TRANSLATE_CHAPTER(bookId, tId, chapterId));
      toast.dismiss(loadToast);
      toast.success(`Chapter "${title}" translated successfully!`);
      await loadData();
    } catch (err) {
      toast.dismiss(loadToast);
      console.error(err);
      toast.error(err.response?.data?.error || `Failed to translate chapter "${title}".`);
    } finally {
      setIsTranslatingChapter(prev => ({ ...prev, [chapterId]: false }));
    }
  };

  // Translate entire book
  const handleTranslateEntireBook = () => {
    if (!selectedTranslation) return;
    setShowTranslateBookDialog(true);
  };

  const handleConfirmTranslateBook = async () => {
    if (!selectedTranslation) return;
    const tId = selectedTranslation._id;
    setShowTranslateBookDialog(false);
    setIsTranslatingBook(true);
    const loadToast = toast.loading("Translating book... This may take a minute.");
    try {
      await axiosInstance.post(API_ENDPOINTS.TRANSLATION.TRANSLATE_BOOK(bookId, tId));
      toast.dismiss(loadToast);
      toast.success("Book translated successfully!");
      await loadData();
    } catch (err) {
      toast.dismiss(loadToast);
      console.error(err);
      toast.error(err.response?.data?.error || "Failed to translate book.");
    } finally {
      setIsTranslatingBook(false);
    }
  };

  // Save audiobook voice and model settings
  const handleSaveAudiobookSettings = async () => {
    if (!selectedTranslation) return;
    if (!selectedVoiceId) {
      toast.error("Please select a voice first.");
      return;
    }

    setSavingAudiobookSettings(true);
    const loadToast = toast.loading("Saving voice settings...");
    try {
      await axiosInstance.patch(API_ENDPOINTS.TRANSLATION.AUDIOBOOK_SETTINGS(bookId, selectedTranslation._id), {
        voiceId: selectedVoiceId,
        voiceName: selectedVoiceName
      });
      toast.dismiss(loadToast);
      toast.success("Voice settings updated!");
      await loadData();
    } catch (err) {
      toast.dismiss(loadToast);
      console.error(err);
      toast.error("Failed to save audiobook settings.");
    } finally {
      setSavingAudiobookSettings(false);
    }
  };

  // Generate audiobook chapter
  const handleGenerateAudiobookChapter = async (chapterId, title) => {
    if (!selectedTranslation) return;
    const tId = selectedTranslation._id;

    setIsGeneratingAudio(prev => ({ ...prev, [chapterId]: true }));
    const loadToast = toast.loading(`Generating narration for "${title}"...`);

    try {
      await axiosInstance.post(API_ENDPOINTS.TRANSLATION.AUDIOBOOK_GENERATE_CHAPTER(bookId, tId, chapterId));
      toast.dismiss(loadToast);
      toast.success(`Audio generated for "${title}"!`);
      await loadData();
    } catch (err) {
      toast.dismiss(loadToast);
      console.error(err);
      toast.error(err.response?.data?.error || `Failed to generate audio for "${title}".`);
    } finally {
      setIsGeneratingAudio(prev => ({ ...prev, [chapterId]: false }));
    }
  };

  // Play preview of ElevenLabs voice
  const handlePreviewVoice = (previewUrl) => {
    if (!previewUrl) {
      toast.error("No preview available for this voice.");
      return;
    }
    if (playingPreviewUrl === previewUrl) {
      previewAudioRef.current.pause();
      setPlayingPreviewUrl(null);
    } else {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
      }
      setPlayingPreviewUrl(previewUrl);
      previewAudioRef.current = new Audio(previewUrl);
      previewAudioRef.current.play().catch(() => {
        setPlayingPreviewUrl(null);
        toast.error("Failed to play preview.");
      });
      previewAudioRef.current.onended = () => {
        setPlayingPreviewUrl(null);
      };
    }
  };

  // Filter voices list
  const filteredVoices = useMemo(() => {
    if (!voiceSearch.trim()) return voices;
    const query = voiceSearch.toLowerCase();
    return voices.filter(
      v =>
        v.name.toLowerCase().includes(query) ||
        (v.category && v.category.toLowerCase().includes(query))
    );
  }, [voices, voiceSearch]);

  if (isLoading || !book) {
    return (
      <DashboardLayout>
        <div className="flex h-[60vh] items-center justify-center">
          <Loader2 className="size-8 animate-spin text-violet-600" />
        </div>
      </DashboardLayout>
    );
  }

  // Find remaining untranslated chapters
  const untranslatedChaptersCount = selectedTranslation
    ? book.chapters.filter(ch => {
        const transCh = selectedTranslation.chapters?.find(tc => tc.chapterId === ch._id);
        return !transCh || transCh.translationStatus !== "complete";
      }).length
    : 0;

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl px-4 py-6">
        {/* Header Navigation */}
        <div className="mb-6 flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <Link
              to={`/books/${bookId}/edit`}
              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              aria-label="Back to editor"
            >
              <ArrowLeft className="size-5" />
            </Link>
            <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white">
              <Languages className="size-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">
                Translation Studio
              </h1>
              <p className="text-sm text-gray-500">
                {selectedTranslation?.title || book.title} {book.author && `· ${book.author}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {translations.length > 0 && (
              <select
                value={selectedTranslation?._id || ""}
                onChange={(e) => {
                  const found = translations.find(t => t._id === e.target.value);
                  if (found) setSelectedTranslation(found);
                }}
                className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                {translations.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.targetLanguage} ({t.engine === "gemini" ? "Gemini" : "Groq"})
                  </option>
                ))}
              </select>
            )}

            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              onClick={() => setIsCreating(true)}
            >
              New Language
            </Button>
          </div>
        </div>

        {/* Empty State / Welcome Screen */}
        {translations.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center shadow-sm">
            <Globe className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-4 text-lg font-semibold text-gray-900">Translate Your Book</h3>
            <p className="mt-2 text-sm text-gray-500 max-w-md mx-auto">
              Expand your readership globally by translating your manuscript chapter by chapter.
              Configure a target language and AI engine to get started.
            </p>
            <div className="mt-6">
              <Button
                variant="primary"
                icon={Plus}
                onClick={() => setIsCreating(true)}
              >
                Create First Translation
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_1fr]">
            {/* Left Column: Translation Management & Chapters */}
            <div className="space-y-6">
              {/* Configuration Details */}
              {selectedTranslation && (
                <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                        {selectedTranslation.targetLanguage} Translation
                        {selectedTranslation.isActive && (
                          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-700/10">
                            Active
                          </span>
                        )}
                      </h2>
                      <div className="mt-2 flex items-center gap-1.5">
                        {["gemini", "groq"].map((eng) => (
                          <button
                            key={eng}
                            type="button"
                            onClick={() => handleChangeEngine(eng)}
                            className={`rounded-lg px-3 py-1 text-xs font-semibold border transition-colors ${
                              selectedTranslation.engine === eng
                                ? "bg-violet-600 text-white border-violet-600"
                                : "bg-white text-gray-500 border-gray-200 hover:border-violet-400 hover:text-violet-600"
                            }`}
                          >
                            {eng === "gemini" ? "Gemini" : "Groq"}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant={selectedTranslation.isActive ? "outline" : "primary"}
                        size="sm"
                        onClick={handleToggleActive}
                      >
                        {selectedTranslation.isActive ? "Deactivate" : "Set Active"}
                      </Button>

                      <button
                        onClick={handleDeleteTranslation}
                        className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                        title="Delete Translation"
                      >
                        <Trash2 className="size-5" />
                      </button>
                    </div>
                  </div>

                  {untranslatedChaptersCount > 0 && (
                    <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
                      <div className="flex items-start gap-2.5">
                        <Coins className="size-5 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-semibold text-amber-900">
                            {untranslatedChaptersCount} chapters untranslated
                          </p>
                          <p className="text-xs text-amber-700">
                            Translate all remaining chapters at once.
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="primary"
                        size="sm"
                        icon={Sparkles}
                        isLoading={isTranslatingBook}
                        onClick={handleTranslateEntireBook}
                        className="self-start sm:self-center"
                      >
                        Translate Book (≈ {bookEstimate.estimatedCredits?.toFixed(2)} Credits)
                      </Button>
                    </div>
                  )}

                  {/* Title/Subtitle editing section */}
                  <form onSubmit={handleSaveDetails} className="mt-5 border-t border-gray-100 pt-4 space-y-4">
                    <h3 className="text-sm font-bold text-gray-900">Translation Details</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="trans-title" className="block text-xs font-semibold text-gray-500 mb-1">
                          Translated Book Title
                        </label>
                        <input
                          id="trans-title"
                          value={translatedTitle}
                          onChange={(e) => setTranslatedTitle(e.target.value)}
                          placeholder="Translated Book Title"
                          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                        />
                      </div>
                      <div>
                        <label htmlFor="trans-subtitle" className="block text-xs font-semibold text-gray-500 mb-1">
                          Translated Book Subtitle
                        </label>
                        <input
                          id="trans-subtitle"
                          value={translatedSubtitle}
                          onChange={(e) => setTranslatedSubtitle(e.target.value)}
                          placeholder="Translated Book Subtitle"
                          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        isLoading={autoTranslatingDetails}
                        onClick={handleAutoTranslateDetails}
                      >
                        Auto-Translate
                      </Button>
                      <Button
                        type="submit"
                        variant="primary"
                        size="sm"
                        isLoading={savingDetails}
                      >
                        Save Details
                      </Button>
                    </div>
                  </form>
                </div>
              )}

              {/* Tabs */}
              <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                  <button
                    onClick={() => setActiveTab("translate")}
                    className={`whitespace-nowrap border-b-2 py-3 px-1 text-sm font-medium transition-colors ${
                      activeTab === "translate"
                        ? "border-violet-600 text-violet-600"
                        : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <BookOpen className="size-4" /> Chapters ({book.chapters?.length || 0})
                    </span>
                  </button>
                  <button
                    onClick={() => setActiveTab("audiobook")}
                    className={`whitespace-nowrap border-b-2 py-3 px-1 text-sm font-medium transition-colors ${
                      activeTab === "audiobook"
                        ? "border-violet-600 text-violet-600"
                        : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Headphones className="size-4" /> Audiobook Studio
                    </span>
                  </button>
                </nav>
              </div>

              {/* Tab Content: Chapters */}
              {activeTab === "translate" && selectedTranslation && (
                <div className="space-y-3">
                  {book.chapters?.map((chapter, idx) => {
                    const transCh = selectedTranslation.chapters?.find(tc => tc.chapterId === chapter._id);
                    const isTranslated = transCh?.translationStatus === "complete";
                    const isTranslating = isTranslatingChapter[chapter._id] || transCh?.translationStatus === "translating";
                    const estimate = chapterEstimates[chapter._id] || 0;

                    return (
                      <div
                        key={chapter._id}
                        className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                              Chapter {idx + 1}
                            </span>
                            {isTranslated ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-700 ring-1 ring-inset ring-green-700/10">
                                <CheckCircle2 className="size-3" /> Translated
                              </span>
                            ) : isTranslating ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-700/10">
                                <Loader2 className="size-3 animate-spin" /> Translating
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-gray-50 px-2 py-0.5 text-xs font-semibold text-gray-600 ring-1 ring-inset ring-gray-600/10">
                                Not Translated
                              </span>
                            )}
                          </div>

                          <h3 className="text-sm font-semibold text-gray-900 mt-1 truncate">
                            {chapter.title || "Untitled Chapter"}
                          </h3>

                          {isTranslated && transCh?.title && (
                            <p className="text-xs text-violet-600 font-medium mt-0.5">
                              → {transCh.title}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center justify-between md:justify-end gap-3 shrink-0">
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <Coins className="size-3.5" />
                            {estimate.toFixed(2)} credits
                          </span>

                          <Button
                            variant={isTranslated ? "outline" : "primary"}
                            size="sm"
                            isLoading={isTranslating}
                            onClick={() => handleTranslateChapter(chapter._id, chapter.title)}
                          >
                            {isTranslated ? "Re-translate" : "Translate"}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Tab Content: Audiobook Setup */}
              {activeTab === "audiobook" && selectedTranslation && (
                <div className="space-y-6">
                  {/* Voice Selector Card */}
                  <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                    <h2 className="text-sm font-bold text-gray-900 mb-1">Select Audiobook Voice</h2>
                    <p className="text-xs text-gray-500 mb-3">
                      Search and preview natural narration voices powered by ElevenLabs.
                    </p>

                    <div className="flex gap-2 mb-4">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
                        <input
                          value={voiceSearch}
                          onChange={(e) => setVoiceSearch(e.target.value)}
                          placeholder="Search voices (e.g. calm, mature, male)"
                          className="w-full rounded-xl border border-gray-200 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                        />
                      </div>
                    </div>

                    <div className="max-h-60 overflow-y-auto space-y-2 border border-gray-100 rounded-xl p-2 bg-gray-50/50">
                      {voicesLoading ? (
                        <div className="flex items-center justify-center py-8 text-gray-400">
                          <Loader2 className="size-6 animate-spin text-violet-600" />
                        </div>
                      ) : filteredVoices.length === 0 ? (
                        <p className="text-center py-6 text-sm text-gray-500">No voices match your search.</p>
                      ) : (
                        filteredVoices.map((voice) => {
                          const isSelected = voice.voiceId === selectedVoiceId;
                          const isPlaying = playingPreviewUrl === voice.previewUrl;

                          return (
                            <div
                              key={voice.voiceId}
                              className={`flex items-center gap-3 rounded-xl border p-2.5 transition-all ${
                                isSelected
                                  ? "border-violet-500 bg-violet-50"
                                  : "border-gray-200 bg-white hover:border-gray-300"
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => handlePreviewVoice(voice.previewUrl)}
                                className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-600 hover:bg-violet-100 hover:text-violet-600"
                              >
                                {isPlaying ? <Pause className="size-4" /> : <Play className="size-4 translate-x-0.5" />}
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedVoiceId(voice.voiceId);
                                  setSelectedVoiceName(voice.name);
                                }}
                                className="flex-1 text-left min-w-0"
                              >
                                <p className="text-sm font-semibold text-gray-900 truncate">{voice.name}</p>
                                {voice.category && (
                                  <p className="text-xs text-gray-500 truncate">{voice.category}</p>
                                )}
                              </button>

                              {isSelected && <Check className="size-4 text-violet-600 shrink-0" />}
                            </div>
                          );
                        })
                      )}
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4">
                      <div className="text-xs text-gray-500">
                        Selected: <span className="font-semibold text-gray-900">{selectedVoiceName || "None"}</span>
                      </div>
                      <Button
                        variant="primary"
                        size="sm"
                        isLoading={savingAudiobookSettings}
                        disabled={!selectedVoiceId}
                        onClick={handleSaveAudiobookSettings}
                      >
                        Save Voice
                      </Button>
                    </div>
                  </div>

                  {/* Audiobook Track Generation List */}
                  <div className="space-y-3">
                    <h2 className="text-sm font-bold text-gray-900">Audiobook Chapters</h2>
                    {book.chapters?.map((chapter, idx) => {
                      const transCh = selectedTranslation.chapters?.find(tc => tc.chapterId === chapter._id);
                      const isTranslated = transCh?.translationStatus === "complete";
                      
                      // Find if audio track exists for this chapter index
                      const audioTrack = audiobookState.chapters?.find(c => c.chapterIndex === idx);
                      const hasAudio = audioTrack?.status === "complete" && audioTrack?.audioUrl;
                      const isGenerating = isGeneratingAudio[chapter._id] || audioTrack?.status === "generating";

                      return (
                        <div
                          key={`audio-${chapter._id}`}
                          className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4"
                        >
                          <div className="min-w-0 flex-1">
                            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                              Chapter {idx + 1}
                            </span>
                            <h3 className="text-sm font-semibold text-gray-900 truncate">
                              {transCh?.title || chapter.title || "Untitled"}
                            </h3>

                            {hasAudio && (
                              <audio
                                src={axiosInstance.defaults.baseURL ? `${axiosInstance.defaults.baseURL.replace(/\/api$/, "")}${audioTrack.audioUrl}` : audioTrack.audioUrl}
                                controls
                                className="mt-2 w-full max-w-md h-8 text-xs focus:outline-none"
                              />
                            )}
                          </div>

                          <div className="flex items-center gap-3 shrink-0 self-end md:self-center">
                            {!isTranslated ? (
                              <span className="text-xs text-gray-400 italic">Requires translation first</span>
                            ) : isGenerating ? (
                              <span className="inline-flex items-center gap-1.5 text-xs text-amber-600 font-medium">
                                <Loader2 className="size-4 animate-spin" /> Generating...
                              </span>
                            ) : hasAudio ? (
                              <div className="flex items-center gap-2">
                                <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-700 ring-1 ring-inset ring-green-700/10">
                                  <CheckCircle2 className="size-3" /> Ready
                                </span>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  icon={RefreshCw}
                                  onClick={() => handleGenerateAudiobookChapter(chapter._id, transCh?.title || chapter.title)}
                                >
                                  Re-generate
                                </Button>
                              </div>
                            ) : (
                              <Button
                                variant="primary"
                                size="sm"
                                icon={Sparkles}
                                onClick={() => handleGenerateAudiobookChapter(chapter._id, transCh?.title || chapter.title)}
                              >
                                Generate Audio
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Information & Preview Player */}
            <div className="space-y-6">
              {/* Info Card */}
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <h2 className="text-base font-bold text-gray-900 flex items-center gap-2 mb-3">
                  <Globe className="size-5 text-violet-600" />
                  About Translation
                </h2>
                <div className="text-sm text-gray-600 space-y-3">
                  <p>
                    Translating a chapter will translate its title and body content. You can preview the translated book at any time by toggling the translation to <strong>Active</strong>.
                  </p>
                  <p>
                    While a translation is active, the <strong>Preview</strong> share links, <strong>KDP Studio</strong> formatting reports, and <strong>Exports</strong> (PDF, EPUB, DOCX) will automatically output the translated manuscript.
                  </p>
                  <p className="bg-violet-50 text-violet-800 rounded-xl p-3 border border-violet-100 text-xs">
                    <strong>Note:</strong> Editing chapters in the primary book editor will always update the original English manuscript. Changes in English will require you to re-translate the modified chapters.
                  </p>
                </div>
              </div>

              {/* Complete Audiobook Player */}
              {selectedTranslation && (
                <div className="space-y-2">
                  <h2 className="text-sm font-bold text-gray-900">Album Player</h2>
                  <div className="rounded-2xl overflow-hidden border border-gray-200 bg-white shadow-sm">
                    {audiobookState.chapters?.filter(c => c.audioUrl).length > 0 ? (
                      <AudiobookPlayer
                        title={`${selectedTranslation.targetLanguage} Translation`}
                        author={book.author}
                        coverImage={book.coverImage}
                        tracks={audiobookState.chapters.map(c => ({
                          title: c.title,
                          audioUrl: c.audioUrl,
                          duration: c.duration
                        }))}
                      />
                    ) : (
                      <div className="p-8 text-center text-sm text-gray-400">
                        <Headphones className="mx-auto mb-2 size-8 text-gray-300" />
                        No translated audio generated yet. Choose a voice and hit &quot;Generate Audio&quot; on one of the translated chapters.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modal: New Translation configuration */}
        {isCreating && (
          <div className="fixed inset-0 z-50 flex justify-center items-center px-4 py-6 sm:px-6 sm:py-10">
            <div
              onClick={() => setIsCreating(false)}
              className="bg-slate-950/60 backdrop-blur-sm absolute inset-0 animate-in fade-in duration-200"
            />
            <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl relative z-10 p-6 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
              <h3 className="text-slate-900 text-lg font-bold mb-4">Create New Translation</h3>

              <form onSubmit={handleCreateTranslation} className="space-y-4">
                <div>
                  <label htmlFor="lang-select" className="block text-sm font-medium text-gray-700 mb-1">
                    Target Language
                  </label>
                  <select
                    id="lang-select"
                    value={newLanguage}
                    onChange={(e) => setNewLanguage(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  >
                    {SUPPORTED_LANGUAGES.map((lang) => (
                      <option key={lang} value={lang}>{lang}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="engine-select" className="block text-sm font-medium text-gray-700 mb-1">
                    AI Translation Engine
                  </label>
                  <select
                    id="engine-select"
                    value={newEngine}
                    onChange={(e) => setNewEngine(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  >
                    <option value="gemini">Google Gemini</option>
                    <option value="groq">Groq AI</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="model-select" className="block text-sm font-medium text-gray-700 mb-1">
                    AI Model
                  </label>
                  <select
                    id="model-select"
                    value={newModel}
                    onChange={(e) => setNewModel(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  >
                    {ENGINES[newEngine].models.map((model) => (
                      <option key={model.id} value={model.id}>{model.name}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                  <Button
                    variant="outline"
                    type="button"
                    onClick={() => setIsCreating(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    type="submit"
                  >
                    Create Configuration
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* ── Translate Book Confirmation Dialog ───────────────────────── */}
      {showTranslateBookDialog && selectedTranslation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowTranslateBookDialog(false)}
          />
          {/* Dialog */}
          <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl border border-gray-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="bg-gradient-to-r from-violet-600 to-purple-600 px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-white/20">
                  <Sparkles className="size-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Translate Entire Book</h2>
                  <p className="text-xs text-violet-200">
                    {selectedTranslation.targetLanguage} · {selectedTranslation.engine === "gemini" ? "Gemini" : "Groq"}
                  </p>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-4">
              {/* What will be translated */}
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">What will be translated</p>
                <ul className="space-y-1.5">
                  <li className="flex items-center gap-2 text-sm text-gray-700">
                    <CheckCircle2 className="size-4 text-violet-500 shrink-0" />
                    <span>
                      <span className="font-semibold">{untranslatedChaptersCount}</span> untranslated chapter{untranslatedChaptersCount !== 1 ? "s" : ""}
                    </span>
                  </li>
                  {(!selectedTranslation.title || !selectedTranslation.subtitle) && (
                    <li className="flex items-center gap-2 text-sm text-gray-700">
                      <CheckCircle2 className="size-4 text-violet-500 shrink-0" />
                      <span>Book title{book.subtitle && !selectedTranslation.subtitle ? " & subtitle" : ""} <span className="text-gray-400">(if not yet translated)</span></span>
                    </li>
                  )}
                </ul>
              </div>

              {/* Cost */}
              <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                <div className="flex items-center gap-2">
                  <Coins className="size-4 text-amber-600 shrink-0" />
                  <span className="text-sm font-semibold text-amber-900">Estimated cost</span>
                </div>
                <span className="text-sm font-bold text-amber-900">
                  ≈ {bookEstimate.estimatedCredits?.toFixed(2)} credits
                </span>
              </div>

              <p className="text-xs text-gray-400 leading-relaxed">
                Credits are deducted upfront. Already-translated chapters are skipped.
              </p>
            </div>

            {/* Footer */}
            <div className="flex items-center gap-3 px-6 pb-6">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowTranslateBookDialog(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                className="flex-1"
                icon={Sparkles}
                onClick={handleConfirmTranslateBook}
              >
                Translate Now
              </Button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

export default TranslationStudioPage;
