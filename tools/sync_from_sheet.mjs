#!/usr/bin/env node
/*
 * tools/sync_from_sheet.mjs — Google 시트('논문 등록' 탭)를 읽어 data/publications.json 을 만든다.
 * Apps Script 없이 수동으로 갱신할 때(또는 최초 생성) 사용. 시트가 "링크가 있는 모든 사용자에게 보기 허용"
 * 상태여야 한다. 이후 `git add data/publications.json && git commit && git push`.
 *
 * 사용법: node tools/sync_from_sheet.mjs [--out data/publications.json]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const lib = require('../apps-script/lib.js');
const here = path.dirname(fileURLToPath(import.meta.url));

const SHEET_ID = '1Iz3_QLSXu6Ovww27wobo3JcsCSPZrhWN-OwEQnwjnc4';
const TAB = '논문 등록';
const URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(TAB)}`;

const outArg = process.argv.indexOf('--out');
const outFile = outArg > -1 ? path.resolve(process.argv[outArg + 1]) : path.join(here, '..', 'data', 'publications.json');

// RFC 4180 CSV (따옴표 안의 줄바꿈/쉼표/"" 처리)
export function parseCsv(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(v => v !== ''));
}

async function main() {
  const res = await fetch(URL);
  if (!res.ok) throw new Error(`시트 다운로드 실패: HTTP ${res.status} (시트 공유 설정이 "링크가 있는 모든 사용자"인지 확인)`);
  const rows = parseCsv(await res.text());
  if (rows.length < 2) throw new Error('시트에 데이터가 없습니다.');
  const [headers, ...data] = rows;
  const result = lib.convertRows(headers, data, { today: new Date() });
  const doc = lib.buildDocument(result, { generatedAt: new Date().toISOString(), source: TAB });
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, lib.serialize(doc));
  console.log(`${doc.count}건 → ${path.relative(process.cwd(), outFile)}`);
  for (const w of result.warnings) console.warn('⚠', w);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(err => { console.error('오류:', err.message); process.exit(1); });
}
