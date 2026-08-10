const ALLOWED_STATES = new Set(['disabled', 'experimental', 'validated', 'promoted']);
const ALLOWED_MODES = new Set(['evidence', 'score']);

export function validateVariableRegistry(registry = {}) {
  const errors = [];
  const ids = new Set();
  if (!Array.isArray(registry.variables)) errors.push('variables must be an array');
  for (const item of registry.variables || []) {
    if (!item?.id || !/^[a-z][a-z0-9_]{2,63}$/.test(item.id)) errors.push(`invalid id: ${item?.id ?? 'missing'}`);
    if (ids.has(item.id)) errors.push(`duplicate id: ${item.id}`);
    ids.add(item.id);
    if (!ALLOWED_STATES.has(item.state)) errors.push(`invalid state for ${item.id}`);
    if (!ALLOWED_MODES.has(item.mode)) errors.push(`invalid mode for ${item.id}`);
    if (!item.source) errors.push(`missing source for ${item.id}`);
    if (!item.missingBehavior) errors.push(`missing behavior for ${item.id}`);
    const weight = Number(item.weight || 0);
    if (!Number.isFinite(weight) || weight < 0) errors.push(`invalid weight for ${item.id}`);
    if (item.state !== 'promoted' && weight !== 0) errors.push(`${item.id} carries weight before promotion`);
    if (item.state === 'promoted' && item.mode !== 'score') errors.push(`${item.id} promoted without score mode`);
  }
  return { valid: errors.length === 0, errors };
}

export function summarizeVariableRegistry(registry = {}) {
  const validation = validateVariableRegistry(registry);
  const counts = { disabled: 0, experimental: 0, validated: 0, promoted: 0 };
  for (const item of registry.variables || []) if (counts[item.state] !== undefined) counts[item.state] += 1;
  return {
    ...counts,
    total: Object.values(counts).reduce((sum, value) => sum + value, 0),
    weightedVariables: (registry.variables || []).filter(item => Number(item.weight || 0) > 0).map(item => item.id),
    valid: validation.valid,
    errors: validation.errors
  };
}

export function promoteVariable(registry = {}, id, { weight, rationale = '', validationSample = null } = {}) {
  const next = structuredClone(registry);
  const target = (next.variables || []).find(item => item.id === id);
  if (!target) throw new Error(`Unknown variable: ${id}`);
  const numericWeight = Number(weight);
  if (!Number.isFinite(numericWeight) || numericWeight <= 0 || numericWeight > 25) throw new Error('Promoted weight must be >0 and <=25.');
  if (!rationale || String(rationale).trim().length < 20) throw new Error('Promotion rationale is required.');
  if (!Number.isFinite(Number(validationSample)) || Number(validationSample) < 20) throw new Error('At least 20 forward observations are required before promotion.');
  target.state = 'promoted';
  target.mode = 'score';
  target.weight = numericWeight;
  target.promotion = { rationale: String(rationale), validationSample: Number(validationSample) };
  const validation = validateVariableRegistry(next);
  if (!validation.valid) throw new Error(validation.errors.join('; '));
  return next;
}

export { ALLOWED_STATES, ALLOWED_MODES };
