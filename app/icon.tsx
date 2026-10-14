import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#11120f",
        background: "#ffffff",
        fontSize: 40,
        fontWeight: 900,
        fontFamily: "Arial, sans-serif",
      }}
    >
      K
    </div>,
    size,
  );
}
