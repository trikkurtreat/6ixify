const EXCLUDE_TAGS = new Set([
  'SCRIPT', 'STYLE', 'CODE', 'PRE', 'NAV', 'FOOTER',
  'BUTTON', 'INPUT', 'TEXTAREA', 'SELECT', 'OPTION',
  'LABEL', 'NOSCRIPT', 'SVG', 'MATH', 'IFRAME', 'OBJECT', 'EMBED'
]);

// Regex to skip pure numbers, dates, punctuation-only, single words
const SKIP_PATTERN = /^[\s\d\-\/\.\:\,\%\$\@\#\!\?\(\)\[\]\"\']+$/;

let isConverted = false;
const originalTexts = new Map(); // WeakMap not used since we need iteration on revert

function hasExcludedAncestor(node) {
  let el = node.parentElement;
  while (el && el !== document.body) {
    if (EXCLUDE_TAGS.has(el.tagName)) return true;
    if (el.isContentEditable) return true;
    if (el.getAttribute('role') === 'navigation') return true;
    el = el.parentElement;
  }
  return false;
}

function collectTextNodes() {
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        const text = node.textContent;
        if (!text || text.trim().length < 4) return NodeFilter.FILTER_SKIP;
        if (SKIP_PATTERN.test(text.trim())) return NodeFilter.FILTER_SKIP;
        if (hasExcludedAncestor(node)) return NodeFilter.FILTER_SKIP;
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  const nodes = [];
  let node;
  while ((node = walker.nextNode())) nodes.push(node);
  return nodes;
}

function chunkNodes(nodes, maxChars = 6000) {
  const chunks = [];
  let current = [], size = 0;
  for (const node of nodes) {
    const len = node.textContent.length;
    if (size + len > maxChars && current.length) {
      chunks.push(current);
      current = [];
      size = 0;
    }
    current.push(node);
    size += len;
  }
  if (current.length) chunks.push(current);
  return chunks;
}

async function convert(level) {
  if (isConverted) return { isConverted: true };

  const nodes = collectTextNodes();
  if (!nodes.length) return { isConverted: false, empty: true };

  nodes.forEach(n => originalTexts.set(n, n.textContent));

  const chunks = chunkNodes(nodes);

  for (const chunk of chunks) {
    const texts = chunk.map(n => n.textContent);

    let res;
    try {
      res = await chrome.runtime.sendMessage({ action: 'convertTexts', texts, level });
    } catch (err) {
      return { error: `Extension error: ${err.message}` };
    }

    if (res.error) return { error: res.error };

    res.converted.forEach((text, i) => {
      chunk[i].textContent = text;
    });
  }

  isConverted = true;
  return { isConverted: true };
}

function revert() {
  originalTexts.forEach((original, node) => {
    node.textContent = original;
  });
  originalTexts.clear();
  isConverted = false;
  return { isConverted: false };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.action === 'getStatus') {
    sendResponse({ isConverted });
    return;
  }
  if (msg.action === 'convert') {
    convert(msg.level ?? 1).then(sendResponse);
    return true; // async
  }
  if (msg.action === 'revert') {
    sendResponse(revert());
  }
});
