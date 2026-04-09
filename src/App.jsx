import { useState, useEffect } from 'react';
import { S3Client, PutObjectCommand, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';
import { fromCognitoIdentityPool } from '@aws-sdk/credential-provider-cognito-identity';

const REGION = import.meta.env.VITE_REGION || 'ap-northeast-1';
const IDENTITY_POOL_ID = import.meta.env.VITE_IDENTITY_POOL_ID;
const BUCKET_NAME = import.meta.env.VITE_BUCKET_NAME;

const s3Client = new S3Client({
  region: REGION,
  credentials: fromCognitoIdentityPool({
    clientConfig: { region: REGION },
    identityPoolId: IDENTITY_POOL_ID,
  }),
});

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Noto+Sans+JP:wght@400;500;700&display=swap');

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    background: #0f1117;
    color: #e8e8e8;
    font-family: 'Noto Sans JP', sans-serif;
    min-height: 100vh;
  }

  .app {
    max-width: 640px;
    margin: 0 auto;
    padding: 24px 16px 48px;
  }

  /* ─── HEADER ─── */
  .header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 32px;
    padding-bottom: 20px;
    border-bottom: 1px solid #2a2a2a;
  }
  .header-icon {
    width: 42px; height: 42px;
    background: #ff4d00;
    border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    font-size: 22px;
    flex-shrink: 0;
  }
  .header-title {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 28px;
    letter-spacing: 2px;
    color: #fff;
    line-height: 1;
  }
  .header-sub {
    font-size: 11px;
    color: #666;
    letter-spacing: 1px;
    margin-top: 3px;
  }

  /* ─── SECTION ─── */
  .section {
    margin-bottom: 28px;
  }
  .section-label {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 2px;
    color: #ff4d00;
    text-transform: uppercase;
    margin-bottom: 12px;
  }

  /* ─── CARD ─── */
  .card {
    background: #1a1a1f;
    border: 1px solid #2a2a2a;
    border-radius: 12px;
    padding: 20px;
  }

  /* ─── TEMPERATURE BLOCK ─── */
  .temp-display {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 64px;
    color: #fff;
    line-height: 1;
    letter-spacing: 2px;
  }
  .temp-unit { font-size: 32px; color: #666; margin-left: 4px; }
  .temp-bar {
    margin-top: 16px;
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 6px;
    border-radius: 3px;
    background: linear-gradient(to right, #1e88e5, #ff4d00);
    outline: none;
    cursor: pointer;
  }
  .temp-bar::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 20px; height: 20px;
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 0 0 3px #ff4d00;
    cursor: pointer;
  }
  .temp-labels {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    color: #555;
    margin-top: 8px;
  }

  /* ─── WBGT ─── */
  .wbgt-value {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 40px;
    color: #ff4d00;
    letter-spacing: 1px;
  }
  .wbgt-note { font-size: 11px; color: #555; margin-top: 4px; }

  .weather-btns {
    display: flex; gap: 8px; margin: 12px 0;
  }
  .weather-btn {
    flex: 1; padding: 10px 6px;
    background: #111;
    border: 1px solid #333;
    border-radius: 8px;
    color: #aaa;
    font-family: 'Noto Sans JP', sans-serif;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.15s;
  }
  .weather-btn.active {
    background: #1a1a2e;
    border-color: #ff4d00;
    color: #fff;
  }

  /* ─── SELECT / INPUT ─── */
  .field { margin-bottom: 14px; }
  .field-label {
    font-size: 11px; color: #666; letter-spacing: 1px;
    margin-bottom: 6px; display: block;
  }
  .field input, .field select {
    width: 100%;
    padding: 10px 14px;
    background: #111;
    border: 1px solid #2a2a2a;
    border-radius: 8px;
    color: #e8e8e8;
    font-family: 'Noto Sans JP', sans-serif;
    font-size: 15px;
    outline: none;
    transition: border-color 0.15s;
  }
  .field input:focus, .field select:focus { border-color: #ff4d00; }
  .field select option { background: #1a1a1f; }

  /* ─── BUTTONS ─── */
  .btn {
    padding: 12px 20px;
    border: none; border-radius: 8px;
    font-family: 'Noto Sans JP', sans-serif;
    font-size: 14px; font-weight: 700;
    cursor: pointer;
    transition: all 0.15s;
    letter-spacing: 0.5px;
  }
  .btn-primary {
    background: #ff4d00; color: #fff;
    width: 100%; font-size: 15px; padding: 14px;
  }
  .btn-primary:hover { background: #e64500; }
  .btn-secondary {
    background: transparent;
    border: 1px solid #333; color: #888;
  }
  .btn-secondary:hover { border-color: #666; color: #ccc; }
  .btn-add {
    background: #1e3a2a;
    border: 1px solid #2d5a3d;
    color: #4caf7d;
    width: 100%; margin-top: 4px;
  }
  .btn-add:hover { background: #24472f; }
  .btn-danger {
    background: transparent;
    border: 1px solid #5a1a1a; color: #cc4444;
    padding: 10px 16px; font-size: 13px;
  }
  .btn-danger:hover { background: #2a0a0a; }
  .btn-back {
    background: transparent;
    border: 1px solid #2a2a2a; color: #666;
    font-size: 13px; padding: 10px 16px;
    margin-bottom: 24px;
  }
  .btn-back:hover { border-color: #444; color: #aaa; }

  .action-row {
    display: flex; gap: 10px; margin-bottom: 28px;
    align-items: stretch;
  }
  .action-row .btn-primary { flex: 1; }
  .action-row .btn-danger { flex-shrink: 0; white-space: nowrap; }

  /* ─── WORKER LIST ─── */
  .worker-list { list-style: none; }
  .worker-item {
    display: flex; align-items: center; gap: 10px;
    padding: 12px 0;
    border-bottom: 1px solid #1f1f1f;
    font-size: 14px; color: #ccc;
  }
  .worker-item:last-child { border-bottom: none; }
  .worker-dot {
    width: 8px; height: 8px; border-radius: 50%;
    background: #ff4d00; flex-shrink: 0;
  }
  .worker-empty { color: #444; font-size: 13px; padding: 12px 0; }

  /* ─── MODE TOGGLE ─── */
  .mode-toggle {
    display: flex; gap: 8px; margin-bottom: 16px;
  }
  .mode-btn {
    flex: 1; padding: 10px;
    background: #111;
    border: 1px solid #2a2a2a;
    border-radius: 8px;
    color: #666; font-size: 13px;
    cursor: pointer; transition: all 0.15s;
    font-family: 'Noto Sans JP', sans-serif;
  }
  .mode-btn.active {
    background: #1a0f00;
    border-color: #ff4d00; color: #ff8040;
  }

  /* ─── TIMER CARDS ─── */
  .timer-grid { display: grid; gap: 14px; }

  .timer-card {
    background: #1a1a1f;
    border: 1px solid #2a2a2a;
    border-radius: 14px;
    padding: 20px 22px;
    transition: all 0.3s;
    position: relative;
    overflow: hidden;
  }
  .timer-card.alert {
    border-color: #ff4d00;
    background: #1f1008;
  }
  .timer-card.alert::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 3px;
    background: #ff4d00;
  }

  .timer-worker-name {
    font-size: 13px; color: #888;
    font-weight: 500; letter-spacing: 1px;
    margin-bottom: 8px;
  }
  .timer-countdown {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 52px;
    line-height: 1;
    letter-spacing: 3px;
    color: #fff;
    margin-bottom: 16px;
  }
  .timer-card.alert .timer-countdown {
    color: #ff4d00;
    animation: pulse 1s ease-in-out infinite;
  }
  .timer-alert-text {
    font-size: 13px; color: #ff6030;
    letter-spacing: 1px; margin-bottom: 12px;
    font-weight: 700;
  }
  .btn-hydrate {
    background: #ff4d00; color: #fff;
    border: none; border-radius: 8px;
    padding: 12px 20px;
    font-family: 'Noto Sans JP', sans-serif;
    font-size: 14px; font-weight: 700;
    cursor: pointer; width: 100%;
    transition: background 0.15s;
    letter-spacing: 0.5px;
  }
  .btn-hydrate:hover { background: #e64500; }
  .btn-hydrate-normal {
    background: #1e2a1e;
    border: 1px solid #2d4a2d;
    color: #6abf7a;
    border-radius: 8px;
    padding: 12px 20px;
    font-family: 'Noto Sans JP', sans-serif;
    font-size: 14px; font-weight: 700;
    cursor: pointer; width: 100%;
    transition: all 0.15s;
  }
  .btn-hydrate-normal:hover { background: #243024; }

  .loading {
    text-align: center; padding: 40px;
    color: #555; font-size: 14px; letter-spacing: 1px;
  }
  .loading-dot {
    display: inline-block;
    animation: blink 1.4s infinite;
  }
  .loading-dot:nth-child(2) { animation-delay: 0.2s; }
  .loading-dot:nth-child(3) { animation-delay: 0.4s; }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
  }
  @keyframes blink {
    0%, 80%, 100% { opacity: 0; }
    40% { opacity: 1; }
  }
`;

export default function App() {
  const [currentView, setCurrentView] = useState('register');
  const [workers, setWorkers] = useState([]);
  const [temperature, setTemperature] = useState(32);
  const [timers, setTimers] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [inputMode, setInputMode] = useState('temperature');
  const [humidity, setHumidity] = useState(50);
  const [newName, setNewName] = useState('');
  const [newHeight, setNewHeight] = useState('');
  const [newWeight, setNewWeight] = useState('');
  const [newWorkload, setNewWorkload] = useState(1.0);

  useEffect(() => {
    const savedWorkers = localStorage.getItem('hydration_workers');
    if (savedWorkers) setWorkers(JSON.parse(savedWorkers));
  }, []);

  const estimateWBGT = (t, h) => {
    const e = (h / 100) * 6.105 * Math.exp((17.27 * t) / (237.7 + t));
    const wbgt = 0.567 * t + 0.393 * e + 3.94;
    return Math.round(wbgt * 10) / 10;
  };

  const calculateIntervalSeconds = (temp, worker) => {
    let riskLevelCoeff = 1.0;
    if (inputMode === 'wbgt') {
      const currentWbgt = estimateWBGT(temperature, humidity);
      if (currentWbgt >= 31) riskLevelCoeff = 0.3;
      else if (currentWbgt >= 28) riskLevelCoeff = 0.4;
      else if (currentWbgt >= 25) riskLevelCoeff = 0.6;
      else riskLevelCoeff = 0.8;
    } else {
      if (temp >= 35) riskLevelCoeff = 0.3;
      else if (temp >= 31) riskLevelCoeff = 0.4;
      else if (temp >= 28) riskLevelCoeff = 0.6;
      else if (temp >= 25) riskLevelCoeff = 0.8;
    }
    let bodyRisk = 1.0;
    if (worker.height && worker.weight) {
      const heightM = worker.height / 100;
      const bmi = worker.weight / (heightM * heightM);
      if (bmi >= 25) bodyRisk = 1.2;
    }
    const minutes = Math.round(60 / (1 / riskLevelCoeff) / (1 / worker.workload) / bodyRisk);
    return Math.max(10, minutes) * 60;
  };

  const handleAddWorker = () => {
    if (!newName) return alert('名前を入力してください');
    const newWorker = {
      id: Date.now().toString(),
      name: newName,
      height: Number(newHeight),
      weight: Number(newWeight),
      workload: Number(newWorkload),
    };
    const updatedWorkers = [...workers, newWorker];
    setWorkers(updatedWorkers);
    localStorage.setItem('hydration_workers', JSON.stringify(updatedWorkers));
    setNewName(''); setNewHeight(''); setNewWeight(''); setNewWorkload(1.0);
  };

  const handleClearWorkers = () => {
    if (window.confirm('名簿をリセットしますか？')) {
      setWorkers([]);
      localStorage.removeItem('hydration_workers');
    }
  };

  const getWorkloadText = (val) => {
    if (val === 0.8) return '軽作業';
    if (val === 1.0) return '中作業';
    if (val === 1.2) return '重作業';
    return val;
  };

  const startTimerView = async () => {
    if (workers.length === 0) return alert('作業員を追加してください');
    setCurrentView('timer');
    setIsLoading(true);
    const now = new Date();
    const dateString = now.getFullYear().toString() +
      (now.getMonth() + 1).toString().padStart(2, '0') +
      now.getDate().toString().padStart(2, '0');
    const newTimers = {};
    try {
      for (const worker of workers) {
        const listCommand = new ListObjectsV2Command({
          Bucket: BUCKET_NAME,
          Prefix: `${dateString}/${worker.name}/`,
        });
        const listOutput = await s3Client.send(listCommand);
        if (listOutput.Contents && listOutput.Contents.length > 0) {
          const latestFile = listOutput.Contents.sort((a, b) => b.Key.localeCompare(a.Key))[0];
          const getCommand = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: latestFile.Key });
          const getOutput = await s3Client.send(getCommand);
          const bodyContents = await getOutput.Body.transformToString();
          const lastData = JSON.parse(bodyContents);
          const lastTime = new Date(lastData.timestamp);
          const elapsedSeconds = Math.floor((now.getTime() - lastTime.getTime()) / 1000);
          const remaining = Math.max(0, lastData.nextHydrationInSeconds - elapsedSeconds);
          newTimers[worker.id] = remaining;
        } else {
          newTimers[worker.id] = calculateIntervalSeconds(temperature, worker);
        }
      }
      setTimers(newTimers);
    } catch (error) {
      console.error("復元エラー:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (currentView !== 'timer') return;
    const intervalId = setInterval(() => {
      setTimers(prev => {
        const next = { ...prev };
        Object.keys(next).forEach(id => { if (next[id] > 0) next[id] -= 1; });
        return next;
      });
    }, 1000);
    return () => clearInterval(intervalId);
  }, [currentView]);

  const handleHydration = async (worker) => {
    const now = new Date();
    const timeString = now.getHours().toString().padStart(2, '0') +
      now.getMinutes().toString().padStart(2, '0') +
      now.getSeconds().toString().padStart(2, '0');
    const dateString = now.getFullYear().toString() +
      (now.getMonth() + 1).toString().padStart(2, '0') +
      now.getDate().toString().padStart(2, '0');
    const key = `${dateString}/${worker.name}/${timeString}.json`;
    const newIntervalSeconds = calculateIntervalSeconds(temperature, worker);
    const data = {
      worker: worker.name,
      temperature,
      nextHydrationInSeconds: newIntervalSeconds,
      timestamp: now.toISOString()
    };
    try {
      const command = new PutObjectCommand({
        Bucket: BUCKET_NAME, Key: key,
        Body: JSON.stringify(data), ContentType: 'application/json'
      });
      await s3Client.send(command);
      setTimers(prev => ({ ...prev, [worker.id]: newIntervalSeconds }));
    } catch (error) {
      console.error(error);
      alert('記録に失敗しました。');
    }
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const getTempColor = (t) => {
    if (t >= 35) return '#ff2200';
    if (t >= 31) return '#ff6600';
    if (t >= 28) return '#ffaa00';
    return '#66aaff';
  };

  return (
    <>
      <style>{styles}</style>
      <div className="app">

        {/* HEADER */}
        <div className="header">
          <div className="header-icon">💧</div>
          <div>
            <div className="header-title">HYDRATION GUARD</div>
            <div className="header-sub">熱中症予防・水分補給管理システム</div>
          </div>
        </div>

        {/* ═══════════════ 設定画面 ═══════════════ */}
        {currentView === 'register' && (
          <div>
            {/* アクションボタン */}
            <div className="action-row">
              <button className="btn btn-primary" onClick={startTimerView}>
                管理を開始する →
              </button>
              <button className="btn btn-danger" onClick={handleClearWorkers}>
                名簿リセット
              </button>
            </div>

            {/* 現場環境設定 */}
            <div className="section">
              <div className="section-label">現場環境設定</div>
              <div className="card">
                <div className="mode-toggle">
                  <button
                    className={`mode-btn ${inputMode === 'temperature' ? 'active' : ''}`}
                    onClick={() => setInputMode('temperature')}
                  >
                    🌡️ 気温のみ
                  </button>
                  <button
                    className={`mode-btn ${inputMode === 'wbgt' ? 'active' : ''}`}
                    onClick={() => setInputMode('wbgt')}
                  >
                    🌫️ WBGT（気温＋湿度）
                  </button>
                </div>

                <div style={{ marginTop: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                    <span className="temp-display" style={{ color: getTempColor(temperature) }}>
                      {temperature}
                    </span>
                    <span className="temp-unit">℃</span>
                  </div>
                  <input
                    type="range" min="20" max="45" value={temperature}
                    onChange={(e) => setTemperature(Number(e.target.value))}
                    className="temp-bar"
                  />
                  <div className="temp-labels">
                    <span>20℃</span><span>快適</span><span>警戒</span><span>危険</span><span>45℃</span>
                  </div>
                </div>

                {inputMode === 'wbgt' && (
                  <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #222' }}>
                    <div className="section-label" style={{ marginBottom: '10px' }}>天候の目安</div>
                    <div className="weather-btns">
                      {[
                        { label: '☀️ 晴れ', val: 50 },
                        { label: '☁️ 曇り', val: 70 },
                        { label: '☔️ 雨', val: 90 },
                      ].map(w => (
                        <button
                          key={w.val}
                          className={`weather-btn ${humidity === w.val ? 'active' : ''}`}
                          onClick={() => setHumidity(w.val)}
                        >
                          {w.label}<br />
                          <span style={{ fontSize: '10px', color: '#555' }}>約{w.val}%</span>
                        </button>
                      ))}
                    </div>
                    <div style={{ marginTop: '12px' }}>
                      <div style={{ fontSize: '11px', color: '#555', marginBottom: '6px' }}>湿度: {humidity}%</div>
                      <input
                        type="range" min="20" max="100" value={humidity}
                        onChange={(e) => setHumidity(Number(e.target.value))}
                        className="temp-bar"
                      />
                    </div>
                    <div style={{ marginTop: '16px', padding: '14px', borderLeft: '3px solid #ff4d00', background: '#110a00', borderRadius: '0 8px 8px 0' }}>
                      <div className="section-label" style={{ marginBottom: '4px' }}>推定WBGT（暑さ指数）</div>
                      <div className="wbgt-value">{estimateWBGT(temperature, humidity)}</div>
                      <div className="wbgt-note">25以上: 警戒　28以上: 厳重警戒　31以上: 危険</div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 現在の名簿 */}
            <div className="section">
              <div className="section-label">登録作業員 ({workers.length}名)</div>
              <div className="card">
                {workers.length > 0 ? (
                  <ul className="worker-list">
                    {workers.map(w => (
                      <li key={w.id} className="worker-item">
                        <div className="worker-dot" />
                        <span style={{ fontWeight: 500, color: '#ddd' }}>{w.name}</span>
                        <span style={{ color: '#555', fontSize: '12px', marginLeft: 'auto' }}>
                          {w.height}cm / {w.weight}kg / {getWorkloadText(w.workload)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="worker-empty">登録された作業員はいません</div>
                )}
              </div>
            </div>

            {/* 作業員登録 */}
            <div className="section">
              <div className="section-label">作業員登録</div>
              <div className="card">
                <div className="field">
                  <label className="field-label">名前</label>
                  <input
                    type="text" value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="例: 田中"
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="field">
                    <label className="field-label">身長 (cm)</label>
                    <input type="number" value={newHeight} onChange={e => setNewHeight(e.target.value)} placeholder="170" />
                  </div>
                  <div className="field">
                    <label className="field-label">体重 (kg)</label>
                    <input type="number" value={newWeight} onChange={e => setNewWeight(e.target.value)} placeholder="70" />
                  </div>
                </div>
                <div className="field">
                  <label className="field-label">労働負荷</label>
                  <select value={newWorkload} onChange={e => setNewWorkload(Number(e.target.value))}>
                    <option value={0.8}>軽作業</option>
                    <option value={1.0}>中作業</option>
                    <option value={1.2}>重作業</option>
                  </select>
                </div>
                <button className="btn btn-add" onClick={handleAddWorker}>
                  + リストに追加
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════ タイマー画面 ═══════════════ */}
        {currentView === 'timer' && (
          <div>
            <button className="btn btn-back" onClick={() => setCurrentView('register')}>
              ← 設定画面に戻る
            </button>

            <div className="section-label" style={{ marginBottom: '16px' }}>
              作業員ステータス — {temperature}℃
            </div>

            {isLoading ? (
              <div className="loading">
                データを読み込み中
                <span className="loading-dot">.</span>
                <span className="loading-dot">.</span>
                <span className="loading-dot">.</span>
              </div>
            ) : (
              <div className="timer-grid">
                {workers.map(w => {
                  const timeLeft = timers[w.id] || 0;
                  const isAlert = timeLeft === 0;
                  return (
                    <div key={w.id} className={`timer-card ${isAlert ? 'alert' : ''}`}>
                      <div className="timer-worker-name">{w.name.toUpperCase()} · {getWorkloadText(w.workload)}</div>
                      {isAlert ? (
                        <>
                          <div className="timer-countdown">00:00</div>
                          <div className="timer-alert-text">⚠ 補給タイミングです</div>
                          <button className="btn-hydrate" onClick={() => handleHydration(w)}>
                            補給完了を記録する
                          </button>
                        </>
                      ) : (
                        <>
                          <div className="timer-countdown">{formatTime(timeLeft)}</div>
                          <button className="btn-hydrate-normal" onClick={() => handleHydration(w)}>
                            早期補給を記録する
                          </button>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </div>
    </>
  );
}
