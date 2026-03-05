"use client";

import { useRef, useState } from "react";

export default function RealtimeVoice() {
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [connected, setConnected] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const log = (msg: string) => {
    console.log(msg);
    setLogs((l) => [...l.slice(-40), msg]);
  };

  async function startSession() {
    log("Requesting ephemeral key...");

    const tokenResponse = await fetch("/api/session");
    const data = await tokenResponse.json();
  if (!data.client_secret) {
  console.error("Session error:", data);
  throw new Error("Failed to get ephemeral key");
}

const EPHEMERAL_KEY = data.client_secret.value;
    const pc = new RTCPeerConnection();
    pcRef.current = pc;

    pc.ontrack = (event) => {
      log("🔊 AI audio received");

      if (audioRef.current) {
        audioRef.current.srcObject = event.streams[0];
        audioRef.current.play().catch(console.error);
      }
    };

    const dc = pc.createDataChannel("oai-events");
    dcRef.current = dc;

    dc.onopen = () => {
      log("📡 Data channel opened");
    };

    dc.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === "response.audio_transcript.done") {
        log("AI: " + data.transcript);
      }

      if (data.type === "conversation.item.input_audio_transcription.completed") {
        if (data.transcript) {
          log("You: " + data.transcript);
        }
      }
    };

    log("🎤 Requesting microphone");

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    log("Sending SDP to OpenAI");

    const sdpResponse = await fetch(
      `https://api.openai.com/v1/realtime?model=gpt-realtime-mini`,
      {
        method: "POST",
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${EPHEMERAL_KEY}`,
          "Content-Type": "application/sdp",
        },
      }
    );

    const answer = {
      type: "answer",
      sdp: await sdpResponse.text(),
    };

    await pc.setRemoteDescription(answer as any);

    log("✅ Connected");

    setConnected(true);
  }

  function stopSession() {
    log("⛔ Session stopped");

    dcRef.current?.close();
    pcRef.current?.close();

    dcRef.current = null;
    
    pcRef.current = null;

    setConnected(false);
  }

  return (
    <div className="container">
      <div className="voicePanel">
        <h2>🎙️ Realtime Voice Assistant [Approach One]</h2>
   <p className="subtitle">
Speak with the AI using the OpenAI Realtime API. Please allow microphone access — this is just a simple demo and results may not be perfect.
</p>
        <div className="status">
          <div className={`dot ${connected ? "on" : ""}`} />
          <span>{connected ? "Connected to AI" : "Disconnected"}</span>
        </div>

        <div className={`wave ${connected ? "active" : ""}`}>
          {Array.from({ length: 12 }).map((_, i) => (
            <span key={i}></span>
          ))}
        </div>

        {!connected ? (
          <button className="start" onClick={startSession}>
            🎤 Start Voice Assistant
          </button>
        ) : (
          <button className="stop" onClick={stopSession}>
            ⛔ Stop
          </button>
        )}

        <audio ref={audioRef} autoPlay playsInline />

        <div className="logs">
          {logs.map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </div>
      </div>

   <div className="explain">
  <h2>⚙️ How This Works</h2>

  <p>
    This demo uses the <b>OpenAI Realtime API</b> with the model
    <b> gpt-realtime-mini</b> to create a low-latency voice assistant.  
    Instead of building and managing a custom voice pipeline, the realtime
    model handles speech understanding, reasoning, and voice generation in a
    single streaming session.
  </p>

  <h3>This Approach (Realtime Model)</h3>

  <p>
    In this implementation we directly connect the browser to OpenAI using
    <b> WebRTC</b>. The realtime model processes audio input and produces audio
    output continuously. This removes the need to manage separate AI services
    on the client or backend.
  </p>

  <pre>
Browser
│
│ microphone audio
▼
WebRTC Connection
│
▼
OpenAI Realtime Model
│
├─ speech understanding
├─ reasoning
└─ speech generation
│
▼
Audio streamed back
to browser
  </pre>

  <p>
    Because the realtime model handles the full conversation loop, the
    application does <b>not need to run or manage separate client models</b>
    for speech recognition, language processing, or voice synthesis.
  </p>

  <h3>Latency and Concurrency</h3>

<p>
Realtime models process speech, reasoning, and voice generation within a
single streaming session. This reduces latency and avoids multiple network
calls required in traditional pipelines where Speech-to-Text, LLM processing,
and Text-to-Speech are separate services.
</p>

<p>
Because processing happens continuously while audio is streamed, the system
can respond faster and handle concurrent audio processing more efficiently.
</p>

  <h3>Traditional Voice AI Pipeline (Alternative architecture not used here)</h3>

  <p>
    Many voice applications use a modular pipeline where each stage is handled
    by a different service. In that setup developers must integrate and manage
    multiple systems.
  </p>

  <pre>
Browser
│
▼
Speech-to-Text Service
│
▼
LLM (language model)
│
▼
Text-to-Speech Service
│
▼
Audio returned to user
  </pre>

  <p>
    This traditional architecture requires orchestrating multiple services,
    handling streaming between them, and managing additional latency between
    each step.
  </p>

  <h3>Key Difference</h3>

  <ul>
    <li>Realtime approach uses a <b>single AI model</b> for the entire conversation</li>
    <li>No custom STT → LLM → TTS pipeline required</li>
    <li>No client-managed AI models</li>
    <li>Lower latency due to streaming processing</li>
    <li>Simpler architecture and fewer integrations</li>
  </ul>
</div>


    </div>
  );
}