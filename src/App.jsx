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

export default function App() {
  const [currentView, setCurrentView] = useState('register');
  const [workers, setWorkers] = useState([]);
  const [temperature, setTemperature] = useState(32);
  const [timers, setTimers] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  
  // ▼ ここを 'temperature' に変更しました ▼
  const [inputMode, setInputMode] = useState('temperature'); 
  const [humidity, setHumidity] = useState(50); 

  const [newName, setNewName] = useState('');
  const [newHeight, setNewHeight] = useState('');
  const [newWeight, setNewWeight] = useState('');
  const [newWorkload, setNewWorkload] = useState(1.0);

  useEffect(() => {
    const savedWorkers = localStorage.getItem('hydration_workers');
    if (savedWorkers) {
      setWorkers(JSON.parse(savedWorkers));
    }
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
    if(window.confirm('名簿をリセットしますか？')) {
      setWorkers([]);
      localStorage.removeItem('hydration_workers');
    }
  }

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
        Object.keys(next).forEach(id => {
          if (next[id] > 0) next[id] -= 1;
        });
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
      temperature: temperature,
      nextHydrationInSeconds: newIntervalSeconds,
      timestamp: now.toISOString()
    };

    try {
      const command = new PutObjectCommand({
        Bucket: BUCKET_NAME, Key: key, Body: JSON.stringify(data), ContentType: "application/json"
      });
      await s3Client.send(command);
      setTimers(prev => ({ ...prev, [worker.id]: newIntervalSeconds }));
    } catch (error) {
      console.error(error);
      alert("記録に失敗しました。");
    }
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '600px', margin: '0 auto' }}>
      
      {currentView === 'register' && (
        <div>
          {/* 1. 管理開始・リセットボタン群 */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '30px' }}>
            <button onClick={startTimerView} style={{ padding: '12px 24px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', flexGrow: 1, fontSize: '16px' }}>
              この設定・名簿で管理を開始（画面2へ）
            </button>
            <button onClick={handleClearWorkers} style={{ padding: '12px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
              名簿リセット
            </button>
          </div>

          {/* 2. 現場環境設定 */}
          <h2>現場環境設定</h2>
          <div style={{ marginBottom: '15px' }}>
            <label>基準とする指標: </label>
            <select 
              value={inputMode} 
              onChange={(e) => setInputMode(e.target.value)}
              style={{ padding: '5px', fontSize: '16px', marginLeft: '10px' }}
            >
              <option value="temperature">気温のみ</option>
              <option value="wbgt">WBGT（気温＋湿度から算出）</option>
            </select>
          </div>

          <div style={{ padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '8px', marginBottom: '30px' }}>
            <p style={{ margin: '0 0 10px 0', fontWeight: 'bold' }}>気温: {temperature}℃</p>
            <input
              type="range" min="20" max="45" value={temperature}
              onChange={(e) => setTemperature(Number(e.target.value))}
              style={{ width: '100%', marginBottom: '15px' }}
            />
            
            {inputMode === 'wbgt' && (
              <>
                <p style={{ margin: '0 0 10px 0', fontWeight: 'bold' }}>天候の目安（湿度一発入力）:</p>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                  <button onClick={() => setHumidity(50)} style={{ flex: 1, padding: '10px', backgroundColor: humidity >= 40 && humidity < 60 ? '#fff3e0' : 'white', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer' }}>
                    ☀️ 晴れ (約50%)
                  </button>
                  <button onClick={() => setHumidity(70)} style={{ flex: 1, padding: '10px', backgroundColor: humidity >= 60 && humidity < 80 ? '#eceff1' : 'white', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer' }}>
                    ☁️ 曇り (約70%)
                  </button>
                  <button onClick={() => setHumidity(90)} style={{ flex: 1, padding: '10px', backgroundColor: humidity >= 80 ? '#e3f2fd' : 'white', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer' }}>
                    ☔️ 雨 (約90%)
                  </button>
                </div>

                <p style={{ margin: '0 0 10px 0' }}>湿度の微調整: {humidity}％</p>
                <input
                  type="range" min="20" max="100" value={humidity}
                  onChange={(e) => setHumidity(Number(e.target.value))}
                  style={{ width: '100%', marginBottom: '5px' }}
                />
                
                <div style={{ marginTop: '15px', padding: '10px', borderLeft: '4px solid #d32f2f', backgroundColor: '#fff' }}>
                  <h3 style={{ color: '#d32f2f', margin: '0 0 5px 0' }}>
                    推定WBGT（暑さ指数）: {estimateWBGT(temperature, humidity)}
                  </h3>
                  <p style={{ fontSize: '12px', color: '#666', margin: 0 }}>
                    ※目安：25以上で警戒、28以上で厳重警戒、31以上で危険
                  </p>
                </div>
              </>
            )}
          </div>

          {/* 3. 現在の名簿 */}
          <h2>現在の名簿</h2>
          <ul style={{ marginBottom: '30px' }}>
            {workers.length > 0 ? (
              workers.map(w => (
                <li key={w.id} style={{ marginBottom: '5px' }}>
                  {w.name} (身長: {w.height}cm, 体重: {w.weight}kg, 負荷: {getWorkloadText(w.workload)})
                </li>
              ))
            ) : (
              <li style={{ color: '#666' }}>登録された作業員はいません</li>
            )}
          </ul>

          {/* 4. 作業員登録 */}
          <h2>作業員登録</h2>
          <div style={{ border: '1px solid #ccc', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
            <div style={{ marginBottom: '10px' }}>
              <label>名前: </label>
              <input type="text" value={newName} onChange={e => setNewName(e.target.value)} />
            </div>
            <div style={{ marginBottom: '10px' }}>
              <label>身長(cm): </label>
              <input type="number" value={newHeight} onChange={e => setNewHeight(e.target.value)} />
            </div>
            <div style={{ marginBottom: '10px' }}>
              <label>体重(kg): </label>
              <input type="number" value={newWeight} onChange={e => setNewWeight(e.target.value)} />
            </div>
            <div style={{ marginBottom: '10px' }}>
              <label>労働負荷: </label>
              <select 
                value={newWorkload} 
                onChange={e => setNewWorkload(Number(e.target.value))}
                style={{ padding: '5px', fontSize: '16px', marginLeft: '5px' }}
              >
                <option value={0.8}>軽作業</option>
                <option value={1.0}>中作業</option>
                <option value={1.2}>重作業</option>
              </select>
            </div>
            <button onClick={handleAddWorker} style={{ padding: '8px 16px', cursor: 'pointer' }}>リストに追加</button>
          </div>
        </div>
      )}

      {currentView === 'timer' && (
        <div>
          <button onClick={() => setCurrentView('register')} style={{ marginBottom: '20px', cursor: 'pointer', padding: '8px 16px' }}>
            ← 設定・名簿画面に戻る
          </button>
          
          <h2>作業員ステータス</h2>
          {isLoading ? (
            <p>S3からデータを復元中...</p>
          ) : (
            <div style={{ display: 'grid', gap: '15px' }}>
              {workers.map(w => {
                const timeLeft = timers[w.id] || 0;
                const isAlert = timeLeft === 0;
                return (
                  <div key={w.id} style={{
                    border: '1px solid #ccc', borderRadius: '8px', padding: '15px',
                    backgroundColor: isAlert ? '#ffebee' : 'white'
                  }}>
                    <h3>{w.name}</h3>
                    <p style={{ fontSize: '28px', fontWeight: 'bold', color: isAlert ? 'red' : 'black' }}>
                      {isAlert ? '補給時間！' : `残り ${formatTime(timeLeft)}`}
                    </p>
                    <button
                      onClick={() => handleHydration(w)}
                      style={{ padding: '10px 20px', cursor: 'pointer', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px' }}
                    >
                      補給完了（S3記録＆リセット）
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}