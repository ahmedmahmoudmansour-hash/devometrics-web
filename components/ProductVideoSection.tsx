"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRef, useState } from "react";

// Homepage "see it in action" section — the real-product-footage video
// (built for social/ad use, see the video gallery this shipped alongside)
// embedded directly on the site rather than left as a download-only asset.
// One file per language: the Arabic cut shows the actual Arabic/RTL
// interface, not the English screens with dubbed captions, so this needs a
// real source swap per locale, not just a captions track.
export default function ProductVideoSection() {
  const t = useTranslations("productVideo");
  const locale = useLocale();
  const isAr = locale === "ar";
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  const src = isAr ? "/videos/product-tour-ar.mp4" : "/videos/product-tour-en.mp4";
  const poster = isAr ? "/videos/product-tour-ar-poster.jpg" : "/videos/product-tour-en-poster.jpg";

  function handlePlayClick() {
    videoRef.current?.play();
    setPlaying(true);
  }

  return (
    <section
      id="product-video"
      style={{
        padding: "100px 24px",
        maxWidth: 1000,
        margin: "0 auto",
      }}
    >
      <div style={{ textAlign: "center", marginBottom: 48 }}>
        <span
          className="mono"
          style={{
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: "0.1em",
            color: "var(--teal)",
            textTransform: "uppercase",
          }}
        >
          {t("label")}
        </span>
        <h2
          className="font-display"
          style={{
            fontSize: "clamp(2rem, 4vw, 3rem)",
            fontWeight: 700,
            letterSpacing: "-0.02em",
            lineHeight: 1.15,
            marginTop: 12,
            color: "var(--text)",
          }}
        >
          {t("headline")}
        </h2>
        <p
          style={{
            fontSize: 17,
            color: "var(--text-muted)",
            marginTop: 16,
            maxWidth: 480,
            margin: "16px auto 0",
            lineHeight: 1.7,
          }}
        >
          {t("subtext")}
        </p>
      </div>

      <div
        style={{
          position: "relative",
          borderRadius: 20,
          overflow: "hidden",
          border: "1px solid var(--border)",
          boxShadow: "0 24px 64px -24px rgba(0,0,0,0.35)",
          background: "var(--navy-mid)",
        }}
      >
        <video
          ref={videoRef}
          src={src}
          poster={poster}
          controls={playing}
          playsInline
          preload="metadata"
          style={{ display: "block", width: "100%", height: "auto" }}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
        />
        {!playing && (
          <button
            type="button"
            onClick={handlePlayClick}
            aria-label={t("playButtonLabel")}
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(0,0,0,0.15)",
              border: "none",
              cursor: "pointer",
            }}
          >
            <span
              style={{
                width: 76,
                height: 76,
                borderRadius: "50%",
                background: "rgba(255,255,255,0.92)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
              }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="var(--navy)" style={{ marginInlineStart: isAr ? 0 : 3, marginInlineEnd: isAr ? 3 : 0, transform: isAr ? "scaleX(-1)" : undefined }}>
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
          </button>
        )}
      </div>
    </section>
  );
}
