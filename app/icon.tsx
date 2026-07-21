import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

// Branded favicon: a white italic "α" on the AlphaBazaar blue→indigo gradient.
export default function Icon() {
    return new ImageResponse(
        (
            <div
                style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)",
                    borderRadius: 7,
                    color: "#ffffff",
                    fontSize: 24,
                    fontWeight: 900,
                    fontStyle: "italic",
                }}
            >
                α
            </div>
        ),
        { ...size }
    );
}
