import { ImageResponse } from "next/og";

export const alt = "OFFLINE, ropa para desconectarse";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: 90, background: "#f5f5f7", color: "#1d1d1f" }}>
        <div style={{ display: "flex", fontSize: 220, fontWeight: 800, letterSpacing: -10, lineHeight: 1 }}>OFFLINE</div>
        <div style={{ display: "flex", marginTop: 30, fontSize: 46, color: "#6e6e73" }}>Ropa para los ratos sin pantalla</div>
      </div>
    ),
    size,
  );
}
