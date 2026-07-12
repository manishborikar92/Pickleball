"use client";

/**
 * global-error.js (ME-14) — catches errors thrown in the ROOT layout (e.g. font
 * loading) that the route-group error boundaries cannot reach. It replaces the
 * whole document, so it must render its own <html>/<body>. Kept dependency-free
 * and inline-styled because the app's CSS/fonts may be exactly what failed.
 */
export default function GlobalError({ error, reset }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0d0f04",
          color: "#f7f7ef",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          padding: "24px",
        }}
      >
        <div style={{ maxWidth: "28rem", textAlign: "center" }}>
          <p style={{ fontSize: "12px", fontWeight: 700, letterSpacing: "0.22em", color: "#caff00", textTransform: "uppercase" }}>
            Baseline Arena
          </p>
          <h1 style={{ marginTop: "12px", fontSize: "28px", fontWeight: 900 }}>Something went wrong</h1>
          <p style={{ marginTop: "12px", color: "#c5c9ac", lineHeight: 1.6 }}>
            An unexpected error interrupted loading. Please try again.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              marginTop: "24px",
              cursor: "pointer",
              borderRadius: "9999px",
              border: "none",
              backgroundColor: "#caff00",
              color: "#0d0f04",
              padding: "12px 24px",
              fontSize: "14px",
              fontWeight: 700,
            }}
          >
            Try Again
          </button>
        </div>
      </body>
    </html>
  );
}
