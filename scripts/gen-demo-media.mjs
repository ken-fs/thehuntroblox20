/**
 * Demo media generator — draws the template's demo article artwork (fictional
 * game "Anvil Quest") as flat vector SVG and rasterizes to PNG with sharp.
 *
 * Why: the demo game is fictional, so there are no real screenshots. These
 * generated "mechanics diagrams / weapon cards / arena maps" demonstrate the
 * template's media features (cover, gallery, inline body images) without
 * shipping copyrighted game captures. Re-run after editing any SVG below:
 *
 *   node scripts/gen-demo-media.mjs
 *
 * Outputs:
 *   src/assets/covers/codes-cover.png        (codes page cover, og:image)
 *   src/assets/gallery/stormcaller-*.png     (boss guide gallery)
 *   src/assets/gallery/emberfang-*.png       (boss guide gallery)
 *   src/assets/gallery/beginner-*.png        (beginner guide gallery)
 *   public/images/articles/weapon-*.png      (tier-list inline body images)
 *
 * The cover renders at 1200×675 (og:image standard since v2.0 — Google
 * Discover large-image previews need ≥1200px width); gallery and inline
 * body images stay 800×450 (16:9, matches the `.prose img:not([class])`
 * CLS guard in globals.css).
 */
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const FONT = "font-family='Helvetica Neue, Helvetica, Arial, sans-serif'";

const W = 800;
const H = 450;

// Shared palette (matches the flat, saturated cover art style).
const C = {
  bg: '#141821',
  panel: '#1e2430',
  panelStroke: '#2d3542',
  text: '#e2e8f0',
  muted: '#94a3b8',
  amber: '#f59e0b',
  gold: '#fbbf24',
  orange: '#ea580c',
  red: '#ef4444',
  green: '#34d399',
  teal: '#2dd4bf',
  ice: '#38bdf8',
  violet: '#a78bfa',
  violetDeep: '#6d28d9',
};

const frame = (title, sub, inner) => `
  <rect width='${W}' height='${H}' fill='url(#bgGrad)'/>
  ${inner}
  <text x='36' y='52' ${FONT} font-size='26' font-weight='700' fill='${C.text}'>${title}</text>
  <text x='36' y='76' ${FONT} font-size='14' fill='${C.muted}' letter-spacing='2'>${sub}</text>`;

// Cover output size — og:image standard (v2.0): Google Discover large-image
// previews require ≥1200px width; 1200×675 keeps the 16:9 aspect.
const COVER_W = 1200;
const COVER_H = 675;

// Internal layout stays on the 800×450 grid; covers render it scaled up via
// viewBox (vector, so no quality loss) while other media rasterize 1:1.
const svgDoc = (inner, { width = W, height = H } = {}) => `<svg xmlns='http://www.w3.org/2000/svg' width='${width}' height='${height}' viewBox='0 0 ${W} ${H}'>
  <defs>
    <radialGradient id='bgGrad' cx='50%' cy='42%' r='85%'>
      <stop offset='0%' stop-color='#1d2330'/>
      <stop offset='100%' stop-color='${C.bg}'/>
    </radialGradient>
  </defs>
  ${inner}
</svg>`;

