import { useEffect, useRef, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';

ChartJS.register( CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend );

export default function App()
{
  const [chartData, setChartData] = useState
  ({
    labels: [],
    datasets:
    [{
      label: 'Peak Amplitude',
      data: [],
      backgroundColor: 'blue',
      barPercentage: 0.1,
      categoryPercentage: 1.0
    }]
  });

  const [currentMsg, setCurrentMsg] = useState('Waiting for data...');

  const wsRef = useRef(null);

  useEffect(() =>
  {
    wsRef.current = new WebSocket('ws://localhost:8765');

    wsRef.current.onmessage = (evt) =>
    {
      const raw = evt.data.trim();
      setCurrentMsg(raw);

      const m = raw.match(/freq=(\d+\.?\d*)Hz,\s*amp=(\d+\.?\d*)/);
      if (!m)
      {
        return;
      }

      const freq = parseFloat(m[1]);
      const amp  = parseFloat(m[2]);

      setChartData
      ({
        labels: [freq],
        datasets:
        [{
          label: 'Peak Amplitude',
          data: [amp],
          backgroundColor: 'blue',
          barPercentage: 0.1,
          categoryPercentage: 1.0
        }]
      });
    };

    return () =>
    {
      if (wsRef.current)
      {
        wsRef.current.close();
      }
    };
  }, []);

  const options =
  {
    responsive: true,
    animation: false,
    maintainAspectRatio: false,
    scales:
    {
      x:
      {
        type: 'linear',
        min: 270,
        max: 620,
        title: { display: true, text: 'Frequency (Hz)' },
        ticks: { stepSize: 25 }
      },
      y:
      {
        beginAtZero: true,
        suggestedMax: 700,
        title: { display: true, text: 'Amplitude' }
      }
    }
  };

  return
  (
    <div style={{ padding: 30 }}>
      <h2 style={{ margin: 0 }}>Peak Frequency Tracking</h2>

      {/* 直接把 raw 訊息印出來 */}
      <div style={{ margin: '8px 0', fontFamily: 'monospace' }}>
        {currentMsg}
      </div>

      <div style={{ width: '100%', height: '80vh', maxWidth: '100vw' }}>
        <Bar data={chartData} options={options} />
      </div>
    </div>
  );
}
