import { useId, useMemo, useState } from 'react';
import {
  ALLOCATION_METHODS,
  normalizeCapital,
  optimizePortfolio,
} from './portfolio-budgeter.js';

export const CURRENT_TOP_CONVICTION = Object.freeze([
  { code: 'JPY', name: 'Yen japonés', score: 82, valuation: 94, fundamentals: 66, momentum: 71, risk: 74 },
  { code: 'CNY', name: 'Yuan chino', score: 76, valuation: 88, fundamentals: 73, momentum: 61, risk: 70 },
  { code: 'MXN', name: 'Peso mexicano', score: 74, valuation: 69, fundamentals: 71, momentum: 82, risk: 66 },
  { code: 'BRL', name: 'Real brasileño', score: 72, valuation: 80, fundamentals: 68, momentum: 73, risk: 60 },
  { code: 'KRW', name: 'Won surcoreano', score: 70, valuation: 81, fundamentals: 72, momentum: 64, risk: 62 },
  { code: 'INR', name: 'Rupia india', score: 68, valuation: 74, fundamentals: 79, momentum: 65, risk: 54 },
  { code: 'IDR', name: 'Rupia indonesia', score: 67, valuation: 78, fundamentals: 72, momentum: 59, risk: 58 },
]);

const USD = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const PERCENT = new Intl.NumberFormat('es-MX', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const RISK_STYLES = {
  low: {
    text: 'text-emerald-300',
    badge: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300',
    bar: 'from-emerald-400 to-emerald-300',
  },
  medium: {
    text: 'text-amber-200',
    badge: 'border-amber-300/20 bg-amber-300/10 text-amber-200',
    bar: 'from-amber-400 to-yellow-300',
  },
  high: {
    text: 'text-rose-300',
    badge: 'border-rose-400/20 bg-rose-400/10 text-rose-300',
    bar: 'from-rose-500 to-orange-400',
  },
};

function sanitizeCapitalInput(value) {
  return value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
}

export default function PortfolioBudgeter({
  currencies = CURRENT_TOP_CONVICTION,
  initialCapital = 1_000_000,
  modelAsOf = '31 jul 2026 · datos demostrativos',
  className = '',
}) {
  const titleId = useId();
  const descriptionId = useId();
  const [capitalInput, setCapitalInput] = useState(String(initialCapital));
  const [method, setMethod] = useState(ALLOCATION_METHODS.RISK_ADJUSTED);
  const [selectedCodes, setSelectedCodes] = useState(() =>
    new Set(currencies.map(({ code }) => code)),
  );

  const capital = normalizeCapital(capitalInput);
  const selectedCurrencies = useMemo(
    () => currencies.filter(({ code }) => selectedCodes.has(code)),
    [currencies, selectedCodes],
  );
  const portfolio = useMemo(
    () => optimizePortfolio({ capital, currencies: selectedCurrencies, method }),
    [capital, selectedCurrencies, method],
  );
  const riskStyle = RISK_STYLES[portfolio.riskBand.tone];

  function toggleCurrency(code) {
    setSelectedCodes((current) => {
      const next = new Set(current);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  return (
    <section
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      className={`overflow-hidden rounded-[28px] border border-white/10 bg-[#0b1118] text-slate-100 shadow-2xl shadow-black/30 ${className}`}
    >
      <header className="border-b border-white/10 px-5 py-6 sm:px-8 sm:py-8">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div className="max-w-2xl">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-300">
              AGCI · Allocation Lab
            </p>
            <h2 id={titleId} className="font-serif text-3xl leading-tight tracking-tight text-white sm:text-4xl">
              Position sizing matters over binary predictions.
            </h2>
            <p id={descriptionId} className="mt-3 max-w-xl text-sm leading-6 text-slate-400">
              Distribuya capital ficticio entre sus monedas de mayor convicción mediante una regla simple, transparente y sensible al riesgo.
            </p>
          </div>
          <div className="shrink-0 text-left lg:text-right">
            <span className="block text-[10px] uppercase tracking-[0.2em] text-slate-500">Corte del modelo</span>
            <strong className="mt-1 block text-sm font-medium text-slate-300">{modelAsOf}</strong>
          </div>
        </div>
      </header>

      <div className="grid gap-0 lg:grid-cols-[minmax(0,0.86fr)_minmax(0,1.34fr)]">
        <div className="border-b border-white/10 p-5 sm:p-8 lg:border-b-0 lg:border-r">
          <label htmlFor={`${titleId}-capital`} className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
            Capital total ficticio
          </label>
          <div className="mt-3 flex items-center rounded-2xl border border-white/10 bg-white/[0.035] px-4 shadow-inner shadow-black/20 focus-within:border-amber-300/60 focus-within:ring-2 focus-within:ring-amber-300/10">
            <span aria-hidden="true" className="mr-3 text-sm font-semibold text-amber-300">USD</span>
            <input
              id={`${titleId}-capital`}
              type="text"
              inputMode="decimal"
              value={capitalInput}
              onChange={(event) => setCapitalInput(sanitizeCapitalInput(event.target.value))}
              onBlur={() => capital && setCapitalInput(String(capital))}
              aria-invalid={!capital}
              className="min-w-0 flex-1 bg-transparent py-4 text-right font-mono text-2xl tabular-nums text-white outline-none placeholder:text-slate-600"
              placeholder="1000000"
            />
          </div>
          {!capital && <p role="alert" className="mt-2 text-xs text-rose-300">Ingrese un capital mayor a cero.</p>}

          <fieldset className="mt-7">
            <legend className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Método de asignación</legend>
            <div className="mt-3 grid grid-cols-2 gap-2 rounded-2xl bg-black/20 p-1.5">
              {[
                [ALLOCATION_METHODS.RISK_ADJUSTED, 'Ajustado a riesgo'],
                [ALLOCATION_METHODS.DIRECT_SCORE, 'Score directo'],
              ].map(([value, label]) => (
                <label key={value} className={`cursor-pointer rounded-xl px-3 py-3 text-center text-xs font-semibold transition ${method === value ? 'bg-white/10 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}>
                  <input
                    type="radio"
                    name={`${titleId}-method`}
                    value={value}
                    checked={method === value}
                    onChange={() => setMethod(value)}
                    className="sr-only"
                  />
                  {label}
                </label>
              ))}
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              {method === ALLOCATION_METHODS.RISK_ADJUSTED
                ? 'Score AGCI dividido entre la exposición implícita (100 − Risk).'
                : 'Capital proporcional al Composite Score de cada moneda.'}
            </p>
          </fieldset>

          <fieldset className="mt-7">
            <div className="flex items-center justify-between">
              <legend className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Top Conviction</legend>
              <span className="text-xs tabular-nums text-slate-500">{selectedCodes.size}/{currencies.length}</span>
            </div>
            <div className="mt-3 space-y-2">
              {currencies.map((currency) => (
                <label key={currency.code} className="group flex cursor-pointer items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 transition hover:border-white/10 hover:bg-white/[0.03]">
                  <input
                    type="checkbox"
                    checked={selectedCodes.has(currency.code)}
                    onChange={() => toggleCurrency(currency.code)}
                    className="h-4 w-4 rounded border-white/20 bg-white/5 text-amber-300 accent-amber-300 focus:ring-amber-300/30"
                  />
                  <span className="w-10 font-mono text-sm font-semibold text-white">{currency.code}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-slate-400 group-hover:text-slate-300">{currency.name}</span>
                    <span className="mt-0.5 block truncate font-mono text-[10px] text-slate-600">
                      V {currency.valuation} · F {currency.fundamentals} · M {currency.momentum} · R {currency.risk}
                    </span>
                  </span>
                  <span className="font-mono text-sm tabular-nums text-amber-200">{currency.score}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        <div className="min-w-0 p-5 sm:p-8">
          <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Asignación sugerida</p>
              <p className="mt-1 font-mono text-2xl font-medium tabular-nums text-white">{USD.format(capital)}</p>
            </div>
            <p className="text-xs text-slate-500">100% del capital distribuido</p>
          </div>

          {portfolio.allocations.length ? (
            <div className="overflow-x-auto rounded-2xl border border-white/10">
              <table className="w-full min-w-[610px] border-collapse text-left">
                <thead className="bg-white/[0.035] text-[10px] uppercase tracking-[0.16em] text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Moneda</th>
                    <th className="px-4 py-3 text-right font-semibold">Monto sugerido</th>
                    <th className="px-4 py-3 text-right font-semibold">Portafolio</th>
                    <th className="px-4 py-3 font-semibold">Peso relativo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.07]">
                  {portfolio.allocations.map((allocation) => (
                    <tr key={allocation.code} className="transition hover:bg-white/[0.025]">
                      <td className="px-4 py-4">
                        <strong className="font-mono text-sm text-white">{allocation.code}</strong>
                        <span className="ml-2 text-xs text-slate-500">Score {allocation.score}</span>
                      </td>
                      <td className="px-4 py-4 text-right font-mono text-sm tabular-nums text-slate-200">{USD.format(allocation.amount)}</td>
                      <td className="px-4 py-4 text-right font-mono text-sm tabular-nums text-slate-200">{PERCENT.format(allocation.percentage)}%</td>
                      <td className="px-4 py-4">
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.07]">
                          <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-yellow-200" style={{ width: `${allocation.percentage}%` }} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid min-h-56 place-items-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 text-center">
              <div>
                <p className="font-serif text-xl text-slate-300">{capital ? 'Seleccione al menos una moneda' : 'Ingrese un capital válido'}</p>
                <p className="mt-2 text-sm text-slate-500">La asignación se recalculará automáticamente.</p>
              </div>
            </div>
          )}

          <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.025] p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Exposición total al riesgo</p>
                <p className={`mt-1 font-mono text-2xl tabular-nums ${riskStyle.text}`}>{portfolio.allocations.length ? `${PERCENT.format(portfolio.riskExposure)}%` : '—'}</p>
              </div>
              <span className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${riskStyle.badge}`}>{portfolio.allocations.length ? portfolio.riskBand.label : 'Sin asignación'}</span>
            </div>
            <div
              role="progressbar"
              aria-label={`Exposición total al riesgo: ${portfolio.riskBand.label}`}
              aria-valuemin="0"
              aria-valuemax="100"
              aria-valuenow={Math.round(portfolio.riskExposure)}
              className="mt-4 h-2 overflow-hidden rounded-full bg-white/[0.07]"
            >
              <div className={`h-full rounded-full bg-gradient-to-r transition-[width] duration-500 ${riskStyle.bar}`} style={{ width: `${portfolio.riskExposure}%` }} />
            </div>
            <div className="mt-2 flex justify-between text-[10px] uppercase tracking-[0.12em] text-slate-600"><span>Bajo</span><span>Medio</span><span>Alto</span></div>
          </div>

          <p className="mt-5 text-xs leading-5 text-slate-600">
            Simulación educativa basada en scores AGCI; no incorpora correlaciones, costos, liquidez, horizonte ni circunstancias del inversionista y no constituye asesoría financiera.
          </p>
        </div>
      </div>
    </section>
  );
}
