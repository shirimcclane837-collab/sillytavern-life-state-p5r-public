// Preserve the engine's real controls, form state and delegated events while
// giving its legacy surfaces the same three physical layers as React controls.
const cards = '.ls-modern-need,.ls-character-profile-card,.ls-character-profile-setup,.ls-play-draft,.ls-play-combination-card,.ls-archive-card,.ls-workflow-card,.ls-settings-entry,.ls-effect-card,.ls-play-library-entry,.ls-play-option-explanation,.ls-auto-profile-control,[role=dialog]';

function unwrap(element) {
    const black = element.querySelector(':scope > .p5-layer-black');
    const content = black?.querySelector(':scope > .p5-layer-content');
    if (content) black.replaceWith(...content.childNodes);
    element.querySelector(':scope > .p5-layer-white')?.remove();
    element.classList.remove('p5-layered', 'p5-button', 'p5-card');
    delete element.dataset.p5Layered;
}

export function syncLayers(root) {
    if (!root) return;
    if (root.dataset.uiTheme !== 'p5r' || !root.classList.contains('ls-modern')) {
        for (const element of root.querySelectorAll('[data-p5-layered]')) unwrap(element);
        return;
    }
    const targets = [...root.querySelectorAll(`${cards},button,summary,.ls-pe-identity-copy,.ls-pe-choice-copy`)];
    for (const element of targets) {
        if (element.closest('[data-p5r-owned]') || element.closest('.p5-scene')
            || element.matches('.ls-toggle,.p5r-party-pause') || element.closest('.p5r-entry-art')) continue;
        if (element.closest('details:not([open])') && !element.closest('summary')) continue;
        if (element.querySelector(':scope > .p5-layer-black')) continue;
        if (!element.dataset.p5Layered) {
            const card = element.matches(cards) && element.tagName !== 'BUTTON';
            // Semantic CSS sets layout. Reading computed widths here would
            // force layout once per control in the large play library.
            element.classList.add('p5-layered', card ? 'p5-card' : 'p5-button');
            element.dataset.p5Layered = '';
        }
        const white = root.ownerDocument.createElement('span');
        white.className = 'p5-layer-white'; white.setAttribute('aria-hidden', 'true');
        const black = root.ownerDocument.createElement(element.tagName === 'BUTTON' || element.tagName === 'SPAN' || element.tagName === 'SUMMARY' ? 'span' : 'div');
        black.className = 'p5-layer-black';
        const content = root.ownerDocument.createElement(black.tagName.toLowerCase());
        content.className = 'p5-layer-content';
        content.append(...element.childNodes); black.append(content); element.append(white, black);
    }
}