/* ------------------------------------------------------------------ */
/* 1. codes-cover — golden redeem ticket on a dark forge backdrop      */
/* ------------------------------------------------------------------ */
const codesCover = svgDoc(`
  <g opacity='0.5'>
    ${[
      [110, 90, 5], [690, 70, 7], [140, 360, 6], [720, 340, 5], [60, 220, 4],
      [740, 180, 4], [90, 140, 3], [660, 400, 5], [200, 50, 4], [560, 420, 4],
    ]
      .map(
        ([x, y, r]) => `<path d='M${x} ${y - r}L${x + r * 0.3} ${y - r * 0.3}L${x + r} ${y}L${x + r * 0.3} ${y + r * 0.3}L${x} ${y + r}L${x - r * 0.3} ${y + r * 0.3}L${x - r} ${y}L${x - r * 0.3} ${y - r * 0.3}Z' fill='${C.gold}' opacity='0.5'/>`,
      )
      .join('')}
  </g>
  <ellipse cx='400' cy='250' rx='230' ry='110' fill='${C.amber}' opacity='0.08'/>
  <g transform='rotate(-5 400 240)'>
    <rect x='205' y='150' width='390' height='185' rx='18' fill='url(#ticketGrad)' stroke='#b45309' stroke-width='3'/>
    <line x1='300' y1='158' x2='300' y2='327' stroke='#92400e' stroke-width='3' stroke-dasharray='2 10' stroke-linecap='round'/>
    <circle cx='300' cy='160' r='7' fill='#141821'/>
    <circle cx='300' cy='325' r='7' fill='#141821'/>
    <text x='450' y='225' text-anchor='middle' ${FONT} font-size='44' font-weight='800' fill='#451a03'>REDEEM</text>
    <text x='450' y='258' text-anchor='middle' ${FONT} font-size='16' font-weight='700' fill='#78350f' letter-spacing='4'>ANVIL QUEST</text>
    <g transform='translate(238 238)'>
      <rect x='-26' y='-20' width='52' height='40' rx='6' fill='#fde68a' stroke='#b45309' stroke-width='3'/>
      <line x1='0' y1='-20' x2='0' y2='20' stroke='#b45309' stroke-width='3'/>
      <path d='M-26 -8 L-14 -18 L0 -6 L14 -18 L26 -8' fill='none' stroke='#b45309' stroke-width='3' stroke-linejoin='round'/>
    </g>
  </g>
  <g>
    <circle cx='630' cy='330' r='26' fill='url(#coinGrad)' stroke='#b45309' stroke-width='3'/>
    <circle cx='600' cy='352' r='18' fill='url(#coinGrad)' stroke='#b45309' stroke-width='3'/>
    <circle cx='660' cy='356' r='14' fill='url(#coinGrad)' stroke='#b45309' stroke-width='3'/>
    <text x='630' y='338' text-anchor='middle' ${FONT} font-size='22' font-weight='800' fill='#78350f'>G</text>
  </g>
  <rect x='36' y='388' width='252' height='34' rx='17' fill='${C.panel}' stroke='${C.panelStroke}'/>
  <text x='162' y='410' text-anchor='middle' ${FONT} font-size='14' font-weight='700' fill='${C.gold}' letter-spacing='2'>ANVIL QUEST · CODES</text>
  <defs>
    <linearGradient id='ticketGrad' x1='0' y1='0' x2='0' y2='1'>
      <stop offset='0%' stop-color='#fcd34d'/>
      <stop offset='100%' stop-color='#d97706'/>
    </linearGradient>
    <linearGradient id='coinGrad' x1='0' y1='0' x2='0' y2='1'>
      <stop offset='0%' stop-color='#fde68a'/>
      <stop offset='100%' stop-color='#f59e0b'/>
    </linearGradient>
  </defs>
`, { width: COVER_W, height: COVER_H });

