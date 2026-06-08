const ENV = require("../configs/env");

const MOCK_VOICES = [
  {
    voiceId: "21m00Tcm4TlvDq8ikWAM",
    name: "Rachel",
    category: "premade",
    previewUrl: "https://dl.elevenlabs.io/previews/21m00Tcm4TlvDq8ikWAM.mp3",
    labels: { gender: "female", accent: "american", age: "young" },
  },
  {
    voiceId: "AZnzlk1XvdvUeBnXmlld",
    name: "Domi",
    category: "premade",
    previewUrl: "https://dl.elevenlabs.io/previews/AZnzlk1XvdvUeBnXmlld.mp3",
    labels: { gender: "female", accent: "american", age: "young" },
  },
  {
    voiceId: "EXAVITQu4vr4xnSDxMaL",
    name: "Bella",
    category: "premade",
    previewUrl: "https://dl.elevenlabs.io/previews/EXAVITQu4vr4xnSDxMaL.mp3",
    labels: { gender: "female", accent: "american", age: "young" },
  },
  {
    voiceId: "ErXwobaYiN019PkySvjV",
    name: "Antoni",
    category: "premade",
    previewUrl: "https://dl.elevenlabs.io/previews/ErXwobaYiN019PkySvjV.mp3",
    labels: { gender: "male", accent: "american", age: "young" },
  },
  {
    voiceId: "TxGEqn7nUaNZTRJjR8go",
    name: "Liam",
    category: "premade",
    previewUrl: "https://dl.elevenlabs.io/previews/TxGEqn7nUaNZTRJjR8go.mp3",
    labels: { gender: "male", accent: "american", age: "young" },
  },
];

const TINY_SILENT_MP3_BASE64 =
  "SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU2LjM2LjEwMAAAAAAAAAAAAAAA//OEAAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAAEAAABIADAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV6urq6urq6urq6urq6urq6urq6urq6urq6v////////////////////////////////8AAAAATGF2YzU2LjQxAAAAAAAAAAAAAAAAJAAAAAAAAAAAASDs90hvAAAAAAAAAAAAAAAAAAAA//MUZAAAAAGkAAAAAAAAA0gAAAAATEFN//MUZAMAAAGkAAAAAAAAA0gAAAAARTMu//MUZAYAAAGkAAAAAAAAA0gAAAAAOTku//MUZAkAAAGkAAAAAAAAA0gAAAAANVVV";

