// Decorative theme artwork, independent of the characters stored in a chat.
export const PORTRAIT_KEY = 'life-state-p5r-party-icon-v1';
export const PORTRAITS = Object.freeze({
    ann: '高卷杏', makoto: '新岛真', futaba: '佐仓双叶', haru: '奥村春',
    hifumi: '东乡一二三', tae: '武见妙', sadayo: '川上贞代', chihaya: '御船千早',
    ichiko: '大宅一子', justine: '芮丝汀娜', caroline: '卡萝莉娜',
});
export const normalizePortrait = value => Object.hasOwn(PORTRAITS, value) ? value : 'futaba';
export const portraitUrl = name => new URL(`./assets/party/${normalizePortrait(name)}.png`, import.meta.url).href;
export const queenArtUrl = new URL('./assets/makoto-menu.png', import.meta.url).href;
export function loadPortrait(storage) {
    try { return normalizePortrait(storage?.getItem(PORTRAIT_KEY)); }
    catch { return 'futaba'; }
}
export const escapeText = text => String(text ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export function portraitMarkup(name, className = '') {
    return `<img class="p5r-portrait ${className}" src="${portraitUrl(name)}" alt="" aria-hidden="true" draggable="false">`;
}
export function portraitChoicesMarkup(selected) {
    return `<fieldset class="p5r-portrait-picker"><legend>Q 版怪盗图标</legend><p class="p5r-hint">选择悬浮入口和欢迎页使用的黑白图标。</p><div class="p5r-portrait-options">${Object.entries(PORTRAITS).map(([id, name]) => `<button type="button" data-action="p5r-portrait" data-portrait="${id}" aria-pressed="${selected === id}" aria-label="${name}">${portraitMarkup(id)}<span>${name}</span></button>`).join('')}</div></fieldset>`;
}
export function cutoutTitle(text) {
    return `<span class="p5r-cutout-title" data-p5r-component="ransom" data-text="${escapeText(text)}">${escapeText(text)}</span>`;
}
export function partyStripMarkup(className = '') {
    const members = Object.entries(PORTRAITS).map(([id, name]) => `<span class="p5r-party-member" role="img" aria-label="${name}">${portraitMarkup(id)}</span>`).join('');
    const group = duplicate => `<div class="p5r-party-group"${duplicate ? ' aria-hidden="true"' : ''}>${members}</div>`;
    return `<div class="p5r-party-strip ${className}"><div class="p5r-party-window" tabindex="0" role="group" aria-label="女性角色图标，左右拖动或使用方向键浏览" title="左右拖动浏览 · 悬停暂停"><div class="p5r-party-track">${group(true)}${group(false)}${group(true)}</div></div><button class="p5r-party-pause" type="button" aria-label="暂停头像自动滚动" title="暂停自动滚动" aria-pressed="false"><span aria-hidden="true">Ⅱ</span></button></div>`;
}
export function pageHeroMarkup(props) {
    return `<header class="p5r-page-hero" data-p5r-component="hero" data-props="${escapeText(JSON.stringify(props))}"></header>`;
}
