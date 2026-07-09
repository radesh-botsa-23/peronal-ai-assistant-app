import fs from "fs";
import { authenticate } from "@google-cloud/local-auth";

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/calendar"
];

const auth = await authenticate({
  scopes: SCOPES,
  keyfilePath: "./credentials.json",
});

fs.writeFileSync(
  "token.json",
  JSON.stringify(auth.credentials, null, 2)
);

console.log("✅ Token saved to token.json");
