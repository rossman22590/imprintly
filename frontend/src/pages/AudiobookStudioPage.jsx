import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  Headphones,
  Loader2,
  Mic,
  Square,
  Play,
  Search,
  Sparkles,
  RefreshCw,
  Download,
  Coins,
  CheckCircle2,
  XCircle,
  FileText,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import DashboardLayout from "../layouts/DashboardLayout";
import axiosInstance from "../lib/axios";
import { API_ENDPOINTS } from "../utils/api-endpoints";
import Button from "../components/ui/Button";
import AudiobookPlayer from "../components/audiobook/AudiobookPlayer";

const POLL_INTERVAL_MS = 2500;
const SCRIPT_SAVE_DELAY_MS = 800;

const NON_NARRATABLE_SECTION_HEADINGS = [
  /^ai cover prompt\b/i,
  /^ai image prompt(?:\s*[–-]\s*book cover)?\b/i,
  /^ai consistency notes\b/i,
  /^ai source warnings\b/i,
  /^cover prompt\b/i,
];

const isNonNarratableSectionHeading = (line = "") => {
  const cleaned = String(line || "")
    .replace(/^#{1,6}\s+/, "")
    .trim();

  if (!cleaned) return false;

  return NON_NARRATABLE_SECTION_HEADINGS.some((pattern) => pattern.test(cleaned));
};

const stripNonNarratableSections = (text = "") => {
  const lines = String(text || "").split(/\r?\n/);
  const kept = [];
  let skipping = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (isNonNarratableSectionHeading(trimmed)) {
      skipping = true;
      continue;
    }

    if (/^#{1,6}\s+/.test(trimmed)) {
      skipping = false;
    }

    if (!skipping) {
      kept.push(line);
    }
  }

  return kept
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

function buildDefaultChapterScript(chapter, chapterIndex) {
  const chapterNumber = chapterIndex + 1;
  const title = chapter.title?.trim() || `Chapter ${chapterNumber}`;
  const body = stripNonNarratableSections(String(chapter.content || ""))
    .replace(/```[a-z]*\n[\s\S]*?\n```/gi, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^(#{1,6})\s+/gm, "")
    .replace(/^\s*>\s+/gm, "")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    .replace(/(~~)(.*?)\1/g, "$2")
    .replace(/^\s*[-*_]{3,}\s*$/gm, "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{2,}/g, "\n\n")
    .trim();

  if (!body) return "";

  return `Chapter ${chapterNumber}\n${title}\n\n${body}`;
}

function formatTrackDuration(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  const mins = Math.floor(total / 60);
  const secs = total % 60;

  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function formatVersionDate(value) {
  if (!value) return "Unknown date";

  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function AudiobookStudioPage() {
  const { bookId } = useParams();
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(true);
  const [meta, setMeta] = useState({ title: "", author: "", coverImage: "" });
  const [audiobook, setAudiobook] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [models, setModels] = useState([]);

  const [voices, setVoices] = useState([]);
  const [voiceSearch, setVoiceSearch] = useState("");
  const [voicesLoading, setVoicesLoading] = useState(true);
  const [hasElevenLabsKey, setHasElevenLabsKey] = useState(true);
  const [selectedVoiceId, setSelectedVoiceId] = useState("");
  const [selectedVoiceName, setSelectedVoiceName] = useState("");
  const [selectedVoicePublicUserId, setSelectedVoicePublicUserId] = useState("");
  const [selectedModelId, setSelectedModelId] = useState("");

  const [estimate, setEstimate] = useState(null);
  const [introScript, setIntroScript] = useState("");
  const [introBusy, setIntroBusy] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  const [job, setJob] = useState(null);
  const [generatingScope, setGeneratingScope] = useState("");

  const [downloading, setDownloading] = useState("");
  const [versionBusyIndex, setVersionBusyIndex] = useState(null);
  const [introVersionBusy, setIntroVersionBusy] = useState(false);
  const [chapterScripts, setChapterScripts] = useState({});
  const [expandedScriptIndex, setExpandedScriptIndex] = useState(null);
  const [scriptSavingIndex, setScriptSavingIndex] = useState(null);
  const [scriptResetIndex, setScriptResetIndex] = useState(null);
  const [estimateVersion, setEstimateVersion] = useState(0);

  const previewAudioRef = useRef(null);
  const pollRef = useRef(null);
  const resumedJobRef = useRef("");
  const recorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const chapterScriptsRef = useRef({});
  const scriptSaveTimersRef = useRef({});
  const dirtyScriptsRef = useRef(new Set());

  // ── Load chapters (manuscript), audiobook state, and voices ───────────────
  const loadAudiobook = useCallback(async () => {
    const { data } = await axiosInstance.get(
      `${API_ENDPOINTS.AUDIOBOOK.BASE}/${bookId}`
    );

    setMeta({
      title: data.title || "",
      author: data.author || "",
      coverImage: data.coverImage || "",
    });
    setAudiobook(data.audiobook || {});
    setModels(data.models || []);

    return data;
  }, [bookId]);

  useEffect(() => {
    let active = true;

    const init = async () => {
      setIsLoading(true);

      try {
        // Manuscript chapters (for per-chapter controls + counts).
        const bookResponse = await axiosInstance.get(
          `${API_ENDPOINTS.BOOKS.GET_BY_ID}/${bookId}`
        );
        const data = await loadAudiobook();

        if (!active) return;

        const bookChapters = Array.isArray(bookResponse.data?.book?.chapters)
          ? bookResponse.data.book.chapters
          : [];

        setChapters(bookChapters);

        const scriptMap = {};
        if (Array.isArray(data.chapterScripts) && data.chapterScripts.length) {
          data.chapterScripts.forEach((entry) => {
            scriptMap[entry.chapterIndex] = entry.script || "";
          });
        } else {
          bookChapters.forEach((chapter, index) => {
            scriptMap[index] = buildDefaultChapterScript(chapter, index);
          });
        }

        setChapterScripts(scriptMap);
        chapterScriptsRef.current = scriptMap;
        dirtyScriptsRef.current = new Set();

        const existing = data.audiobook || {};

        setSelectedVoiceId(existing.voiceId || "");
        setSelectedVoiceName(existing.voiceName || "");
        setSelectedModelId(
          existing.modelId ||
            data.models?.[0]?.id ||
            "eleven_v3"
        );
        setIntroScript(existing.intro?.script || "");
      } catch (error) {
        console.error("Error loading audiobook:", error);
        toast.error("Failed to load the audiobook studio.");
        navigate("/dashboard");
      } finally {
        if (active) setIsLoading(false);
      }
    };

    init();

    return () => {
      active = false;
    };
  }, [bookId, loadAudiobook, navigate]);

  const loadVoices = useCallback(async (search = "") => {
    setVoicesLoading(true);

    try {
      const { data } = await axiosInstance.get(API_ENDPOINTS.AUDIOBOOK.VOICES, {
        params: search ? { search } : {},
      });

      setVoices(data.voices || []);
      setHasElevenLabsKey(data.hasApiKey !== false);

      if (data.models?.length) setModels(data.models);
    } catch (error) {
      console.error("Error loading voices:", error);
      toast.error(
        error.response?.data?.error ||
          "Failed to load ElevenLabs voices. Is the API key configured?"
      );
    } finally {
      setVoicesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadVoices();
  }, [loadVoices]);

  // ── Credit estimate (refetch when model changes) ──────────────────────────
  useEffect(() => {
    if (!selectedModelId || isLoading) return undefined;

    let active = true;

    (async () => {
      try {
        const { data } = await axiosInstance.post(
          `${API_ENDPOINTS.AUDIOBOOK.BASE}/${bookId}/estimate`,
          { modelId: selectedModelId }
        );

        if (active) setEstimate(data);
      } catch {
        if (active) setEstimate(null);
      }
    })();

    return () => {
      active = false;
    };
  }, [bookId, selectedModelId, isLoading, estimateVersion]);

  const saveChapterScript = useCallback(
    async (chapterIndex, script) => {
      setScriptSavingIndex(chapterIndex);

      try {
        const { data } = await axiosInstance.patch(
          API_ENDPOINTS.AUDIOBOOK.CHAPTER_SCRIPT(bookId, chapterIndex),
          { script }
        );

        dirtyScriptsRef.current.delete(chapterIndex);
        setAudiobook(data.audiobook);

        if (Array.isArray(data.chapterScripts)) {
          const next = { ...chapterScriptsRef.current };
          data.chapterScripts.forEach((entry) => {
            next[entry.chapterIndex] = entry.script || "";
          });
          chapterScriptsRef.current = next;
          setChapterScripts(next);
        }

        setEstimateVersion((value) => value + 1);
      } catch (error) {
        toast.error(error.response?.data?.error || "Failed to save chapter script.");
      } finally {
        setScriptSavingIndex(null);
      }
    },
    [bookId]
  );

  const scheduleScriptSave = useCallback(
    (chapterIndex, script) => {
      dirtyScriptsRef.current.add(chapterIndex);
      chapterScriptsRef.current = {
        ...chapterScriptsRef.current,
        [chapterIndex]: script,
      };

      if (scriptSaveTimersRef.current[chapterIndex]) {
        clearTimeout(scriptSaveTimersRef.current[chapterIndex]);
      }

      scriptSaveTimersRef.current[chapterIndex] = setTimeout(() => {
        saveChapterScript(chapterIndex, script);
      }, SCRIPT_SAVE_DELAY_MS);
    },
    [saveChapterScript]
  );

  const flushChapterScriptSave = useCallback(
    async (chapterIndex) => {
      if (scriptSaveTimersRef.current[chapterIndex]) {
        clearTimeout(scriptSaveTimersRef.current[chapterIndex]);
        delete scriptSaveTimersRef.current[chapterIndex];
      }

      if (!dirtyScriptsRef.current.has(chapterIndex)) return;

      await saveChapterScript(
        chapterIndex,
        chapterScriptsRef.current[chapterIndex] || ""
      );
    },
    [saveChapterScript]
  );

  const flushAllScriptSaves = useCallback(async () => {
    const pendingIndexes = [...dirtyScriptsRef.current];

    await Promise.all(
      pendingIndexes.map((chapterIndex) => flushChapterScriptSave(chapterIndex))
    );
  }, [flushChapterScriptSave]);

  const handleChapterScriptChange = useCallback(
    (chapterIndex, value) => {
      setChapterScripts((current) => ({
        ...current,
        [chapterIndex]: value,
      }));
      scheduleScriptSave(chapterIndex, value);
    },
    [scheduleScriptSave]
  );

  const handleResetChapterScript = useCallback(
    async (chapterIndex) => {
      setScriptResetIndex(chapterIndex);

      try {
        const { data } = await axiosInstance.post(
          API_ENDPOINTS.AUDIOBOOK.CHAPTER_SCRIPT_RESET(bookId, chapterIndex)
        );

        const nextScript = data.script || "";
        const next = {
          ...chapterScriptsRef.current,
          [chapterIndex]: nextScript,
        };

        chapterScriptsRef.current = next;
        dirtyScriptsRef.current.delete(chapterIndex);
        setChapterScripts(next);
        setAudiobook(data.audiobook);
        setEstimateVersion((value) => value + 1);
        toast.success("Script reset from book.");
      } catch (error) {
        toast.error(error.response?.data?.error || "Failed to reset script.");
      } finally {
        setScriptResetIndex(null);
      }
    },
    [bookId]
  );

  const handleToggleChapterScript = useCallback((chapterIndex) => {
    setExpandedScriptIndex((current) =>
      current === chapterIndex ? null : chapterIndex
    );
  }, []);

  // ── Job polling ───────────────────────────────────────────────────────────
  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const startPolling = useCallback(
    (jobId) => {
      stopPolling();

      pollRef.current = setInterval(async () => {
        try {
          const { data } = await axiosInstance.get(
            `${API_ENDPOINTS.AUDIOBOOK.JOBS}/${jobId}`
          );
          const nextJob = data.job;

          setJob(nextJob);

          if (nextJob?.scope === "chapter" && Number.isInteger(nextJob.chapterIndex)) {
            setGeneratingScope(`chapter-${nextJob.chapterIndex}`);
          } else if (nextJob?.scope === "all") {
            setGeneratingScope("all");
          }

          if (nextJob?.status === "generating") {
            await loadAudiobook();
          }

          if (
            nextJob &&
            (nextJob.status === "complete" || nextJob.status === "failed")
          ) {
            stopPolling();
            setGeneratingScope("");
            resumedJobRef.current = "";
            await loadAudiobook();

            if (nextJob.status === "complete") {
              if (nextJob.scope === "chapter" && Number.isInteger(nextJob.chapterIndex)) {
                toast.success(`Chapter ${nextJob.chapterIndex + 1} narration ready!`);
              } else {
                toast.success("Audiobook ready!");
              }
            } else {
              toast.error(nextJob.error || "Audiobook generation failed.");
            }
          }
        } catch (error) {
          console.error("Error polling audiobook job:", error);
        }
      }, POLL_INTERVAL_MS);
    },
    [loadAudiobook, stopPolling]
  );

  useEffect(() => {
    if (isLoading) return undefined;

    const jobId = audiobook?.jobId;
    if (audiobook?.status !== "generating" || !jobId) {
      resumedJobRef.current = "";
      return undefined;
    }

    if (resumedJobRef.current === jobId || pollRef.current) {
      return undefined;
    }

    resumedJobRef.current = jobId;
    startPolling(jobId);

    return () => stopPolling();
  }, [isLoading, audiobook?.jobId, audiobook?.status, startPolling, stopPolling]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const generate = useCallback(
    async (scope, chapterIndex = null) => {
      if (!selectedVoiceId) {
        toast.error("Select a voice first.");
        return;
      }

      if (scope === "chapter") {
        await flushChapterScriptSave(Number(chapterIndex));
      } else {
        await flushAllScriptSaves();
      }

      setGeneratingScope(scope === "chapter" ? `chapter-${chapterIndex}` : "all");

      try {
        const payload = {
          voiceId: selectedVoiceId,
          voiceName: selectedVoiceName,
          publicUserId: selectedVoicePublicUserId,
          modelId: selectedModelId,
          scope,
        };

        if (scope === "chapter") {
          payload.chapterIndex = Number(chapterIndex);
        }

        const { data } = await axiosInstance.post(
          `${API_ENDPOINTS.AUDIOBOOK.BASE}/${bookId}/generate`,
          payload
        );

        setJob(data.job);
        toast.success(
          scope === "chapter"
            ? `Generating chapter ${Number(chapterIndex) + 1}...`
            : "Generation started."
        );
        startPolling(data.job.id);
        await loadAudiobook();
      } catch (error) {
        setGeneratingScope("");
        toast.error(
          error.response?.data?.error || "Failed to start generation."
        );
      }
    },
    [
      bookId,
      selectedVoiceId,
      selectedVoiceName,
      selectedVoicePublicUserId,
      selectedModelId,
      startPolling,
      loadAudiobook,
      flushChapterScriptSave,
      flushAllScriptSaves,
    ]
  );

  // ── Intro ──────────────────────────────────────────────────────────────────
  const generateIntro = useCallback(async () => {
    if (!introScript.trim()) {
      toast.error("Write an intro script first.");
      return;
    }

    if (!selectedVoiceId) {
      toast.error("Select a voice first.");
      return;
    }

    setIntroBusy(true);

    try {
      const { data } = await axiosInstance.post(
        `${API_ENDPOINTS.AUDIOBOOK.BASE}/${bookId}/intro`,
        {
          mode: "generated",
          script: introScript,
          voiceId: selectedVoiceId,
          voiceName: selectedVoiceName,
          publicUserId: selectedVoicePublicUserId,
          modelId: selectedModelId,
        }
      );

      setAudiobook(data.audiobook);
      toast.success("Intro narration generated.");
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to generate intro.");
    } finally {
      setIntroBusy(false);
    }
  }, [
    bookId,
    introScript,
    selectedVoiceId,
    selectedVoiceName,
    selectedVoicePublicUserId,
    selectedModelId,
  ]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      recordedChunksRef.current = [];

      const recorder = new MediaRecorder(stream);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordedChunksRef.current.push(event.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());

        const blob = new Blob(recordedChunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        const formData = new FormData();
        const extension = (recorder.mimeType || "audio/webm").includes("mp4")
          ? "mp4"
          : "webm";

        formData.append("introAudio", blob, `intro.${extension}`);
        formData.append("mode", "recorded");

        setIntroBusy(true);

        try {
          const { data } = await axiosInstance.post(
            `${API_ENDPOINTS.AUDIOBOOK.BASE}/${bookId}/intro`,
            formData,
            { headers: { "Content-Type": "multipart/form-data" } }
          );

          setAudiobook(data.audiobook);
          toast.success("Intro recording saved.");
        } catch (error) {
          toast.error(error.response?.data?.error || "Failed to save recording.");
        } finally {
          setIntroBusy(false);
        }
      };

      recorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch {
      toast.error("Microphone access is required to record an intro.");
    }
  }, [bookId]);

  const stopRecording = useCallback(() => {
    recorderRef.current?.stop();
    setIsRecording(false);
  }, []);

  // ── Downloads ───────────────────────────────────────────────────────────────
  const downloadAlbum = useCallback(
    async (format) => {
      setDownloading(format);

      const loadingToast = toast.loading(
        `Building ${format.toUpperCase()}...`
      );

      try {
        const { data } = await axiosInstance.get(
          `${API_ENDPOINTS.AUDIOBOOK.BASE}/${bookId}/album.${format}`,
          { responseType: "blob" }
        );

        const url = window.URL.createObjectURL(new Blob([data]));
        const linkEl = document.createElement("a");
        const safeTitle = (meta.title || "audiobook").replace(/[^a-zA-Z0-9]/g, "_");

        linkEl.href = url;
        linkEl.setAttribute(
          "download",
          format === "zip" ? `${safeTitle}_audiobook.zip` : `${safeTitle}.m4b`
        );
        document.body.appendChild(linkEl);
        linkEl.click();
        linkEl.parentNode.removeChild(linkEl);
        window.URL.revokeObjectURL(url);

        toast.dismiss(loadingToast);
        toast.success("Download ready.");
      } catch (error) {
        toast.dismiss(loadingToast);
        toast.error(error.response?.data?.error || "Failed to build download.");
      } finally {
        setDownloading("");
      }
    },
    [bookId, meta.title]
  );

  const previewVoice = useCallback((url) => {
    if (!url) {
      toast("This voice has no preview.");
      return;
    }

    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
    }

    const audio = new Audio(url);
    previewAudioRef.current = audio;
    audio.play().catch(() => toast.error("Could not play voice preview."));
  }, []);

  const sortedVoices = useMemo(() => {
    if (!selectedVoiceId) return voices;

    const selectedIndex = voices.findIndex(
      (voice) => voice.voiceId === selectedVoiceId
    );

    if (selectedIndex > 0) {
      const next = [...voices];
      const [selected] = next.splice(selectedIndex, 1);
      return [selected, ...next];
    }

    if (selectedIndex === -1 && selectedVoiceName) {
      return [
        {
          voiceId: selectedVoiceId,
          name: selectedVoiceName,
          category: "Selected",
          previewUrl: "",
          publicUserId: selectedVoicePublicUserId,
        },
        ...voices,
      ];
    }

    return voices;
  }, [voices, selectedVoiceId, selectedVoiceName, selectedVoicePublicUserId]);

  const handleSelectChapterVersion = useCallback(
    async (chapterIndex, versionId) => {
      setVersionBusyIndex(chapterIndex);

      try {
        const { data } = await axiosInstance.patch(
          API_ENDPOINTS.AUDIOBOOK.CHAPTER_VERSION(bookId, chapterIndex),
          { versionId }
        );

        setAudiobook(data.audiobook);
        toast.success("Album track updated.");
      } catch (error) {
        toast.error(
          error.response?.data?.error || "Failed to update album track."
        );
      } finally {
        setVersionBusyIndex(null);
      }
    },
    [bookId]
  );

  const handleSelectIntroVersion = useCallback(
    async (versionId) => {
      setIntroVersionBusy(true);

      try {
        const { data } = await axiosInstance.patch(
          API_ENDPOINTS.AUDIOBOOK.INTRO_VERSION(bookId),
          { versionId }
        );

        setAudiobook(data.audiobook);
        toast.success("Intro album track updated.");
      } catch (error) {
        toast.error(
          error.response?.data?.error || "Failed to update intro album track."
        );
      } finally {
        setIntroVersionBusy(false);
      }
    },
    [bookId]
  );

  // ── Derived ──────────────────────────────────────────────────────────────────
  const audiobookChapters = useMemo(
    () => audiobook?.chapters || [],
    [audiobook]
  );

  const chapterAudioByIndex = useMemo(() => {
    const map = new Map();
    audiobookChapters.forEach((entry) => map.set(entry.chapterIndex, entry));
    return map;
  }, [audiobookChapters]);

  const introVersions = useMemo(() => {
    const intro = audiobook?.intro;
    if (!intro || intro.mode === "none") return [];

    if (Array.isArray(intro.versions) && intro.versions.length > 0) {
      return intro.versions;
    }

    if (intro.audioUrl) {
      return [
        {
          id: intro.activeVersionId || "legacy",
          audioUrl: intro.audioUrl,
          duration: intro.duration || 0,
          voiceName: audiobook?.voiceName || "",
          createdAt: intro.updatedAt,
        },
      ];
    }

    return [];
  }, [audiobook]);

  const activeIntroVersionId =
    audiobook?.intro?.activeVersionId ||
    introVersions[introVersions.length - 1]?.id ||
    "";

  const activeIntroAudio = useMemo(() => {
    if (introVersions.length === 0) return null;

    const selected =
      introVersions.find((version) => version.id === activeIntroVersionId) ||
      introVersions[introVersions.length - 1];

    if (!selected?.audioUrl) return null;

    return {
      title: "Introduction",
      audioUrl: selected.audioUrl,
      duration: selected.duration || 0,
    };
  }, [introVersions, activeIntroVersionId]);

  const playerTracks = useMemo(() => {
    const tracks = [];

    if (activeIntroAudio) {
      tracks.push(activeIntroAudio);
    }

    [...audiobookChapters]
      .filter((entry) => entry.audioUrl && entry.status !== "generating")
      .sort((a, b) => a.chapterIndex - b.chapterIndex)
      .forEach((entry) =>
        tracks.push({
          title: entry.title,
          audioUrl: entry.audioUrl,
          duration: entry.duration || 0,
        })
      );

    return tracks;
  }, [audiobook, audiobookChapters, activeIntroAudio]);

  const chapterEstimateMap = useMemo(() => {
    const map = new Map();
    if (estimate?.perChapter) {
      estimate.perChapter.forEach((item) => {
        map.set(item.chapterIndex, item);
      });
    }
    return map;
  }, [estimate]);

  const isFullBookGenerating =
    generatingScope === "all" ||
    ((job?.status === "generating" || job?.status === "queued") &&
      (job?.scope === "all" || !job?.scope));

  const isChapterGenerating = useCallback(
    (index) =>
      generatingScope === `chapter-${index}` ||
      ((job?.status === "generating" || job?.status === "queued") &&
        job?.scope === "chapter" &&
        job?.chapterIndex === index),
    [generatingScope, job]
  );

  const isAnyJobActive =
    isFullBookGenerating ||
    generatingScope.startsWith("chapter-") ||
    ((job?.status === "generating" || job?.status === "queued") &&
      job?.scope === "chapter");

  const hasAudio = playerTracks.length > 0;

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex h-[60vh] items-center justify-center">
          <Loader2 className="size-8 animate-spin text-violet-600" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl px-4 py-6">
        {/* Header */}
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
              <Headphones className="size-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">
                Audiobook Studio
              </h1>
              <p className="text-sm text-gray-500">
                {meta.title} {meta.author && `· ${meta.author}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={Download}
              isLoading={downloading === "zip"}
              disabled={!hasAudio || Boolean(downloading)}
              onClick={() => downloadAlbum("zip")}
            >
              Album (ZIP)
            </Button>
            <Button
              variant="outline"
              size="sm"
              icon={Download}
              isLoading={downloading === "m4b"}
              disabled={!hasAudio || Boolean(downloading)}
              onClick={() => downloadAlbum("m4b")}
            >
              Audiobook (M4B)
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.1fr]">
          {/* Left: controls */}
          <div className="space-y-6">
            {/* Voice picker */}
            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold text-gray-900">
                1. Choose a voice
              </h2>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  loadVoices(voiceSearch);
                }}
                className="mb-3 flex gap-2"
              >
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
                  <input
                    value={voiceSearch}
                    onChange={(e) => setVoiceSearch(e.target.value)}
                    placeholder="Search voices (e.g. calm, narration, deep)"
                    className="w-full rounded-xl border border-gray-200 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>
                <Button type="submit" variant="secondary" size="sm">
                  Search
                </Button>
              </form>

              {!hasElevenLabsKey && (
                <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  ElevenLabs API key is missing — showing demo voices only. Add{" "}
                  <code className="font-mono">ELEVENLABS_API_KEY</code> to{" "}
                  <code className="font-mono">backend/.env</code> and restart the
                  backend.
                </p>
              )}

              <div className="max-h-72 space-y-2 overflow-auto pr-1">
                {voicesLoading ? (
                  <div className="flex items-center justify-center py-8 text-gray-400">
                    <Loader2 className="size-5 animate-spin" />
                  </div>
                ) : voices.length === 0 ? (
                  <p className="py-6 text-center text-sm text-gray-500">
                    No voices found.
                  </p>
                ) : (
                  sortedVoices.map((voice) => {
                    const isSelected = voice.voiceId === selectedVoiceId;

                    return (
                      <div
                        key={voice.voiceId}
                        className={`flex items-center gap-3 rounded-xl border p-3 transition-colors ${
                          isSelected
                            ? "border-violet-500 bg-violet-50"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => previewVoice(voice.previewUrl)}
                          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-600 hover:bg-violet-100 hover:text-violet-600"
                          aria-label={`Preview ${voice.name}`}
                        >
                          <Play className="size-4 translate-x-0.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedVoiceId(voice.voiceId);
                            setSelectedVoiceName(voice.name);
                            setSelectedVoicePublicUserId(voice.publicUserId || "");
                          }}
                          className="min-w-0 flex-1 text-left"
                        >
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-medium text-gray-900">
                              {voice.name}
                            </p>
                            {voice.publicUserId && (
                              <span className="inline-flex shrink-0 items-center rounded-md bg-purple-50 px-1.5 py-0.5 text-[10px] font-medium text-purple-700 ring-1 ring-inset ring-purple-700/10">
                                Community
                              </span>
                            )}
                          </div>
                          {voice.category && (
                            <p className="truncate text-xs text-gray-500">
                              {voice.category}
                            </p>
                          )}
                        </button>

                        {isSelected && (
                          <CheckCircle2 className="size-5 shrink-0 text-violet-600" />
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </section>

            {/* Model + estimate */}
            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold text-gray-900">
                2. Narration model
              </h2>

              <select
                value={selectedModelId}
                onChange={(e) => setSelectedModelId(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                {models.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.label}
                  </option>
                ))}
              </select>

              {estimate && (
                <div className="mt-3 flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
                  <Coins className="size-4 shrink-0" />
                  <span>
                    Full audiobook ≈{" "}
                    <strong>
                      {Number(estimate.totalCredits).toLocaleString(undefined, {
                        maximumFractionDigits: 2,
                      })}{" "}
                      credits
                    </strong>{" "}
                    ({estimate.totalCharCount.toLocaleString()} characters)
                  </span>
                </div>
              )}
            </section>

            {/* Intro */}
            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="mb-1 text-sm font-semibold text-gray-900">
                3. Intro (optional)
              </h2>
              <p className="mb-3 text-xs text-gray-500">
                Write a short intro and generate narration, or record your own.
              </p>

              <textarea
                value={introScript}
                onChange={(e) => setIntroScript(e.target.value)}
                rows={4}
                placeholder={`Welcome to ${meta.title || "this audiobook"}, written by ${
                  meta.author || "the author"
                }...`}
                className="w-full rounded-xl border border-gray-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              />

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  icon={Sparkles}
                  isLoading={introBusy}
                  onClick={generateIntro}
                >
                  Generate intro
                </Button>

                {isRecording ? (
                  <Button
                    variant="destructive"
                    size="sm"
                    icon={Square}
                    onClick={stopRecording}
                  >
                    Stop recording
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    icon={Mic}
                    disabled={introBusy}
                    onClick={startRecording}
                  >
                    Record intro
                  </Button>
                )}

                {activeIntroAudio && (
                  <span className="inline-flex items-center gap-1 text-xs text-green-600">
                    <CheckCircle2 className="size-4" />
                    Intro ready ({audiobook.intro.mode})
                  </span>
                )}
              </div>

              {introVersions.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <label
                    htmlFor="intro-version"
                    className="text-xs font-medium text-gray-500"
                  >
                    Album track
                  </label>
                  <select
                    id="intro-version"
                    value={activeIntroVersionId}
                    disabled={introVersionBusy}
                    onChange={(event) =>
                      handleSelectIntroVersion(event.target.value)
                    }
                    className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-50"
                    aria-label="Select intro album version"
                  >
                    {introVersions.map((version, versionIndex) => (
                      <option key={version.id} value={version.id}>
                        Version {versionIndex + 1} ·{" "}
                        {formatTrackDuration(version.duration)} ·{" "}
                        {version.voiceName || audiobook?.voiceName || "Voice"} ·{" "}
                        {formatVersionDate(version.createdAt)}
                      </option>
                    ))}
                  </select>
                  {introVersionBusy && (
                    <Loader2 className="size-3.5 animate-spin text-violet-600" />
                  )}
                </div>
              )}
            </section>

            {/* Generate */}
            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="mb-1 text-sm font-semibold text-gray-900">
                4. Chapter scripts & narration
              </h2>
              <p className="mb-3 text-xs text-gray-500">
                Each script starts with the chapter number and title, then the
                narrated text. Edit before generating.
              </p>

              <Button
                variant="primary"
                size="md"
                icon={isFullBookGenerating ? undefined : Headphones}
                isLoading={isFullBookGenerating}
                disabled={isAnyJobActive || !selectedVoiceId}
                onClick={() => generate("all")}
                className="w-full"
              >
                {hasAudio ? "Regenerate full audiobook" : "Generate audiobook"}
              </Button>

              {job && job.status === "generating" && job.progress && (
                <div className="mt-3">
                  <div className="mb-1 flex justify-between text-xs text-gray-500">
                    <span>{job.progress.message}</span>
                    <span>
                      {job.progress.completed}/{job.progress.total}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full bg-gradient-to-r from-violet-600 to-purple-600 transition-all"
                      style={{
                        width: `${
                          job.progress.total
                            ? (job.progress.completed / job.progress.total) * 100
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Per-chapter list */}
              <div className="mt-4 space-y-2">
                {chapters.map((chapter, index) => {
                  const audioEntry = chapterAudioByIndex.get(index);
                  const status = audioEntry?.status || "empty";
                  const est = chapterEstimateMap.get(index);
                  const chapterVersions = Array.isArray(audioEntry?.versions)
                    ? audioEntry.versions
                    : audioEntry?.audioUrl
                    ? [
                        {
                          id: audioEntry.activeVersionId || "legacy",
                          audioUrl: audioEntry.audioUrl,
                          duration: audioEntry.duration || 0,
                          voiceName: audioEntry.voiceName || audiobook?.voiceName || "",
                          createdAt: audioEntry.updatedAt,
                        },
                      ]
                    : [];
                  const activeVersionId =
                    audioEntry?.activeVersionId ||
                    chapterVersions[chapterVersions.length - 1]?.id ||
                    "";
                  const chapterScript = chapterScripts[index] || "";
                  const isScriptExpanded = expandedScriptIndex === index;

                  return (
                    <div
                      key={index}
                      className="rounded-lg border border-gray-100 px-2 py-2 hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-6 shrink-0 text-xs text-gray-400">
                          {index + 1}
                        </span>
                        <div className="min-w-0 flex-1 truncate text-sm text-gray-700 flex items-center gap-2">
                          <span className="truncate">
                            {chapter.title || `Chapter ${index + 1}`}
                          </span>
                          {est && (
                            <span className="shrink-0 text-xs font-normal text-gray-400">
                              ({est.charCount.toLocaleString()} chars · {est.credits} credits)
                            </span>
                          )}
                        </div>

                        {status === "complete" && (
                          <CheckCircle2 className="size-4 shrink-0 text-green-500" />
                        )}
                        {status === "failed" && (
                          <XCircle className="size-4 shrink-0 text-red-500" />
                        )}

                        {status === "generating" || isChapterGenerating(index) ? (
                          <span className="inline-flex items-center gap-1 rounded-lg bg-violet-50 px-2 py-1 text-xs font-medium text-violet-700 ring-1 ring-inset ring-violet-700/10">
                            <Loader2 className="size-3 animate-spin" />
                            Generating
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => generate("chapter", index)}
                            disabled={
                              isFullBookGenerating ||
                              isChapterGenerating(index) ||
                              !selectedVoiceId
                            }
                            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                              status === "complete"
                                ? "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                : status === "failed"
                                ? "bg-red-50 text-red-700 hover:bg-red-100"
                                : "bg-violet-600 text-white hover:bg-violet-700"
                            }`}
                            title={
                              status === "complete"
                                ? "Regenerate chapter narration"
                                : status === "failed"
                                ? "Retry chapter narration"
                                : "Generate chapter narration"
                            }
                          >
                            {generatingScope === `chapter-${index}` ? (
                              <Loader2 className="size-3 animate-spin" />
                            ) : status === "complete" ? (
                              <>
                                <RefreshCw className="size-3" />
                                <span>Regenerate</span>
                              </>
                            ) : status === "failed" ? (
                              <>
                                <RefreshCw className="size-3" />
                                <span>Retry</span>
                              </>
                            ) : (
                              <>
                                <Sparkles className="size-3" />
                                <span>Generate</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>

                      <div className="mt-2 ml-8">
                        <button
                          type="button"
                          onClick={() => handleToggleChapterScript(index)}
                          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
                          aria-expanded={isScriptExpanded}
                          aria-controls={`chapter-script-${index}`}
                        >
                          <FileText className="size-3.5" />
                          <span>{isScriptExpanded ? "Hide script" : "Edit script"}</span>
                          {isScriptExpanded ? (
                            <ChevronUp className="size-3.5" />
                          ) : (
                            <ChevronDown className="size-3.5" />
                          )}
                        </button>

                        {isScriptExpanded && (
                          <div
                            id={`chapter-script-${index}`}
                            className="mt-2 space-y-2"
                          >
                            <textarea
                              value={chapterScript}
                              onChange={(event) =>
                                handleChapterScriptChange(index, event.target.value)
                              }
                              rows={8}
                              placeholder={`Chapter ${index + 1}\n${
                                chapter.title || `Chapter ${index + 1}`
                              }\n\nPaste or edit the narration script here...`}
                              className="w-full rounded-xl border border-gray-200 p-3 font-mono text-xs leading-relaxed text-gray-800 focus:outline-none focus:ring-2 focus:ring-violet-500"
                              aria-label={`Narration script for ${
                                chapter.title || `Chapter ${index + 1}`
                              }`}
                            />

                            <div className="flex flex-wrap items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                isLoading={scriptResetIndex === index}
                                disabled={
                                  scriptSavingIndex === index ||
                                  scriptResetIndex === index
                                }
                                onClick={() => handleResetChapterScript(index)}
                              >
                                Reset from book
                              </Button>

                              {scriptSavingIndex === index && (
                                <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                                  <Loader2 className="size-3 animate-spin" />
                                  Saving script...
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {chapterVersions.length > 0 && (
                        <div className="mt-2 ml-8 flex flex-wrap items-center gap-2">
                          <label
                            htmlFor={`chapter-version-${index}`}
                            className="text-xs font-medium text-gray-500"
                          >
                            Album track
                          </label>
                          <select
                            id={`chapter-version-${index}`}
                            value={activeVersionId}
                            disabled={versionBusyIndex === index}
                            onChange={(event) =>
                              handleSelectChapterVersion(index, event.target.value)
                            }
                            className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-50"
                            aria-label={`Select album version for ${chapter.title || `Chapter ${index + 1}`}`}
                          >
                            {chapterVersions.map((version, versionIndex) => (
                              <option key={version.id} value={version.id}>
                                Version {versionIndex + 1} ·{" "}
                                {formatTrackDuration(version.duration)} ·{" "}
                                {version.voiceName || "Voice"} ·{" "}
                                {formatVersionDate(version.createdAt)}
                              </option>
                            ))}
                          </select>
                          {versionBusyIndex === index && (
                            <Loader2 className="size-3.5 animate-spin text-violet-600" />
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          {/* Right: player */}
          <div className="lg:sticky lg:top-6 lg:self-start">
            <h2 className="mb-3 text-sm font-semibold text-gray-900">Preview</h2>
            <AudiobookPlayer
              tracks={playerTracks}
              coverImage={meta.coverImage}
              title={meta.title}
              author={meta.author}
            />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default AudiobookStudioPage;