/* ------------------------------------------------------------------ */
/* 2. stormcaller-arena — overhead arena map                           */
/* ------------------------------------------------------------------ */
const stormcallerArena = svgDoc(
  frame(
    'EMBERFALL CRATER',
    'STORMCALLER ARENA — OVERHEAD VIEW',
    `
  <g stroke='#1c1712' stroke-width='1'>
    ${Array.from({ length: 15 }, (_, i) => `<line x1='${i * 57 + 28}' y1='0' x2='${i * 57 + 28}' y2='${H}'/>`).join('')}
    ${Array.from({ length: 9 }, (_, i) => `<line x1='0' y1='${i * 56 + 22}' x2='${W}' y2='${i * 56 + 22}'/>`).join('')}
  </g>
  <circle cx='470' cy='245' r='155' fill='#241a12' stroke='#3f2a1a' stroke-width='3'/>
  <circle cx='470' cy='245' r='155' fill='none' stroke='${C.orange}' stroke-width='9'/>
  <path d='M470 390 A145 145 0 0 0 400 372' fill='none' stroke='${C.bg}' stroke-width='12'/>
  <path d='M470 392 A147 147 0 0 0 402 374' fill='none' stroke='${C.green}' stroke-width='8'/>
  <g opacity='0.85'>
    <ellipse cx='380' cy='150' rx='26' ry='13' fill='${C.red}' opacity='0.7'/>
    <ellipse cx='585' cy='205' rx='22' ry='11' fill='${C.red}' opacity='0.7'/>
    <ellipse cx='545' cy='330' rx='24' ry='12' fill='${C.red}' opacity='0.7'/>
    <ellipse cx='352' cy='290' rx='18' ry='9' fill='${C.red}' opacity='0.7'/>
  </g>
  <g>
    <circle cx='470' cy='245' r='34' fill='${C.amber}' opacity='0.18'/>
    <path d='M470 222 L482 248 L474 245 L470 262 L466 245 L458 248 Z' fill='${C.gold}' stroke='#b45309' stroke-width='2'/>
    <text x='470' y='296' text-anchor='middle' ${FONT} font-size='13' font-weight='700' fill='${C.text}' letter-spacing='2'>STORMCALLER</text>
  </g>
  <g stroke='${C.red}' stroke-width='5' stroke-linecap='round'>
    <path d='M382 142 l20 20 M402 142 l-20 20' fill='none'/>
    <path d='M580 230 l20 20 M600 230 l-20 20' fill='none'/>
    <path d='M490 345 l20 20 M510 345 l-20 20' fill='none'/>
  </g>
  <text x='392' y='180' text-anchor='middle' ${FONT} font-size='11' font-weight='700' fill='${C.red}'>×3</text>
  <path d='M436 430 Q400 380 430 330 Q455 292 445 275' fill='none' stroke='${C.green}' stroke-width='5' stroke-dasharray='10 8' stroke-linecap='round'/>
  <path d='M445 275 l-10 14 M445 275 l14 6' stroke='${C.green}' stroke-width='5' stroke-linecap='round' fill='none'/>
  <path d='M445 262 A22 22 0 0 0 425 275 L465 275 A22 22 0 0 0 445 262 Z' fill='${C.green}' opacity='0.3' transform='translate(0 -6) rotate(180 445 268)'/>
  <text x='430' y='412' text-anchor='middle' ${FONT} font-size='12' font-weight='700' fill='${C.green}'>ENTRANCE</text>
  <g>
    <rect x='36' y='120' width='216' height='120' rx='12' fill='${C.panel}' stroke='${C.panelStroke}'/>
    <text x='56' y='148' ${FONT} font-size='12' font-weight='700' fill='${C.muted}' letter-spacing='2'>LEGEND</text>
    <line x1='56' y1='170' x2='92' y2='170' stroke='${C.green}' stroke-width='4' stroke-dasharray='8 6'/>
    <text x='102' y='174' ${FONT} font-size='12' fill='${C.text}'>safe route — behind boss</text>
    <path d='M66 188 l0 16 M66 188 l-6 6 M66 188 l6 6' stroke='${C.red}' stroke-width='4' stroke-linecap='round' transform='rotate(180 66 196)' fill='none'/>
    <text x='102' y='198' ${FONT} font-size='12' fill='${C.text}'>meteor marks — 3 per wave</text>
    <path d='M74 216 L80 228 L76.5 226 L74 236 L71.5 226 L68 228 Z' fill='${C.gold}'/>
    <text x='102' y='228' ${FONT} font-size='12' fill='${C.text}'>Stormcaller · 18,000 HP</text>
  </g>
  <text x='648' y='432' text-anchor='middle' ${FONT} font-size='12' fill='${C.muted}'>red pools: fire puddles last 20s</text>
`,
  ),
);

