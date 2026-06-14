const fs = require("fs");
const path = require("path");
const os = require("os");
const ffmpegStatic = require("ffmpeg-static");
const ffmpeg = require("fluent-ffmpeg");
ffmpeg.setFfmpegPath(ffmpegStatic);

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

const modelLimitsCache = new Map();

async function getModelLimit(modelId) {
  if (!modelId) modelId = ENV.ELEVENLABS_DEFAULT_MODEL || "eleven_v3";
  if (modelLimitsCache.has(modelId)) {
    return modelLimitsCache.get(modelId);
  }

  // Static fallback mapping of known limits
  const MODEL_LIMITS = {
    "eleven_flash_v2_5": 40000,
    "eleven_flash_v2": 30000,
    "eleven_turbo_v2_5": 40000,
    "eleven_turbo_v2": 30000,
    "eleven_multilingual_v2": 10000,
    "eleven_v3": 5000,
    "eleven_monolingual_v1": 10000,
    "eleven_multilingual_v1": 10000,
  };

  let limit = MODEL_LIMITS[modelId];

  const apiKey = ENV.ELEVENLABS_API_KEY;
  if (apiKey) {
    try {
      const response = await fetch("https://api.elevenlabs.io/v1/models", {
        headers: { "xi-api-key": apiKey },
      });
      if (response.ok) {
        const models = await response.json();
        for (const m of models) {
          const maxTextLength = m.maximum_text_length_per_request || m.max_characters_request_subscribed_user || m.max_characters_request_free_user;
          if (maxTextLength) {
            modelLimitsCache.set(m.model_id, maxTextLength);
          }
        }
        if (modelLimitsCache.has(modelId)) {
          return modelLimitsCache.get(modelId);
        }
      }
    } catch (err) {
      console.warn("Failed to fetch model limits from ElevenLabs, using fallback:", err.message);
    }
  }

  const finalLimit = limit || 5000;
  modelLimitsCache.set(modelId, finalLimit);
  return finalLimit;
}

