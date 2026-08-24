import { useState } from "react";
import "./App.css";

function App() {
  // ============================================================
  // URL / VIDEO INFORMATION
  // ============================================================

  const [url, setUrl] = useState("");
  const [videoInfo, setVideoInfo] = useState(null);

  // Quality comes directly from backend
  const [quality, setQuality] = useState(720);

  // ============================================================
  // ANALYZE
  // ============================================================

  const [analyzing, setAnalyzing] = useState(false);

  // ============================================================
  // VIDEO DOWNLOAD
  // ============================================================

  const [downloadingVideo, setDownloadingVideo] =
    useState(false);

  const [videoProgress, setVideoProgress] =
    useState(0);

  // ============================================================
  // AUDIO DOWNLOAD
  // ============================================================

  const [downloadingAudio, setDownloadingAudio] =
    useState(false);

  const [audioProgress, setAudioProgress] =
    useState(0);

  // ============================================================
  // THUMBNAIL DOWNLOAD
  // ============================================================

  const [downloadingThumbnail, setDownloadingThumbnail] =
    useState(false);

  // ============================================================
  // CLIP DOWNLOAD
  // ============================================================

  const [downloadingClip, setDownloadingClip] =
    useState(false);

  const [clipProgress, setClipProgress] =
    useState(0);

  const [startTime, setStartTime] =
    useState("");

  const [endTime, setEndTime] =
    useState("");

  // ============================================================
  // MESSAGE
  // ============================================================

  const [message, setMessage] =
    useState("");

  const [messageType, setMessageType] =
    useState("");

  // ============================================================
  // ANY DOWNLOAD RUNNING
  // ============================================================

  const downloading =
    downloadingVideo ||
    downloadingAudio ||
    downloadingThumbnail ||
    downloadingClip;

  // ============================================================
  // ANALYZE VIDEO
  // ============================================================

  const handleAnalyze = async () => {
    if (!url.trim()) {
      setMessage("Please enter a YouTube URL");
      setMessageType("error");
      return;
    }

    setAnalyzing(true);

    setMessage("");
    setMessageType("");

    setVideoInfo(null);

    setVideoProgress(0);
    setAudioProgress(0);
    setClipProgress(0);

    try {
      const response = await fetch(
        "http://localhost:8080/api/media/analyze",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            url: url.trim(),
          }),
        }
      );

      if (!response.ok) {
        const errorText =
          await response.text();

        throw new Error(
          errorText || "Analyze failed"
        );
      }

      const data =
        await response.json();

      console.log(
        "Video information:",
        data
      );

      setVideoInfo(data);

      // ========================================================
      // USE QUALITY FROM BACKEND
      // ========================================================

      if (
        Array.isArray(data.qualities) &&
        data.qualities.length > 0
      ) {
        const qualities =
          data.qualities
            .map(Number)
            .filter(
              (q) =>
                Number.isFinite(q) &&
                q > 0
            );

        if (qualities.length > 0) {
          if (
            qualities.includes(
              Number(quality)
            )
          ) {
            setQuality(
              Number(quality)
            );
          } else {
            setQuality(
              Math.max(...qualities)
            );
          }
        }
      }

      setMessage(
        "Video analyzed successfully"
      );

      setMessageType("success");

    } catch (error) {
      console.error(
        "Analyze error:",
        error
      );

      setMessage(
        error.message ||
          "Unable to analyze video"
      );

      setMessageType("error");

    } finally {
      setAnalyzing(false);
    }
  };

  // ============================================================
  // DOWNLOAD VIDEO
  // ============================================================

  const handleDownloadVideo = async () => {
    if (!url.trim()) {
      setMessage(
        "Please enter a YouTube URL"
      );

      setMessageType("error");

      return;
    }

    if (!quality) {
      setMessage(
        "Please select a video quality"
      );

      setMessageType("error");

      return;
    }

    setDownloadingVideo(true);

    setVideoProgress(0);

    setMessage(
      "Starting video download..."
    );

    setMessageType("");

    try {
      // ========================================================
      // START VIDEO DOWNLOAD
      // ========================================================

      const startResponse =
        await fetch(
          "http://localhost:8080/api/media/download/start",
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
          }
        );

      if (!startResponse.ok) {
        const errorText =
          await startResponse.text();

        throw new Error(
          errorText ||
            "Could not start video download"
        );
      }

      // ========================================================
      // MONITOR VIDEO
      // ========================================================

      let completed = false;

      while (!completed) {
        await new Promise(
          (resolve) =>
            setTimeout(resolve, 1000)
        );

        // ======================================================
        // VIDEO PROGRESS
        // ======================================================

        const progressResponse =
          await fetch(
            "http://localhost:8080/api/media/progress"
          );

        if (!progressResponse.ok) {
          throw new Error(
            "Could not get video progress"
          );
        }

        const currentProgress =
          await progressResponse.json();

        const rounded =
          Math.round(
            Number(currentProgress)
          );

        setVideoProgress(
          Math.min(
            100,
            Math.max(0, rounded)
          )
        );

        // ======================================================
        // VIDEO STATUS
        // ======================================================

        const statusResponse =
          await fetch(
            "http://localhost:8080/api/media/status"
          );

        if (!statusResponse.ok) {
          throw new Error(
            "Could not get video status"
          );
        }

        const status =
          await statusResponse.text();

        console.log(
          "Video:",
          rounded + "%",
          status
        );

        // ======================================================
        // COMPLETED
        // ======================================================

        if (status === "COMPLETED") {
          completed = true;

          setVideoProgress(100);

          setMessage(
            "Video download completed!"
          );

          setMessageType("success");
        }

        // ======================================================
        // ERROR
        // ======================================================

        if (
          status.startsWith("ERROR:")
        ) {
          const actualError =
            status
              .substring(
                "ERROR:".length
              )
              .trim();

          throw new Error(
            actualError ||
              "Video download failed"
          );
        }

        // ======================================================
        // CANCELLED
        // ======================================================

        if (
          status === "IDLE" &&
          rounded === 0
        ) {
          completed = true;

          throw new Error(
            "Video download cancelled"
          );
        }
      }

      // ========================================================
      // GET COMPLETED VIDEO
      // ========================================================

      const fileResponse =
        await fetch(
          "http://localhost:8080/api/media/download/file"
        );

      if (!fileResponse.ok) {
        throw new Error(
          "Could not get completed video file"
        );
      }

      const blob =
        await fileResponse.blob();

      // ========================================================
      // DOWNLOAD TO LAPTOP
      // ========================================================

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

      document.body.appendChild(link);

      link.click();

      link.remove();

      window.URL.revokeObjectURL(
        downloadUrl
      );

      setMessage(
        "Video downloaded successfully!"
      );

      setMessageType("success");

    } catch (error) {
      console.error(
        "Video download error:",
        error
      );

      setMessage(
        error.message ||
          "Video download failed"
      );

      setMessageType("error");

    } finally {
      setDownloadingVideo(false);
    }
  };

  // ============================================================
  // CANCEL VIDEO
  // ============================================================

  const handleCancelVideo = async () => {
    try {
      const response =
        await fetch(
          "http://localhost:8080/api/media/download/cancel",
          {
            method: "POST",
          }
        );

      if (!response.ok) {
        throw new Error(
          "Could not cancel video download"
        );
      }

      setDownloadingVideo(false);

      setVideoProgress(0);

      setMessage(
        "Video download cancelled"
      );

      setMessageType("");

    } catch (error) {
      console.error(
        "Cancel video error:",
        error
      );

      setMessage(
        error.message ||
          "Could not cancel video download"
      );

      setMessageType("error");
    }
  };

  // ============================================================
  // DOWNLOAD AUDIO
  // ============================================================

  const handleDownloadAudio = async () => {
    if (!url.trim()) {
      setMessage(
        "Please enter a YouTube URL"
      );

      setMessageType("error");

      return;
    }

    setDownloadingAudio(true);

    setAudioProgress(0);

    setMessage(
      "Starting best quality audio download..."
    );

    setMessageType("");

    try {
      // ========================================================
      // START AUDIO DOWNLOAD
      // ========================================================

      const startResponse =
        await fetch(
          "http://localhost:8080/api/media/audio/start",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              url: url.trim(),
            }),
          }
        );

      if (!startResponse.ok) {
        const errorText =
          await startResponse.text();

        throw new Error(
          errorText ||
            "Could not start audio download"
        );
      }

      // ========================================================
      // MONITOR AUDIO
      // ========================================================

      let completed = false;

      while (!completed) {
        await new Promise(
          (resolve) =>
            setTimeout(resolve, 1000)
        );

        // ======================================================
        // AUDIO PROGRESS
        // ======================================================

        const progressResponse =
          await fetch(
            "http://localhost:8080/api/media/audio/progress"
          );

        if (!progressResponse.ok) {
          throw new Error(
            "Could not get audio progress"
          );
        }

        const currentProgress =
          await progressResponse.json();

        const rounded =
          Math.round(
            Number(currentProgress)
          );

        setAudioProgress(
          Math.min(
            100,
            Math.max(0, rounded)
          )
        );

        // ======================================================
        // AUDIO STATUS
        // ======================================================

        const statusResponse =
          await fetch(
            "http://localhost:8080/api/media/audio/status"
          );

        if (!statusResponse.ok) {
          throw new Error(
            "Could not get audio status"
          );
        }

        const status =
          await statusResponse.text();

        console.log(
          "Audio:",
          rounded + "%",
          status
        );

        // ======================================================
        // COMPLETED
        // ======================================================

        if (status === "COMPLETED") {
          completed = true;

          setAudioProgress(100);

          setMessage(
            "Best quality audio download completed!"
          );

          setMessageType("success");
        }

        // ======================================================
        // ERROR
        // ======================================================

        if (
          status.startsWith("ERROR:")
        ) {
          const actualError =
            status
              .substring(
                "ERROR:".length
              )
              .trim();

          throw new Error(
            actualError ||
              "Audio download failed"
          );
        }

        // ======================================================
        // CANCELLED
        // ======================================================

        if (
          status === "IDLE" &&
          rounded === 0
        ) {
          completed = true;

          throw new Error(
            "Audio download cancelled"
          );
        }
      }

      // ========================================================
      // GET COMPLETED AUDIO
      // ========================================================

      const fileResponse =
        await fetch(
          "http://localhost:8080/api/media/audio/file"
        );

      if (!fileResponse.ok) {
        throw new Error(
          "Could not get completed audio file"
        );
      }

      const blob =
        await fileResponse.blob();

      // ========================================================
      // DOWNLOAD TO LAPTOP
      // ========================================================

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

      document.body.appendChild(link);

      link.click();

      link.remove();

      window.URL.revokeObjectURL(
        downloadUrl
      );

      setMessage(
        "Best quality audio downloaded successfully!"
      );

      setMessageType("success");

    } catch (error) {
      console.error(
        "Audio download error:",
        error
      );

      setMessage(
        error.message ||
          "Audio download failed"
      );

      setMessageType("error");

    } finally {
      setDownloadingAudio(false);
    }
  };

  // ============================================================
  // CANCEL AUDIO
  // ============================================================

  const handleCancelAudio = async () => {
    try {
      const response =
        await fetch(
          "http://localhost:8080/api/media/audio/cancel",
          {
            method: "POST",
          }
        );

      if (!response.ok) {
        throw new Error(
          "Could not cancel audio download"
        );
      }

      setDownloadingAudio(false);

      setAudioProgress(0);

      setMessage(
        "Audio download cancelled"
      );

      setMessageType("");

    } catch (error) {
      console.error(
        "Cancel audio error:",
        error
      );

      setMessage(
        error.message ||
          "Could not cancel audio download"
      );

      setMessageType("error");
    }
  };

  // ============================================================
  // DOWNLOAD THUMBNAIL
  // ============================================================

  const handleDownloadThumbnail = async () => {
    if (!videoInfo?.thumbnail) {
      setMessage(
        "Analyze the video first"
      );

      setMessageType("error");

      return;
    }

    setDownloadingThumbnail(true);

    setMessage(
      "Downloading thumbnail..."
    );

    setMessageType("");

    try {
      // ========================================================
      // SEND THUMBNAIL URL TO SPRING BOOT
      // ========================================================

      const response =
        await fetch(
          `http://localhost:8080/api/media/thumbnail?url=${encodeURIComponent(
            videoInfo.thumbnail
          )}`
        );

      if (!response.ok) {
        const errorText =
          await response.text();

        throw new Error(
          errorText ||
            "Thumbnail download failed"
        );
      }

      // ========================================================
      // RECEIVE IMAGE AS BLOB
      // ========================================================

      const blob =
        await response.blob();

      if (!blob || blob.size === 0) {
        throw new Error(
          "Thumbnail file is empty"
        );
      }

      // ========================================================
      // CREATE LOCAL DOWNLOAD
      // ========================================================

      const downloadUrl =
        window.URL.createObjectURL(
          blob
        );

      const link =
        document.createElement("a");

      link.href = downloadUrl;

      link.download =
        videoInfo?.title
          ? `${videoInfo.title}-thumbnail.webp`
          : "MediaMeld-thumbnail.webp";

      document.body.appendChild(link);

      link.click();

      link.remove();

      window.URL.revokeObjectURL(
        downloadUrl
      );

      setMessage(
        "Thumbnail downloaded successfully!"
      );

      setMessageType("success");

    } catch (error) {
      console.error(
        "Thumbnail download error:",
        error
      );

      setMessage(
        error.message ||
          "Thumbnail download failed"
      );

      setMessageType("error");

    } finally {
      setDownloadingThumbnail(false);
    }
  };

  // ============================================================
  // DOWNLOAD CLIP
  // ============================================================

  const handleDownloadClip = async () => {
    if (!url.trim()) {
      setMessage(
        "Please enter a YouTube URL"
      );

      setMessageType("error");

      return;
    }

    if (
      !startTime.trim() ||
      !endTime.trim()
    ) {
      setMessage(
        "Please enter both start time and end time"
      );

      setMessageType("error");

      return;
    }

    if (!quality) {
      setMessage(
        "Please select a video quality"
      );

      setMessageType("error");

      return;
    }

    setDownloadingClip(true);

    setClipProgress(0);

    setMessage(
      "Starting clip download..."
    );

    setMessageType("");

    try {
      // ========================================================
      // START CLIP DOWNLOAD
      // ========================================================

      const startResponse =
        await fetch(
          "http://localhost:8080/api/media/clip/start",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              url: url.trim(),
              startTime: startTime.trim(),
              endTime: endTime.trim(),
              quality: Number(quality),
            }),
          }
        );

      if (!startResponse.ok) {
        const errorText =
          await startResponse.text();

        throw new Error(
          errorText ||
            "Could not start clip download"
        );
      }

      // ========================================================
      // MONITOR CLIP
      // ========================================================

      let completed = false;

      while (!completed) {
        await new Promise(
          (resolve) =>
            setTimeout(resolve, 1000)
        );

        // ======================================================
        // CLIP PROGRESS
        // ======================================================

        const progressResponse =
          await fetch(
            "http://localhost:8080/api/media/clip/progress"
          );

        if (!progressResponse.ok) {
          throw new Error(
            "Could not get clip progress"
          );
        }

        const currentProgress =
          await progressResponse.json();

        const rounded =
          Math.round(
            Number(currentProgress)
          );

        setClipProgress(
          Math.min(
            100,
            Math.max(0, rounded)
          )
        );

        // ======================================================
        // CLIP STATUS
        // ======================================================

        const statusResponse =
          await fetch(
            "http://localhost:8080/api/media/clip/status"
          );

        if (!statusResponse.ok) {
          throw new Error(
            "Could not get clip status"
          );
        }

        const status =
          await statusResponse.text();

        console.log(
          "Clip:",
          rounded + "%",
          status
        );

        // ======================================================
        // COMPLETED
        // ======================================================

        if (status === "COMPLETED") {
          completed = true;

          setClipProgress(100);

          setMessage(
            "Clip download completed!"
          );

          setMessageType("success");
        }

        // ======================================================
        // ERROR
        // ======================================================

        if (
          status.startsWith("ERROR:")
        ) {
          const actualError =
            status
              .substring(
                "ERROR:".length
              )
              .trim();

          throw new Error(
            actualError ||
              "Clip download failed"
          );
        }

        // ======================================================
        // CANCELLED
        // ======================================================

        if (
          status === "IDLE" &&
          rounded === 0
        ) {
          completed = true;

          throw new Error(
            "Clip download cancelled"
          );
        }
      }

      // ========================================================
      // GET COMPLETED CLIP
      // ========================================================

      const fileResponse =
        await fetch(
          "http://localhost:8080/api/media/clip/file"
        );

      if (!fileResponse.ok) {
        throw new Error(
          "Could not get completed clip file"
        );
      }

      const blob =
        await fileResponse.blob();

      // ========================================================
      // DOWNLOAD TO LAPTOP
      // ========================================================

      const downloadUrl =
        window.URL.createObjectURL(
          blob
        );

      const link =
        document.createElement("a");

      link.href = downloadUrl;

      const safeStart =
        startTime
          .trim()
          .replace(/:/g, "-");

      const safeEnd =
        endTime
          .trim()
          .replace(/:/g, "-");

      link.download =
        videoInfo?.title
          ? `${videoInfo.title}-clip-${safeStart}-${safeEnd}.mp4`
          : `MediaMeld-clip-${safeStart}-${safeEnd}.mp4`;

      document.body.appendChild(link);

      link.click();

      link.remove();

      window.URL.revokeObjectURL(
        downloadUrl
      );

      setMessage(
        "Clip downloaded successfully!"
      );

      setMessageType("success");

    } catch (error) {
      console.error(
        "Clip download error:",
        error
      );

      setMessage(
        error.message ||
          "Clip download failed"
      );

      setMessageType("error");

    } finally {
      setDownloadingClip(false);
    }
  };

  // ============================================================
  // CANCEL CLIP
  // ============================================================

  const handleCancelClip = async () => {
    try {
      const response =
        await fetch(
          "http://localhost:8080/api/media/clip/cancel",
          {
            method: "POST",
          }
        );

      if (!response.ok) {
        throw new Error(
          "Could not cancel clip download"
        );
      }

      setDownloadingClip(false);

      setClipProgress(0);

      setMessage(
        "Clip download cancelled"
      );

      setMessageType("");

    } catch (error) {
      console.error(
        "Cancel clip error:",
        error
      );

      setMessage(
        error.message ||
          "Could not cancel clip download"
      );

      setMessageType("error");
    }
  };

  // ============================================================
  // UI
  // ============================================================

  return (
    <div className="app">

      <div className="container">

        {/* ====================================================
            HEADER
        ==================================================== */}

        <header className="header">

          <div className="logo">
            MediaMeld
          </div>

          <p>
            Download YouTube videos,
            audio, clips and thumbnails
          </p>

        </header>


        {/* ====================================================
            URL INPUT
        ==================================================== */}

        <section className="search-section">

          <input
            id="youtube-url"
            name="youtube-url"
            className="url-input"
            type="url"
            placeholder="Paste YouTube URL here..."
            value={url}
            onChange={(e) =>
              setUrl(e.target.value)
            }
            disabled={downloading}
            autoComplete="url"
          />

          <button
            className="analyze-btn"
            onClick={handleAnalyze}
            disabled={
              analyzing ||
              downloading
            }
          >
            {analyzing
              ? "Analyzing..."
              : "Analyze"}
          </button>

        </section>


        {/* ====================================================
            VIDEO CARD
        ==================================================== */}

        {videoInfo && (

          <section className="video-card">

            {/* ==================================================
                THUMBNAIL
            ================================================== */}

            <div className="thumbnail-wrapper">

              <img
                src={videoInfo.thumbnail}
                alt="YouTube video thumbnail"
                className="thumbnail"
              />

            </div>


            {/* ==================================================
                VIDEO DETAILS
            ================================================== */}

            <div className="video-details">

              <h2>
                {videoInfo.title}
              </h2>

              <p className="channel">
                {videoInfo.channelName}
              </p>


              {/* ===============================================
                  VIDEO QUALITY
              =============================================== */}

              <div className="quality-section">

                <label
                  htmlFor="video-quality"
                >
                  Video Quality
                </label>

                <select
                  id="video-quality"
                  name="video-quality"
                  value={quality}
                  onChange={(e) =>
                    setQuality(
                      Number(
                        e.target.value
                      )
                    )
                  }
                  disabled={downloading}
                >

                  {Array.isArray(
                    videoInfo.qualities
                  ) &&
                    videoInfo.qualities.map(
                      (q) => (

                        <option
                          key={q}
                          value={q}
                        >
                          {q}p
                        </option>

                      )
                    )}

                </select>

              </div>


              {/* ===============================================
                  VIDEO DOWNLOAD
              =============================================== */}

              {!downloadingVideo && (

                <button
                  className="download-btn video-btn"
                  onClick={
                    handleDownloadVideo
                  }
                  disabled={downloading}
                >
                  Download Video
                </button>

              )}

              {downloadingVideo && (

                <button
                  className="download-btn cancel-btn"
                  onClick={
                    handleCancelVideo
                  }
                >
                  Cancel Video Download
                </button>

              )}


              {/* ===============================================
                  VIDEO PROGRESS
              =============================================== */}

              {downloadingVideo && (

                <div className="progress-section">

                  <div className="progress-header">

                    <span>
                      Video Download
                    </span>

                    <span>
                      {videoProgress}%
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

                  <p>
                    Downloading video...
                  </p>

                </div>

              )}


              {/* ===============================================
                  AUDIO DOWNLOAD
              =============================================== */}

              {!downloadingAudio && (

                <button
                  className="download-btn audio-btn"
                  onClick={
                    handleDownloadAudio
                  }
                  disabled={downloading}
                >
                  Download Best Audio
                </button>

              )}

              {downloadingAudio && (

                <button
                  className="download-btn cancel-btn"
                  onClick={
                    handleCancelAudio
                  }
                >
                  Cancel Audio Download
                </button>

              )}


              {/* ===============================================
                  AUDIO PROGRESS
              =============================================== */}

              {downloadingAudio && (

                <div className="progress-section">

                  <div className="progress-header">

                    <span>
                      Audio Download
                    </span>

                    <span>
                      {audioProgress}%
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

                  <p>
                    Downloading best quality audio...
                  </p>

                </div>

              )}


              {/* ===============================================
                  CLIP SECTION
              =============================================== */}

              <div className="clip-section">

                <h3>
                  Download Specific Part
                </h3>

                <p className="clip-description">
                  Enter the start and end time
                  of the part you want to download.
                </p>


                {/* =============================================
                    START TIME
                ============================================= */}

                <div className="clip-time-row">

                  <div className="clip-time-field">

                    <label
                      htmlFor="start-time"
                    >
                      Start Time
                    </label>

                    <input
                      id="start-time"
                      name="start-time"
                      type="text"
                      placeholder="02:15"
                      value={startTime}
                      onChange={(e) =>
                        setStartTime(
                          e.target.value
                        )
                      }
                      disabled={downloading}
                    />

                  </div>


                  {/* ==========================================
                      END TIME
                  ========================================== */}

                  <div className="clip-time-field">

                    <label
                      htmlFor="end-time"
                    >
                      End Time
                    </label>

                    <input
                      id="end-time"
                      name="end-time"
                      type="text"
                      placeholder="05:40"
                      value={endTime}
                      onChange={(e) =>
                        setEndTime(
                          e.target.value
                        )
                      }
                      disabled={downloading}
                    />

                  </div>

                </div>


                <p className="time-format">
                  Format: MM:SS or HH:MM:SS
                </p>


                {/* =============================================
                    CLIP BUTTON
                ============================================= */}

                {!downloadingClip && (

                  <button
                    className="download-btn clip-btn"
                    onClick={
                      handleDownloadClip
                    }
                    disabled={downloading}
                  >
                    Download Clip
                  </button>

                )}

                {downloadingClip && (

                  <button
                    className="download-btn cancel-btn"
                    onClick={
                      handleCancelClip
                    }
                  >
                    Cancel Clip Download
                  </button>

                )}


                {/* =============================================
                    CLIP PROGRESS
                ============================================= */}

                {downloadingClip && (

                  <div className="progress-section">

                    <div className="progress-header">

                      <span>
                        Clip Download
                      </span>

                      <span>
                        {clipProgress}%
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

                    <p>
                      Downloading selected part...
                    </p>

                  </div>

                )}

              </div>


              {/* ===============================================
                  THUMBNAIL DOWNLOAD
              =============================================== */}

              <button
                className="download-btn thumbnail-btn"
                onClick={
                  handleDownloadThumbnail
                }
                disabled={downloading}
              >
                {downloadingThumbnail
                  ? "Downloading Thumbnail..."
                  : "Download Thumbnail"}
              </button>

            </div>

          </section>

        )}


        {/* ====================================================
            MESSAGE
        ==================================================== */}

        {message && (

          <div
            className={`message ${
              messageType === "success"
                ? "message-success"
                : messageType === "error"
                  ? "message-error"
                  : ""
            }`}
          >
            {message}
          </div>

        )}

      </div>

    </div>
  );
}

export default App;