/* ------------------------------------------------------------------ */
/* 3. stormcaller-mechanics — Flame Whip arc + meteor timeline         */
/* ------------------------------------------------------------------ */
const stormcallerMechanics = svgDoc(
  frame(
    'STORMCALLER',
    'MECHANICS AT A GLANCE',
    `
  <g>
    <rect x='36' y='100' width='352' height='300' rx='14' fill='${C.panel}' stroke='${C.panelStroke}'/>
    <text x='212' y='132' text-anchor='middle' ${FONT} font-size='15' font-weight='700' fill='${C.amber}' letter-spacing='2'>FLAME WHIP · 180° FRONT ARC</text>
    <text x='212' y='154' text-anchor='middle' ${FONT} font-size='12' fill='${C.muted}'>1.2s wind-up · 600 damage + burn</text>
    <path d='M152 290 A60 60 0 0 1 272 290 L152 290 Z' fill='${C.red}' opacity='0.22'/>
    <path d='M152 290 A60 60 0 0 1 272 290' fill='none' stroke='${C.red}' stroke-width='5'/>
    <path d='M272 288 A60 60 0 0 1 240 238' fill='none' stroke='${C.red}' stroke-width='4' stroke-dasharray='7 6' opacity='0.8'/>
    <path d='M152 292 A60 60 0 0 0 272 292 L272 292 Z' fill='${C.green}' opacity='0.2' transform='translate(0 2)'/>
    <path d='M152 290 A60 60 0 0 0 272 290' fill='none' stroke='${C.green}' stroke-width='5'/>
    <circle cx='212' cy='290' r='26' fill='${C.orange}' stroke='#7c2d12' stroke-width='3'/>
    <text x='212' y='295' text-anchor='middle' ${FONT} font-size='11' font-weight='800' fill='#fff7ed'>BOSS</text>
    <circle cx='188' cy='330' r='7' fill='${C.ice}'/>
    <circle cx='212' cy='340' r='7' fill='${C.ice}'/>
    <circle cx='236' cy='330' r='7' fill='${C.ice}'/>
    <text x='212' y='368' text-anchor='middle' ${FONT} font-size='13' font-weight='700' fill='${C.green}'>SAFE — stay behind the boss</text>
    <text x='212' y='240' text-anchor='middle' ${FONT} font-size='13' font-weight='700' fill='${C.red}'>DANGER ZONE</text>
  </g>
  <g>
    <rect x='412' y='100' width='352' height='300' rx='14' fill='${C.panel}' stroke='${C.panelStroke}'/>
    <text x='588' y='132' text-anchor='middle' ${FONT} font-size='15' font-weight='700' fill='${C.amber}' letter-spacing='2'>METEORS · EVERY 30 SECONDS</text>
    <line x1='452' y1='240' x2='724' y2='240' stroke='${C.panelStroke}' stroke-width='4'/>
    ${[0, 1, 2, 3, 4, 5, 6, 7]
      .map((i) => {
        const x = 452 + i * 38.857;
        return `<line x1='${x}' y1='232' x2='${x}' y2='248' stroke='${C.muted}' stroke-width='2'/>
      <text x='${x}' y='270' text-anchor='middle' ${FONT} font-size='10' fill='${C.muted}'>${(i * 30 / 60).toFixed(i % 2 === 0 ? 0 : 1)}m</text>`;
      })
      .join('')}
    ${[1, 2, 3, 4, 5, 6]
      .map((i) => {
        const x = 452 + i * 38.857;
        return `<g><line x1='${x + 4}' y1='196' x2='${x - 2}' y2='212' stroke='${C.orange}' stroke-width='3' stroke-linecap='round'/>
        <circle cx='${x - 4}' cy='216' r='10' fill='${C.red}'/>
        <circle cx='${x - 7}' cy='213' r='3' fill='${C.gold}'/></g>`;
      })
      .join('')}
    <rect x='700' y='222' width='36' height='36' rx='8' fill='${C.amber}' opacity='0.25'/>
    <text x='718' y='246' text-anchor='middle' ${FONT} font-size='16' font-weight='800' fill='${C.gold}'>!</text>
    <text x='718' y='286' text-anchor='middle' ${FONT} font-size='11' font-weight='700' fill='${C.gold}'>ENRAGE 4:00</text>
    <text x='588' y='330' text-anchor='middle' ${FONT} font-size='13' fill='${C.text}'>2s to move after each mark</text>
    <text x='588' y='352' text-anchor='middle' ${FONT} font-size='13' fill='${C.muted}'>melee: stand at her side or back</text>
  </g>
`,
  ),
);

/* ------------------------------------------------------------------ */
/* 4. beginner-class-picks — the four starting classes                 */
/* ------------------------------------------------------------------ */
const classCard = (x, y, name, sub, chipColor, icon, highlight = false) => `
  <g>
    <rect x='${x}' y='${y}' width='340' height='140' rx='14' fill='#231d33' stroke='${highlight ? C.violet : '#3b2f57'}' stroke-width='${highlight ? 2.5 : 1.5}'/>
    ${highlight ? `<rect x='${x + 196}' y='${y - 12}' width='132' height='24' rx='12' fill='${C.violet}'/><text x='${x + 262}' y='${y + 4}' text-anchor='middle' ${FONT} font-size='11' font-weight='800' fill='#1e1b2e' letter-spacing='1'>BEGINNER PICK</text>` : ''}
    <g transform='translate(${x + 44} ${y + 70})'>${icon}</g>
    <text x='${x + 110}' y='${y + 62}' ${FONT} font-size='20' font-weight='800' fill='${C.text}'>${name}</text>
    <text x='${x + 110}' y='${y + 86}' ${FONT} font-size='12' fill='${C.muted}'>${sub}</text>
    <rect x='${x + 110}' y='${y + 98}' width='76' height='22' rx='11' fill='${chipColor}' opacity='0.22'/>
    <text x='${x + 148}' y='${y + 113}' text-anchor='middle' ${FONT} font-size='11' font-weight='800' fill='${chipColor}'>${name === 'WARRIOR' ? 'EASY' : name === 'ROGUE' ? 'HARD' : 'MEDIUM'}</text>
  </g>`;

const iconSword = `<g stroke='${C.violet}' stroke-width='4' stroke-linecap='round' fill='none'>
  <path d='M0 -26 L0 14'/><path d='M-12 8 L12 8'/><path d='M0 14 L0 26'/></g>`;
const iconStaff = `<g stroke='${C.ice}' stroke-width='4' stroke-linecap='round' fill='none'>
  <path d='M0 -18 L0 26'/><circle cx='0' cy='-26' r='8' fill='${C.ice}' opacity='0.4'/><circle cx='0' cy='-26' r='3.5' fill='${C.ice}'/></g>`;
