import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';

const fail = (m) => { console.error('ASSERT FAIL: ' + m); process.exit(1); };

// ============ SERVER: app/api/ai-doubt/live/tts/route.ts ============
let srv = readFileSync('app/api/ai-doubt/live/tts/route.ts', 'utf8');

if (!srv.includes('synthesizeEdgeTTS(cleanText, 2500)')) fail('server anchor: timeout call');
if (!srv.includes('timeoutMs = 2800')) fail('server anchor: timeout default');
srv = srv.split('synthesizeEdgeTTS(cleanText, 2500)').join('synthesizeEdgeTTS(cleanText, 12000)');
srv = srv.split('timeoutMs = 2800').join('timeoutMs = 12000');

const idxA = srv.indexOf('export async function GET(req: NextRequest) {');
const anchorB = 'const provider = searchParams.get("provider") || "auto";';
const idxB = srv.indexOf(anchorB, idxA);
if (idxA < 0 || idxB < 0) fail('server anchors: GET handler');
const lineEnd = srv.indexOf('\n', idxB + anchorB.length);
const newHeader =
  'export async function POST(req: NextRequest) {\n' +
  '  try {\n' +
  '    let text: string | null = null;\n' +
  '    let provider = "auto";\n' +
  '    try {\n' +
  '      const body = await req.json();\n' +
  '      if (typeof body?.text === "string") text = body.text.trim();\n' +
  '      if (typeof body?.provider === "string") provider = body.provider;\n' +
  '    } catch (_) {\n' +
  '      const { searchParams } = new URL(req.url);\n' +
  '      text = searchParams.get("text")?.trim() ?? null;\n' +
  '      provider = searchParams.get("provider") || "auto";\n' +
  '    }\n';
srv = srv.slice(0, idxA) + newHeader + srv.slice(lineEnd + 1);
srv += '\n// Backwards-compatible GET endpoint (short texts only)\nexport async function GET(req: NextRequest) {\n  return POST(req);\n}\n';

const nPOST = (srv.match(/export async function POST/g) || []).length;
const nGET = (srv.match(/export async function GET/g) || []).length;
if (nPOST !== 1 || nGET !== 1) fail('server POST/GET export counts');
if (!srv.includes('synthesizeEdgeTTS(cleanText, 12000)') || !srv.includes('timeoutMs = 12000')) fail('server timeout applied');
writeFileSync('app/api/ai-doubt/live/tts/route.ts', srv);
console.log('server: OK');

// ============ CLIENT: components/dashboard/LiveVideoCallModal.tsx ============
let cli = readFileSync('components/dashboard/LiveVideoCallModal.tsx', 'utf8');

const refAnchor = 'const isAudioQueuePlayingRef = useRef(false);';
if (!cli.includes(refAnchor)) fail('client anchor: queue ref');
cli = cli.split(refAnchor).join(refAnchor + '\n  const speechInterruptRef = useRef(false);');

const pA = cli.indexOf('const playAudioChunk = useCallback(');
const pB = cli.indexOf('const stopSpeaking = useCallback(');
if (pA < 0 || pB < 0 || pB < pA) fail('client anchors: play/stop blocks');

