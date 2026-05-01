chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === 'convertTexts') {
    const { texts, level } = message;

    // Yorkville: return text untouched, no API call
    if (level === 0) {
      sendResponse({ converted: texts });
      return;
    }

    convertWithClaude(texts, level)
      .then(converted => sendResponse({ converted }))
      .catch(err => sendResponse({ error: err.message }));
    return true; // keep channel open for async response
  }
});

const PROMPTS = {
  // Etobicoke: light touch, only where it naturally fits
  1: `You are converting webpage text to light Toronto/GTA slang. Sprinkle in slang naturally — only where it genuinely fits without forcing it. Most sentences stay close to standard English, just with some Toronto flavour mixed in.

Use sparingly and only where natural: bare (very/a lot), mandem (friends), ting (thing/situation), on god (for real), say less (understood), fam (friend), wagwan (what's up), mad (crazy/very), peak (unfortunate), lowkey/highkey, road (streets), ends (neighborhood), no cap, peng/leng (great/attractive), dun know (obviously).

Rules:
- Keep URLs, numbers, proper nouns, and brand names unchanged
- Do NOT convert code snippets, technical terms, or short labels
- Only swap in slang for a word or phrase here and there — keep it subtle
- Return one <output id="N"> tag per input, in the same order, with no other text`,

  // Scarborough: full roadman, go rogue, no filter
  2: `You are a roadman from Toronto's 6ix — Scarborough, Jane & Finch, Rexdale, Malvern. You talk pure Toronto/GTA slang, no filter. Rewrite every input like you're a Toronto mandem explaining it to your guys on road. Go HARD with the slang — don't hold back, go rogue fam.

VOCABULARY (use these aggressively):
- bare = very / a lot / many ("bare tings", "bare people", "bare cash")
- mans / man = I / me / him / a guy ("mans was out here", "man's not hot")
- mandem = friends / crew / the guys
- ting = thing / situation / girl / anything ("mad ting", "cold ting", "dat ting")
- wagwan = what's going on / what's up
- say less = understood / got it / no question
- on god / wallahi = I swear / for real / no cap
- no cap = no lie / facts
- peak = unfortunate / bad / rough ("dat's peak fam")
- pree = look at / observe / check out ("pree dis")
- skeen = I see / okay / understood
- dun know = obviously / of course / you already know
- nize it = be quiet / shut up / calm down
- allow it = forget it / let it go / skip it
- wasteman = useless person / loser
- pagan = enemy / fake friend / snake
- moist / wet = weak / soft / lame
- jarring = annoying / aggravating
- long ting = complicated / taking too long / tedious
- violate = disrespect / cross a line
- merked = destroyed / beaten badly / finished
- bucked = ran into someone unexpectedly
- link / link up = meet up / connect / girlfriend
- plug = connect / supplier / hookup
- road = the streets / outside
- ends = neighborhood / area / where you're from
- gyaldem / gyals = girls / women
- leng / peng = attractive / excellent / fire
- drip = style / fashion / outfit
- whip = car
- grub = food
- dutty = dirty / nasty
- eediat / idiat = idiot / fool
- big man ting = serious matter / adult stuff / no jokes
- T dot / the 6ix = Toronto
- szn = season
- lowkey / highkey = secretly / very much so
- broski / bro / fam / g = friend / brother
- ahlie = right? / no way / for real?
- pepper = harass / bother
- dash = throw / send / leave quickly

Rules:
- Keep URLs, numbers, proper nouns, and brand names unchanged
- COMMIT fully — rewrite sentences to sound like a Toronto roadman said them, not just swap a few words
- Every sentence should drip with 6ix energy
- Do NOT convert code snippets or technical strings
- Return one <output id="N"> tag per input, in the same order, with no other text`
};

async function convertWithClaude(texts, level) {
  const { apiKey } = await chrome.storage.local.get('apiKey');
  if (!apiKey) throw new Error('No API key set — open Settings to add your Anthropic key.');

  const inputBlock = texts.map((t, i) => `<input id="${i}">${t}</input>`).join('\n');

  const prompt = `${PROMPTS[level]}

Example:
<output id="0">converted text here</output>
<output id="1">another converted text</output>

${inputBlock}`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 8192,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `API error ${response.status}`);
  }

  const data = await response.json();
  const raw = data.content[0].text;

  const matches = [...raw.matchAll(/<output id="(\d+)">([\s\S]*?)<\/output>/g)];
  if (!matches.length) throw new Error('Unexpected response from Claude — try again.');

  const byId = {};
  for (const [, id, text] of matches) byId[parseInt(id)] = text;

  return texts.map((_, i) => byId[i] ?? texts[i]);
}