const iconDagger = `<g stroke='${C.red}' stroke-width='4' stroke-linecap='round' fill='none'>
  <path d='M-6 -24 L4 8'/><path d='M-12 12 L10 4'/><path d='M6 12 L12 22'/></g>`;
const iconMace = `<g stroke='${C.gold}' stroke-width='4' stroke-linecap='round' fill='none'>
  <path d='M0 -6 L0 26'/><circle cx='0' cy='-16' r='11' fill='${C.gold}' opacity='0.3'/><circle cx='0' cy='-16' r='11'/></g>`;

const beginnerClasses = svgDoc(
  frame(
    'PICK YOUR STARTING CLASS',
    'CHARACTER CREATION — CANNOT BE CHANGED WITHOUT 500 GEMS',
    `
  ${classCard(36, 110, 'WARRIOR', 'High HP · simple melee', C.green, iconSword, true)}
  ${classCard(424, 110, 'MAGE', 'Ranged burst · fragile', C.amber, iconStaff)}
  ${classCard(36, 272, 'ROGUE', 'High crit · melee', C.red, iconDagger)}
  ${classCard(424, 272, 'CLERIC', 'Support · healing', C.amber, iconMace)}
`,
  ),
);

/* ------------------------------------------------------------------ */
/* 5. beginner-route — first-two-hours timeline                        */
/* ------------------------------------------------------------------ */
const routeNode = (x, y, color, icon, label, sub, anchor = 'middle') => `
  <g>
    <line x1='${x}' y1='${y > 250 ? y - 44 : y + 44}' x2='${x}' y2='${y > 250 ? y - 16 : y + 16}' stroke='#3b2f57' stroke-width='3'/>
    <circle cx='${x}' cy='${y}' r='30' fill='#231d33' stroke='${color}' stroke-width='3'/>
    <g transform='translate(${x} ${y})'>${icon}</g>
    <text x='${x}' y='${y > 250 ? y + 54 : y - 42}' text-anchor='${anchor}' ${FONT} font-size='13' font-weight='800' fill='${C.text}'>${label}</text>
    <text x='${x}' y='${y > 250 ? y + 72 : y - 26}' text-anchor='${anchor}' ${FONT} font-size='11' fill='${C.muted}'>${sub}</text>
  </g>`;

const beginnerRoute = svgDoc(
  frame(
    'YOUR FIRST TWO HOURS',
    'TUTORIAL FORGE → SHATTERED ISLES',
    `
  <path d='M70 260 C 170 130 260 130 360 230 S 560 340 730 210' fill='none' stroke='${C.violet}' stroke-width='6' opacity='0.55' stroke-linecap='round'/>
  ${routeNode(88, 258, C.violet, `<path d='M-10 4 L10 -2 M-8 8 Q0 14 8 8 M0 -12 L0 -16 M-4 -12 L4 -12' stroke='${C.violet}' stroke-width='3.5' fill='none' stroke-linecap='round'/>`, 'TUTORIAL FORGE', '0:00–0:20 · Lv 3')}
  ${routeNode(255, 178, C.green, `<circle cx='0' cy='6' r='9' fill='none' stroke='${C.green}' stroke-width='3.5'/><path d='M0 -14 L0 6 M0 -6 L-9 -14 M0 -6 L9 -14' stroke='${C.green}' stroke-width='3.5' fill='none' stroke-linecap='round'/>`, 'OAKWOOD VALE', '0:20–0:50 · Lv 5')}
  ${routeNode(430, 252, C.ice, `<g stroke='${C.ice}' stroke-width='3' stroke-linecap='round'><path d='M0 -14 L0 14 M-12 -7 L12 7 M-12 7 L12 -7 M0 -14 L-4 -10 M0 -14 L4 -10 M0 14 L-4 10 M0 14 L4 10'/></g>`, 'FROSTSPIRE', '0:50–1:20 · Lv 8')}
  ${routeNode(610, 300, C.orange, `<path d='M0 14 L8 -4 L2 -2 L0 -16 L-2 -2 L-8 -4 Z' fill='${C.orange}'/>`, 'EMBERFANG', '1:20–1:50 · first boss')}
  ${routeNode(730, 200, C.violet, `<circle cx='0' cy='0' r='13' fill='none' stroke='${C.violet}' stroke-width='3.5'/><circle cx='0' cy='0' r='6' fill='${C.violet}' opacity='0.5'/>`, 'SHATTERED ISLES', '1:50–2:00 · endgame', 'end')}
`,
  ),
);