const newPlay =
`  // Split long AI replies into natural sentence-based chunks for reliable TTS
  const splitIntoSpeechChunks = (text: string, maxLen = 300): string[] => {
    const parts = text.match(/[^.!?\u0964]+[.!?\u0964]*/g) || [text];
    const chunks: string[] = [];
    let current = "";
    for (const part of parts) {
      const p = part.trim();
      if (!p) continue;
      if (current && (current + " " + p).length > maxLen) {
        chunks.push(current);
        current = p;
      } else {
        current = current ? current + " " + p : p;
      }
    }
    if (current) chunks.push(current);
    return chunks;
  };

  // Play one chunk via server TTS; falls back to browser speechSynthesis if the route fails
  const playSingleChunk = (chunk: string): Promise<void> => {
    return new Promise<void>(async (resolve) => {
      let settled = false;
      const done = () => {
        if (!settled) {
          settled = true;
          resolve();
        }
      };
      try {
        const res = await fetch("/api/ai-doubt/live/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: chunk }),
        });
        if (res.ok) {
          const blob = await res.blob();
          const audio = new Audio(URL.createObjectURL(blob));
          currentAudioRef.current = audio;
          audio.onended = done;
          audio.onerror = done;
          audio.onpause = done;
          await audio.play();
          return;
        }
      } catch (_) {}
      try {
        if (typeof window !== "undefined" && "speechSynthesis" in window) {
          const utterance = new SpeechSynthesisUtterance(chunk);
          utterance.lang = "hi-IN";
          utterance.rate = 1.05;
          utterance.onend = done;
          utterance.onerror = done;
          window.speechSynthesis.speak(utterance);
          return;
        }
      } catch (_) {}
      done();
    });
  };

  const playAudioChunk = useCallback(
    async (textToSpeak: string, msgId: string) => {
      if (isMuted) return;
      const cleanedSpeech = cleanTextForSpeech(textToSpeak);
      if (!cleanedSpeech) return;

      // Stop any in-flight speech session before starting a new one
      try {
        if (currentAudioRef.current) currentAudioRef.current.pause();
      } catch (_) {}
      try {
        if (typeof window !== "undefined" && "speechSynthesis" in window) {
          window.speechSynthesis.cancel();
        }
      } catch (_) {}
      currentAudioRef.current = null;
      speechInterruptRef.current = false;
      setIsAiSpeaking(true);
      setActiveSpeechMessageId(msgId);

      // Queue and play chunks sequentially (no URL length limits)
      const chunks = splitIntoSpeechChunks(cleanedSpeech, 300);
      audioQueueRef.current = chunks;
      isAudioQueuePlayingRef.current = true;
      for (const chunk of chunks) {
        if (speechInterruptRef.current) break;
        await playSingleChunk(chunk);
      }
      isAudioQueuePlayingRef.current = false;
      audioQueueRef.current = [];
      setIsAiSpeaking(false);
      setActiveSpeechMessageId(null);
    },
    [isMuted]
  );

`;
cli = cli.slice(0, pA) + newPlay + cli.slice(pB);

const sC = cli.indexOf('const stopSpeaking = useCallback(');
const sEnd = cli.indexOf('}, []);', sC) + '}, []);'.length;
if (sC < 0 || sEnd < '}, []);'.length) fail('client anchors: stopSpeaking block');
const newStop =
`const stopSpeaking = useCallback(() => {
      speechInterruptRef.current = true;
      try {
        if (currentAudioRef.current) {
          currentAudioRef.current.pause();
          currentAudioRef.current.currentTime = 0;
        }
      } catch (_) {}
      currentAudioRef.current = null;
      try {
        if (typeof window !== "undefined" && "speechSynthesis" in window) {
          window.speechSynthesis.cancel();
        }
      } catch (_) {}
      setIsAiSpeaking(false);
      setActiveSpeechMessageId(null);
    }, []);`;
cli = cli.slice(0, sC) + newStop + cli.slice(sEnd);

const cliChecks = {
  playCount: (cli.match(/const playAudioChunk = useCallback\(/g) || []).length === 1,
  interrupt: (cli.match(/speechInterruptRef/g) || []).length >= 5,
  chunks: (cli.match(/splitIntoSpeechChunks/g) || []).length >= 2,
  synth: cli.includes('SpeechSynthesisUtterance'),
};
if (!Object.values(cliChecks).every(Boolean)) fail('client verification: ' + JSON.stringify(cliChecks));
writeFileSync('components/dashboard/LiveVideoCallModal.tsx', cli);
console.log('client: OK');

// ============ SELF-CLEANUP: remove this automation ============
unlinkSync('.github/workflows/apply-tts-fix.yml');
unlinkSync('scripts/apply-tts-fix.mjs');
console.log('cleanup: OK');
console.log('ALL FIXES APPLIED');
