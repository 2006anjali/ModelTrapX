import { useState } from 'react'

const API_URL = 'http://127.0.0.1:8000'

interface FailedCase {
  case_id: number
  actual_label: number
  predicted_label: number
  changed_feature: string
  original_value: number
  stressed_value: number
  scenario?: string
  failed_on_clean_data?: boolean
}

interface ScenarioSummary {
  name: string
  description: string
  changed_feature: string
  stressed_accuracy: number
  accuracy_change: number
  failure_count: number
  newly_failed: number
  newly_fixed: number
}

interface ModelResult {
  model_version: string
  total_cases: number
  accuracy: number
  stressed_accuracy: number
  failure_rate: number
  robustness_score: number
  worst_scenario?: string
  scenarios?: ScenarioSummary[]
  failed_cases: FailedCase[]
}

interface EvaluateResponse {
  report: {
    project: string
    generated_at: string
    test_suite: string
    results: Record<string, ModelResult>
  }
  sha256: string
  hash_algorithm: string
}

interface VerifyResult {
  valid: boolean
  expected_hash?: string
  actual_hash?: string
}

type VerifyMode = 'original' | 'tampered'

interface ChainOutcome {
  ok: boolean
  text: string
  details?: string
}

const pct = (value: number) => (value * 100).toFixed(1) + '%'

const signedPoints = (value: number) => {
  const points = value * 100
  return (points >= 0 ? '+' : '') + points.toFixed(1) + ' pts'
}

const panel = {
  background: '#13262d',
  border: '1px solid #1d3b44',
  borderRadius: 12,
  padding: 16,
} as const

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: '#0f2027', border: '1px solid #1d3b44', borderRadius: 8, padding: 12 }}>
      <div style={{ fontSize: 12, color: '#8fb3ba' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: '#2dd4bf' }}>{value}</div>
    </div>
  )
}