/* ------------------------------------------------------------------ */
/* 6+7. weapon cards — tier-list inline images                         */
/* ------------------------------------------------------------------ */
const weaponCard = (tier, tierColor, name, spec, dps, dpsMax, dpsLabel, passive, icon) => svgDoc(`
  <rect x='30' y='30' width='740' height='390' rx='18' fill='#10141c' stroke='${tierColor}' stroke-width='2' opacity='0.98'/>
  <rect x='30' y='30' width='740' height='390' rx='18' fill='none' stroke='${tierColor}' stroke-width='1' opacity='0.35' transform='translate(3 3)'/>
  <g transform='translate(170 225)'>${icon}</g>
  <rect x='330' y='96' width='96' height='34' rx='17' fill='${tierColor}' opacity='0.2'/>
  <text x='378' y='119' text-anchor='middle' ${FONT} font-size='17' font-weight='800' fill='${tierColor}' letter-spacing='2'>${tier} TIER</text>
  <text x='330' y='180' ${FONT} font-size='34' font-weight='800' fill='${C.text}'>${name}</text>
  <text x='330' y='210' ${FONT} font-size='15' fill='${C.muted}' letter-spacing='2'>${spec}</text>
  <text x='330' y='268' ${FONT} font-size='13' font-weight='700' fill='${C.muted}' letter-spacing='2'>${dpsLabel}</text>
  <rect x='330' y='282' width='380' height='14' rx='7' fill='#262d3a'/>
  <rect x='330' y='282' width='${Math.round((dps / dpsMax) * 380)}' height='14' rx='7' fill='url(#dpsGrad)'/>
  <text x='330' y='340' ${FONT} font-size='14' fill='${C.text}'>${passive}</text>
  <text x='330' y='384' ${FONT} font-size='11' fill='${C.muted}' letter-spacing='2'>ANVIL QUEST · DEMO WEAPON CARD</text>
  <defs><linearGradient id='dpsGrad' x1='0' y1='0' x2='1' y2='0'>
    <stop offset='0%' stop-color='${tierColor}' stop-opacity='0.7'/>
    <stop offset='100%' stop-color='${tierColor}'/>
  </linearGradient></defs>
`);

const voidforgeIcon = `
  <g>
    <path d='M0 -130 L14 -96 L14 30 L0 52 L-14 30 L-14 -96 Z' fill='url(#bladeGrad)' stroke='${C.violetDeep}' stroke-width='3'/>
    <line x1='0' y1='-122' x2='0' y2='42' stroke='#d8b4fe' stroke-width='3' opacity='0.7'/>
    <rect x='-34' y='52' width='68' height='13' rx='6' fill='${C.gold}'/>
    <rect x='-8' y='65' width='16' height='46' rx='5' fill='#44403c'/>
    <circle cx='0' cy='120' r='9' fill='${C.gold}'/>
  </g>
  <defs><linearGradient id='bladeGrad' x1='0' y1='0' x2='1' y2='0'>
    <stop offset='0%' stop-color='#a78bfa'/><stop offset='100%' stop-color='#6d28d9'/>
  </linearGradient></defs>`;

const frostpikeIcon = `
  <g>
    <rect x='-7' y='-70' width='14' height='190' rx='6' fill='#334155'/>
    <path d='M0 -140 L18 -108 L0 -78 L-18 -108 Z' fill='url(#crystalGrad)' stroke='#0ea5e9' stroke-width='3'/>
    <path d='M0 -122 L7 -108 L0 -94 L-7 -108 Z' fill='#e0f2fe' opacity='0.85'/>
    <path d='M-7 -88 L-26 -78 L-7 -70 Z' fill='#7dd3fc'/>
    <path d='M7 -88 L26 -78 L7 -70 Z' fill='#7dd3fc'/>
    <circle cx='0' cy='132' r='9' fill='#334155'/>
  </g>
  <defs><linearGradient id='crystalGrad' x1='0' y1='0' x2='0' y2='1'>
    <stop offset='0%' stop-color='#bae6fd'/><stop offset='100%' stop-color='#38bdf8'/>
  </linearGradient></defs>`;

const weaponVoidforge = weaponCard(
  'S',
  C.gold,
  'VOIDFORGE BLADE',
  'WARRIOR · GREATSWORD',
  145,
  160,
  'SUSTAINED DPS 145',
  'Passive — every 4th hit deals 300% damage',
  voidforgeIcon,
);

const weaponFrostpike = weaponCard(
  'A',
  C.teal,
  'FROSTPIKE STAFF',
  'MAGE · ICE SPEC',
  115,
  160,
  'DPS 90 · 115 VS ICE-WEAK',
  'Freeze utility — trivializes several bosses',
  frostpikeIcon,
);

