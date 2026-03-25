import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const text = body?.text || "";
    const voiceId = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      console.error("ELEVENLABS_API_KEY not configured");
      return NextResponse.json(
        { error: "TTS not configured on server (missing ELEVENLABS_API_KEY)" },
        { status: 500 },
      );
    }

    if (!text || text.trim().length === 0) {
      return NextResponse.json({ error: "No text provided" }, { status: 400 });
    }

    const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;

    // Use a model recommended by ElevenLabs; include it in request body for compatibility
    const requestBody: any = { text, model: "eleven_multilingual_v1" };

    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify(requestBody),
    });

    if (!resp.ok) {
      // try to extract provider error body for better diagnostics
      let providerMsg = "";
      try {
        const txt = await resp.text();
        providerMsg = txt;
        console.error("ElevenLabs TTS provider error:", resp.status, txt);
      } catch (e) {
        console.error("ElevenLabs TTS provider error status", resp.status);
      }
      return NextResponse.json(
        { error: "TTS provider error", detail: providerMsg },
        { status: resp.status },
      );
    }

    const contentType = resp.headers.get("content-type") || "audio/mpeg";

    // Proxy the audio stream back to the client
    return new NextResponse(resp.body, {
      status: 200,
      headers: { "Content-Type": contentType },
    });
  } catch (err) {
    console.error("TTS route error", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