function ModelCard({ model }: { model: ModelResult }) {
  return (
    <div style={panel}>
      <h2 style={{ margin: '0 0 4px 0' }}>Model {model.model_version.toUpperCase()}</h2>
      <p style={{ margin: '0 0 4px 0', color: '#8fb3ba', fontSize: 13 }}>
        {model.total_cases} test cases, {model.failed_cases.length} failed in the worst scenario
      </p>
      {model.worst_scenario && (
        <p style={{ margin: '0 0 12px 0', color: '#8fb3ba', fontSize: 12 }}>
          Worst scenario: {model.worst_scenario}
        </p>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <MetricCard label="Accuracy (clean)" value={pct(model.accuracy)} />
        <MetricCard label="Stressed accuracy (worst)" value={pct(model.stressed_accuracy)} />
        <MetricCard label="Failure rate (worst)" value={pct(model.failure_rate)} />
        <MetricCard label="Robustness score" value={model.robustness_score.toFixed(1)} />
      </div>
    </div>
  )
}

function ScenarioTable({ results }: { results: Record<string, ModelResult> }) {
  const models = Object.values(results)
  const first = models[0]
  const scenarios = first?.scenarios ?? []

  const cell = { padding: '8px 10px', borderBottom: '1px solid #1d3b44', textAlign: 'left' as const }

  if (scenarios.length === 0) {
    return null
  }

  return (
    <div style={{ ...panel, marginTop: 24 }}>
      <h2 style={{ margin: '0 0 4px 0', fontSize: 18 }}>Scenario comparison</h2>
      <p style={{ margin: '0 0 12px 0', color: '#8fb3ba', fontSize: 12 }}>
        Each cell: stressed accuracy, change from clean accuracy, and how many cases newly failed or were newly fixed.
        With 143 test cases, one case is about 0.7 points, so small gaps are not strong evidence.
      </p>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ color: '#8fb3ba' }}>
              <th style={cell}>Scenario</th>
              {models.map((m) => (
                <th key={m.model_version} style={cell}>
                  {m.model_version.toUpperCase()}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={cell}>clean data (no stress)</td>
              {models.map((m) => (
                <td key={m.model_version} style={cell}>
                  {pct(m.accuracy)}
                </td>
              ))}
            </tr>
            {scenarios.map((sc) => {
              const accuracies = models.map(
                (m) => m.scenarios?.find((s) => s.name === sc.name)?.stressed_accuracy ?? 0
              )
              const best = Math.max(...accuracies)
              return (
                <tr key={sc.name}>
                  <td style={cell}>
                    <div style={{ fontWeight: 600 }}>{sc.name}</div>
                    <div style={{ fontSize: 12, color: '#8fb3ba' }}>{sc.description}</div>
                  </td>
                  {models.map((m) => {
                    const s = m.scenarios?.find((x) => x.name === sc.name)
                    if (!s) {
                      return (
                        <td key={m.model_version} style={cell}>
                          n/a
                        </td>
                      )
                    }
                    const isBest = s.stressed_accuracy === best && accuracies.some((a) => a !== best)
                    return (
                      <td key={m.model_version} style={cell}>
                        <div style={{ fontWeight: 700, color: isBest ? '#4ade80' : '#e6f1f3' }}>
                          {pct(s.stressed_accuracy)}
                        </div>
                        <div style={{ fontSize: 12, color: '#8fb3ba' }}>
                          {signedPoints(s.accuracy_change)}, {s.newly_failed} newly failed, {s.newly_fixed} newly fixed
                        </div>
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function FailedCasesTable({ results }: { results: Record<string, ModelResult> }) {
  const rows = Object.values(results).flatMap((model) =>
    model.failed_cases.map((c) => ({ ...c, model: model.model_version }))
  )

  const cell = { padding: '8px 10px', borderBottom: '1px solid #1d3b44', textAlign: 'left' as const }

  return (
    <div style={{ ...panel, marginTop: 24 }}>
      <h2 style={{ margin: '0 0 4px 0', fontSize: 18 }}>Failed cases (worst scenario of each model)</h2>
      <p style={{ margin: '0 0 12px 0', color: '#8fb3ba', fontSize: 12 }}>
        Radius columns show the mean radius value. "Wrong on clean data?" tells whether the model was already wrong before any stress.
      </p>
      {rows.length === 0 ? (
        <p style={{ color: '#8fb3ba' }}>No failed cases.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ color: '#8fb3ba' }}>
                <th style={cell}>Model</th>
                <th style={cell}>Case</th>
                <th style={cell}>Scenario</th>
                <th style={cell}>Radius (orig)</th>
                <th style={cell}>Radius (stressed)</th>
                <th style={cell}>Actual</th>
                <th style={cell}>Predicted</th>
                <th style={cell}>Wrong on clean data?</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.model}-${row.scenario ?? 'x'}-${row.case_id}`}>
                  <td style={cell}>{row.model.toUpperCase()}</td>
                  <td style={cell}>#{row.case_id}</td>
                  <td style={cell}>{row.scenario ?? row.changed_feature}</td>
                  <td style={cell}>{row.original_value.toFixed(2)}</td>
                  <td style={cell}>{row.stressed_value.toFixed(2)}</td>
                  <td style={cell}>{row.actual_label}</td>
                  <td style={{ ...cell, color: '#f87171' }}>{row.predicted_label}</td>
                  <td style={cell}>
                    {row.failed_on_clean_data === undefined ? 'n/a' : row.failed_on_clean_data ? 'Yes' : 'No'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function App() {
  const [data, setData] = useState<EvaluateResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null)
  const [verifyMode, setVerifyMode] = useState<VerifyMode>('original')
  const [verifyError, setVerifyError] = useState('')
  const [chainBusy, setChainBusy] = useState(false)
  const [chainOutcome, setChainOutcome] = useState<ChainOutcome | null>(null)

  const runStressTest = async () => {
    setLoading(true)
    setChainOutcome(null)
    setError('')
    setVerifyResult(null)
    setVerifyError('')
    try {
      const res = await fetch(`${API_URL}/api/evaluate`)
      if (!res.ok) {
        throw new Error(`Server returned status ${res.status}`)
      }
      const json: EvaluateResponse = await res.json()
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const verifyReport = async (mode: VerifyMode) => {
    if (!data) return
    setVerifying(true)
    setVerifyError('')
    setVerifyResult(null)
    setVerifyMode(mode)
    try {
      // Original mode: send the report exactly as received.
      // Tampered mode: send a modified COPY of the report with the ORIGINAL hash.
      let reportToSend: EvaluateResponse['report'] = data.report
      if (mode === 'tampered') {
        reportToSend = JSON.parse(JSON.stringify(data.report))
        const lastKey = Object.keys(reportToSend.results).pop()
        if (lastKey) {
          reportToSend.results[lastKey].accuracy = 0.999
        }
      }

      const res = await fetch(`${API_URL}/api/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          report: reportToSend,
          expected_hash: data.sha256,
        }),
      })
      if (!res.ok) {
        throw new Error(`Server returned status ${res.status}`)
      }
      const json: VerifyResult = await res.json()
      setVerifyResult(json)
    } catch (err) {
      setVerifyError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setVerifying(false)
    }
  }

  const callChain = async (path: string, report: EvaluateResponse['report'], hash: string) => {
    const res = await fetch(`${API_URL}/api/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ report, expected_hash: hash }),
    })
    const json = await res.json().catch(() => ({}))
    return { status: res.status, json }
  }

  const registerOnChain = async () => {
    if (!data) return
    setChainBusy(true)
    setChainOutcome(null)
    try {
      const { status, json } = await callChain('register', data.report, data.sha256)
      if (status === 200) {
        setChainOutcome({
          ok: true,
          text: 'Report hash registered on the blockchain.',
          details: `Block ${json.block_number} | Tx ${json.tx_hash}`,
        })
      } else if (status === 409) {
        setChainOutcome({ ok: true, text: 'This report hash is already registered on-chain.' })
      } else {
        setChainOutcome({ ok: false, text: json.detail ?? `Server returned status ${status}` })
      }
    } catch (err) {
      setChainOutcome({ ok: false, text: err instanceof Error ? err.message : 'Unknown error' })
    } finally {
      setChainBusy(false)
    }
  }

  const verifyOnChain = async (tamper: boolean) => {
    if (!data) return
    setChainBusy(true)
    setChainOutcome(null)
    try {
      let reportToSend: EvaluateResponse['report'] = data.report
      if (tamper) {
        reportToSend = JSON.parse(JSON.stringify(data.report))
        const lastKey = Object.keys(reportToSend.results).pop()
        if (lastKey) {
          reportToSend.results[lastKey].accuracy = 0.999
        }
      }
      const { status, json } = await callChain('verify-onchain', reportToSend, data.sha256)
      if (status !== 200) {
        setChainOutcome({ ok: false, text: json.detail ?? `Server returned status ${status}` })
        return
      }
      const when = json.on_chain?.timestamp
        ? new Date(json.on_chain.timestamp * 1000).toLocaleString()
        : ''
      if (tamper) {
        setChainOutcome(
          json.valid
            ? { ok: false, text: 'WARNING: the tampered report was accepted on-chain check.' }
            : { ok: true, text: 'Tampering detected: the modified report does not match the on-chain record.' }
        )
      } else if (json.valid) {
        setChainOutcome({
          ok: true,
          text: 'Verified on-chain: the report matches a hash recorded on the blockchain.',
          details: `Recorded ${when} by ${json.on_chain.submitter}`,
        })
      } else if (json.hash_matches && !json.on_chain?.registered) {
        setChainOutcome({ ok: false, text: 'Hash is correct, but this report is not registered on-chain yet. Click "Register on blockchain" first.' })
      } else {
        setChainOutcome({ ok: false, text: 'Verification failed: report does not match its hash.' })
      }
    } catch (err) {
      setChainOutcome({ ok: false, text: err instanceof Error ? err.message : 'Unknown error' })
    } finally {
      setChainBusy(false)
    }
  }

  const downloadReport = () => {
    if (!data) return
    const payload = JSON.stringify(
      { report: data.report, sha256: data.sha256, hash_algorithm: data.hash_algorithm },
      null,
      2
    )
    const blob = new Blob([payload], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'modeltrapx-report-' + data.sha256.slice(0, 8) + '.json'
    link.click()
    URL.revokeObjectURL(url)
  }

  const outcome = (() => {
    if (!verifyResult) return null
    if (verifyMode === 'original') {
      return verifyResult.valid
        ? { ok: true, text: 'Report verified: the hash matches the report data.' }
        : { ok: false, text: 'Verification failed: the original report does NOT match its hash.' }
    }
    return verifyResult.valid
      ? { ok: false, text: 'WARNING: the tampered report was accepted. Hash check is not working.' }
      : { ok: true, text: 'Tampering detected: the modified report was rejected (hash mismatch).' }
  })()

  const smallButton = (primary: boolean) => ({
    background: 'transparent',
    color: primary ? '#2dd4bf' : '#fbbf24',
    border: `1px solid ${primary ? '#2dd4bf' : '#fbbf24'}`,
    borderRadius: 8,
    padding: '8px 16px',
    fontWeight: 700,
    cursor: verifying ? 'not-allowed' : 'pointer',
  })

  return (
    <div
      style={{
        width: '100%',
        minHeight: '100vh',
        boxSizing: 'border-box',
        padding: 24,
        background: '#0a1519',
        color: '#e6f1f3',
        fontFamily: 'system-ui, sans-serif',
        textAlign: 'left',
      }}
    >
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <h1 style={{ margin: 0, color: '#2dd4bf' }}>ModelTrap X</h1>
        <p style={{ color: '#8fb3ba' }}>AI Model Stress-Testing and Report Integrity Platform</p>

        <button
          onClick={runStressTest}
          disabled={loading}
          style={{
            background: '#2dd4bf',
            color: '#0a1519',
            border: 'none',
            borderRadius: 8,
            padding: '10px 20px',
            fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Running...' : 'Run stress test'}
        </button>

        {data && (
          <button
            onClick={downloadReport}
            style={{
              marginLeft: 10,
              background: 'transparent',
              color: '#2dd4bf',
              border: '1px solid #2dd4bf',
              borderRadius: 8,
              padding: '10px 20px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Download report (JSON)
          </button>
        )}

        {error && (
          <p style={{ color: '#f87171' }}>Error: {error}. Backend chal raha hai ya nahi check karo.</p>
        )}

        {data && (
          <div style={{ marginTop: 24 }}>
            <p style={{ color: '#8fb3ba', fontSize: 13 }}>
              Test suite: {data.report.test_suite}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {Object.values(data.report.results).map((model) => (
                <ModelCard key={model.model_version} model={model} />
              ))}
            </div>

            <ScenarioTable results={data.report.results} />

            <div style={{ ...panel, marginTop: 24 }}>
              <div style={{ fontSize: 12, color: '#8fb3ba' }}>Report hash ({data.hash_algorithm})</div>
              <code style={{ wordBreak: 'break-all', color: '#2dd4bf' }}>{data.sha256}</code>

              <div style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button
                  onClick={() => verifyReport('original')}
                  disabled={verifying}
                  style={smallButton(true)}
                >
                  {verifying && verifyMode === 'original' ? 'Verifying...' : 'Verify report'}
                </button>
                <button
                  onClick={() => verifyReport('tampered')}
                  disabled={verifying}
                  style={smallButton(false)}
                >
                  {verifying && verifyMode === 'tampered' ? 'Testing...' : 'Tamper & verify (test)'}
                </button>
              </div>

              {verifyError && (
                <p style={{ color: '#f87171', marginBottom: 0 }}>Verify error: {verifyError}</p>
              )}

              {outcome && verifyResult && (
                <div style={{ marginTop: 12 }}>
                  <p style={{ margin: 0, fontWeight: 700, color: outcome.ok ? '#4ade80' : '#f87171' }}>
                    {outcome.text}
                  </p>
                  {verifyMode === 'tampered' && (
                    <p style={{ margin: '8px 0 0 0', fontSize: 12, color: '#8fb3ba' }}>
                      Test change: the last model's accuracy was set to 99.9% in a copy of the report. The original report on screen is unchanged.
                    </p>
                  )}
                  {verifyResult.expected_hash && (
                    <p style={{ margin: '8px 0 0 0', fontSize: 12, color: '#8fb3ba', wordBreak: 'break-all' }}>
                      Expected: {verifyResult.expected_hash}
                    </p>
                  )}
                  {verifyResult.actual_hash && (
                    <p style={{ margin: '4px 0 0 0', fontSize: 12, color: '#8fb3ba', wordBreak: 'break-all' }}>
                      Actual: {verifyResult.actual_hash}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div style={{ ...panel, marginTop: 24 }}>
              <h2 style={{ margin: '0 0 4px 0', fontSize: 18 }}>Blockchain record</h2>
              <p style={{ margin: '0 0 12px 0', color: '#8fb3ba', fontSize: 12 }}>
                Stores the report hash on a local test blockchain. It proves this hash was recorded at a certain time by a certain address. It does not prove the evaluation itself was correct.
              </p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button
                  onClick={registerOnChain}
                  disabled={chainBusy}
                  style={{ ...smallButton(true), cursor: chainBusy ? 'not-allowed' : 'pointer' }}
                >
                  {chainBusy ? 'Working...' : 'Register on blockchain'}
                </button>
                <button
                  onClick={() => verifyOnChain(false)}
                  disabled={chainBusy}
                  style={{ ...smallButton(true), cursor: chainBusy ? 'not-allowed' : 'pointer' }}
                >
                  Verify on-chain
                </button>
                <button
                  onClick={() => verifyOnChain(true)}
                  disabled={chainBusy}
                  style={{ ...smallButton(false), cursor: chainBusy ? 'not-allowed' : 'pointer' }}
                >
                  Tamper & verify on-chain (test)
                </button>
              </div>
              {chainOutcome && (
                <div style={{ marginTop: 12 }}>
                  <p style={{ margin: 0, fontWeight: 700, color: chainOutcome.ok ? '#4ade80' : '#f87171' }}>
                    {chainOutcome.text}
                  </p>
                  {chainOutcome.details && (
                    <p style={{ margin: '8px 0 0 0', fontSize: 12, color: '#8fb3ba', wordBreak: 'break-all' }}>
                      {chainOutcome.details}
                    </p>
                  )}
                </div>
              )}
            </div>

            <FailedCasesTable results={data.report.results} />

            <p style={{ color: '#8fb3ba', fontSize: 12, marginTop: 16 }}>
              Demonstration stress test only; not a universal AI safety guarantee.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default App