// Hide remaining protocol output after Markdown. Keep its text in the rendered
// result as well as in the saved message: hiding must never become data removal.
const protocolTags = new Set(['life_state', 'state_handoff', 'story_time']);
const formatterHooks = new WeakMap();
const marker = 'data-life-state-output-hidden';

export function stateBlockRanges(text, { encoded = false } = {}) {
    const ranges = [];
    const tags = /<\/?([a-z][\w:-]*)\b(?:[^>"']|"[^"]*"|'[^']*')*>|&lt;\/?(life_state|state_handoff|story_time)\b(?:(?!&gt;)[\s\S])*&gt;/gi;
    let open = null, literal = null, depth = 0;
    for (const match of String(text).matchAll(tags)) {
        const escaped = Boolean(match[2]);
        if (escaped && !encoded) continue;
        const name = (match[1] || match[2]).toLowerCase(), closing = /^(?:<|&lt;)\//i.test(match[0]);
        if (literal) {
            if (!escaped && name === literal) {
                depth += closing ? -1 : 1;
                if (!depth) literal = null;
            }
            continue;
        }
        if (!open && !escaped && !closing && (['script', 'style', 'textarea'].includes(name)
            || (name === 'span' && match[0].includes(marker)))) { literal = name; depth = 1; continue; }
        if (!protocolTags.has(name)) continue;
        if (!open && !closing) open = { name, start: match.index, contentStart: match.index + match[0].length };
        else if (open?.name === name && closing) {
            ranges.push({ ...open, contentEnd: match.index, end: match.index + match[0].length });
            open = null;
        }
    }
    return ranges;
}

export function hideDisplayStateBlocks(text) {
    let result = String(text);
    const visibleTag = value => value.startsWith('<')
        ? value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') : value;
    for (const range of stateBlockRanges(result, { encoded: true }).reverse()) {
        // Keep the protocol delimiters as text too. The host sanitizer would
        // otherwise discard these unknown HTML tags, leaving only their JSON.
        const content = visibleTag(result.slice(range.start, range.contentStart))
            + result.slice(range.contentStart, range.contentEnd)
            + visibleTag(result.slice(range.contentEnd, range.end));
        result = result.slice(0, range.start)
            + `<span ${marker} hidden style="display:none!important">${content}</span>`
            + result.slice(range.end);
    }
    return result;
}

function acquireFormatter(formatter) {
    let entry = formatterHooks.get(formatter);
    if (!entry) {
        entry = { owners: new Set() };
        // TauriTavern's registry has no removeHook. One inert hook per registry
        // avoids both accumulating callbacks and removing another extension's hook.
        formatter.addHook((text, context) => {
            if (!entry.owners.size || context.isUser || context.isSystem || context.isReasoning
                || !Number.isInteger(Number(context.messageId)) || context.messageId == null || context.messageId < 0) return text;
            return hideDisplayStateBlocks(text);
        }, { stage: formatter.stage.AFTER_MARKDOWN, order: formatter.order?.LATEST ?? 100 });
        formatterHooks.set(formatter, entry);
    }
    const owner = {};
    entry.owners.add(owner);
    return () => entry.owners.delete(owner);
}

function removeLegacyRule(context, rule, document) {
    const settings = context.extensionSettings;
    if (!settings || settings.regex == null) return false;
    if (!Array.isArray(settings.regex)) throw new Error('酒馆正则列表格式异常，未修改任何规则');
    // A user may have edited the old rule. Preserve it unless its actual
    // transformation still exactly matches the rule installed by this extension.
    const matches = item => item?.id === rule.id && item.findRegex === rule.findRegex
        && item.replaceString === rule.replaceString && item.markdownOnly === true
        && item.promptOnly === false && JSON.stringify(item.placement) === JSON.stringify(rule.placement)
        && JSON.stringify(item.trimStrings ?? []) === '[]' && (item.runOnEdit ?? true) === true
        && (item.substituteRegex ?? 0) === 0 && item.minDepth == null && item.maxDepth == null;
    if (!settings.regex.some(matches)) return false;
    if (typeof context.saveSettingsDebounced !== 'function') throw new Error('无法保存旧隐藏规则的迁移，请重新启用扩展');
    settings.regex = settings.regex.filter(item => !matches(item));
    context.saveSettingsDebounced();
    // Do not emit CHAT_CHANGED merely to refresh a settings list.
    document.getElementById(rule.id)?.closest('#saved_regex_scripts > *')?.remove();
    return true;
}

async function refreshRendered(context, refresh, document) {
    if (!refresh) return;
    for (const row of document.querySelectorAll('#chat .mes[mesid]')) {
        const id = Number(row.getAttribute('mesid')), message = context.chat?.[id];
        if (!message || message.is_user || message.is_system || row.querySelector('.edit_textarea')) continue;
        if (stateBlockRanges(message.mes || '').length) await refresh(id);
    }
}

// Older SillyTavern versions have no formatting hooks. Match protocol payloads
// against the already-rendered message, then hide only that exact DOM range.
// A transformed widget that no longer contains the payload is left untouched.
function observeRenderedOutput(document, getContext) {
    const win = document.defaultView;
    const hidden = new Set();
    let disposed = false, scheduled = false;
    const compact = value => value.replace(/\s/g, '');

    function hideRange(root, needle) {
        const offsets = [];
        let text = '';
        const walker = document.createTreeWalker(root, win.NodeFilter.SHOW_TEXT, {
            acceptNode: node => node.parentElement.closest(`[${marker}],script,style,textarea,[contenteditable=true]`)
                ? win.NodeFilter.FILTER_REJECT : win.NodeFilter.FILTER_ACCEPT,
        });
        for (let node; (node = walker.nextNode());) {
            for (let index = 0; index < node.data.length; index++) {
                if (/\s/.test(node.data[index])) continue;
                text += node.data[index]; offsets.push({ node, index });
            }
        }
        const start = text.lastIndexOf(needle);
        // Legacy hosts only hide a matching footer. Never take matching JSON
        // out of a regex-generated widget or out of the middle of prose.
        if (!needle || start < 0 || start + needle.length !== text.length) return false;
        const first = offsets[start], last = offsets[start + needle.length - 1];
        // Legacy hosts cannot distinguish a custom regex widget from Markdown.
        // Restrict the fallback to plain text / unadorned paragraphs. In
        // particular, never extract JSON from a user's details, pre or article.
        const plain = node => {
            for (let element = node.parentElement; element !== root; element = element.parentElement) {
                if (!element || !['P', 'Q', 'EM', 'STRONG', 'BR'].includes(element.tagName) || element.attributes.length) return false;
            }
            return true;
        };
        if (!plain(first.node) || !plain(last.node)) return false;
        const range = document.createRange();
        range.setStart(first.node, first.index); range.setEnd(last.node, last.index + 1);
        const span = document.createElement('span');
        span.setAttribute(marker, ''); span.hidden = true;
        span.style.setProperty('display', 'none', 'important');
        span.append(range.extractContents()); range.insertNode(span);
        hidden.add(span);
        return true;
    }

    function scan() {
        scheduled = false;
        if (disposed) return;
        observer.disconnect();
        try {
            const context = getContext();
            for (const row of document.querySelectorAll('#chat .mes[mesid]')) {
                const message = context?.chat?.[Number(row.getAttribute('mesid'))];
                const root = row.querySelector('.mes_text');
                if (!message || message.is_user || message.is_system || !root || row.querySelector('.edit_textarea')) continue;
                const raw = String(message.mes || '');
                for (const range of stateBlockRanges(raw).reverse()) {
                    const tagged = compact(raw.slice(range.start, range.end));
                    const payload = compact(raw.slice(range.contentStart, range.contentEnd));
                    if (hideRange(root, tagged)) continue;
                    // Avoid concealing an unrelated occurrence of a short word
                    // such as "null" after a regex has already removed the block.
                    if (payload.length >= 24 && /^[\[{]/.test(payload)) hideRange(root, payload);
                }
            }
            for (const node of hidden) if (!node.isConnected) hidden.delete(node);
        } finally {
            if (!disposed) observer.observe(document.body, { childList: true, subtree: true, characterData: true });
        }
    }
    const observer = new win.MutationObserver(records => {
        if (scheduled || !records.some(record => record.target.nodeType === 1
            ? record.target.closest?.('#chat') || [...record.addedNodes].some(node => node.nodeType === 1 && (node.id === 'chat' || node.querySelector?.('#chat')))
            : record.target.parentElement?.closest('#chat'))) return;
        scheduled = true; win.queueMicrotask(scan);
    });
    scan();
    return {
        refresh: scan,
        dispose() {
            disposed = true; observer.disconnect();
            for (const span of hidden) if (span.isConnected) span.replaceWith(...span.childNodes);
            hidden.clear();
        },
    };
}

export function createOutputVisibility({ document, getContext, legacyRule }) {
    let release = null, fallback = null, disposed = false, installed = false;
    return {
        async connect(refresh) {
            if (disposed) return { ready: false };
            const context = getContext();
            const formatter = context?.messageFormatter;
            if (!installed) {
                if (typeof formatter?.addHook === 'function' && formatter.stage && 'AFTER_MARKDOWN' in formatter.stage) release = acquireFormatter(formatter);
                else fallback = observeRenderedOutput(document, getContext);
                installed = true;
            }
            const migrated = removeLegacyRule(context, legacyRule, document);
            await refreshRendered(context, refresh, document);
            fallback?.refresh();
            return { ready: true, migrated, mode: release ? 'after-markdown' : 'rendered-dom' };
        },
        dispose() {
            disposed = true; release?.(); fallback?.dispose();
            for (const span of document.querySelectorAll(`#chat span[${marker}]`)) span.replaceWith(...span.childNodes);
        },
    };
}
