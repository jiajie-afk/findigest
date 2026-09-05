import {
  NEWS_BRIEF_SYSTEM,
  buildNewsBriefPrompt,
  clipText,
  parseNewsBrief,
} from './newsBriefCore.js'

export function resolveNewsLlmConfig() {
  const mimo = String(process.env.MIMO_API_KEY || '').trim()
  const deepseek = String(process.env.DEEPSEEK_API_KEY || '').trim()
  const generic = String(process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || '').trim()
  if (generic) {
    return {
      apiKey: generic,
      baseUrl: String(process.env.LLM_BASE_URL || process.env.OPENAI_BASE_URL || 'https://api.deepseek.com/v1').replace(
        /\/$/,
        '',
      ),
      model: process.env.LLM_MODEL || process.env.OPENAI_MODEL || 'deepseek-chat',
    }
  }
  if (deepseek) {
    return {
      apiKey: deepseek,
      baseUrl: String(process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1').replace(/\/$/, ''),
      model: process.env.DEEPSEEK_MODEL || process.env.LLM_MODEL || 'deepseek-chat',
    }
  }
  if (mimo) {
    return {
      apiKey: mimo,
      baseUrl: String(process.env.MIMO_BASE_URL || 'https://token-plan-cn.xiaomimimo.com/v1').replace(/\/$/, ''),
      model: process.env.MIMO_MODEL || 'mimo-v2.5',
    }
  }
  return null
}

export async function callNewsLlm(item, cfg) {
  const url = `${cfg.baseUrl.replace(/\/$/, '')}/chat/completions`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cfg.apiKey}`,
      'api-key': cfg.apiKey,
    },
    body: JSON.stringify({
      model: cfg.model || 'deepseek-chat',
      temperature: 0.25,
      max_tokens: 1400,
      messages: [
        { role: 'system', content: NEWS_BRIEF_SYSTEM },
        { role: 'user', content: buildNewsBriefPrompt(item) },
      ],
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`LLM ${res.status}: ${text.slice(0, 160)}`)
  }
  const data = await res.json()
  const choice = data.choices?.[0]?.message || {}
  const reasoning = String(choice.reasoning_content || '').trim()
  const content = String(choice.content || '').trim()
  const brief = parseNewsBrief(content)
  if (reasoning && !brief.thinking) brief.thinking = clipText(reasoning, 900)
  if (!brief.facts) throw new Error('模型没有返回可用摘要')
  return {
    brief,
    usage: data.usage || null,
    model: cfg.model || '',
  }
}