function splitTextIntoChunks(text, maxChars) {
  if (!text) return [];
  if (text.length <= maxChars) {
    return [text];
  }

  const paragraphs = text.split("\n\n");
  const chunks = [];
  let currentChunk = "";

  for (const paragraph of paragraphs) {
    const separator = currentChunk ? "\n\n" : "";
    if ((currentChunk + separator + paragraph).length <= maxChars) {
      currentChunk += separator + paragraph;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk);
        currentChunk = "";
      }

      if (paragraph.length <= maxChars) {
        currentChunk = paragraph;
      } else {
        const sentences = (paragraph.match(/[^.?!]+[.?!]+(?:\s+|$)|[^.?!]+(?:\s+|$)/g) || [paragraph]).map(s => s.trim());
        
        for (let sentence of sentences) {
          const sSeparator = currentChunk ? " " : "";
          if ((currentChunk + sSeparator + sentence).length <= maxChars) {
            currentChunk += sSeparator + sentence;
          } else {
            if (currentChunk) {
              chunks.push(currentChunk);
              currentChunk = "";
            }

            if (sentence.length <= maxChars) {
              currentChunk = sentence;
            } else {
              const words = sentence.split(" ");
              for (const word of words) {
                const wSeparator = currentChunk ? " " : "";
                if ((currentChunk + wSeparator + word).length <= maxChars) {
                  currentChunk += wSeparator + word;
                } else {
                  if (currentChunk) {
                    chunks.push(currentChunk);
                    currentChunk = "";
                  }

                  if (word.length <= maxChars) {
                    currentChunk = word;
                  } else {
                    let remainingWord = word;
                    while (remainingWord.length > 0) {
                      const cutLength = Math.min(remainingWord.length, maxChars);
                      chunks.push(remainingWord.slice(0, cutLength));
                      remainingWord = remainingWord.slice(cutLength);
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
}

async function concatMp3Buffers(buffers) {
  if (buffers.length === 0) return Buffer.alloc(0);
  if (buffers.length === 1) return buffers[0];

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "mp3-concat-"));
  const tempFiles = [];
  const listFilePath = path.join(tempDir, "list.txt");
  const outputFilePath = path.join(tempDir, "output.mp3");

  try {
    const listLines = [];
    for (let i = 0; i < buffers.length; i++) {
      const filePath = path.join(tempDir, `chunk-${i}.mp3`);
      fs.writeFileSync(filePath, buffers[i]);
      tempFiles.push(filePath);
      const safePath = filePath.replace(/\\/g, "/").replace(/'/g, "'\\''");
      listLines.push(`file '${safePath}'`);
    }

    fs.writeFileSync(listFilePath, listLines.join("\n"));
    tempFiles.push(listFilePath);

    await new Promise((resolve, reject) => {
      ffmpeg()
        .input(listFilePath)
        .inputOptions(["-f", "concat", "-safe", "0"])
        .outputOptions("-c", "copy")
        .output(outputFilePath)
        .on("end", () => resolve())
        .on("error", (err) => reject(err))
        .run();
    });

    const combinedBuffer = fs.readFileSync(outputFilePath);
    return combinedBuffer;
  } finally {
    for (const f of tempFiles) {
      try {
        if (fs.existsSync(f)) fs.unlinkSync(f);
      } catch (err) {}
    }
    try {
      if (fs.existsSync(outputFilePath)) fs.unlinkSync(outputFilePath);
    } catch (err) {}
    try {
      if (fs.existsSync(tempDir)) fs.rmdirSync(tempDir);
    } catch (err) {}
  }
}

async function synthesizeSpeechSingleChunk({ text, voiceId, modelId }) {
  const apiKey = ENV.ELEVENLABS_API_KEY;
  if (!apiKey) {
    console.error("[ElevenLabs] API key is missing");
    const error = new Error(
      "ElevenLabs API key is not configured. Set ELEVENLABS_API_KEY in backend/.env."
    );
    error.statusCode = 503;
    throw error;
  }

  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
  const startTime = Date.now();

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
        model_id: modelId,
      }),
    });

    const duration = Date.now() - startTime;
    if (!response.ok) {
      const errText = await response.text();
      console.error(`[ElevenLabs] API request failed after ${duration}ms with status ${response.status}: ${errText}`);
      const error = new Error(`ElevenLabs speech synthesis failed: ${errText}`);
      error.statusCode = response.status;
      throw error;
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    console.log(`[ElevenLabs] API request succeeded in ${duration}ms. Buffer size: ${buffer.length} bytes.`);
    return buffer;
  } catch (error) {
    console.error(`[ElevenLabs] Network or API error after ${Date.now() - startTime}ms:`, error);
    throw error;
  }
}

async function synthesizeSpeech({ text, voiceId, modelId }) {
  const selectedModel =
    modelId || ENV.ELEVENLABS_DEFAULT_MODEL || "eleven_v3";

  console.log(`[ElevenLabs] synthesizeSpeech called. Model: ${selectedModel}, Voice: ${voiceId}, Text Length: ${text.length} characters.`);

  const limit = await getModelLimit(selectedModel);
  console.log(`[ElevenLabs] Model "${selectedModel}" limit is ${limit} characters.`);

  if (text.length <= limit) {
    console.log("[ElevenLabs] Text length is within limit. Initiating single-chunk synthesis...");
    return synthesizeSpeechSingleChunk({ text, voiceId, modelId: selectedModel });
  }

  console.log(`[ElevenLabs] Text length exceeds limit. Splitting into chunks...`);
  const chunks = splitTextIntoChunks(text, limit);
  console.log(`[ElevenLabs] Split text into ${chunks.length} chunks.`);

  // Make parallel synthesis requests
  const chunkPromises = chunks.map((chunk, index) => {
    console.log(`[ElevenLabs] Starting synthesis for chunk ${index + 1}/${chunks.length} (${chunk.length} chars)...`);
    return synthesizeSpeechSingleChunk({
      text: chunk,
      voiceId,
      modelId: selectedModel,
    }).then(buffer => {
      console.log(`[ElevenLabs] Successfully synthesized chunk ${index + 1}/${chunks.length}`);
      return buffer;
    });
  });

  try {
    const buffers = await Promise.all(chunkPromises);
    console.log(`[ElevenLabs] All ${buffers.length} chunks synthesized. Combining chunk MP3 buffers...`);
    const combinedBuffer = await concatMp3Buffers(buffers);
    console.log(`[ElevenLabs] Successfully combined MP3 buffers. Total size: ${combinedBuffer.length} bytes.`);
    return combinedBuffer;
  } catch (error) {
    console.error("[ElevenLabs] Synthesis failed during chunk generation or combination:", error);
    throw error;
  }
}

module.exports = {
  listVoices,
  addSharedVoice,
  synthesizeSpeech,
  narrationTextFromMarkdown,
  splitTextIntoChunks,
  concatMp3Buffers,
  getModelLimit,
};