/* ------------------------------------------------------------------ */
/* 8. emberfang-arena — Ashen Keep overhead map                        */
/* ------------------------------------------------------------------ */
const emberfangArena = svgDoc(
  frame(
    'ASHEN KEEP',
    'EMBERFANG ARENA — OVERHEAD VIEW',
    `
  <g stroke='#1a1410' stroke-width='1'>
    ${Array.from({ length: 15 }, (_, i) => `<line x1='${i * 57 + 28}' y1='0' x2='${i * 57 + 28}' y2='${H}'/>`).join('')}
    ${Array.from({ length: 9 }, (_, i) => `<line x1='0' y1='${i * 56 + 22}' x2='${W}' y2='${i * 56 + 22}'/>`).join('')}
  </g>
  <rect x='256' y='104' width='338' height='270' rx='24' fill='#221711' stroke='#43291a' stroke-width='3'/>
  <rect x='256' y='104' width='338' height='270' rx='24' fill='none' stroke='${C.orange}' stroke-width='9'/>
  <g opacity='0.85'>
    <circle cx='336' cy='250' r='28' fill='none' stroke='${C.red}' stroke-width='4'/>
    <circle cx='336' cy='250' r='16' fill='${C.red}' opacity='0.28'/>
    <circle cx='516' cy='278' r='24' fill='none' stroke='${C.red}' stroke-width='4'/>
    <circle cx='516' cy='278' r='13' fill='${C.red}' opacity='0.28'/>
    <circle cx='416' cy='330' r='22' fill='none' stroke='${C.red}' stroke-width='4'/>
    <circle cx='416' cy='330' r='12' fill='${C.red}' opacity='0.28'/>
  </g>
  <g>
    <circle cx='424' cy='192' r='32' fill='${C.amber}' opacity='0.18'/>
    <path d='M424 170 L436 196 L428 193 L424 210 L420 193 L412 196 Z' fill='${C.gold}' stroke='#b45309' stroke-width='2'/>
    <text x='424' y='236' text-anchor='middle' ${FONT} font-size='13' font-weight='700' fill='${C.text}' letter-spacing='2'>EMBERFANG</text>
  </g>
  <path d='M420 384 Q556 352 548 254 Q542 198 478 180' fill='none' stroke='${C.green}' stroke-width='5' stroke-dasharray='10 8' stroke-linecap='round'/>
  <path d='M478 180 l-4 16 M478 180 l16 6' stroke='${C.green}' stroke-width='5' stroke-linecap='round' fill='none'/>
  <text x='420' y='406' text-anchor='middle' ${FONT} font-size='12' font-weight='700' fill='${C.green}'>ENTRANCE</text>
  <g>
    <rect x='36' y='120' width='208' height='120' rx='12' fill='${C.panel}' stroke='${C.panelStroke}'/>
    <text x='56' y='148' ${FONT} font-size='12' font-weight='700' fill='${C.muted}' letter-spacing='2'>LEGEND</text>
    <line x1='56' y1='170' x2='92' y2='170' stroke='${C.green}' stroke-width='4' stroke-dasharray='8 6'/>
    <text x='102' y='174' ${FONT} font-size='12' fill='${C.text}'>safe route — strafe right</text>
    <circle cx='66' cy='196' r='9' fill='none' stroke='${C.red}' stroke-width='3'/>
    <text x='102' y='200' ${FONT} font-size='12' fill='${C.text}'>fire rings — jump, not dash</text>
    <path d='M74 216 L80 228 L76.5 226 L74 236 L71.5 226 L68 228 Z' fill='${C.gold}'/>
    <text x='102' y='228' ${FONT} font-size='12' fill='${C.text}'>Emberfang · 4,200 HP</text>
  </g>
  <text x='660' y='432' text-anchor='middle' ${FONT} font-size='12' fill='${C.muted}'>rings expand every 1.2s — sets of three</text>
`,
  ),
);

