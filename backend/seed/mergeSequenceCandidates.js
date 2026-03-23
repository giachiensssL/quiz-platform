const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
const getArg = (name, fallback = "") => {
  const i = args.indexOf(name);
  if (i < 0 || i + 1 >= args.length) return fallback;
  return String(args[i + 1] || "").trim();
};

const subject = getArg("--subject").toUpperCase();
const baseFile = getArg("--base");
const seqFile = getArg("--seq");
const lessonCountsFile = getArg("--lesson-counts");
const outputFile = getArg("--output");

if (!subject || !baseFile || !seqFile || !lessonCountsFile || !outputFile) {
  console.error("Usage: node seed/mergeSequenceCandidates.js --subject PLDC --base seed/answer_key_pldc_aggressive.json --seq seed/seq_pldc.json --lesson-counts seed/lesson_counts_pldc.json --output seed/answer_key_pldc_merged.json");
  process.exit(1);
}

const readJson = (p) => JSON.parse(fs.readFileSync(path.resolve(process.cwd(), p), "utf8"));
const basePayload = readJson(baseFile);
const seqPayload = readJson(seqFile);
const lessonCounts = readJson(lessonCountsFile);

const base = basePayload.lessons || {};
const eventsByLesson = seqPayload.eventsByLesson || {};

const result = JSON.parse(JSON.stringify(base));
const diagnostics = {};

for (const lessonNo of Object.keys(lessonCounts)) {
  const total = Number(lessonCounts[lessonNo] || 0);
  if (!total) continue;

  const events = Array.isArray(eventsByLesson[lessonNo]) ? eventsByLesson[lessonNo] : [];
  if (!events.length) {
    diagnostics[lessonNo] = { total, events: 0, offset: null, matches: 0, compared: 0, added: 0 };
    continue;
  }

  let bestOffset = 0;
  let bestMatches = -1;
  let bestCompared = 0;

  for (let offset = -5; offset <= 5; offset += 1) {
    let matches = 0;
    let compared = 0;

    for (let i = 0; i < events.length; i += 1) {
      const q = i + 1 + offset;
      if (q < 1 || q > total) continue;
      const qStr = String(q);
      const known = base?.[lessonNo]?.[qStr];
      if (!known) continue;
      compared += 1;
      if (known === events[i].option) matches += 1;
    }

    if (matches > bestMatches || (matches === bestMatches && compared > bestCompared)) {
      bestMatches = matches;
      bestCompared = compared;
      bestOffset = offset;
    }
  }

  const lessonBucket = result[lessonNo] || {};
  let added = 0;

  const accuracy = bestCompared ? bestMatches / bestCompared : 0;
  if (bestCompared >= 8 && accuracy >= 0.75) {
    for (let i = 0; i < events.length; i += 1) {
      const q = i + 1 + bestOffset;
      if (q < 1 || q > total) continue;
      const qStr = String(q);
      if (lessonBucket[qStr]) continue;
      lessonBucket[qStr] = events[i].option;
      added += 1;
    }
  }

  result[lessonNo] = lessonBucket;
  diagnostics[lessonNo] = {
    total,
    events: events.length,
    offset: bestOffset,
    matches: bestMatches,
    compared: bestCompared,
    accuracy: Number((accuracy * 100).toFixed(2)),
    added,
  };
}

const sorted = {};
for (const lessonNo of Object.keys(result).sort((a, b) => Number(a) - Number(b))) {
  const qMap = result[lessonNo] || {};
  sorted[lessonNo] = {};
  for (const qNo of Object.keys(qMap).sort((a, b) => Number(a) - Number(b))) {
    sorted[lessonNo][qNo] = qMap[qNo];
  }
}

const payload = {
  source: `merged-sequence:${subject}`,
  subject,
  lessons: sorted,
  diagnostics,
};

fs.writeFileSync(path.resolve(process.cwd(), outputFile), JSON.stringify(payload, null, 2));

let totalBase = 0;
let totalMerged = 0;
for (const l of Object.keys(base)) totalBase += Object.keys(base[l] || {}).length;
for (const l of Object.keys(sorted)) totalMerged += Object.keys(sorted[l] || {}).length;
console.log(`subject=${subject} base=${totalBase} merged=${totalMerged} added=${totalMerged - totalBase}`);
