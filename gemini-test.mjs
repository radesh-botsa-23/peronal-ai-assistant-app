import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "./config.mjs";

console.log("Testing with Gemini API key from config:", config.gemini.apiKey);

async function run() {
  try {
    const genAI = new GoogleGenerativeAI(config.gemini.apiKey);
    const models = ["gemini-1.5-flash", "gemini-2.0-flash", "gemini-2.5-flash", "gemini-flash-latest"];
    
    for (const modelName of models) {
      console.log(`\nTesting model: ${modelName}...`);
      const model = genAI.getGenerativeModel({ model: modelName });
      
      const start = Date.now();
      try {
        const result = await model.generateContent("Respond with the single word 'Success'.");
        const text = result.response.text();
        console.log(`✅ ${modelName} responded in ${Date.now() - start}ms: "${text.trim()}"`);
      } catch (err) {
        console.error(`❌ ${modelName} failed in ${Date.now() - start}ms:`, err.message);
      }
    }
  } catch (err) {
    console.error("Setup failed:", err.message);
  }
}

run();
