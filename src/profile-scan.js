// These overrides belong to one utility request, never to the user's preset.
const optionalGenerationFields = [
    'json_schema', 'response_format', 'responseSchema', 'responseJsonSchema', 'responseMimeType',
    'tools', 'tool_choice', 'parallel_tool_calls', 'functions', 'function_call',
    'temperature', 'top_p', 'top_k', 'min_p', 'top_a', 'frequency_penalty', 'presence_penalty',
    'repetition_penalty', 'logit_bias', 'logprobs', 'top_logprobs', 'stop', 'seed', 'n',
    'reasoning_effort', 'thinking_budget', 'verbosity', 'request_image_resolution', 'request_image_aspect_ratio',
];
let requestSequence = 0;

function textParts(message) {
    if (typeof message?.content === 'string') return [message.content];
    return Array.isArray(message?.content) ? message.content.map(part => part?.text || '') : [];
}

export async function requestProfileScan(context, source, { compatibility = false, systemPrompt, schema, generate } = {}) {
    const settings = context.chatCompletionSettings || {};
    const google = ['vertexai', 'makersuite'].includes(settings.chat_completion_source);
    const configuredLength = Number(context.mainApi && context.mainApi !== 'openai' ? context.amountGen : settings.openai_max_tokens);
    const responseLength = Number.isFinite(configuredLength) && configuredLength > 0
        ? Math.min(8192, Math.max(1, Math.floor(configuredLength))) : 8192;
    const event = context.eventTypes?.CHAT_COMPLETION_SETTINGS_READY;
    const bus = context.eventSource;
    const canScope = compatibility && event && typeof bus?.on === 'function' && typeof bus?.removeListener === 'function';
    const requestId = globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${++requestSequence}-${Math.random().toString(36).slice(2)}`;
    const marker = canScope ? `\n[life-state-scan:${requestId}]` : '';
    const instruction = String(systemPrompt || '');
    const params = {
        // A single user message also works with providers that reject a
        // separate system instruction in auxiliary requests.
        systemPrompt: compatibility ? '' : instruction,
        prompt: compatibility ? `${instruction}\n\n── 待扫描角色资料 ──\n${String(source || '')}${marker}` : String(source || ''),
        trimNames: false,
        responseLength,
        // Vertex's responseSchema accepts a different schema dialect. Keep
        // the same strict local validation without sending OpenAI's schema.
        ...(!compatibility && !google ? { jsonSchema: schema } : {}),
    };
    const sanitize = data => {
        if (!Array.isArray(data?.messages) || !data.messages.some(message => textParts(message).some(text => text.includes(marker)))) return;
        for (const message of data.messages) {
            if (typeof message.content === 'string') message.content = message.content.replace(marker, '');
            else if (Array.isArray(message.content)) for (const part of message.content) {
                if (typeof part?.text === 'string') part.text = part.text.replace(marker, '');
            }
        }
        for (const key of optionalGenerationFields) delete data[key];
        data.max_tokens = responseLength;
        data.enable_web_search = false;
        data.request_images = false;
        data.include_reasoning = false;
    };
    if (canScope) bus.on(event, sanitize);
    try {
        return await (generate || (params => context.generateRaw(params)))(params);
    } finally {
        if (canScope) bus.removeListener(event, sanitize);
    }
}
