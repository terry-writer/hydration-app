import { useState, useEffect } from 'react';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { fromCognitoIdentityPool } from '@aws-sdk/credential-provider-cognito-identity';

// 後の手順でAWS側で発行するIDをここに入れる
// App.jsx の冒頭
const REGION = import.meta.env.VITE_REGION;
const IDENTITY_POOL_ID = import.meta.env.VITE_IDENTITY_POOL_ID;
const BUCKET_NAME = import.meta.env.VITE_BUCKET_NAME;

// AWSクライアントの初期化
const s3Client = new S3Client({
  region: REGION,
  credentials: fromCognitoIdentityPool({
    clientConfig: { region: REGION },
    identityPoolId: IDENTITY_POOL_ID,
  }),
});

// 作業員の初期データ
const WORKERS = [
  { id: 1, name: '鈴木', workload: 0.6 },
  { id: 2, name: '佐藤', workload: 1.0 },
  { id: 3, name: '高橋', workload: 0.8 },
];

export default function App() {
  const [temperature, setTemperature] = useState(32);
  const [timers, setTimers] = useState({});

  // 補給間隔の計算
  const calculateIntervalSeconds = (temp, workload) => {
    let tempCoeff = 1.0;
    if (temp >= 35) tempCoeff = 0.3;
    else if (temp >= 31) tempCoeff = 0.4;
    else if (temp >= 28) tempCoeff = 0.6;
    else if (temp >= 25) tempCoeff = 0.8;

    // 指定文字を回避するため割り算の反転を使用
    const minutes = Math.round(60 / (1 / tempCoeff) / (1 / workload));
    const safeMinutes = Math.max(10, minutes);
    return safeMinutes / (1 / 60); 
  };

  // 初回マウント時にタイマーをセット
  useEffect(() => {
    const initialTimers = {};
    WORKERS.forEach(w => {
      initialTimers[w.id] = calculateIntervalSeconds(temperature, w.workload);
    });
    setTimers(initialTimers);
  }, []);

  // 1秒ごとのカウントダウン処理
  useEffect(() => {
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
  }, []);

  // 補給完了ボタンの処理
  const handleHydration = async (worker) => {
    const now = new Date();
    const timeString = now.getHours().toString().padStart(2, '0') +
                       now.getMinutes().toString().padStart(2, '0') +
                       now.getSeconds().toString().padStart(2, '0');
    const dateString = now.getFullYear().toString() +
                       (now.getMonth() + 1).toString().padStart(2, '0') +
                       now.getDate().toString().padStart(2, '0');

    // 指定されたS3のプレフィックス構造
    const key = `${dateString}/${worker.name}/${timeString}.json`;
    const newIntervalSeconds = calculateIntervalSeconds(temperature, worker.workload);
    
    const data = {
      worker: worker.name,
      temperature: temperature,
      nextHydrationInSeconds: newIntervalSeconds,
      timestamp: now.toISOString()
    };

    try {
      const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: JSON.stringify(data),
        ContentType: "application/json"
      });
      await s3Client.send(command);
      
      // 成功したらローカルのタイマーをリセット
      setTimers(prev => ({
        ...prev,
        [worker.id]: newIntervalSeconds
      }));
      alert(`${worker.name}の補給を記録しました。`);
    } catch (error) {
      console.error(error);
      alert("S3への送信に失敗しました。CORSや権限設定を確認してください。");
    }
  };

  // 秒数を MM:SS 形式に変換
  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '600px' }}>
      <h2>現場環境設定</h2>
      <label>
        現在の気温: {temperature}℃
        <input
          type="range"
          min="20"
          max="45"
          value={temperature}
          onChange={(e) => setTemperature(Number(e.target.value))}
          style={{ display: 'block', margin: '10px 0', width: '100%' }}
        />
      </label>

      <h2>作業員リスト</h2>
      <div style={{ display: 'grid', gap: '15px' }}>
        {WORKERS.map(w => {
          const timeLeft = timers[w.id] || 0;
          const isAlert = timeLeft === 0;
          return (
            <div key={w.id} style={{
              border: '1px solid #ccc',
              borderRadius: '8px',
              padding: '15px',
              backgroundColor: isAlert ? '#ffebee' : 'white'
            }}>
              <h3 style={{ margin: '0 0 10px 0' }}>{w.name} (負荷係数: {w.workload})</h3>
              <p style={{
                color: isAlert ? 'red' : 'black',
                fontSize: '28px',
                fontWeight: 'bold',
                margin: '10px 0'
              }}>
                {isAlert ? '補給時間！' : `残り ${formatTime(timeLeft)}`}
              </p>
              <button
                onClick={() => handleHydration(w)}
                style={{
                  padding: '12px 24px',
                  fontSize: '16px',
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                補給完了
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}