/* ------------------------------------------------------------------ */
/* 9. emberfang-mechanics — bolt fan arc + phase timeline              */
/* ------------------------------------------------------------------ */
const emberfangMechanics = svgDoc(
  frame(
    'EMBERFANG',
    'MECHANICS AT A GLANCE',
    `
  <g>
    <rect x='36' y='100' width='352' height='300' rx='14' fill='${C.panel}' stroke='${C.panelStroke}'/>
    <text x='212' y='132' text-anchor='middle' ${FONT} font-size='15' font-weight='700' fill='${C.amber}' letter-spacing='2'>FIRE BOLT VOLLEY · 3-BOLT FAN</text>
    <text x='212' y='154' text-anchor='middle' ${FONT} font-size='12' fill='${C.muted}'>180 damage per bolt · 5 bolts in enrage</text>
    <path d='M152 268 L312 196 L312 340 Z' fill='${C.red}' opacity='0.2'/>
    <g stroke='${C.red}' stroke-width='4' stroke-linecap='round' fill='none'>
      <path d='M152 268 L306 202'/>
      <path d='M152 268 L310 268'/>
      <path d='M152 268 L306 334'/>
    </g>
    <circle cx='152' cy='268' r='26' fill='${C.orange}' stroke='#7c2d12' stroke-width='3'/>
    <text x='152' y='273' text-anchor='middle' ${FONT} font-size='11' font-weight='800' fill='#fff7ed'>BOSS</text>
    <g fill='${C.red}'>
      <circle cx='312' cy='200' r='6'/>
      <circle cx='316' cy='268' r='6'/>
      <circle cx='312' cy='336' r='6'/>
    </g>
    <text x='226' y='186' text-anchor='middle' ${FONT} font-size='13' font-weight='700' fill='${C.red}'>DANGER CONE</text>
    <g>
      <circle cx='176' cy='348' r='7' fill='${C.ice}'/>
      <path d='M196 348 L330 348' stroke='${C.green}' stroke-width='5' stroke-linecap='round'/>
      <path d='M330 348 l-14 -8 M330 348 l-14 8' stroke='${C.green}' stroke-width='5' stroke-linecap='round' fill='none'/>
      <text x='212' y='374' text-anchor='middle' ${FONT} font-size='13' font-weight='700' fill='${C.green}'>STRAFE RIGHT</text>
    </g>
  </g>
  <g>
    <rect x='412' y='100' width='352' height='300' rx='14' fill='${C.panel}' stroke='${C.panelStroke}'/>
    <text x='588' y='132' text-anchor='middle' ${FONT} font-size='15' font-weight='700' fill='${C.amber}' letter-spacing='2'>PHASES · BY BOSS HP</text>
    ${[['100%', 452], ['66%', 544], ['33%', 634], ['0%', 724]]
      .map(
        ([t, x]) => `<line x1='${x}' y1='204' x2='${x}' y2='246' stroke='${C.muted}' stroke-width='2'/>
      <text x='${x}' y='196' text-anchor='middle' ${FONT} font-size='11' fill='${C.muted}'>${t}</text>`,
      )
      .join('')}
    <rect x='452' y='214' width='92' height='22' rx='4' fill='${C.amber}' opacity='0.85'/>
    <rect x='546' y='214' width='88' height='22' rx='4' fill='${C.orange}' opacity='0.85'/>
    <rect x='636' y='214' width='88' height='22' rx='4' fill='${C.red}' opacity='0.85'/>
    <text x='498' y='262' text-anchor='middle' ${FONT} font-size='11' font-weight='800' fill='${C.gold}'>PHASE 1</text>
    <text x='498' y='280' text-anchor='middle' ${FONT} font-size='11' fill='${C.text}'>fire bolt volley</text>
    <text x='590' y='262' text-anchor='middle' ${FONT} font-size='11' font-weight='800' fill='${C.orange}'>PHASE 2</text>
    <text x='590' y='280' text-anchor='middle' ${FONT} font-size='11' fill='${C.text}'>burning rings — jump</text>
    <text x='680' y='262' text-anchor='middle' ${FONT} font-size='11' font-weight='800' fill='${C.red}'>PHASE 3</text>
    <text x='680' y='280' text-anchor='middle' ${FONT} font-size='11' fill='${C.text}'>inferno enrage</text>
    <text x='588' y='330' text-anchor='middle' ${FONT} font-size='13' fill='${C.text}'>rings expand every 1.2s · 0.4s jump window</text>
    <text x='588' y='352' text-anchor='middle' ${FONT} font-size='13' fill='${C.muted}'>enrage: +30% speed · 5-bolt volleys</text>
  </g>
`,
  ),
);

/* ------------------------------------------------------------------ */

const outputs = [
  ['src/assets/covers/codes-cover.png', codesCover],
  ['src/assets/gallery/stormcaller-arena.png', stormcallerArena],
  ['src/assets/gallery/stormcaller-mechanics.png', stormcallerMechanics],
  ['src/assets/gallery/emberfang-arena.png', emberfangArena],
  ['src/assets/gallery/emberfang-mechanics.png', emberfangMechanics],
  ['src/assets/gallery/beginner-class-picks.png', beginnerClasses],
  ['src/assets/gallery/beginner-route.png', beginnerRoute],
  ['public/images/articles/weapon-voidforge.png', weaponVoidforge],
  ['public/images/articles/weapon-frostpike.png', weaponFrostpike],
];

for (const [rel, svg] of outputs) {
  const out = join(root, rel);
  mkdirSync(dirname(out), { recursive: true });
  await sharp(Buffer.from(svg)).png().toFile(out);
  console.log('wrote', rel);
}
