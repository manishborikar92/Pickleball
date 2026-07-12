import { connection } from "next/server";
import { ImageResponse } from "next/og";

export async function GET(request) {
  await connection();
  try {
    const { searchParams } = new URL(request.url);
    const title = searchParams.get("title") || "Baseline Arena";
    const desc = searchParams.get("desc") || "Book premium outdoor pickleball courts in Besa, Nagpur.";

    return new ImageResponse(
      (
        <div
          style={{
            height: "100%",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            justifyContent: "space-between",
            backgroundColor: "#0D0D0D",
            backgroundImage: "radial-gradient(circle at 80% 20%, rgba(203, 255, 0, 0.08) 0%, transparent 60%)",
            padding: "80px",
            boxSizing: "border-box",
            borderLeft: "16px solid #CBFF00",
            fontFamily: "sans-serif",
          }}
        >
          {/* Top Row: Text brand mark. Rendered as text (not an SVG image) —
              Satori's SVG support is unreliable, so the wordmark is drawn with
              the accent color to guarantee it appears in production OG cards (ME-11). */}
          <div style={{ display: "flex", alignItems: "center" }}>
            <div
              style={{
                fontSize: "34px",
                fontWeight: "900",
                letterSpacing: "-0.02em",
                color: "#CBFF00",
                textTransform: "uppercase",
              }}
            >
              Baseline Arena
            </div>
          </div>

          {/* Center Content: Title and Description */}
          <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
            <div
              style={{
                fontSize: "64px",
                fontWeight: "900",
                color: "#FFFFFF",
                lineHeight: "1.15",
                letterSpacing: "-0.03em",
                marginBottom: "20px",
                textTransform: "uppercase",
              }}
            >
              {title}
            </div>
            <div
              style={{
                fontSize: "26px",
                fontWeight: "500",
                color: "#888888",
                lineHeight: "1.45",
                maxWidth: "920px",
              }}
            >
              {desc}
            </div>
          </div>

          {/* Bottom Row: Specifications and Domain */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              width: "100%",
              borderTop: "1px solid rgba(255, 255, 255, 0.08)",
              paddingTop: "32px",
            }}
          >
            <div
              style={{
                fontSize: "14px",
                fontWeight: "800",
                color: "#CBFF00",
                letterSpacing: "0.2em",
                textTransform: "uppercase",
              }}
            >
              Premium Cushion Courts
            </div>
            <div
              style={{
                fontSize: "14px",
                fontWeight: "600",
                color: "#555555",
                letterSpacing: "0.1em",
              }}
            >
              Besa, Nagpur · baselinearena.in
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (error) {
    console.error("Failed to generate OG image:", error);
    return new Response(`Failed to generate image`, { status: 500 });
  }
}
