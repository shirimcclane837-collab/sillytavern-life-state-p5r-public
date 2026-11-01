import DOMPurify from '/node_modules/dompurify/dist/purify.es.mjs';

// Same synchronous contract as TauriTavern's getContext().messageFormatter.
// The registry is a fixture. Markdown and sanitization use the real libraries,
// in the order used by the host (including its quote markup and encode-tags mode).
export function createFixtureFormatter() {
    const hooks = [];
    const stage = { BEFORE_REGEX: 'beforeRegex', AFTER_REGEX: 'afterRegex', AFTER_MARKDOWN: 'afterMarkdown' };
    const converter = new window.showdown.Converter({ literalMidWordUnderscores: true, simpleLineBreaks: true, tables: true });
    const run = (name, text, context) => hooks.filter(hook => hook.stage === name)
        .sort((a, b) => a.order - b.order).reduce((text, hook) => hook.fn(text, { ...context, stage: name }), text);
    return {
        stage, order: { LATEST: 100 }, hooks,
        addHook(fn, options) { hooks.push({ fn, ...options }); },
        format(raw, context, rules) {
            let value = context.isSystem ? raw : run(stage.BEFORE_REGEX, raw, context);
            for (const rule of rules || []) {
                if (rule.disabled || rule.promptOnly || !rule.placement?.includes(context.isUser ? 1 : 2)) continue;
                const parsed = rule.findRegex.match(/^\/(.*)\/([a-z]*)$/s);
                const regex = parsed ? new RegExp(parsed[1], parsed[2]) : new RegExp(rule.findRegex, 'g');
                value = value.replace(regex, rule.replaceString);
            }
            if (!context.isSystem) {
                value = run(stage.AFTER_REGEX, value, context);
                if (window.fixtureEncodeTags) value = value.replaceAll('<', '&lt;').replaceAll('>', '&gt;');
                value = value.replace(/<([^>]+)>/g, (_, content) => '<' + content.replace(/"/g, '\ufffe') + '>')
                    .replace(/<style>[\s\S]*?<\/style>|```[\s\S]*?```|~~~[\s\S]*?~~~|``[\s\S]*?``|`[\s\S]*?`|(".*?")/gim,
                        (match, quoted) => quoted ? `<q>${quoted}</q>` : match)
                    .replace(/\ufffe/g, '"');
                value = converter.makeHtml(value);
                value = run(stage.AFTER_MARKDOWN, value, context);
            }
            return DOMPurify.sanitize(value);
        },
    };
}
