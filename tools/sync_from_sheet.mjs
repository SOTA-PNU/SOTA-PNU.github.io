#!/usr/bin/env node
/*
 * tools/sync_from_sheet.mjs — Google 시트('논문 등록' 탭)를 읽어 data/publications.json 을 만든다.
 * Apps Script 없이 수동으로 갱신할 때(또는 최초 생성) 사용하는 비상용 경로다.
 *
 * 시트 ID 는 저장소에 커밋하지 않는다 (공개 저장소이고, 시트에는 미공개 논문·특허·기술이전 탭이 있다).
 *   - 환경변수:  SOTA_SHEET_ID=... node tools/sync_from_sheet.mjs
 *   - 또는 파일: tools/sheet-id.local  (한 줄로 시트 ID, .gitignore 처리됨)
 * 시트가 "링크가 있는 모든 사용자에게 보기 허용" 상태여야 CSV 내려받기가 된다.
 *
 * 사용법: node tools/sync_from_sheet.mjs [--out data/publications.json] [--seed]
 *   --seed  '키워드' 가 빈 논문을 apps-script/seed.js (기존 홈페이지에서 추출) 로 채운다.
 *           시트에 '키워드' 열이 아직 없는 최초 1회 생성에만 쓴다.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const lib = require('../apps-script/lib.js');
const here = path.dirname(fileURLToPath(import.meta.url));

const TAB = '논문 등록';

function readSheetId() {
  if (process.env.SOTA_SHEET_ID) return process.env.SOTA_SHEET_ID.trim();
  const local = path.join(here, 'sheet-id.local');
  if (fs.existsSync(local)) {
    const id = fs.readFileSync(local, 'utf8').trim();
    if (id) return id;
  }
  throw new Error(
    '시트 ID 를 찾을 수 없습니다.\n' +
    '  환경변수로:  SOTA_SHEET_ID=<시트ID> node tools/sync_from_sheet.mjs\n' +
    '  또는 파일로:  tools/sheet-id.local 에 시트 ID 한 줄 저장 (이 파일은 커밋되지 않습니다)\n' +
    '  시트 ID 는 시트 URL 의 /spreadsheets/d/ 와 /edit 사이 문자열입니다.');
}

function csvUrl(sheetId) {
  return 'https://docs.google.com/spreadsheets/d/' + sheetId +
    '/gviz/tq?tqx=out:csv&headers=1&sheet=' + encodeURIComponent(TAB);
}

// RFC 4180 CSV (따옴표 안의 줄바꿈/쉼표/"" 처리).
// 중간의 빈 행은 남긴다 — 시트 행 번호와 경고 메시지의 행 번호를 맞추기 위해.
export function parseCsv(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text; // BOM 제거
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  while (rows.length && rows[rows.length - 1].every(v => v === '')) rows.pop(); // 끝의 빈 행만 제거
  return rows;
}

export function loadSeed(seedPath) {
  const src = fs.readFileSync(seedPath || path.join(here, '..', 'apps-script', 'seed.js'), 'utf8');
  return vm.runInNewContext(src + ';PUB_SEED', {});
}

export function applySeed(publications, seed) {
  let filled = 0;
  for (const p of publications) {
    if (p.keywords) continue;
    const hit = seed[lib.normalizeTitle(p.titleKo)] || seed[lib.normalizeTitle(p.titleEn)];
    if (hit && hit.keywords) { p.keywords = hit.keywords; filled++; }
  }
  return filled;
}

async function main() {
  const outArg = process.argv.indexOf('--out');
  const outFile = outArg > -1 ? path.resolve(process.argv[outArg + 1]) : path.join(here, '..', 'data', 'publications.json');
  const useSeed = process.argv.includes('--seed');

  const res = await fetch(csvUrl(readSheetId()));
  if (!res.ok) throw new Error(`시트 다운로드 실패: HTTP ${res.status} (시트 공유 설정이 "링크가 있는 모든 사용자"인지, 시트 ID 가 맞는지 확인)`);
  const rows = parseCsv(await res.text());
  if (rows.length < 2) throw new Error('시트에 데이터가 없습니다.');
  const [headers, ...data] = rows;
  const result = lib.convertRows(headers, data, { today: new Date() });
  if (useSeed) {
    const filled = applySeed(result.publications, loadSeed());
    console.log(`키워드 seed 적용: ${filled}건`);
  }
  const doc = lib.buildDocument(result, { generatedAt: new Date().toISOString(), source: TAB });
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, lib.serialize(doc));
  console.log(`${doc.count}건 → ${path.relative(process.cwd(), outFile)}`);
  for (const w of result.warnings) console.warn('⚠', w);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(err => { console.error('오류:', err.message); process.exit(1); });
}
