import { ImageResponse } from "next/og";

export const dynamic = "force-static";

export function GET() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "72px 80px", background: "#f5f6f3", color: "#242625", fontFamily: "Arial, sans-serif" }}>
      <div style={{ display: "flex", fontSize: 32, fontWeight: 700 }}>Poppy Robotics</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ display: "flex", fontSize: 112, fontWeight: 700, letterSpacing: -6 }}>Meet Poppy</div>
        <div style={{ display: "flex", fontSize: 38, color: "#61675f" }}>Personal robots for homes.</div>
      </div>
      <div style={{ display: "flex", fontSize: 24, color: "#61675f" }}>Your personal robot agent.</div>
    </div>,
    { width: 1200, height: 630 },
  );
}
