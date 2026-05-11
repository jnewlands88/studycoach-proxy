exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  let body;
  try { body = JSON.parse(event.body); }
  catch(e) { return { statusCode: 400, body: JSON.stringify({ error: { message: 'Invalid request' } }) }; }

  const { apiKey, messages, model, max_tokens } = body;
  if (!apiKey || !apiKey.startsWith('sk-ant-'))
    return { statusCode: 400, body: JSON.stringify({ error: { message: 'Invalid API key' } }) };

  // Force all images to image/jpeg (canvas always outputs jpeg)
  const sanitized = (messages||[]).map(msg => {
    if (!Array.isArray(msg.content)) return msg;
    return { ...msg, content: msg.content.map(block => {
      if (block.type === 'image' && block.source?.type === 'base64')
        return { ...block, source: { ...block.source, media_type: 'image/jpeg' } };
      return block;
    })};
  });

  let response;
  try {
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: model || 'claude-sonnet-4-20250514', max_tokens: max_tokens || 6000, messages: sanitized })
    });
  } catch(err) {
    return { statusCode: 502, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: { message: 'Could not reach Anthropic: ' + err.message } }) };
  }

  const text = await response.text();
  let data;
  try { data = JSON.parse(text); }
  catch(e) { return { statusCode: 500, headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ error: { message: 'Bad response from Anthropic: ' + text.slice(0,200) } }) }; }

  if (!response.ok) return { statusCode: response.status, headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ error: { message: 'Anthropic error (' + response.status + '): ' + (data?.error?.message || JSON.stringify(data)) } }) };

  return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) };
};
