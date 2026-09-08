#!/usr/bin/env node
/*
 * tools/extract_seed.mjs — 손으로 작성된 publications.html 에서 (제목 → 키워드) 를 뽑아
 * apps-script/seed.js 를 생성한다. "초기 설정" 메뉴가 시트의 빈 '키워드' 셀을 채울 때 사용.
 *
 * 사용법: node tools/extract_seed.mjs <publications.html 경로> [출력 경로]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const lib = require('../apps-script/lib.js');
const here = path.dirname(fileURLToPath(import.meta.url));

const input = process.argv[2];
const output = process.argv[3] || path.join(here, '..', 'apps-script', 'seed.js');
if (!input) {
  console.error('사용법: node tools/extract_seed.mjs <publications.html> [seed.js]');
  process.exit(1);
}

const text = (s) => s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const html = fs.readFileSync(input, 'utf8').replace(/<!--[\s\S]*?-->/g, ''); // 주석 처리된 예시 카드 제외

const seed = {};
const cardRe = /<article class="pnu-pub-card[^"]*"[\s\S]*?<\/article>/g;
for (const [card] of html.matchAll(cardRe)) {
  const title = card.match(/<h3 class="pnu-title">([\s\S]*?)<\/h3>/);
  const metas = [...card.matchAll(/<span class="pnu-meta">([\s\S]*?)<\/span>/g)].map(m => text(m[1]));
  if (!title) continue;
  const t = text(title[1]);
  const keywords = metas[1] || '';
  if (!keywords) continue;
  seed[lib.normalizeTitle(t)] = { title: t, keywords };
}

const body = JSON.stringify(seed, null, 2);
const out = `/*
 * apps-script/seed.js — 생성 파일 (tools/extract_seed.mjs). 손으로 편집하지 말 것.
 * 초기 설정(setupWebsiteColumns)에서 시트의 빈 '키워드' 셀을 채우는 데만 사용한다.
 * 키: PubLib.normalizeTitle(제목)
 */
var PUB_SEED = ${body};
`;
fs.writeFileSync(output, out);
console.log(`${Object.keys(seed).length} entries → ${path.relative(process.cwd(), output)}`);
