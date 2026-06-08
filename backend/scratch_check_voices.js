const { listVoices } = require("./src/utils/elevenlabs.generator");
const ENV = require("./src/configs/env");

async function test() {
  console.log("ElevenLabs API Key configured:", !!ENV.ELEVENLABS_API_KEY);
  if (ENV.ELEVENLABS_API_KEY) {
    console.log("API Key Prefix:", ENV.ELEVENLABS_API_KEY.slice(0, 5) + "...");
  }
  
  try {
    console.log("Calling listVoices()...");
    const voices = await listVoices();
    console.log("Total voices returned:", voices.length);
    if (voices.length > 0) {
      console.log("Sample voices:");
      console.log(voices.slice(0, 5).map(v => ({ voiceId: v.voiceId, name: v.name, category: v.category })));
    }
  } catch (error) {
    console.error("Caught error in test:", error);
  }
}

test();
