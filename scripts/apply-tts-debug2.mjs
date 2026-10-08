import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';

const fail = (m) => { console.error('ASSERT FAIL: ' + m); process.exit(1); };

const srvPath = 'app/api/ai-doubt/live/tts/route.ts';
let srv = readFileSync(srvPath, 'utf8');

// --- FIX 1: 'info.messages' unknown -> typed local array (TS strict mode) ---
const oldMsgLine = 'if (info.messages.length < 6) info.messages.push(ev.data.slice(0, 300));';
if (!srv.includes(oldMsgLine)) fail('anchor: messages push line');
const newMsgLine = 'if (messages.length < 6) messages.push(ev.data.slice(0, 300));';
srv = srv.split(oldMsgLine).join(newMsgLine);

// declare the typed array right after the info object creation
const infoAnchor = 'const info: Record<string, unknown> = { opened: false, messages: [], binaryFrames: 0, audioBytes: 0 };';
if (!srv.includes(infoAnchor)) fail('anchor: info declaration');
const newInfoDecl = 'const messages: string[] = [];\n' +
'          const info: Record<string, unknown> = { opened: false, binaryFrames: 0, audioBytes: 0 };';
srv = srv.split(infoAnchor).join(newInfoDecl);

// expose messages on close/resolve so diagnostics include them
const resolveAnchor = 'ws.onclose = (e: any) => { info.closeCode = e?.code; info.closeReason = e?.reason; clearTimeout(timer); resolve(info); };';
if (!srv.includes(resolveAnchor)) fail('anchor: onclose resolve');
const newResolve = 'ws.onclose = (e: any) => { info.closeCode = e?.code; info.closeReason = e?.reason; info.messages = messages; clearTimeout(timer); resolve(info); };';
srv = srv.split(resolveAnchor).join(newResolve);
// timeout path must also attach messages
const timeoutAnchor = 'const timer = setTimeout(() => { info.timeout = true; try { ws && ws.close(); } catch (_) {} resolve(info); }, 8000);';
if (!srv.includes(timeoutAnchor)) fail('anchor: timeout resolve');
const newTimeout = 'const timer = setTimeout(() => { info.timeout = true; info.messages = messages; try { ws && ws.close(); } catch (_) {} resolve(info); }, 8000);';
srv = srv.split(timeoutAnchor).join(newTimeout);

// --- FIX 2: guard other unknown-typed property assignments if any remain ---
// ensure no other 'info.<x>.push' or method calls on unknown remain
const badPatterns = [/info\.[a-zA-Z]+\.push/, /info\.[a-zA-Z]+\.length/];
for (const re of badPatterns) {
  const m2 = srv.match(re);
  if (m2) fail('remaining unknown-type property access: ' + m2[0]);
}

// --- verify ---
if (!srv.includes('const messages: string[] = [];')) fail('verify: typed messages array');
if (!srv.includes('info.messages = messages;')) fail('verify: messages attached');
if ((srv.match(/export async function POST/g) || []).length !== 1) fail('verify: single POST');
if ((srv.match(/export async function GET/g) || []).length !== 1) fail('verify: single GET');
const opens = (srv.match(/{/g) || []).length;
const closes = (srv.match(/}/g) || []).length;
if (opens !== closes) fail('verify: brace balance ' + opens + '/' + closes);
writeFileSync(srvPath, srv);
console.log('debug TS fix: OK');

unlinkSync('.github/workflows/apply-tts-debug2.yml');
unlinkSync('scripts/apply-tts-debug2.mjs');
console.log('cleanup: OK');
