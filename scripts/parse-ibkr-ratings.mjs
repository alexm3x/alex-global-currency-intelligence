const ROW_RE = /^([A-Z0-9.-]+)@([A-Z]+)\s+(\d+)\(([+-]?\d+)\)\s+(\d+)\(([+-]?\d+)\)\s+(\d+)\(([+-]?\d+)\)\s+(\d+)\(([+-]?\d+)\)\s+(\d+)\(([+-]?\d+)\)(?:\s+.*)?$/gm;

const round = (value, digits = 1) => Number(Number(value).toFixed(digits));
const SAME_ISSUER_PROXIES = Object.freeze({ GOOG: ['GOOGL'] });

export function parseIbkrRatingsBody(body = '', sourceDate = null) {
  const rows = [];
  const text = String(body || '').replace(/\r/g, '');
  let match;
  while ((match = ROW_RE.exec(text))) {
    const [,
      ticker, exchange,
      buy, buyDelta,
      outperform, outperformDelta,
      hold, holdDelta,
      underperform, underperformDelta,
      sell, sellDelta
    ] = match;
    const counts = {
      buy: Number(buy),
      outperform: Number(outperform),
      hold: Number(hold),
      underperform: Number(underperform),
      sell: Number(sell)
    };
    const deltas = {
      buy: Number(buyDelta),
      outperform: Number(outperformDelta),
      hold: Number(holdDelta),
      underperform: Number(underperformDelta),
      sell: Number(sellDelta)
    };
    const totalAnalysts = Object.values(counts).reduce((sum, value) => sum + value, 0);
    const bullishPct = totalAnalysts ? ((counts.buy + counts.outperform) / totalAnalysts) * 100 : null;
    const consensusScore = totalAnalysts
      ? (counts.buy * 5 + counts.outperform * 4 + counts.hold * 3 + counts.underperform * 2 + counts.sell) / totalAnalysts
      : null;
    const netChange = deltas.buy * 2 + deltas.outperform - deltas.underperform - deltas.sell * 2;
    rows.push({
      ticker,
      exchange,
      asOf: sourceDate,
      ...counts,
      totalAnalysts,
      bullishPct: bullishPct == null ? null : round(bullishPct, 1),
      consensusScore: consensusScore == null ? null : round(consensusScore, 2),
      netChange,
      signal: classifyAnalystSignal({ bullishPct, consensusScore, netChange })
    });
  }
  return rows;
}

export function classifyAnalystSignal({ bullishPct, consensusScore, netChange } = {}) {
  const bullish = Number(bullishPct);
  const consensus = Number(consensusScore);
  const delta = Number(netChange || 0);
  if (!Number.isFinite(bullish) || !Number.isFinite(consensus)) return 'N/D';
  if (bullish >= 90 && consensus >= 4.2 && delta >= 0) return 'Strong Positive';
  if (bullish >= 75 && consensus >= 4.0) return 'Positive';
  if (bullish >= 60 && consensus >= 3.6) return 'Neutral Positive';
  if (bullish < 50 || consensus < 3.5) return 'Mixed';
  return 'Neutral';
}

function isoDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value).slice(0, 10) : date.toISOString().slice(0, 10);
}

function withIssuerProxy(row, previousRow = null) {
  const proxyFor = previousRow?.proxyFor || SAME_ISSUER_PROXIES[row.ticker] || null;
  return proxyFor?.length ? { ...row, proxyFor: [...proxyFor] } : row;
}

export function buildCiarSnapshot(messages = [], previous = null, now = new Date()) {
  const latestByTicker = new Map();
  for (const record of previous?.records || []) latestByTicker.set(record.ticker, { ...record });

  const normalizedMessages = [...messages]
    .filter(item => String(item?.subject || '').includes('Changes in Analyst Ratings'))
    .map(item => ({ ...item, sourceDate: isoDate(item.email_ts || item.date || item.sourceDate) }))
    .filter(item => item.sourceDate)
    .sort((a, b) => String(a.sourceDate).localeCompare(String(b.sourceDate)));

  for (const message of normalizedMessages) {
    for (const row of parseIbkrRatingsBody(message.body, message.sourceDate)) {
      const previousRow = latestByTicker.get(row.ticker);
      if (!previousRow || String(row.asOf) >= String(previousRow.asOf || '')) {
        latestByTicker.set(row.ticker, withIssuerProxy(row, previousRow));
      }
    }
  }

  const records = [...latestByTicker.values()]
    .map(record => ({ ...record }))
    .sort((a, b) => {
      const scoreDiff = Number(b.consensusScore || 0) - Number(a.consensusScore || 0);
      return scoreDiff || Number(b.bullishPct || 0) - Number(a.bullishPct || 0) || a.ticker.localeCompare(b.ticker);
    })
    .map((record, index) => ({ rank: index + 1, ...record }));

  const latestSourceDate = records.reduce((latest, row) => String(row.asOf || '') > latest ? String(row.asOf) : latest, '');
  return {
    schemaVersion: 2,
    generatedAt: now.toISOString(),
    latestSourceDate: latestSourceDate || null,
    windowDays: 45,
    source: 'IBKR FYI / Reuters',
    sourceTitle: 'FYI: Changes in Analyst Ratings',
    sourceMode: 'connected-private-gmail-sanitized',
    governance: 'Aggregate analyst evidence only. Gmail message IDs, account identifiers, email addresses, positions, balances and orders are never published.',
    records
  };
}

export function publicSnapshotIsSanitized(snapshot) {
  const text = JSON.stringify(snapshot || {});
  return !/@/.test(text)
    && !/U\*{2,}/.test(text)
    && !/message[_-]?id/i.test(text)
    && !/account\(s\)/i.test(text)
    && !/proadmexico/i.test(text);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  let input = '';
  process.stdin.setEncoding('utf8');
  for await (const chunk of process.stdin) input += chunk;
  const payload = input.trim() ? JSON.parse(input) : {};
  const snapshot = buildCiarSnapshot(payload.messages || [], payload.previous || null, payload.now ? new Date(payload.now) : new Date());
  if (!publicSnapshotIsSanitized(snapshot)) throw new Error('Refusing to emit a CIAR snapshot containing private identifiers.');
  process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
}

export { SAME_ISSUER_PROXIES };