function narrationTextFromMarkdown(markdown = "") {
  return String(markdown || "")
    // Remove code blocks
    .replace(/```[a-z]*\n[\s\S]*?\n```/gi, "")
    // Remove inline code
    .replace(/`([^`]+)`/g, "$1")
    // Remove images
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "")
    // Remove links but keep text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    // Remove headers
    .replace(/^(#{1,6})\s+/gm, "")
    // Remove blockquote markers
    .replace(/^\s*>\s+/gm, "")
    // Remove bold/italic formatting
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    // Remove italic formatting
    .replace(/(\*|_)(.*?)\1/g, "$2")
    // Remove strikethrough
    .replace(/(~~)(.*?)\1/g, "$2")
    // Remove horizontal rules
    .replace(/^\s*[-*_]{3,}\s*$/gm, "")
    // Normalize newlines and whitespaces
    .replace(/\r\n/g, "\n")
    .replace(/\n{2,}/g, "\n\n")
    .trim();
}

async function listVoices({ search } = {}) {
  const apiKey = ENV.ELEVENLABS_API_KEY;
  if (!apiKey) {
    let voices = [...MOCK_VOICES];
    if (search) {
      const q = String(search).toLowerCase();
      voices = voices.filter(
        (v) =>
          v.name.toLowerCase().includes(q) ||
          (v.category && v.category.toLowerCase().includes(q))
      );
    }
    return voices;
  }

  let accountVoices = [];
  try {
    const response = await fetch("https://api.elevenlabs.io/v1/voices", {
      headers: { "xi-api-key": apiKey },
    });

    if (response.ok) {
      const data = await response.json();
      accountVoices = (data.voices || []).map((v) => ({
        voiceId: v.voice_id,
        name: v.name,
        category: v.category,
        previewUrl: v.preview_url,
        labels: v.labels || {},
      }));
    } else {
      console.error(`ElevenLabs /v1/voices returned status ${response.status}`);
    }
  } catch (error) {
    console.error("Error fetching account voices:", error);
  }

  let sharedVoices = [];
  try {
    const sharedUrl = new URL("https://api.elevenlabs.io/v1/shared-voices");
    sharedUrl.searchParams.set("page_size", "100");
    if (search) {
      sharedUrl.searchParams.set("search", search);
    }

    const response = await fetch(sharedUrl.toString(), {
      headers: { "xi-api-key": apiKey },
    });

    if (response.ok) {
      const data = await response.json();
      sharedVoices = (data.voices || []).map((v) => ({
        voiceId: v.voice_id,
        name: v.name,
        category: v.category || "shared",
        previewUrl: v.preview_url,
        publicUserId: v.public_owner_id,
        labels: {
          gender: v.gender,
          accent: v.accent,
          age: v.age,
          language: v.language,
          descriptive: v.descriptive,
          useCase: v.use_case,
          ...(v.labels || {}),
        },
      }));
    } else {
      console.error(`ElevenLabs /v1/shared-voices returned status ${response.status}`);
    }
  } catch (error) {
    console.error("Error fetching shared voices:", error);
  }

  // Filter account voices by search in JavaScript (since /v1/voices has no search param)
  let filteredAccount = accountVoices;
  if (search) {
    const q = String(search).toLowerCase();
    filteredAccount = accountVoices.filter(
      (v) =>
        v.name.toLowerCase().includes(q) ||
        (v.category && v.category.toLowerCase().includes(q)) ||
        Object.values(v.labels || {}).some((val) =>
          String(val).toLowerCase().includes(q)
        )
    );
  }

  const uniqueVoicesMap = new Map();
  [...filteredAccount, ...sharedVoices].forEach((v) => {
    if (v.voiceId) {
      uniqueVoicesMap.set(v.voiceId, v);
    }
  });

  return Array.from(uniqueVoicesMap.values());
}

async function addSharedVoice({ publicUserId, voiceId, voiceName }) {
  const apiKey = ENV.ELEVENLABS_API_KEY;
  if (!apiKey || !publicUserId || !voiceId) {
    return voiceId;
  }

  try {
    const url = `https://api.elevenlabs.io/v1/voices/add/${publicUserId}/${voiceId}`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        new_name: voiceName || `Shared Voice ${voiceId}`,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data && data.voice_id) {
        return data.voice_id;
      }
    } else {
      const errText = await response.text();
      console.warn(`ElevenLabs addSharedVoice warning: ${errText}`);
    }

    return voiceId;
  } catch (error) {
    console.error("Error adding shared voice to ElevenLabs account:", error);
    return voiceId;
  }
}

async function synthesizeSpeech({ text, voiceId, modelId }) {
  const apiKey = ENV.ELEVENLABS_API_KEY;
  if (!apiKey) {
    const error = new Error(
      "ElevenLabs API key is not configured. Set ELEVENLABS_API_KEY in backend/.env."
    );
    error.statusCode = 503;
    throw error;
  }

  const selectedModel =
    modelId || ENV.ELEVENLABS_DEFAULT_MODEL || "eleven_v3";
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "content-type": "application/json",
        accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: selectedModel,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      const error = new Error(`ElevenLabs speech synthesis failed: ${errText}`);
      error.statusCode = response.status;
      throw error;
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.error("Error synthesizing speech via ElevenLabs:", error);
    throw error;
  }
}

module.exports = {
  listVoices,
  addSharedVoice,
  synthesizeSpeech,
  narrationTextFromMarkdown,
};
