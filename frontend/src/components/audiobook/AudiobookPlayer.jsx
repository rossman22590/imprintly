import { useEffect, useRef, useState } from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Gauge,
  Music2,
} from "lucide-react";
import { resolveImageUrl } from "../../utils/api-endpoints";

const SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2];

function formatTime(seconds) {
  const numeric = Math.max(0, Number(seconds) || 0);
  const total = numeric > 0 && numeric < 1 ? 1 : Math.floor(numeric);
  const mins = Math.floor(total / 60);
  const secs = total % 60;

  return `${mins}:${String(secs).padStart(2, "0")}`;
}

/**
 * Audible/Spotify-style player driven by a single native <audio> element.
 * `tracks` is an ordered list of { title, audioUrl, duration }.
 */
function AudiobookPlayer({ tracks = [], coverImage = "", title = "", author = "" }) {
  const audioRef = useRef(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);

  const playableTracks = tracks.filter((track) => track && track.audioUrl);
  const activeTrack = playableTracks[currentIndex] || null;

  // Keep the native element's playback rate in sync (external system, no setState).
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
  }, [speed, activeTrack?.audioUrl]);

  const playIndex = (index) => {
    setCurrentIndex(index);
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(true);

    // Defer until the new source loads.
    requestAnimationFrame(() => {
      audioRef.current?.play().catch(() => setIsPlaying(false));
    });
  };

  const togglePlay = () => {
    const audio = audioRef.current;

    if (!audio) return;

    if (audio.paused) {
      audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  };

  const goPrev = () => {
    if (currentIndex > 0) playIndex(currentIndex - 1);
  };

  const goNext = () => {
    if (currentIndex < playableTracks.length - 1) playIndex(currentIndex + 1);
  };

  const handleEnded = () => {
    if (currentIndex < playableTracks.length - 1) {
      playIndex(currentIndex + 1);
    } else {
      setIsPlaying(false);
    }
  };

  const handleSeek = (event) => {
    const audio = audioRef.current;
    const value = Number(event.target.value);

    if (audio && Number.isFinite(value)) {
      audio.currentTime = value;
      setCurrentTime(value);
    }
  };

  if (!playableTracks.length) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-8 text-center text-sm text-gray-500">
        <Music2 className="mx-auto mb-3 size-7 text-gray-400" />
        No audio generated yet. Pick a voice and generate the audiobook to preview it here.
      </div>
    );
  }

  const cover = resolveImageUrl(coverImage);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <audio
        ref={audioRef}
        src={resolveImageUrl(activeTrack?.audioUrl)}
        preload="metadata"
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) =>
          setDuration(
            e.currentTarget.duration ||
              activeTrack?.duration ||
              0
          )
        }
        onEnded={handleEnded}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />

      {/* Now playing */}
      <div className="flex items-center gap-4 p-5 bg-gradient-to-br from-violet-50 to-purple-50">
        {cover ? (
          <img
            src={cover}
            alt={title}
            className="size-20 rounded-xl object-cover shadow-md"
          />
        ) : (
          <div className="size-20 rounded-xl bg-violet-200 flex items-center justify-center">
            <Music2 className="size-8 text-violet-600" />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-gray-900">
            {activeTrack?.title || "Untitled"}
          </p>
          <p className="truncate text-sm text-gray-600">{title}</p>
          {author && (
            <p className="truncate text-xs text-gray-500">by {author}</p>
          )}
        </div>
      </div>

      {/* Transport */}
      <div className="px-5 pt-4">
        <input
          type="range"
          min={0}
          max={duration || 0}
          value={Math.min(currentTime, duration || 0)}
          onChange={handleSeek}
          className="w-full accent-violet-600 cursor-pointer"
          aria-label="Seek"
        />
        <div className="mt-1 flex justify-between text-xs text-gray-500">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      <div className="flex items-center justify-center gap-6 px-5 py-4">
        <button
          type="button"
          onClick={goPrev}
          disabled={currentIndex === 0}
          className="text-gray-700 hover:text-violet-600 disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Previous chapter"
        >
          <SkipBack className="size-6" />
        </button>

        <button
          type="button"
          onClick={togglePlay}
          className="flex size-14 items-center justify-center rounded-full bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-lg shadow-violet-500/30 hover:from-violet-700 hover:to-purple-700"
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? (
            <Pause className="size-7" />
          ) : (
            <Play className="size-7 translate-x-0.5" />
          )}
        </button>

        <button
          type="button"
          onClick={goNext}
          disabled={currentIndex >= playableTracks.length - 1}
          className="text-gray-700 hover:text-violet-600 disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Next chapter"
        >
          <SkipForward className="size-6" />
        </button>

        <div className="ml-2 flex items-center gap-1.5 text-sm text-gray-600">
          <Gauge className="size-4" />
          <select
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            className="rounded-lg border border-gray-200 bg-white px-1.5 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-violet-500"
            aria-label="Playback speed"
          >
            {SPEEDS.map((value) => (
              <option key={value} value={value}>
                {value}×
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Track list */}
      <div className="max-h-72 overflow-auto border-t border-gray-100">
        {playableTracks.map((track, index) => {
          const isActive = index === currentIndex;

          return (
            <button
              key={`${track.audioUrl}-${index}`}
              type="button"
              onClick={() => playIndex(index)}
              className={`flex w-full items-center gap-3 px-5 py-3 text-left transition-colors ${
                isActive ? "bg-violet-50" : "hover:bg-gray-50"
              }`}
            >
              <span
                className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  isActive
                    ? "bg-violet-600 text-white"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {isActive && isPlaying ? (
                  <Pause className="size-3.5" />
                ) : (
                  index + 1
                )}
              </span>
              <span
                className={`min-w-0 flex-1 truncate text-sm ${
                  isActive ? "font-medium text-violet-700" : "text-gray-700"
                }`}
              >
                {track.title}
              </span>
              {track.duration > 0 && (
                <span className="shrink-0 text-xs text-gray-400">
                  {formatTime(track.duration)}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default AudiobookPlayer;
