// Decorative theme artwork, independent of the characters stored in a chat.
export const PORTRAIT_KEY = 'life-state-p5r-party-icon-v1';
export const PORTRAITS = Object.freeze({
    ann: '高卷杏', makoto: '新岛真', futaba: '佐仓双叶', haru: '奥村春',
    hifumi: '东乡一二三', tae: '武见妙', sadayo: '川上贞代', chihaya: '御船千早',
    ichiko: '大宅一子', justine: '芮丝汀娜', caroline: '卡萝莉娜',
});
export const normalizePortrait = value => Object.hasOwn(PORTRAITS, value) ? value : 'futaba';
export const portraitUrl = name => new URL(`./assets/party/${normalizePortrait(name)}.png`, import.meta.url).href;
export function loadPortrait(storage) {
    try { return normalizePortrait(storage?.getItem(PORTRAIT_KEY)); }
    catch { return 'futaba'; }
}
export const escapeText = text => String(text ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export function portraitMarkup(name, className = '') {
    return `<img class="p5r-portrait ${className}" src="${portraitUrl(name)}" alt="" aria-hidden="true" draggable="false">`;
}
export function portraitChoicesMarkup(selected) {
    return `<fieldset class="p5r-portrait-picker"><legend>Q 版怪盗图标</legend><p class="p5r-hint">选择悬浮入口和转场使用的黑白图标。</p><div class="p5r-portrait-options">${Object.entries(PORTRAITS).map(([id, name]) => `<button type="button" data-action="p5r-portrait" data-portrait="${id}" aria-pressed="${selected === id}" aria-label="${name}">${portraitMarkup(id)}<span>${name}</span></button>`).join('')}</div></fieldset>`;
}
export function cutoutTitle(text) {
    return `<span class="p5r-cutout-title" aria-label="${escapeText(text)}">${Array.from(text).map((letter, index) => `<span aria-hidden="true" style="--letter-turn:${[-5,4,-2,6,-3,2][index % 6]}deg">${escapeText(letter)}</span>`).join('')}</span>`;
}
export function partyStripMarkup(className = '') {
    return `<div class="p5r-party-strip ${className}" aria-hidden="true">${['justine', 'ann', 'makoto', 'futaba', 'haru', 'hifumi', 'tae'].map(name => portraitMarkup(name)).join('')}</div>`;
}
export function pageHeroMarkup({ title, kicker, subtitle, portrait, number }) {
    return `<header class="p5r-page-hero"><div class="p5r-hero-copy"><span class="p5r-eyebrow">${escapeText(kicker)}</span><h2>${cutoutTitle(title)}</h2><p>${escapeText(subtitle)}</p></div><span class="p5r-hero-number" aria-hidden="true">${escapeText(number)}</span><div class="p5r-hero-art" aria-hidden="true">${portraitMarkup(portrait)}<span>TAKE YOUR TIME</span></div></header>`;
}
