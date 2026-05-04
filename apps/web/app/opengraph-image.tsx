import { ImageResponse } from "next/og";

export const alt = "Kletron — Sovereign agent platform";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          background: "linear-gradient(135deg, #09090b 0%, #18181b 50%, #0c1912 100%)",
          padding: 72,
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ fontSize: 56, fontWeight: 600, color: "#fafafa", marginBottom: 16 }}>Kletron</div>
        <div style={{ fontSize: 36, fontWeight: 500, color: "#a1a1aa", maxWidth: 900, lineHeight: 1.25 }}>
          Sovereign agent platform — visual graphs, MCP, Code + Work modes
        </div>
        <div style={{ marginTop: 40, fontSize: 22, color: "#22c55e" }}>🇨🇭 Swiss HQ · 🇪🇺 EU infrastructure</div>
      </div>
    ),
    { ...size },
  );
}
