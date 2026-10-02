import { ImageResponse } from "next/og";

export const alt = "OFFLINE, ropa para desconectarse";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: 80, background: "#fff6dd", color: "#141414", border: "16px solid #141414" }}>
        <div style={{ display: "flex", fontSize: 230, fontWeight: 900, letterSpacing: -8, lineHeight: 1, textShadow: "12px 12px 0 #e5251b" }}>OFFLINE</div>
        <div style={{ display: "flex", marginTop: 40 }}>
          <div style={{ display: "flex", fontSize: 44, fontWeight: 700, background: "#ffd400", border: "5px solid #141414", padding: "10px 28px", borderRadius: 999 }}>
            Ropa para los ratos sin pantalla
          </div>
        </div>
      </div>
    ),
    size,
  );
}
