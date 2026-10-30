import DOMPurify from '/node_modules/dompurify/dist/purify.es.mjs';

// Same synchronous contract as TauriTavern's getContext().messageFormatter.
// The formatter is a fixture; the sanitizer is the real DOMPurify distribution.
export function createFixtureFormatter() {
    const hooks = [];
    return {
        stage: { AFTER_REGEX: 'afterRegex' }, order: { LATEST: 100 }, hooks,
        addHook(fn, options) { hooks.push({ fn, ...options }); },
        format(raw, context, rules) {
            let value = raw;
            for (const rule of rules || []) {
                if (rule.disabled || rule.promptOnly || !rule.placement?.includes(context.isUser ? 1 : 2)) continue;
                const parsed = rule.findRegex.match(/^\/(.*)\/([a-z]*)$/s);
                const regex = parsed ? new RegExp(parsed[1], parsed[2]) : new RegExp(rule.findRegex, 'g');
                value = value.replace(regex, rule.replaceString);
            }
            for (const hook of hooks.slice().sort((a, b) => a.order - b.order)) value = hook.fn(value, context);
            return DOMPurify.sanitize(value);
        },
    };
}
