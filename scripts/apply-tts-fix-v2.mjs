import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';

const fail = (m) => { console.error('ASSERT FAIL: ' + m); process.exit(1); };

// ============ SERVER: app/api/ai-doubt/live/tts/route.ts ============
let srv = readFileSync('app/api/ai-doubt/live/tts/route.ts', 'utf8');

// --- FIX 1: Sec-MS-GEC token precision bug (root cause of Edge TTS 503) ---
// Old code multiplied float ticks by 1e7 -> ~1.3e17 > Number.MAX_SAFE_INTEGER
// -> precision loss -> invalid DRM token -> Microsoft rejects the handshake.
// BigInt (built from strings, NO '...n' literals) keeps the token exact.
const gecStart = srv.indexOf('async function generateSecMsGec(clientToken: string): Promise<string> {');
if (gecStart < 0) fail('anchor: generateSecMsGec start');
const gecEndAnchor = 'toUpperCase();\n}';
const gecEndIdx = srv.indexOf(gecEndAnchor, gecStart);
if (gecEndIdx < 0) fail('anchor: generateSecMsGec end');
const gecEnd = gecEndIdx + gecEndAnchor.length;

const newGec =
'async function generateSecMsGec(clientToken: string): Promise<string> {\n' +
'  // Exact integer math via BigInt (constructed from strings; no BigInt literals).\n' +
'  // Old float math overflowed Number.MAX_SAFE_INTEGER and corrupted the token.\n' +
'  const WIN_EPOCH = 11644473600;\n' +
'  let seconds = Math.floor(Date.now() / 1000) + WIN_EPOCH;\n' +
'  seconds = seconds - (seconds % 300); // round down to nearest 5 minutes\n' +
'  const ticks = BigInt(seconds) * BigInt("10000000"); // 100ns intervals\n' +
'  const strToHash = ticks.toString() + clientToken;\n' +
'  const enc = new TextEncoder();\n' +
'  const hashBuffer = await crypto.subtle.digest(\n' +
'    "SHA-256",\n' +
'    enc.encode(strToHash)\n' +
'  );\n' +
'  const hashArray = Array.from(new Uint8Array(hashBuffer));\n' +
'  return hashArray\n' +
'    .map((b) => b.toString(16).padStart(2, "0"))\n' +
'    .join("")\n' +
'    .toUpperCase();\n' +
'}';

srv = srv.slice(0, gecStart) + newGec + srv.slice(gecEnd);

// --- FIX 2: Sarvam Tier 2 endpoint (deprecated /text-to-speech -> /v1/text-to-speech, bulbul:v1 -> bulbul:v3) ---
if (!srv.includes('https://api.sarvam.ai/text-to-speech')) fail('anchor: sarvam url');
srv = srv.split('https://api.sarvam.ai/text-to-speech').join('https://api.sarvam.ai/v1/text-to-speech');
srv = srv.split('inputs: [cleanText],').join('text: cleanText,');
srv = srv.split('target_language_code: "hi-IN",').join('language_code: "hi-IN",');
srv = srv.split('pitch: 0,').join('');
srv = srv.split('loudness: 1.5,').join('');
srv = srv.split('enable_preprocessing: true,').join('');
srv = srv.split('model: "bulbul:v1",').join('model: "bulbul:v3",');
srv = srv.split('speech_sample_rate: 22050,').join('speech_sample_rate: 24000,');

// --- verify ---
if (!srv.includes('BigInt(seconds) * BigInt("10000000")')) fail('verify: BigInt ticks');
if (!srv.includes('ticks.toString() + clientToken')) fail('verify: hash string');
if (srv.includes('ticks *= S_TO_NS / 100;')) fail('verify: old float math still present');
if (!srv.includes('https://api.sarvam.ai/v1/text-to-speech')) fail('verify: sarvam url');
if (!srv.includes('model: "bulbul:v3"')) fail('verify: bulbul v3');
if (srv.includes('inputs: [cleanText]')) fail('verify: old sarvam param');
if (srv.includes('bulbul:v1')) fail('verify: deprecated model remains');
if ((srv.match(/export const runtime = "edge"/g) || []).length !== 1) fail('verify: edge runtime export');
if (!srv.includes('hi-IN-MadhurNeural')) fail('verify: MadhurNeural voice');
writeFileSync('app/api/ai-doubt/live/tts/route.ts', srv);
console.log('server: OK (Edge TTS Sec-MS-GEC fixed, Sarvam endpoint fixed)');

// ============ SELF-CLEANUP ============
unlinkSync('.github/workflows/apply-tts-fix-v2.yml');
unlinkSync('scripts/apply-tts-fix-v2.mjs');
console.log('cleanup: OK');
console.log('ALL FIXES APPLIED');
