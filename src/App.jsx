import { useEffect, useRef, useState } from "react";
import "./App.css";
import translations from "./i18n/translations";

const API_BASE = "http://localhost:8080/api/media";

function App() {
  // ============================================================
  // LANGUAGE
  // ============================================================

  const [language, setLanguage] = useState(
    localStorage.getItem("mediameld-language") || "en"
  );

  const t = translations[language] || translations.en;

  // ============================================================
  // THEME
  // ============================================================

  const [theme, setTheme] = useState(
    localStorage.getItem("mediameld-theme") || "dark"
  );

  // ============================================================
  // COMMON
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
  // VIDEO DOWNLOAD
  // ============================================================

  const [videoProgress, setVideoProgress] = useState(0);
  const [videoSpeed, setVideoSpeed] = useState("0 B/s");
  const [videoEta, setVideoEta] = useState("--:--");
  const [videoStatus, setVideoStatus] = useState("IDLE");

  // ============================================================
  // AUDIO DOWNLOAD
  // ============================================================

  const [audioProgress, setAudioProgress] = useState(0);
  const [audioSpeed, setAudioSpeed] = useState("0 B/s");
  const [audioEta, setAudioEta] = useState("--:--");
  const [audioStatus, setAudioStatus] = useState("IDLE");

  // ============================================================
  // VIDEO CLIP
  // ============================================================

  const [startTime, setStartTime] = useState("00:00");
  const [endTime, setEndTime] = useState("00:30");

  const [clipProgress, setClipProgress] = useState(0);
  const [clipSpeed, setClipSpeed] = useState("0 B/s");
  const [clipEta, setClipEta] = useState("--:--");
  const [clipStatus, setClipStatus] = useState("IDLE");

  // ============================================================
  // AUDIO CLIP
  // ============================================================

  const [audioClipStartTime, setAudioClipStartTime] =
    useState("00:00");

  const [audioClipEndTime, setAudioClipEndTime] =
    useState("00:30");

  const [audioClipProgress, setAudioClipProgress] =
    useState(0);

  const [audioClipSpeed, setAudioClipSpeed] =
    useState("0 B/s");

  const [audioClipEta, setAudioClipEta] =
    useState("--:--");

  const [audioClipStatus, setAudioClipStatus] =
    useState("IDLE");

  // ============================================================
  // THUMBNAIL
  // ============================================================

  const [thumbnailLoading, setThumbnailLoading] =
    useState(false);

  // ============================================================
  // POLLING REFS
  // ============================================================

  const videoPollingRef = useRef(null);
  const audioPollingRef = useRef(null);
  const clipPollingRef = useRef(null);
  const audioClipPollingRef = useRef(null);

  // ============================================================
  // POLLING START TIME REFS
  // ============================================================

  const videoPollingStartRef = useRef(null);
  const audioPollingStartRef = useRef(null);
  const clipPollingStartRef = useRef(null);
  const audioClipPollingStartRef = useRef(null);

  // ============================================================
  // SAVE LANGUAGE
  // ============================================================

  useEffect(() => {
    localStorage.setItem(
      "mediameld-language",
      language
    );
  }, [language]);

  // ============================================================
  // APPLY + SAVE THEME
  // ============================================================

  useEffect(() => {
    document.documentElement.dataset.theme = theme;

    localStorage.setItem(
      "mediameld-theme",
      theme
    );
  }, [theme]);

  // ============================================================
  // CLEANUP
  // ============================================================

  useEffect(() => {
    return () => {
      clearInterval(videoPollingRef.current);
      clearInterval(audioPollingRef.current);
      clearInterval(clipPollingRef.current);
      clearInterval(audioClipPollingRef.current);
    };
  }, []);

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
      const response = await fetch(
        `${API_BASE}/analyze`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            url: url.trim(),
          }),
          cache: "no-store",
        }
      );

      if (!response.ok) {
        const text = await response.text();

        throw new Error(
          text || "Unable to analyze video"
        );
      }

      const data = await response.json();

      setVideoInfo(data);

      if (
        data.qualities &&
        data.qualities.length > 0
      ) {
        const sortedQualities =
          [...data.qualities].sort(
            (a, b) => a - b
          );

        setQuality(
          sortedQualities.includes(720)
            ? 720
            : sortedQualities[
                sortedQualities.length - 1
              ]
        );
      }

      setMessage(t.videoAnalyzed);
    } catch (err) {
      console.error(
        "Analyze error:",
        err
      );

      setError(
        err.message ||
          "Unable to analyze video"
      );
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // VIDEO PROGRESS POLLING
  // ============================================================

  const startVideoProgressPolling = () => {
    clearInterval(videoPollingRef.current);
    videoPollingStartRef.current = Date.now();
    videoPollingRef.current = setInterval(async () => {
      try {
        const response = await fetch(`${API_BASE}/download/status?t=${Date.now()}`, { cache: "no-store" });
        if (!response.ok) throw new Error(`Video status endpoint returned ${response.status}`);
        const data = await response.json();
        setVideoProgress(Number(data.progress) || 0);
        setVideoSpeed(data.speed || "0 B/s");
        setVideoEta(data.eta || "--:--");
        if (data.error) { clearInterval(videoPollingRef.current); setError(data.error); setVideoStatus("ERROR"); return; }
        if (data.completed) {
          clearInterval(videoPollingRef.current);
          setVideoProgress(100); setVideoSpeed(t.completed); setVideoEta("00:00"); setVideoStatus("COMPLETED");
          await downloadCompletedVideo(); return;
        }
        setVideoStatus(data.downloading ? "DOWNLOADING" : "IDLE");
        if (Date.now() - videoPollingStartRef.current > 15 * 60 * 1000) {
          clearInterval(videoPollingRef.current); setError(t.videoDownloadStuck); setVideoStatus("ERROR");
        }
      } catch (err) { console.error("Video progress error:", err); }
    }, 500);
  };
  // ============================================================
  // START VIDEO DOWNLOAD
  // ============================================================

  const startVideoDownload = async () => {
    if (!url.trim()) {
      setError(t.pleaseEnterUrl);
      return;
    }

    if (!quality || quality <= 0) {
      setError(
        t.pleaseSelectQuality
      );
      return;
    }

    clearInterval(
      videoPollingRef.current
    );

    setError("");
    setMessage("");

    setVideoProgress(0);
    setVideoSpeed("0 B/s");
    setVideoEta("--:--");
    setVideoStatus("STARTING");

    try {
      const response = await fetch(
        `${API_BASE}/download`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            url: url.trim(),
            quality: Number(quality),
          }),
          cache: "no-store",
        }
      );

      if (!response.ok) {
        const text =
          await response.text();

        throw new Error(
          text ||
            "Could not start video download"
        );
      }

      await response.text();

      setMessage(
        t.videoDownloadStarted
      );

      setVideoStatus(
        "DOWNLOADING"
      );

      startVideoProgressPolling();
    } catch (err) {
      console.error(
        "Start video download error:",
        err
      );

      setError(
        err.message ||
          "Could not start video download"
      );

      setVideoStatus("IDLE");
    }
  };

  // ============================================================
  // DOWNLOAD COMPLETED VIDEO
  // ============================================================

  const downloadCompletedVideo =
    async () => {
      try {
        const response = await fetch(
          `${API_BASE}/download/file?t=${Date.now()}`,
          {
            cache: "no-store",
          }
        );

        if (!response.ok) {
          const text =
            await response.text();

          throw new Error(
            text ||
              "Could not retrieve downloaded video"
          );
        }

        const blob =
          await response.blob();

        const downloadUrl =
          window.URL.createObjectURL(
            blob
          );

        const link =
          document.createElement("a");

        link.href = downloadUrl;

        link.download =
          videoInfo?.title
            ? `${videoInfo.title}.mp4`
            : "MediaMeld-video.mp4";

        document.body.appendChild(
          link
        );

        link.click();

        link.remove();

        setTimeout(() => {
          window.URL.revokeObjectURL(
            downloadUrl
          );
        }, 1000);

        setMessage(
          t.videoDownloadedSuccessfully
        );

        setVideoStatus(
          "COMPLETED"
        );
      } catch (err) {
        console.error(
          "Completed video error:",
          err
        );

        setError(
          err.message ||
            "Could not download video"
        );
      }
    };

  // ============================================================
  // CANCEL VIDEO
  // ============================================================

  const cancelVideoDownload =
    async () => {
      try {
        clearInterval(
          videoPollingRef.current
        );

        await fetch(
          `${API_BASE}/download/cancel`,
          {
            method: "POST",
            cache: "no-store",
          }
        );

        setVideoProgress(0);
        setVideoSpeed("0 B/s");
        setVideoEta("--:--");
        setVideoStatus("IDLE");

        setMessage(
          t.videoDownloadCancelled
        );
      } catch (err) {
        console.error(
          "Cancel video error:",
          err
        );

        setError(
          "Could not cancel video download"
        );
      }
    };

  // ============================================================
  // AUDIO PROGRESS POLLING
  // ============================================================

  const startAudioProgressPolling = () => {
    clearInterval(audioPollingRef.current);
    audioPollingStartRef.current = Date.now();
    audioPollingRef.current = setInterval(async () => {
      try {
        const response = await fetch(`${API_BASE}/audio/status?t=${Date.now()}`, { cache: "no-store" });
        if (!response.ok) throw new Error(`Audio status endpoint returned ${response.status}`);
        const data = await response.json();
        setAudioProgress(Number(data.progress) || 0);
        setAudioSpeed(data.speed || "0 B/s"); setAudioEta(data.eta || "--:--");
        if (data.error) { clearInterval(audioPollingRef.current); setError(data.error); setAudioStatus("ERROR"); return; }
        if (data.completed) {
          clearInterval(audioPollingRef.current);
          setAudioProgress(100); setAudioSpeed(t.completed); setAudioEta("00:00"); setAudioStatus("COMPLETED");
          await downloadCompletedAudio(); return;
        }
        setAudioStatus(data.downloading ? "DOWNLOADING" : "IDLE");
        if (Date.now() - audioPollingStartRef.current > 15 * 60 * 1000) {
          clearInterval(audioPollingRef.current); setError(t.audioDownloadStuck); setAudioStatus("ERROR");
        }
      } catch (err) { console.error("Audio progress error:", err); }
    }, 500);
  };
  // ============================================================
  // START AUDIO DOWNLOAD
  // ============================================================

  const startAudioDownload =
    async () => {
      if (!url.trim()) {
        setError(
          t.pleaseEnterUrl
        );
        return;
      }

      clearInterval(
        audioPollingRef.current
      );

      setError("");
      setMessage("");

      setAudioProgress(0);
      setAudioSpeed("0 B/s");
      setAudioEta("--:--");
      setAudioStatus("STARTING");

      try {
        const response = await fetch(
          `${API_BASE}/audio/download`,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              url: url.trim(),
            }),
            cache: "no-store",
          }
        );

        if (!response.ok) {
          const text =
            await response.text();

          throw new Error(
            text ||
              "Could not start audio download"
          );
        }

        await response.text();

        setMessage(
          t.audioDownloadStarted
        );

        setAudioStatus(
          "DOWNLOADING"
        );

        startAudioProgressPolling();
      } catch (err) {
        console.error(
          "Start audio error:",
          err
        );

        setError(
          err.message ||
            "Could not start audio download"
        );

        setAudioStatus("IDLE");
      }
    };

  // ============================================================
  // DOWNLOAD COMPLETED AUDIO
  // ============================================================

  const downloadCompletedAudio =
    async () => {
      try {
        const response = await fetch(
          `${API_BASE}/audio/file?t=${Date.now()}`,
          {
            cache: "no-store",
          }
        );

        if (!response.ok) {
          const text =
            await response.text();

          throw new Error(
            text ||
              "Could not retrieve downloaded audio"
          );
        }

        const blob =
          await response.blob();

        const downloadUrl =
          window.URL.createObjectURL(
            blob
          );

        const link =
          document.createElement("a");

        link.href = downloadUrl;

        link.download =
          videoInfo?.title
            ? `${videoInfo.title}.m4a`
            : "MediaMeld-audio.m4a";

        document.body.appendChild(
          link
        );

        link.click();

        link.remove();

        setTimeout(() => {
          window.URL.revokeObjectURL(
            downloadUrl
          );
        }, 1000);

        setMessage(
          t.audioDownloadedSuccessfully
        );

        setAudioStatus(
          "COMPLETED"
        );
      } catch (err) {
        console.error(
          "Completed audio error:",
          err
        );

        setError(
          err.message ||
            "Could not download audio"
        );
      }
    };

  // ============================================================
  // CANCEL AUDIO
  // ============================================================

  const cancelAudioDownload =
    async () => {
      try {
        clearInterval(
          audioPollingRef.current
        );

        await fetch(
          `${API_BASE}/audio/cancel`,
          {
            method: "POST",
            cache: "no-store",
          }
        );

        setAudioProgress(0);
        setAudioSpeed("0 B/s");
        setAudioEta("--:--");
        setAudioStatus("IDLE");

        setMessage(
          t.audioDownloadCancelled
        );
      } catch (err) {
        console.error(
          "Cancel audio error:",
          err
        );

        setError(
          "Could not cancel audio download"
        );
      }
    };

  // ============================================================
  // THUMBNAIL DOWNLOAD
  // ============================================================

  const downloadThumbnail =
    async () => {
      if (!url.trim()) {
        setError(
          t.pleaseEnterUrl
        );
        return;
      }

      if (!videoInfo?.thumbnail) {
        setError(
          t.thumbnailNotAvailable
        );
        return;
      }

      setThumbnailLoading(true);
      setError("");
      setMessage("");

      try {
        const response = await fetch(
          `${API_BASE}/thumbnail/download`,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              url: url.trim(),
            }),
            cache: "no-store",
          }
        );

        if (!response.ok) {
          const text =
            await response.text();

          throw new Error(
            text ||
              "Could not download thumbnail"
          );
        }

        const blob =
          await response.blob();

        const downloadUrl =
          window.URL.createObjectURL(
            blob
          );

        const link =
          document.createElement("a");

        link.href = downloadUrl;

        link.download =
          videoInfo?.title
            ? `${videoInfo.title}-thumbnail.jpg`
            : "MediaMeld-thumbnail.jpg";

        document.body.appendChild(
          link
        );

        link.click();

        link.remove();

        setTimeout(() => {
          window.URL.revokeObjectURL(
            downloadUrl
          );
        }, 1000);

        setMessage(
          t.thumbnailDownloadedSuccessfully
        );
      } catch (err) {
        console.error(
          "Thumbnail error:",
          err
        );

        setError(
          err.message ||
            "Could not download thumbnail"
        );
      } finally {
        setThumbnailLoading(false);
      }
    };

  // ============================================================
  // VIDEO CLIP PROGRESS POLLING
  // ============================================================

  const startClipProgressPolling = () => {
    clearInterval(clipPollingRef.current);
    clipPollingStartRef.current = Date.now();
    clipPollingRef.current = setInterval(async () => {
      try {
        const response = await fetch(`${API_BASE}/clip/status?t=${Date.now()}`, { cache: "no-store" });
        if (!response.ok) throw new Error(`Clip status endpoint returned ${response.status}`);
        const data = await response.json();
        setClipProgress(Number(data.progress) || 0);
        setClipSpeed(data.speed || "0 B/s"); setClipEta(data.eta || "--:--");
        if (data.error) { clearInterval(clipPollingRef.current); setError(data.error); setClipStatus("ERROR"); return; }
        if (data.completed) {
          clearInterval(clipPollingRef.current);
          setClipProgress(100); setClipSpeed(t.completed); setClipEta("00:00"); setClipStatus("COMPLETED");
          await downloadCompletedClip(); return;
        }
        setClipStatus(data.downloading ? "DOWNLOADING" : "IDLE");
        if (Date.now() - clipPollingStartRef.current > 15 * 60 * 1000) {
          clearInterval(clipPollingRef.current); setError(t.clipDownloadStuck); setClipStatus("ERROR");
        }
      } catch (err) { console.error("Clip progress error:", err); }
    }, 500);
  };
  // ============================================================
  // START VIDEO CLIP DOWNLOAD
  // ============================================================

  const startClipDownload =
    async () => {
      if (!url.trim()) {
        setError(
          t.pleaseEnterUrl
        );
        return;
      }

      if (
        !startTime.trim() ||
        !endTime.trim()
      ) {
        setError(
          t.startEndRequired
        );
        return;
      }

      if (!quality || quality <= 0) {
        setError(
          t.pleaseSelectQuality
        );
        return;
      }

      clearInterval(
        clipPollingRef.current
      );

      setError("");
      setMessage("");

      setClipProgress(0);
      setClipSpeed("0 B/s");
      setClipEta("--:--");
      setClipStatus("STARTING");

      try {
        const response = await fetch(
          `${API_BASE}/clip/download`,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              url: url.trim(),
              quality: Number(quality),
              startTime:
                startTime.trim(),
              endTime:
                endTime.trim(),
            }),
            cache: "no-store",
          }
        );

        if (!response.ok) {
          const text =
            await response.text();

          throw new Error(
            text ||
              "Could not start clip download"
          );
        }

        await response.text();

        setMessage(
          t.clipDownloadStarted
        );

        setClipStatus(
          "DOWNLOADING"
        );

        startClipProgressPolling();
      } catch (err) {
        console.error(
          "Start clip error:",
          err
        );

        setError(
          err.message ||
            "Could not start clip download"
        );

        setClipStatus("IDLE");
      }
    };

  // ============================================================
  // DOWNLOAD COMPLETED VIDEO CLIP
  // ============================================================

  const downloadCompletedClip =
    async () => {
      try {
        const response = await fetch(
          `${API_BASE}/clip/file?t=${Date.now()}`,
          {
            cache: "no-store",
          }
        );

        if (!response.ok) {
          const text =
            await response.text();

          throw new Error(
            text ||
              "Could not retrieve downloaded clip"
          );
        }

        const blob =
          await response.blob();

        const downloadUrl =
          window.URL.createObjectURL(
            blob
          );

        const link =
          document.createElement("a");

        link.href = downloadUrl;

        link.download =
          videoInfo?.title
            ? `${videoInfo.title}-clip.mp4`
            : "MediaMeld-clip.mp4";

        document.body.appendChild(
          link
        );

        link.click();

        link.remove();

        setTimeout(() => {
          window.URL.revokeObjectURL(
            downloadUrl
          );
        }, 1000);

        setMessage(
          t.clipDownloadedSuccessfully
        );

        setClipStatus(
          "COMPLETED"
        );
      } catch (err) {
        console.error(
          "Completed clip error:",
          err
        );

        setError(
          err.message ||
            "Could not download clip"
        );
      }
    };

  // ============================================================
  // CANCEL VIDEO CLIP
  // ============================================================

  const cancelClipDownload =
    async () => {
      try {
        clearInterval(
          clipPollingRef.current
        );

        await fetch(
          `${API_BASE}/clip/cancel`,
          {
            method: "POST",
            cache: "no-store",
          }
        );

        setClipProgress(0);
        setClipSpeed("0 B/s");
        setClipEta("--:--");
        setClipStatus("IDLE");

        setMessage(
          t.clipDownloadCancelled
        );
      } catch (err) {
        console.error(
          "Cancel clip error:",
          err
        );

        setError(
          "Could not cancel clip download"
        );
      }
    };

  // ============================================================
  // AUDIO CLIP PROGRESS POLLING
  // ============================================================

  const startAudioClipProgressPolling = () => {
    clearInterval(audioClipPollingRef.current);
    audioClipPollingStartRef.current = Date.now();
    audioClipPollingRef.current = setInterval(async () => {
      try {
        const response = await fetch(`${API_BASE}/audio-clip/status?t=${Date.now()}`, { cache: "no-store" });
        if (!response.ok) throw new Error(`Audio clip status endpoint returned ${response.status}`);
        const data = await response.json();
        setAudioClipProgress(Number(data.progress) || 0);
        setAudioClipSpeed(data.speed || "0 B/s"); setAudioClipEta(data.eta || "--:--");
        if (data.error) { clearInterval(audioClipPollingRef.current); setError(data.error); setAudioClipStatus("ERROR"); return; }
        if (data.completed) {
          clearInterval(audioClipPollingRef.current);
          setAudioClipProgress(100); setAudioClipSpeed(t.completed); setAudioClipEta("00:00"); setAudioClipStatus("COMPLETED");
          await downloadCompletedAudioClip(); return;
        }
        setAudioClipStatus(data.downloading ? "DOWNLOADING" : "IDLE");
        if (Date.now() - audioClipPollingStartRef.current > 15 * 60 * 1000) {
          clearInterval(audioClipPollingRef.current);
          setError(t.audioDownloadStuck || "Audio clip download is taking too long."); setAudioClipStatus("ERROR");
        }
      } catch (err) { console.error("Audio clip progress error:", err); }
    }, 500);
  };
  // ============================================================
  // START AUDIO CLIP DOWNLOAD
  // ============================================================

  const startAudioClipDownload =
    async () => {
      if (!url.trim()) {
        setError(
          t.pleaseEnterUrl
        );
        return;
      }

      if (
        !audioClipStartTime.trim() ||
        !audioClipEndTime.trim()
      ) {
        setError(
          t.startEndRequired
        );
        return;
      }

      clearInterval(
        audioClipPollingRef.current
      );

      setError("");
      setMessage("");

      setAudioClipProgress(0);
      setAudioClipSpeed("0 B/s");
      setAudioClipEta("--:--");
      setAudioClipStatus("STARTING");

      try {
        const response = await fetch(
          `${API_BASE}/audio-clip/download`,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              url: url.trim(),
              startTime:
                audioClipStartTime.trim(),
              endTime:
                audioClipEndTime.trim(),
            }),
            cache: "no-store",
          }
        );

        if (!response.ok) {
          const text =
            await response.text();

          throw new Error(
            text ||
              "Could not start audio clip download"
          );
        }

        await response.text();

        setMessage(
          t.audioClipDownloadStarted ||
            "Audio clip download started."
        );

        setAudioClipStatus(
          "DOWNLOADING"
        );

        startAudioClipProgressPolling();
      } catch (err) {
        console.error(
          "Start audio clip error:",
          err
        );

        setError(
          err.message ||
            "Could not start audio clip download"
        );

        setAudioClipStatus(
          "IDLE"
        );
      }
    };

  // ============================================================
  // DOWNLOAD COMPLETED AUDIO CLIP
  // ============================================================

  const downloadCompletedAudioClip =
    async () => {
      try {
        const response = await fetch(
          `${API_BASE}/audio-clip/file?t=${Date.now()}`,
          {
            cache: "no-store",
          }
        );

        if (!response.ok) {
          const text =
            await response.text();

          throw new Error(
            text ||
              "Could not retrieve downloaded audio clip"
          );
        }

        const blob =
          await response.blob();

        const downloadUrl =
          window.URL.createObjectURL(
            blob
          );

        const link =
          document.createElement("a");

        link.href = downloadUrl;

        link.download =
          videoInfo?.title
            ? `${videoInfo.title}-audio-clip.m4a`
            : "MediaMeld-audio-clip.m4a";

        document.body.appendChild(
          link
        );

        link.click();

        link.remove();

        setTimeout(() => {
          window.URL.revokeObjectURL(
            downloadUrl
          );
        }, 1000);

        setMessage(
          t.audioClipDownloadedSuccessfully ||
            "Audio clip downloaded successfully."
        );

        setAudioClipStatus(
          "COMPLETED"
        );
      } catch (err) {
        console.error(
          "Completed audio clip error:",
          err
        );

        setError(
          err.message ||
            "Could not download audio clip"
        );
      }
    };

  // ============================================================
  // CANCEL AUDIO CLIP
  // ============================================================

  const cancelAudioClipDownload =
    async () => {
      try {
        clearInterval(
          audioClipPollingRef.current
        );

        await fetch(
          `${API_BASE}/audio-clip/cancel`,
          {
            method: "POST",
            cache: "no-store",
          }
        );

        setAudioClipProgress(0);
        setAudioClipSpeed("0 B/s");
        setAudioClipEta("--:--");
        setAudioClipStatus("IDLE");

        setMessage(
          t.audioClipDownloadCancelled ||
            "Audio clip download cancelled."
        );
      } catch (err) {
        console.error(
          "Cancel audio clip error:",
          err
        );

        setError(
          "Could not cancel audio clip download"
        );
      }
    };

  // ============================================================
  // FORMAT DURATION
  // ============================================================

  const formatDuration = (
    seconds
  ) => {
    if (!seconds) {
      return "00:00";
    }

    const totalSeconds =
      Math.floor(seconds);

    const hours =
      Math.floor(
        totalSeconds / 3600
      );

    const minutes =
      Math.floor(
        (totalSeconds % 3600) / 60
      );

    const secs =
      totalSeconds % 60;

    if (hours > 0) {
      return (
        `${String(hours).padStart(
          2,
          "0"
        )}:` +
        `${String(minutes).padStart(
          2,
          "0"
        )}:` +
        `${String(secs).padStart(
          2,
          "0"
        )}`
      );
    }

    return (
      `${String(minutes).padStart(
        2,
        "0"
      )}:` +
      `${String(secs).padStart(
        2,
        "0"
      )}`
    );
  };

  // ============================================================
  // DISPLAY STATUS
  // ============================================================

  const getStatusText = (
    status
  ) => {
    switch (status) {
      case "IDLE":
        return t.idle;

      case "DOWNLOADING":
        return t.downloading;

      case "COMPLETED":
        return t.completed;

      case "ERROR":
        return t.error;

      case "STARTING":
        return t.starting;

      default:
        return status;
    }
  };

  // ============================================================
  // UI
  // ============================================================

  return (
    <div className="app">
      <div className="container">

        {/* ======================================================
            HEADER
        ====================================================== */}

        <div className="header">

          <div className="logo">
            {t.appTitle}
          </div>

          <p>
            {t.appSubtitle}
          </p>

          <div className="header-settings">

            {/* LANGUAGE */}

            <div className="language-selector">

              <label htmlFor="language">
                {t.language}
              </label>

              <select
                id="language"
                value={language}
                onChange={(e) =>
                  setLanguage(
                    e.target.value
                  )
                }
              >
                {Object.entries(
                  translations
                ).map(
                  ([
                    code,
                    translation,
                  ]) => (
                    <option
                      key={code}
                      value={code}
                    >
                      {
                        translation.languageName
                      }
                    </option>
                  )
                )}
              </select>

            </div>

            {/* THEME */}

            <div className="theme-selector">

              <label htmlFor="theme">
                Theme
              </label>

              <select
                id="theme"
                value={theme}
                onChange={(e) =>
                  setTheme(
                    e.target.value
                  )
                }
              >
                <option value="dark">
                  🌙 Dark
                </option>

                <option value="light">
                  ☀️ Light
                </option>
              </select>

            </div>

          </div>

        </div>

        {/* ======================================================
            SEARCH
        ====================================================== */}

        <div className="search-section">

          <input
            className="url-input"
            type="text"
            placeholder={
              t.pasteUrl
            }
            value={url}
            onChange={(e) =>
              setUrl(e.target.value)
            }
            disabled={loading}
          />

          <button
            className="analyze-btn"
            onClick={
              analyzeVideo
            }
            disabled={loading}
          >
            {loading
              ? t.analyzing
              : t.analyze}
          </button>

        </div>

        {/* ======================================================
            ERROR
        ====================================================== */}

        {error && (
          <div className="message message-error">
            {error}
          </div>
        )}

        {/* ======================================================
            SUCCESS
        ====================================================== */}

        {message && (
          <div className="message message-success">
            {message}
          </div>
        )}

        {/* ======================================================
            VIDEO CARD
        ====================================================== */}

        {videoInfo && (
          <div className="video-card">

            {/* ==================================================
                THUMBNAIL
            ================================================== */}

            <div className="thumbnail-wrapper">

              {videoInfo.thumbnail && (
                <img
                  src={
                    videoInfo.thumbnail
                  }
                  alt="Video Thumbnail"
                  className="thumbnail"
                />
              )}

            </div>

            {/* ==================================================
                DETAILS
            ================================================== */}

            <div className="video-details">

              <h2>
                {videoInfo.title}
              </h2>

              <p className="channel">
                {t.channel}:{" "}
                {videoInfo.channelName ||
                  t.unknown}
                {" • "}
                {t.duration}:{" "}
                {formatDuration(
                  videoInfo.duration
                )}
              </p>

              {/* ==================================================
                  QUALITY
              ================================================== */}

              <div className="quality-section">

                <label>
                  {t.videoQuality}
                </label>

                <select
                  value={quality}
                  onChange={(e) =>
                    setQuality(
                      Number(
                        e.target.value
                      )
                    )
                  }
                  disabled={
                    videoStatus ===
                      "DOWNLOADING" ||
                    videoStatus ===
                      "STARTING"
                  }
                >
                  {videoInfo.qualities
                    ?.slice()
                    .sort(
                      (a, b) =>
                        b - a
                    )
                    .map((q) => (
                      <option
                        key={q}
                        value={q}
                      >
                        {q}p
                      </option>
                    ))}
                </select>

              </div>

              {/* ==================================================
                  VIDEO DOWNLOAD
              ================================================== */}

              <button
                className="download-btn video-btn"
                onClick={
                  startVideoDownload
                }
                disabled={
                  videoStatus ===
                    "DOWNLOADING" ||
                  videoStatus ===
                    "STARTING"
                }
              >
                {videoStatus ===
                "STARTING"
                  ? t.starting
                  : t.downloadVideo}
              </button>

              {/* VIDEO PROGRESS */}

              {(videoStatus ===
                "DOWNLOADING" ||
                videoStatus ===
                  "STARTING" ||
                videoProgress > 0) && (
                <div className="progress-section">

                  <div className="progress-header">
                    <span>
                      {getStatusText(
                        videoStatus
                      )}
                    </span>

                    <span>
                      {videoProgress.toFixed(
                        1
                      )}
                      %
                    </span>
                  </div>

                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{
                        width:
                          `${videoProgress}%`,
                      }}
                    />
                  </div>

                  <div className="download-stats">
                    <span>
                      {t.speed}:{" "}
                      {videoSpeed}
                    </span>

                    <span>
                      {t.eta}:{" "}
                      {videoEta}
                    </span>
                  </div>

                  {videoStatus ===
                    "DOWNLOADING" && (
                    <button
                      className="cancel-btn"
                      onClick={
                        cancelVideoDownload
                      }
                    >
                      {t.cancel}
                    </button>
                  )}

                </div>
              )}

              {/* ==================================================
                  FULL AUDIO DOWNLOAD
              ================================================== */}

              <button
                className="download-btn audio-btn"
                onClick={
                  startAudioDownload
                }
                disabled={
                  audioStatus ===
                    "DOWNLOADING" ||
                  audioStatus ===
                    "STARTING"
                }
              >
                {audioStatus ===
                "STARTING"
                  ? t.starting
                  : t.downloadAudio}
              </button>

              {/* AUDIO PROGRESS */}

              {(audioStatus ===
                "DOWNLOADING" ||
                audioStatus ===
                  "STARTING" ||
                audioProgress > 0) && (
                <div className="progress-section">

                  <div className="progress-header">
                    <span>
                      {getStatusText(
                        audioStatus
                      )}
                    </span>

                    <span>
                      {audioProgress.toFixed(
                        1
                      )}
                      %
                    </span>
                  </div>

                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{
                        width:
                          `${audioProgress}%`,
                      }}
                    />
                  </div>

                  <div className="download-stats">
                    <span>
                      {t.speed}:{" "}
                      {audioSpeed}
                    </span>

                    <span>
                      {t.eta}:{" "}
                      {audioEta}
                    </span>
                  </div>

                  {audioStatus ===
                    "DOWNLOADING" && (
                    <button
                      className="cancel-btn"
                      onClick={
                        cancelAudioDownload
                      }
                    >
                      {t.cancel}
                    </button>
                  )}

                </div>
              )}

              {/* ==================================================
                  THUMBNAIL
              ================================================== */}

              <button
                className="download-btn thumbnail-btn"
                onClick={
                  downloadThumbnail
                }
                disabled={
                  thumbnailLoading
                }
              >
                {thumbnailLoading
                  ? t.downloadingThumbnail
                  : t.downloadThumbnail}
              </button>

              {/* ==================================================
                  VIDEO CLIP
              ================================================== */}

              <div className="clip-section">

                <h3 className="clip-title">
                  {t.clipDownload}
                </h3>

                <p className="clip-description">
                  {t.clipDescription}
                </p>

                <div className="clip-time-row">

                  <div className="clip-time-field">

                    <label>
                      {t.startTime}
                    </label>

                    <input
                      className="clip-time-input"
                      type="text"
                      placeholder="00:00"
                      value={
                        startTime
                      }
                      onChange={(e) =>
                        setStartTime(
                          e.target.value
                        )
                      }
                      disabled={
                        clipStatus ===
                          "DOWNLOADING" ||
                        clipStatus ===
                          "STARTING"
                      }
                    />

                  </div>

                  <div className="clip-time-field">

                    <label>
                      {t.endTime}
                    </label>

                    <input
                      className="clip-time-input"
                      type="text"
                      placeholder="00:30"
                      value={
                        endTime
                      }
                      onChange={(e) =>
                        setEndTime(
                          e.target.value
                        )
                      }
                      disabled={
                        clipStatus ===
                          "DOWNLOADING" ||
                        clipStatus ===
                          "STARTING"
                      }
                    />

                  </div>

                </div>

                <button
                  className="download-btn clip-btn"
                  onClick={
                    startClipDownload
                  }
                  disabled={
                    clipStatus ===
                      "DOWNLOADING" ||
                    clipStatus ===
                      "STARTING"
                  }
                >
                  {clipStatus ===
                  "STARTING"
                    ? t.starting
                    : t.downloadClip}
                </button>

                {/* CLIP PROGRESS */}

                {(clipStatus ===
                  "DOWNLOADING" ||
                  clipStatus ===
                    "STARTING" ||
                  clipProgress > 0) && (
                  <div className="progress-section">

                    <div className="progress-header">
                      <span>
                        {getStatusText(
                          clipStatus
                        )}
                      </span>

                      <span>
                        {clipProgress.toFixed(
                          1
                        )}
                        %
                      </span>
                    </div>

                    <div className="progress-bar">
                      <div
                        className="progress-fill"
                        style={{
                          width:
                            `${clipProgress}%`,
                        }}
                      />
                    </div>

                    <div className="download-stats">
                      <span>
                        {t.speed}:{" "}
                        {clipSpeed}
                      </span>

                      <span>
                        {t.eta}:{" "}
                        {clipEta}
                      </span>
                    </div>

                    {clipStatus ===
                      "DOWNLOADING" && (
                      <button
                        className="cancel-btn"
                        onClick={
                          cancelClipDownload
                        }
                      >
                        {t.cancel}
                      </button>
                    )}

                  </div>
                )}

              </div>

              {/* ==================================================
                  AUDIO CLIP
              ================================================== */}

              <div className="clip-section">

                <h3 className="clip-title">
                  {t.audioClipDownload ||
                    "Audio Clip Download"}
                </h3>

                <p className="clip-description">
                  {t.audioClipDescription ||
                    "Download only a selected part of the audio."}
                </p>

                <div className="clip-time-row">

                  {/* AUDIO CLIP START */}

                  <div className="clip-time-field">

                    <label>
                      {t.startTime}
                    </label>

                    <input
                      className="clip-time-input"
                      type="text"
                      placeholder="00:00"
                      value={
                        audioClipStartTime
                      }
                      onChange={(e) =>
                        setAudioClipStartTime(
                          e.target.value
                        )
                      }
                      disabled={
                        audioClipStatus ===
                          "DOWNLOADING" ||
                        audioClipStatus ===
                          "STARTING"
                      }
                    />

                  </div>

                  {/* AUDIO CLIP END */}

                  <div className="clip-time-field">

                    <label>
                      {t.endTime}
                    </label>

                    <input
                      className="clip-time-input"
                      type="text"
                      placeholder="00:30"
                      value={
                        audioClipEndTime
                      }
                      onChange={(e) =>
                        setAudioClipEndTime(
                          e.target.value
                        )
                      }
                      disabled={
                        audioClipStatus ===
                          "DOWNLOADING" ||
                        audioClipStatus ===
                          "STARTING"
                      }
                    />

                  </div>

                </div>

                {/* AUDIO CLIP BUTTON */}

                <button
                  className="download-btn audio-btn"
                  onClick={
                    startAudioClipDownload
                  }
                  disabled={
                    audioClipStatus ===
                      "DOWNLOADING" ||
                    audioClipStatus ===
                      "STARTING"
                  }
                >
                  {audioClipStatus ===
                  "STARTING"
                    ? t.starting
                    : t.downloadAudioClip ||
                      "Download Audio Clip"}
                </button>

                {/* AUDIO CLIP PROGRESS */}

                {(audioClipStatus ===
                  "DOWNLOADING" ||
                  audioClipStatus ===
                    "STARTING" ||
                  audioClipProgress > 0) && (
                  <div className="progress-section">

                    <div className="progress-header">

                      <span>
                        {getStatusText(
                          audioClipStatus
                        )}
                      </span>

                      <span>
                        {audioClipProgress.toFixed(
                          1
                        )}
                        %
                      </span>

                    </div>

                    <div className="progress-bar">

                      <div
                        className="progress-fill"
                        style={{
                          width:
                            `${audioClipProgress}%`,
                        }}
                      />

                    </div>

                    <div className="download-stats">

                      <span>
                        {t.speed}:{" "}
                        {audioClipSpeed}
                      </span>

                      <span>
                        {t.eta}:{" "}
                        {audioClipEta}
                      </span>

                    </div>

                    {audioClipStatus ===
                      "DOWNLOADING" && (
                      <button
                        className="cancel-btn"
                        onClick={
                          cancelAudioClipDownload
                        }
                      >
                        {t.cancel}
                      </button>
                    )}

                  </div>
                )}

              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default App;
