import { config } from "./config.mjs";
import { execSync } from "child_process";

const cmd = `wsl bash -c "export PATH=/home/radesh/.bun/bin:/usr/bin:/bin:\\$PATH && export OPENAI_API_KEY='${config.gemini.apiKey}' && export OPENAI_BASE_URL='https://generativelanguage.googleapis.com/v1beta/openai/' && gbrain config set embedding_model openai:text-embedding-004 && gbrain embed --dry-run"`;

try {
  console.log(execSync(cmd, { encoding: "utf8" }));
} catch (e) {
  console.error(e.stdout || e.message);
}
