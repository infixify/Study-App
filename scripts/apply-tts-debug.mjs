import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';

const fail = (m) => { console.error('ASSERT FAIL: ' + m); process.exit(1); };

const srvPath = 'app/api/ai-doubt/live/tts/route.ts';
let srv = readFileSync(srvPath, 'utf8');

// anchor: the missing-text check inside POST (present after merged v1 patch)
const anchor = 'return new NextResponse("Missing text parameter", { status: 400 });';
const idx = srv.indexOf(anchor);
if (idx < 0) fail('anchor: missing text check');
const insertAt = srv.indexOf('}', idx + anchor.length);
if (insertAt < 0) fail('anchor: closing brace');

const debugBlock =
'\n\n    // ── DEBUG MODE (temporary): ?debug=1 returns per-tier diagnostics JSON ──\n' +
'    const wantsDebug =\n' +
'      (typeof (req as any).url === "string" && (req as any).url.includes("debug=1"));\n' +
'    if (wantsDebug) {\n' +
'      const diag: Record<string, unknown> = { inputText: text, runtime: "edge", ts: Date.now() };\n' +
'\n' +
'      // TIER 1: Edge TTS raw WebSocket probe with full error capture\n' +
'      try {\n' +
'        const secMsGec = await generateSecMsGec(TRUSTED_CLIENT_TOKEN);\n' +
'        const connectionId = crypto.randomUUID().replace(/-/g, "");\n' +
'        const wssUrl = \`wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=\${TRUSTED_CLIENT_TOKEN}&Sec-MS-GEC=\${secMsGec}&Sec-MS-GEC-Version=1-\${CHROMIUM_VERSION}&ConnectionId=\${connectionId}\`;\n' +
'        diag.secMsGec = secMsGec;\n' +
'        diag.wssUrl = wssUrl;\n' +
'        diag.wsConstructor = typeof WebSocket;\n' +
'        const edgeResult = await new Promise((resolve) => {\n' +
'          const info: Record<string, unknown> = { opened: false, messages: [], binaryFrames: 0, audioBytes: 0 };\n' +
'          let ws: any;\n' +
'          const timer = setTimeout(() => { info.timeout = true; try { ws && ws.close(); } catch (_) {} resolve(info); }, 8000);\n' +
'          try {\n' +
'            ws = new WebSocket(wssUrl);\n' +
'            ws.binaryType = "arraybuffer";\n' +
'            ws.onopen = () => { info.opened = true; };\n' +
'            ws.onmessage = (ev: any) => {\n' +
'              if (typeof ev.data === "string") {\n' +
'                if (info.messages.length < 6) info.messages.push(ev.data.slice(0, 300));\n' +
'              } else { info.binaryFrames++; info.audioBytes += (ev.data?.byteLength || 0); }\n' +
'            };\n' +
'            ws.onerror = (e: any) => { info.error = String((e && (e.message || e.type)) || e); };\n' +
'            ws.onclose = (e: any) => { info.closeCode = e?.code; info.closeReason = e?.reason; clearTimeout(timer); resolve(info); };\n' +
'          } catch (err: any) { info.constructorThrow = String(err?.message || err); clearTimeout(timer); resolve(info); }\n' +
'        });\n' +
'        diag.edgeTts = edgeResult;\n' +
'      } catch (err: any) {\n' +
'        diag.edgeTts = { outerError: String(err?.message || err) };\n' +
'      }\n' +
'\n' +
'      // TIER 2: Sarvam raw call with status + body snippet\n' +
'      try {\n' +
'        const sarvamApiKey = process.env.SARVAM_API_KEY;\n' +
'        diag.sarvamKeyPresent = Boolean(sarvamApiKey);\n' +
'        if (sarvamApiKey) {\n' +
'          const res = await fetch("https://api.sarvam.ai/v1/text-to-speech", {\n' +
'            method: "POST",\n' +
'            headers: { "Content-Type": "application/json", "api-subscription-key": sarvamApiKey },\n' +
'            body: JSON.stringify({ text: "test bol", language_code: "hi-IN", speaker: "shubh", pace: 1.0, model: "bulbul:v3", speech_sample_rate: 24000 }),\n' +
'          });\n' +
'          diag.sarvamStatus = res.status;\n' +
'          const body = await res.text();\n' +
'          diag.sarvamBodySnippet = body.slice(0, 300);\n' +
'        }\n' +
'      } catch (err: any) { diag.sarvamError = String(err?.message || err); }\n' +
'\n' +
'      // TIER 3: Google translate probe with status\n' +
'      try {\n' +
'        const gUrl = \`https://translate.google.com/translate_tts?ie=UTF-8&q=test&tl=hi&client=tw-ob\`;\n' +
'        const gRes = await fetch(gUrl, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" } });\n' +
'        diag.googleStatus = gRes.status;\n' +
'        diag.googleBodySnippet = (await gRes.text()).slice(0, 120);\n' +
'      } catch (err: any) { diag.googleError = String(err?.message || err); }\n' +
'\n' +
'      return NextResponse.json(diag);\n' +
'    }\n';

srv = srv.slice(0, insertAt + 1) + debugBlock + srv.slice(insertAt + 1);

// sanity checks
if ((srv.match(/if \(wantsDebug\)/g) || []).length !== 1) fail('verify: debug block inserted once');
if (!srv.includes('generateSecMsGec(TRUSTED_CLIENT_TOKEN)')) fail('verify: gec call in debug');
if (!srv.includes('sarvam.ai/v1/text-to-speech')) fail('verify: sarvam probe');
if ((srv.match(/export async function POST/g) || []).length !== 1) fail('verify: single POST');
if ((srv.match(/export async function GET/g) || []).length !== 1) fail('verify: single GET');
// quick syntax sanity: balanced braces
const opens = (srv.match(/{/g) || []).length;
const closes = (srv.match(/}/g) || []).length;
if (opens !== closes) fail('verify: brace balance ' + opens + '/' + closes);
writeFileSync(srvPath, srv);
console.log('debug patch: OK');

unlinkSync('.github/workflows/apply-tts-debug.yml');
unlinkSync('scripts/apply-tts-debug.mjs');
console.log('cleanup: OK');
