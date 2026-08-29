import { useEffect, useRef, useState } from "react";
import "./App.css";
import translations from "./i18n/translations";

const API_BASE = "http://localhost:8080/api/media";

function App() {
  // ============================================================
  // LANGUAGE & THEME
  // ============================================================
  const [language, setLanguage] = useState(
    localStorage.getItem("mediameld-language") || "en"
  );
  const t = translations[language] || translations.en;

  const [theme, setTheme] = useState(
    localStorage.getItem("mediameld-theme") || "dark"
  );

  // ============================================================
  // COMMON STATE
  // ============================================================
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // ============================================================
  // VIDEO ANALYSIS
  // ============================================================
  const [videoInfo, setVideoInfo] = useState(null);
  const [quality, setQuality] = useState(720);

  // ============================================================
  // MEDIA PROCESS STATES
  // ============================================================
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoSpeed, setVideoSpeed] = useState("0 B/s");
  const [videoEta, setVideoEta] = useState("--:--");
  const [videoStatus, setVideoStatus] = useState("IDLE");

  const [audioProgress, setAudioProgress] = useState(0);
  const [audioSpeed, setAudioSpeed] = useState("0 B/s");
  const [audioEta, setAudioEta] = useState("--:--");
  const [audioStatus, setAudioStatus] = useState("IDLE");

  const [startTime, setStartTime] = useState("00:00");
  const [endTime, setEndTime] = useState("00:30");
  const [clipProgress, setClipProgress] = useState(0);
  const [clipSpeed, setClipSpeed] = useState("0 B/s");
  const [clipEta, setClipEta] = useState("--:--");
  const [clipStatus, setClipStatus] = useState("IDLE");

  const [audioClipStartTime, setAudioClipStartTime] = useState("00:00");
  const [audioClipEndTime, setAudioClipEndTime] = useState("00:30");
  const [audioClipProgress, setAudioClipProgress] = useState(0);
  const [audioClipSpeed, setAudioClipSpeed] = useState("0 B/s");
  const [audioClipEta, setAudioClipEta] = useState("--:--");
  const [audioClipStatus, setAudioClipStatus] = useState("IDLE");

  const [isolationMode, setIsolationMode] = useState("VOCALS");
  const [isolationProgress, setIsolationProgress] = useState(0);
  const [isolationStatus, setIsolationStatus] = useState("IDLE");
  const [, setIsolationError] = useState("");

  const [thumbnailLoading, setThumbnailLoading] = useState(false);

  // ============================================================
  // QUEUE & POLLING REFS
  // ============================================================
  const [downloadQueue, setDownloadQueue] = useState([]);
  const queueIdRef = useRef(1);

  const videoPollingRef = useRef(null);
  const audioPollingRef = useRef(null);
  const clipPollingRef = useRef(null);
  const audioClipPollingRef = useRef(null);
  const isolationPollingRef = useRef(null);

  const videoPollingStartRef = useRef(null);
  const audioPollingStartRef = useRef(null);
  const clipPollingStartRef = useRef(null);
  const audioClipPollingStartRef = useRef(null);
  const isolationPollingStartRef = useRef(null);

  // Sync settings
  useEffect(() => {
    localStorage.setItem("mediameld-language", language);
  }, [language]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("mediameld-theme", theme);
  }, [theme]);

  // Clean polling timers on unmount
  useEffect(() => {
    return () => {
      clearInterval(videoPollingRef.current);
      clearInterval(audioPollingRef.current);
      clearInterval(clipPollingRef.current);
      clearInterval(audioClipPollingRef.current);
      clearInterval(isolationPollingRef.current);
    };
  }, []);

  // ============================================================
  // QUEUE MANAGERS
  // ============================================================
  const addQueueItem = ({ type, title, url: itemUrl, details = "" }) => {
    const id = queueIdRef.current++;
    const item = {
      id,
      type,
      title,
      url: itemUrl,
      details,
      status: "QUEUED",
      progress: 0,
      createdAt: Date.now(),
    };
    setDownloadQueue((previous) => [...previous, item]);
    return id;
  };

  const updateQueueItem = (id, updates) => {
    setDownloadQueue((previous) =>
      previous.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
  };

  const clearCompletedQueue = () => {
    setDownloadQueue((previous) =>
      previous.filter((item) => item.status !== "COMPLETED")
    );
  };

  // ============================================================
  // ANALYZE VIDEO
  // ============================================================
  const analyzeVideo = async () => {
    if (!url.trim()) {
      setError(t.pleaseEnterUrl);
      return;
    }
    setLoading(true);
    setError("");
    setMessage("");
    setVideoInfo(null);
    try {
      const response = await fetch(`${API_BASE}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
        cache: "no-store",
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Unable to analyze video");
      }
      const data = await response.json();
      setVideoInfo(data);
      if (data.qualities && data.qualities.length > 0) {
        const sortedQualities = [...data.qualities].sort((a, b) => a - b);
        setQuality(
          sortedQualities.includes(720)
            ? 720
            : sortedQualities[sortedQualities.length - 1]
        );
      }
      setMessage(t.videoAnalyzed);
    } catch (err) {
      console.error("Analyze error:", err);
      setError(err.message || "Unable to analyze video");
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // VIDEO DOWNLOAD
  // ============================================================
  const startVideoProgressPolling = (queueId) => {
    clearInterval(videoPollingRef.current);
    videoPollingStartRef.current = Date.now();
    videoPollingRef.current = setInterval(async () => {
      try {
        const response = await fetch(
          `${API_BASE}/download/status?t=${Date.now()}`,
          { cache: "no-store" }
        );
        if (!response.ok) throw new Error(`HTTP error ${response.status}`);
        const data = await response.json();
        const progress = Number(data.progress) || 0;

        setVideoProgress(progress);
        setVideoSpeed(data.speed || "0 B/s");
        setVideoEta(data.eta || "--:--");

        if (data.error) {
          clearInterval(videoPollingRef.current);
          setVideoStatus("ERROR");
          updateQueueItem(queueId, { status: "ERROR", progress, error: data.error });
          setError(data.error);
          return;
        }

        if (data.completed) {
          clearInterval(videoPollingRef.current);
          setVideoProgress(100);
          setVideoSpeed(t.completed);
          setVideoEta("00:00");
          setVideoStatus("COMPLETED");
          updateQueueItem(queueId, { status: "COMPLETED", progress: 100 });
          await downloadCompletedVideo(queueId);
          return;
        }

        const nextStatus = data.downloading ? "DOWNLOADING" : "QUEUED";
        setVideoStatus(nextStatus);
        updateQueueItem(queueId, { status: nextStatus, progress });

        if (Date.now() - videoPollingStartRef.current > 30 * 60 * 1000) {
          clearInterval(videoPollingRef.current);
          setVideoStatus("ERROR");
          updateQueueItem(queueId, { status: "ERROR", error: t.videoDownloadStuck });
          setError(t.videoDownloadStuck);
        }
      } catch (err) {
        console.error("Video status polling error:", err);
      }
    }, 700);
  };

  const downloadCompletedVideo = async (queueId) => {
    try {
      const response = await fetch(`${API_BASE}/download/file?t=${Date.now()}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Could not retrieve downloaded video");
      }
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      const safeTitle = videoInfo?.title
        ? sanitizeFilename(videoInfo.title)
        : "MediaMeld-video";
      link.download = `${safeTitle}.mp4`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => window.URL.revokeObjectURL(downloadUrl), 1000);
      setMessage(t.videoDownloadedSuccessfully);
      updateQueueItem(queueId, { status: "COMPLETED", progress: 100 });
    } catch (err) {
      console.error("Completed video download error:", err);
      updateQueueItem(queueId, {
        status: "ERROR",
        error: err.message || "Could not download video",
      });
      setError(err.message || "Could not download video");
    }
  };

  const startVideoDownload = async () => {
    if (!url.trim()) return setError(t.pleaseEnterUrl);
    if (!quality || quality <= 0) return setError(t.pleaseSelectQuality);

    setError("");
    setMessage("");
    setVideoProgress(0);
    setVideoSpeed("0 B/s");
    setVideoEta("--:--");
    setVideoStatus("QUEUED");

    const queueId = addQueueItem({
      type: "VIDEO",
      title: videoInfo?.title || "Video",
      url: url.trim(),
      details: `${quality}p`,
    });

    try {
      const response = await fetch(`${API_BASE}/download`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), quality: Number(quality) }),
        cache: "no-store",
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Could not add video to queue");
      }
      await response.text();
      setMessage(t.videoDownloadStarted);
      startVideoProgressPolling(queueId);
    } catch (err) {
      console.error("Start video download error:", err);
      updateQueueItem(queueId, {
        status: "ERROR",
        error: err.message || "Could not add video to queue",
      });
      setError(err.message || "Could not add video to queue");
      setVideoStatus("ERROR");
    }
  };

  const cancelVideoDownload = async () => {
    try {
      clearInterval(videoPollingRef.current);
      await fetch(`${API_BASE}/download/cancel`, {
        method: "POST",
        cache: "no-store",
      });
      setVideoProgress(0);
      setVideoSpeed("0 B/s");
      setVideoEta("--:--");
      setVideoStatus("IDLE");
      setMessage(t.videoDownloadCancelled);
      setDownloadQueue((prev) =>
        prev.map((item) =>
          item.type === "VIDEO" && item.status === "DOWNLOADING"
            ? { ...item, status: "CANCELLED", progress: 0 }
            : item
        )
      );
    } catch (err) {
      console.error("Cancel video error:", err);
      setError("Could not cancel video download");
    }
  };

  // ============================================================
  // AUDIO DOWNLOAD
  // ============================================================
  const startAudioProgressPolling = (queueId) => {
    clearInterval(audioPollingRef.current);
    audioPollingStartRef.current = Date.now();
    audioPollingRef.current = setInterval(async () => {
      try {
        const response = await fetch(`${API_BASE}/audio/status?t=${Date.now()}`, {
          cache: "no-store",
        });
        if (!response.ok) throw new Error(`HTTP error ${response.status}`);
        const data = await response.json();
        const progress = Number(data.progress) || 0;

        setAudioProgress(progress);
        setAudioSpeed(data.speed || "0 B/s");
        setAudioEta(data.eta || "--:--");

        if (data.error) {
          clearInterval(audioPollingRef.current);
          setAudioStatus("ERROR");
          updateQueueItem(queueId, { status: "ERROR", progress, error: data.error });
          setError(data.error);
          return;
        }

        if (data.completed) {
          clearInterval(audioPollingRef.current);
          setAudioProgress(100);
          setAudioSpeed(t.completed);
          setAudioEta("00:00");
          setAudioStatus("COMPLETED");
          updateQueueItem(queueId, { status: "COMPLETED", progress: 100 });
          await downloadCompletedAudio(queueId);
          return;
        }

        const nextStatus = data.downloading ? "DOWNLOADING" : "QUEUED";
        setAudioStatus(nextStatus);
        updateQueueItem(queueId, { status: nextStatus, progress });

        if (Date.now() - audioPollingStartRef.current > 30 * 60 * 1000) {
          clearInterval(audioPollingRef.current);
          setAudioStatus("ERROR");
          updateQueueItem(queueId, { status: "ERROR", error: t.audioDownloadStuck });
          setError(t.audioDownloadStuck);
        }
      } catch (err) {
        console.error("Audio status error:", err);
      }
    }, 700);
  };

  const startAudioDownload = async () => {
    if (!url.trim()) return setError(t.pleaseEnterUrl);

    setError("");
    setMessage("");
    setAudioProgress(0);
    setAudioSpeed("0 B/s");
    setAudioEta("--:--");
    setAudioStatus("QUEUED");

    const queueId = addQueueItem({
      type: "AUDIO",
      title: videoInfo?.title || "Audio",
      url: url.trim(),
      details: "M4A",
    });

    try {
      const response = await fetch(`${API_BASE}/audio/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
        cache: "no-store",
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Could not add audio to queue");
      }
      await response.text();
      setMessage(t.audioDownloadStarted);
      startAudioProgressPolling(queueId);
    } catch (err) {
      console.error("Start audio error:", err);
      updateQueueItem(queueId, {
        status: "ERROR",
        error: err.message || "Could not add audio to queue",
      });
      setAudioStatus("ERROR");
      setError(err.message || "Could not add audio to queue");
    }
  };

  const downloadCompletedAudio = async (queueId) => {
    try {
      const response = await fetch(`${API_BASE}/audio/file?t=${Date.now()}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Could not retrieve downloaded audio");
      }
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      const safeTitle = videoInfo?.title
        ? sanitizeFilename(videoInfo.title)
        : "MediaMeld-audio";
      link.download = `${safeTitle}.m4a`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => window.URL.revokeObjectURL(downloadUrl), 1000);
      setMessage(t.audioDownloadedSuccessfully);
      updateQueueItem(queueId, { status: "COMPLETED", progress: 100 });
    } catch (err) {
      console.error("Completed audio error:", err);
      updateQueueItem(queueId, {
        status: "ERROR",
        error: err.message || "Could not download audio",
      });
      setError(err.message || "Could not download audio");
    }
  };

  const cancelAudioDownload = async () => {
    try {
      clearInterval(audioPollingRef.current);
      await fetch(`${API_BASE}/audio/cancel`, {
        method: "POST",
        cache: "no-store",
      });
      setAudioProgress(0);
      setAudioSpeed("0 B/s");
      setAudioEta("--:--");
      setAudioStatus("IDLE");
      setMessage(t.audioDownloadCancelled);
      setDownloadQueue((prev) =>
        prev.map((item) =>
          item.type === "AUDIO" && item.status === "DOWNLOADING"
            ? { ...item, status: "CANCELLED", progress: 0 }
            : item
        )
      );
    } catch (err) {
      console.error("Cancel audio error:", err);
      setError("Could not cancel audio download");
    }
  };

  // ============================================================
  // THUMBNAIL DOWNLOAD
  // ============================================================
  const downloadThumbnail = async () => {
    if (!url.trim()) return setError(t.pleaseEnterUrl);
    if (!videoInfo?.thumbnail) return setError(t.thumbnailNotAvailable);

    setThumbnailLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`${API_BASE}/thumbnail/download`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
        cache: "no-store",
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Could not download thumbnail");
      }
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      const safeTitle = videoInfo?.title
        ? sanitizeFilename(videoInfo.title)
        : "MediaMeld";
      link.download = `${safeTitle}-thumbnail.jpg`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => window.URL.revokeObjectURL(downloadUrl), 1000);
      setMessage(t.thumbnailDownloadedSuccessfully);
    } catch (err) {
      console.error("Thumbnail error:", err);
      setError(err.message || "Could not download thumbnail");
    } finally {
      setThumbnailLoading(false);
    }
  };

  // ============================================================
  // VIDEO CLIP
  // ============================================================
  const startClipProgressPolling = (queueId) => {
    clearInterval(clipPollingRef.current);
    clipPollingStartRef.current = Date.now();
    clipPollingRef.current = setInterval(async () => {
      try {
        const response = await fetch(`${API_BASE}/clip/status?t=${Date.now()}`, {
          cache: "no-store",
        });
        if (!response.ok) throw new Error(`HTTP error ${response.status}`);
        const data = await response.json();
        const progress = Number(data.progress) || 0;

        setClipProgress(progress);
        setClipSpeed(data.speed || "0 B/s");
        setClipEta(data.eta || "--:--");

        if (data.error) {
          clearInterval(clipPollingRef.current);
          setClipStatus("ERROR");
          updateQueueItem(queueId, { status: "ERROR", progress, error: data.error });
          setError(data.error);
          return;
        }

        if (data.completed) {
          clearInterval(clipPollingRef.current);
          setClipProgress(100);
          setClipSpeed(t.completed);
          setClipEta("00:00");
          setClipStatus("COMPLETED");
          updateQueueItem(queueId, { status: "COMPLETED", progress: 100 });
          await downloadCompletedClip(queueId);
          return;
        }

        const nextStatus = data.downloading ? "DOWNLOADING" : "QUEUED";
        setClipStatus(nextStatus);
        updateQueueItem(queueId, { status: nextStatus, progress });

        if (Date.now() - clipPollingStartRef.current > 30 * 60 * 1000) {
          clearInterval(clipPollingRef.current);
          setClipStatus("ERROR");
          updateQueueItem(queueId, { status: "ERROR", error: t.clipDownloadStuck });
          setError(t.clipDownloadStuck);
        }
      } catch (err) {
        console.error("Clip status error:", err);
      }
    }, 700);
  };

  const startClipDownload = async () => {
    if (!url.trim()) return setError(t.pleaseEnterUrl);
    if (!startTime.trim() || !endTime.trim()) return setError(t.startEndRequired);
    if (!quality || quality <= 0) return setError(t.pleaseSelectQuality);

    setError("");
    setMessage("");
    setClipProgress(0);
    setClipSpeed("0 B/s");
    setClipEta("--:--");
    setClipStatus("QUEUED");

    const queueId = addQueueItem({
      type: "VIDEO CLIP",
      title: videoInfo?.title || "Video Clip",
      url: url.trim(),
      details: `${startTime} → ${endTime} • ${quality}p`,
    });

    try {
      const response = await fetch(`${API_BASE}/clip/download`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url.trim(),
          startTime: startTime.trim(),
          endTime: endTime.trim(),
          quality: Number(quality),
        }),
        cache: "no-store",
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Could not add clip to queue");
      }
      await response.text();
      setMessage(t.clipDownloadStarted);
      startClipProgressPolling(queueId);
    } catch (err) {
      console.error("Start clip error:", err);
      updateQueueItem(queueId, {
        status: "ERROR",
        error: err.message || "Could not add clip to queue",
      });
      setClipStatus("ERROR");
      setError(err.message || "Could not add clip to queue");
    }
  };

  const downloadCompletedClip = async (queueId) => {
    try {
      const response = await fetch(`${API_BASE}/clip/file?t=${Date.now()}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Could not retrieve downloaded clip");
      }
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      const safeTitle = videoInfo?.title
        ? sanitizeFilename(videoInfo.title)
        : "MediaMeld-clip";
      link.download = `${safeTitle}-clip.mp4`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => window.URL.revokeObjectURL(downloadUrl), 1000);
      setMessage(t.clipDownloadedSuccessfully);
      updateQueueItem(queueId, { status: "COMPLETED", progress: 100 });
    } catch (err) {
      console.error("Completed clip error:", err);
      updateQueueItem(queueId, {
        status: "ERROR",
        error: err.message || "Could not download clip",
      });
      setError(err.message || "Could not download clip");
    }
  };

  const cancelClipDownload = async () => {
    try {
      clearInterval(clipPollingRef.current);
      await fetch(`${API_BASE}/clip/cancel`, { method: "POST", cache: "no-store" });
      setClipProgress(0);
      setClipSpeed("0 B/s");
      setClipEta("--:--");
      setClipStatus("IDLE");
      setMessage(t.clipDownloadCancelled);
      setDownloadQueue((prev) =>
        prev.map((item) =>
          item.type === "VIDEO CLIP" && item.status === "DOWNLOADING"
            ? { ...item, status: "CANCELLED", progress: 0 }
            : item
        )
      );
    } catch (err) {
      console.error("Cancel clip error:", err);
      setError("Could not cancel clip download");
    }
  };

  // ============================================================
  // AUDIO CLIP
  // ============================================================
  const startAudioClipProgressPolling = (queueId) => {
    clearInterval(audioClipPollingRef.current);
    audioClipPollingStartRef.current = Date.now();
    audioClipPollingRef.current = setInterval(async () => {
      try {
        const response = await fetch(
          `${API_BASE}/audio-clip/status?t=${Date.now()}`,
          { cache: "no-store" }
        );
        if (!response.ok) throw new Error(`HTTP error ${response.status}`);
        const data = await response.json();
        const progress = Number(data.progress) || 0;

        setAudioClipProgress(progress);
        setAudioClipSpeed(data.speed || "0 B/s");
        setAudioClipEta(data.eta || "--:--");

        if (data.error) {
          clearInterval(audioClipPollingRef.current);
          setAudioClipStatus("ERROR");
          updateQueueItem(queueId, { status: "ERROR", progress, error: data.error });
          setError(data.error);
          return;
        }

        if (data.completed) {
          clearInterval(audioClipPollingRef.current);
          setAudioClipProgress(100);
          setAudioClipSpeed(t.completed);
          setAudioClipEta("00:00");
          setAudioClipStatus("COMPLETED");
          updateQueueItem(queueId, { status: "COMPLETED", progress: 100 });
          await downloadCompletedAudioClip(queueId);
          return;
        }

        const nextStatus = data.downloading ? "DOWNLOADING" : "QUEUED";
        setAudioClipStatus(nextStatus);
        updateQueueItem(queueId, { status: nextStatus, progress });

        if (Date.now() - audioClipPollingStartRef.current > 30 * 60 * 1000) {
          clearInterval(audioClipPollingRef.current);
          setAudioClipStatus("ERROR");
          const stuckMsg =
            t.audioDownloadStuck || "Audio clip download is taking too long.";
          updateQueueItem(queueId, { status: "ERROR", error: stuckMsg });
          setError(stuckMsg);
        }
      } catch (err) {
        console.error("Audio clip status error:", err);
      }
    }, 700);
  };

  const startAudioClipDownload = async () => {
    if (!url.trim()) return setError(t.pleaseEnterUrl);
    if (!audioClipStartTime.trim() || !audioClipEndTime.trim())
      return setError(t.startEndRequired);

    setError("");
    setMessage("");
    setAudioClipProgress(0);
    setAudioClipSpeed("0 B/s");
    setAudioClipEta("--:--");
    setAudioClipStatus("QUEUED");

    const queueId = addQueueItem({
      type: "AUDIO CLIP",
      title: videoInfo?.title || "Audio Clip",
      url: url.trim(),
      details: `${audioClipStartTime} → ${audioClipEndTime}`,
    });

    try {
      const response = await fetch(`${API_BASE}/audio-clip/download`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url.trim(),
          startTime: audioClipStartTime.trim(),
          endTime: audioClipEndTime.trim(),
        }),
        cache: "no-store",
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Could not add audio clip to queue");
      }
      await response.text();
      setMessage(
        t.audioClipDownloadStarted ||
          t.clipDownloadStarted ||
          "Audio clip added to queue"
      );
      startAudioClipProgressPolling(queueId);
    } catch (err) {
      console.error("Start audio clip error:", err);
      updateQueueItem(queueId, {
        status: "ERROR",
        error: err.message || "Could not add audio clip to queue",
      });
      setAudioClipStatus("ERROR");
      setError(err.message || "Could not add audio clip to queue");
    }
  };

  const downloadCompletedAudioClip = async (queueId) => {
    try {
      const response = await fetch(`${API_BASE}/audio-clip/file?t=${Date.now()}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Could not retrieve downloaded audio clip");
      }
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      const safeTitle = videoInfo?.title
        ? sanitizeFilename(videoInfo.title)
        : "MediaMeld-audio-clip";
      link.download = `${safeTitle}-audio-clip.m4a`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => window.URL.revokeObjectURL(downloadUrl), 1000);
      setMessage(
        t.audioClipDownloadedSuccessfully || "Audio clip downloaded successfully."
      );
      updateQueueItem(queueId, { status: "COMPLETED", progress: 100 });
    } catch (err) {
      console.error("Completed audio clip error:", err);
      updateQueueItem(queueId, {
        status: "ERROR",
        error: err.message || "Could not download audio clip",
      });
      setError(err.message || "Could not download audio clip");
    }
  };

  const cancelAudioClipDownload = async () => {
    try {
      clearInterval(audioClipPollingRef.current);
      await fetch(`${API_BASE}/audio-clip/cancel`, {
        method: "POST",
        cache: "no-store",
      });
      setAudioClipProgress(0);
      setAudioClipSpeed("0 B/s");
      setAudioClipEta("--:--");
      setAudioClipStatus("IDLE");
      setMessage(
        t.audioClipDownloadCancelled || "Audio clip download cancelled."
      );
      setDownloadQueue((prev) =>
        prev.map((item) =>
          item.type === "AUDIO CLIP" && item.status === "DOWNLOADING"
            ? { ...item, status: "CANCELLED", progress: 0 }
            : item
        )
      );
    } catch (err) {
      console.error("Cancel audio clip error:", err);
      setError("Could not cancel audio clip download");
    }
  };

  // ============================================================
  // DEMUCS AUDIO ISOLATION
  // ============================================================
  const startIsolationPolling = (queueId) => {
    clearInterval(isolationPollingRef.current);
    isolationPollingStartRef.current = Date.now();
    isolationPollingRef.current = setInterval(async () => {
      try {
        const response = await fetch(
          `${API_BASE}/audio/isolate/status?t=${Date.now()}`,
          { cache: "no-store" }
        );
        if (!response.ok) throw new Error(`HTTP error ${response.status}`);
        const data = await response.json();
        const progress = Number(data.progress) || 0;

        setIsolationProgress(progress);
        setIsolationError(data.error || "");

        if (data.error) {
          clearInterval(isolationPollingRef.current);
          setIsolationStatus("ERROR");
          updateQueueItem(queueId, { status: "ERROR", progress, error: data.error });
          setError(data.error);
          return;
        }

        if (data.completed) {
          clearInterval(isolationPollingRef.current);
          setIsolationProgress(100);
          setIsolationStatus("COMPLETED");
          updateQueueItem(queueId, { status: "COMPLETED", progress: 100 });
          await downloadCompletedIsolation(queueId, data.filename);
          return;
        }

        const nextStatus = data.separating ? "SEPARATING" : "QUEUED";
        setIsolationStatus(nextStatus);
        updateQueueItem(queueId, { status: nextStatus, progress });

        if (Date.now() - isolationPollingStartRef.current > 60 * 60 * 1000) {
          clearInterval(isolationPollingRef.current);
          setIsolationStatus("ERROR");
          updateQueueItem(queueId, {
            status: "ERROR",
            error: "Audio isolation is taking too long.",
          });
          setError("Audio isolation is taking too long.");
        }
      } catch (err) {
        console.error("Isolation status error:", err);
      }
    }, 1000);
  };

  const startIsolation = async () => {
    if (!url.trim()) return setError(t.pleaseEnterUrl);
    if (!isolationMode) return setError("Please select VOCALS or MUSIC");

    setError("");
    setMessage("");
    setIsolationProgress(0);
    setIsolationError("");
    setIsolationStatus("QUEUED");

    const queueId = addQueueItem({
      type: "DEMUCS",
      title: videoInfo?.title || "Audio Isolation",
      url: url.trim(),
      details: isolationMode,
    });

    try {
      const response = await fetch(`${API_BASE}/audio/isolate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), mode: isolationMode }),
        cache: "no-store",
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Could not add isolation to queue");
      }
      await response.text();
      setMessage("Audio isolation added to queue");
      startIsolationPolling(queueId);
    } catch (err) {
      console.error("Start isolation error:", err);
      updateQueueItem(queueId, {
        status: "ERROR",
        error: err.message || "Could not add isolation to queue",
      });
      setIsolationStatus("ERROR");
      setError(err.message || "Could not add isolation to queue");
    }
  };

  const downloadCompletedIsolation = async (queueId, filename) => {
    try {
      const response = await fetch(
        `${API_BASE}/audio/isolate/file?t=${Date.now()}`,
        { cache: "no-store" }
      );
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Could not retrieve isolated audio");
      }
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download =
        filename ||
        `${sanitizeFilename(videoInfo?.title || "MediaMeld")}-${isolationMode.toLowerCase()}.wav`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => window.URL.revokeObjectURL(downloadUrl), 1000);
      setMessage("Audio isolation completed successfully");
      updateQueueItem(queueId, { status: "COMPLETED", progress: 100 });
    } catch (err) {
      console.error("Isolation file error:", err);
      updateQueueItem(queueId, {
        status: "ERROR",
        error: err.message || "Could not download isolated audio",
      });
      setError(err.message || "Could not download isolated audio");
    }
  };

  const cancelIsolation = async () => {
    try {
      clearInterval(isolationPollingRef.current);
      await fetch(`${API_BASE}/audio/isolate/cancel`, {
        method: "POST",
        cache: "no-store",
      });
      setIsolationProgress(0);
      setIsolationStatus("IDLE");
      setMessage("Audio isolation cancelled");
      setDownloadQueue((prev) =>
        prev.map((item) =>
          item.type === "DEMUCS" && item.status === "SEPARATING"
            ? { ...item, status: "CANCELLED", progress: 0 }
            : item
        )
      );
    } catch (err) {
      console.error("Cancel isolation error:", err);
      setError("Could not cancel audio isolation");
    }
  };

  // ============================================================
  // FORMATTERS & HELPERS
  // ============================================================
  const formatDuration = (seconds) => {
    if (!seconds) return "00:00";
    const totalSeconds = Math.floor(seconds);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;

    if (hours > 0) {
      return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    }
    return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const getStatusText = (status) => {
    switch (status) {
      case "IDLE":
        return t.idle;
      case "QUEUED":
        return "QUEUED";
      case "DOWNLOADING":
        return t.downloading;
      case "SEPARATING":
        return "SEPARATING";
      case "COMPLETED":
        return t.completed;
      case "ERROR":
        return t.error;
      case "CANCELLED":
        return t.cancel;
      case "STARTING":
        return t.starting;
      default:
        return status;
    }
  };

  const queuedCount = downloadQueue.filter((item) =>
    ["QUEUED", "DOWNLOADING", "SEPARATING"].includes(item.status)
  ).length;

  const completedCount = downloadQueue.filter(
    (item) => item.status === "COMPLETED"
  ).length;

  return (
    <div className="app">
      <div className="container">
        {/* HEADER */}
        <header className="header">
          <div>
            <div className="logo">{t.appTitle}</div>
            <p>{t.appSubtitle}</p>
          </div>
          <div className="header-settings">
            <div className="setting-control">
              <label htmlFor="language">{t.language}</label>
              <select
                id="language"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
              >
                {Object.entries(translations).map(([key, value]) => (
                  <option key={key} value={key}>
                    {value.languageName}
                  </option>
                ))}
              </select>
            </div>
            <button
              className="theme-btn"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              title="Toggle theme"
            >
              {theme === "dark" ? "☀️" : "🌙"}
            </button>
          </div>
        </header>

        {/* URL INPUT */}
        <section className="search-section">
          <div className="url-row">
            <input
              className="url-input"
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") analyzeVideo();
              }}
              placeholder={t.pasteUrl}
            />
            <button
              className="analyze-btn"
              onClick={analyzeVideo}
              disabled={loading}
            >
              {loading ? t.analyzing : t.analyze}
            </button>
          </div>
        </section>

        {/* NOTIFICATIONS */}
        {error && <div className="message message-error">{error}</div>}
        {message && <div className="message message-success">{message}</div>}

        {/* MAIN MEDIA DETAILS */}
        {videoInfo && (
          <section className="video-card">
            <div className="thumbnail-wrapper">
              {videoInfo.thumbnail && (
                <img
                  src={videoInfo.thumbnail}
                  alt="Video Thumbnail"
                  className="thumbnail"
                />
              )}
            </div>
            <div className="video-details">
              <h2>{videoInfo.title}</h2>
              <p className="channel">
                {t.channel}: {videoInfo.channelName || t.unknown} {" • "}
                {t.duration}: {formatDuration(videoInfo.duration)}
              </p>

              {/* VIDEO QUALITY SELECTOR */}
              <div className="quality-section">
                <label>{t.videoQuality}</label>
                <select
                  value={quality}
                  onChange={(e) => setQuality(Number(e.target.value))}
                >
                  {videoInfo.qualities
                    ?.slice()
                    .sort((a, b) => b - a)
                    .map((q) => (
                      <option key={q} value={q}>
                        {q}p
                      </option>
                    ))}
                </select>
              </div>

              {/* VIDEO DOWNLOAD ACTION */}
              <button
                className="download-btn video-btn"
                onClick={startVideoDownload}
              >
                {t.downloadVideo}
              </button>
              {videoStatus !== "IDLE" && (
                <ProgressBox
                  status={videoStatus}
                  progress={videoProgress}
                  speed={videoSpeed}
                  eta={videoEta}
                  getStatusText={getStatusText}
                  t={t}
                />
              )}
              {videoStatus === "DOWNLOADING" && (
                <button className="cancel-btn" onClick={cancelVideoDownload}>
                  {t.cancel}
                </button>
              )}

              {/* AUDIO DOWNLOAD ACTION */}
              <button
                className="download-btn audio-btn"
                onClick={startAudioDownload}
              >
                {t.downloadAudio}
              </button>
              {audioStatus !== "IDLE" && (
                <ProgressBox
                  status={audioStatus}
                  progress={audioProgress}
                  speed={audioSpeed}
                  eta={audioEta}
                  getStatusText={getStatusText}
                  t={t}
                />
              )}
              {audioStatus === "DOWNLOADING" && (
                <button className="cancel-btn" onClick={cancelAudioDownload}>
                  {t.cancel}
                </button>
              )}

              {/* THUMBNAIL DOWNLOAD */}
              <button
                className="secondary-btn"
                onClick={downloadThumbnail}
                disabled={thumbnailLoading}
              >
                {thumbnailLoading
                  ? t.downloadingThumbnail || "Downloading..."
                  : t.downloadThumbnail}
              </button>
            </div>
          </section>
        )}

        {/* VIDEO CLIP SECTION */}
        {videoInfo && (
          <section className="feature-card">
            <div className="feature-header">
              <h3>{t.clipDownload}</h3>
              <p>{t.clipDescription}</p>
            </div>
            <div className="time-grid">
              <div>
                <label>{t.startTime}</label>
                <input
                  type="text"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  placeholder="00:00"
                />
              </div>
              <div>
                <label>{t.endTime}</label>
                <input
                  type="text"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  placeholder="00:30"
                />
              </div>
            </div>
            <button className="download-btn clip-btn" onClick={startClipDownload}>
              {t.downloadClip}
            </button>
            {clipStatus !== "IDLE" && (
              <ProgressBox
                status={clipStatus}
                progress={clipProgress}
                speed={clipSpeed}
                eta={clipEta}
                getStatusText={getStatusText}
                t={t}
              />
            )}
            {clipStatus === "DOWNLOADING" && (
              <button className="cancel-btn" onClick={cancelClipDownload}>
                {t.cancel}
              </button>
            )}
          </section>
        )}

        {/* AUDIO CLIP SECTION */}
        {videoInfo && (
          <section className="feature-card">
            <div className="feature-header">
              <h3>Audio Clip</h3>
              <p>Download only a selected audio portion.</p>
            </div>
            <div className="time-grid">
              <div>
                <label>{t.startTime}</label>
                <input
                  type="text"
                  value={audioClipStartTime}
                  onChange={(e) => setAudioClipStartTime(e.target.value)}
                  placeholder="00:00"
                />
              </div>
              <div>
                <label>{t.endTime}</label>
                <input
                  type="text"
                  value={audioClipEndTime}
                  onChange={(e) => setAudioClipEndTime(e.target.value)}
                  placeholder="00:30"
                />
              </div>
            </div>
            <button
              className="download-btn audio-clip-btn"
              onClick={startAudioClipDownload}
            >
              Download Audio Clip
            </button>
            {audioClipStatus !== "IDLE" && (
              <ProgressBox
                status={audioClipStatus}
                progress={audioClipProgress}
                speed={audioClipSpeed}
                eta={audioClipEta}
                getStatusText={getStatusText}
                t={t}
              />
            )}
            {audioClipStatus === "DOWNLOADING" && (
              <button className="cancel-btn" onClick={cancelAudioClipDownload}>
                {t.cancel}
              </button>
            )}
          </section>
        )}

        {/* DEMUCS AUDIO ISOLATION SECTION */}
        {videoInfo && (
          <section className="feature-card">
            <div className="feature-header">
              <h3>Audio Isolation</h3>
              <p>Separate vocals or music using Demucs.</p>
            </div>
            <div className="isolation-controls">
              <label>Mode</label>
              <select
                value={isolationMode}
                onChange={(e) => setIsolationMode(e.target.value)}
              >
                <option value="VOCALS">VOCALS</option>
                <option value="MUSIC">MUSIC</option>
              </select>
            </div>
            <button className="download-btn isolation-btn" onClick={startIsolation}>
              Isolate {isolationMode}
            </button>
            {isolationStatus !== "IDLE" && (
              <ProgressBox
                status={isolationStatus}
                progress={isolationProgress}
                speed=""
                eta=""
                getStatusText={getStatusText}
                t={t}
              />
            )}
            {isolationStatus === "SEPARATING" && (
              <button className="cancel-btn" onClick={cancelIsolation}>
                {t.cancel}
              </button>
            )}
          </section>
        )}

        {/* DOWNLOAD QUEUE TRACKER */}
        <section className="queue-section">
          <div className="queue-header">
            <div>
              <h2>Download Queue</h2>
              <p>
                {queuedCount} active {queuedCount !== 1 ? "tasks" : "task"}
                {" • "}
                {completedCount} completed
              </p>
            </div>
            {downloadQueue.some((item) => item.status === "COMPLETED") && (
              <button className="clear-btn" onClick={clearCompletedQueue}>
                Clear Completed
              </button>
            )}
          </div>

          {downloadQueue.length === 0 ? (
            <div className="empty-queue">
              <div className="empty-icon">↓</div>
              <p>Your download queue is empty.</p>
              <span>Add a video, audio, clip or isolation task above.</span>
            </div>
          ) : (
            <div className="queue-list">
              {downloadQueue.map((item, index) => (
                <div
                  className={`queue-item queue-${item.status.toLowerCase()}`}
                  key={item.id}
                >
                  <div className="queue-number">{index + 1}</div>
                  <div className="queue-main">
                    <div className="queue-title-row">
                      <div className="queue-title">{item.title}</div>
                      <span
                        className={`queue-status status-${item.status.toLowerCase()}`}
                      >
                        {getStatusText(item.status)}
                      </span>
                    </div>
                    <div className="queue-meta">
                      <span>{item.type}</span>
                      {item.details && (
                        <>
                          <span>•</span>
                          <span>{item.details}</span>
                        </>
                      )}
                    </div>
                    {(["QUEUED", "DOWNLOADING", "SEPARATING"].includes(
                      item.status
                    ) ||
                      item.progress > 0) && (
                      <div className="queue-progress">
                        <div className="queue-progress-top">
                          <span>
                            {item.status === "QUEUED"
                              ? "Waiting in queue"
                              : getStatusText(item.status)}
                          </span>
                          <span>{Number(item.progress || 0).toFixed(1)}%</span>
                        </div>
                        <div className="progress-bar">
                          <div
                            className="progress-fill"
                            style={{
                              width: `${Math.min(
                                100,
                                Number(item.progress || 0)
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                    )}
                    {item.error && (
                      <div className="queue-error">{item.error}</div>
                    )}
                  </div>
                  {item.status === "COMPLETED" && (
                    <div className="queue-check">✓</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* FOOTER */}
        <footer className="footer">
          <span>MediaMeld</span>
          <span>YouTube Media Downloader</span>
        </footer>
      </div>
    </div>
  );
}

function ProgressBox({ status, progress, speed, eta, getStatusText, t }) {
  return (
    <div className="progress-section">
      <div className="progress-header">
        <span>{getStatusText(status)}</span>
        <span>{Number(progress || 0).toFixed(1)}%</span>
      </div>
      <div className="progress-bar">
        <div
          className="progress-fill"
          style={{
            width: `${Math.min(100, Number(progress || 0))}%`,
          }}
        />
      </div>
      {(speed || eta) && (
        <div className="download-stats">
          {speed && (
            <span>
              {t.speed}: {speed}
            </span>
          )}
          {eta && (
            <span>
              {t.eta}: {eta}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function sanitizeFilename(filename) {
  return filename
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .substring(0, 180);
}

export default App;