import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0b0e",
          color: "#19e09a",
          fontSize: 96,
          fontWeight: 700,
          fontFamily: "monospace",
        }}
      >
        P
      </div>
    ),
    { ...size }
  );
}
