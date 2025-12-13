import { useState, useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

function App() {
  // 状态管理
  const [goalTime, setGoalTime] = useState('03:00:00'); 
  const [distance, setDistance] = useState(42.195);     
  const [splits, setSplits] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false); // 防止重复点击

  // 这里的 ref 用于标记我们要“截图”的区域
  const printRef = useRef(null);

  const presets = ['03:00:00', '03:30:00', '04:00:00', '04:30:00', '05:00:00'];

  useEffect(() => {
    calculateSplits();
  }, [goalTime, distance]);

  const calculateSplits = () => {
    const [h, m, s] = goalTime.split(':').map(Number);
    if (isNaN(h)) return;
    const totalSeconds = (h || 0) * 3600 + (m || 0) * 60 + (s || 0);
    const pacePerKm = totalSeconds / distance;

    const newSplits = [];
    const loopCount = Math.ceil(distance);

    for (let i = 1; i <= loopCount; i++) {
      const currentTotalSeconds = pacePerKm * i;
      const hh = Math.floor(currentTotalSeconds / 3600);
      const mm = Math.floor((currentTotalSeconds % 3600) / 60);
      const ss = Math.floor(currentTotalSeconds % 60);
      const timeStr = `${hh}:${mm.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}`;
      newSplits.push({ km: i, time: timeStr });
    }
    setSplits(newSplits);
  };

  // 核心功能：生成并下载 PDF
  const downloadPDF = async () => {
    if (!printRef.current) return;
    setIsGenerating(true);

    try {
      // 1. 高清截图 (scale: 2 保证打印清晰)
      const canvas = await html2canvas(printRef.current, {
        scale: 2, 
        useCORS: true,
        backgroundColor: '#ffffff' // 确保背景是白色的
      });

      // 2. 初始化 PDF (A4纸)
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgData = canvas.toDataURL('image/png');

      // 3. 计算图片在 A4 纸上的尺寸 (保持比例)
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

      // 4. 将图片添加到 PDF (居中显示，留出边距)
      // 我们把宽度设为 60mm (约手环真实宽度)，高度自动缩放
      const printWidth = 60; 
      const printHeight = (imgProps.height * printWidth) / imgProps.width;
      
      pdf.addImage(imgData, 'PNG', 10, 10, printWidth, printHeight);
      
      // 5. 保存
      pdf.save(`pace-band-${goalTime}.pdf`);
    } catch (error) {
      console.error('PDF生成失败', error);
      alert('生成失败，请重试');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 py-10 px-4 font-sans text-slate-800">
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-10">
        
        {/* 左侧：控制面板 */}
        <div className="bg-white p-8 rounded-2xl shadow-xl h-fit">
          <h1 className="text-3xl font-bold mb-6 text-blue-600">🏃‍♂️ 配速手环生成器</h1>
          
          <div className="mb-6">
            <label className="block text-sm font-semibold mb-2 text-gray-600">比赛距离</label>
            <div className="flex gap-4">
              <button 
                onClick={() => setDistance(42.195)}
                className={`flex-1 py-3 rounded-xl border-2 font-medium transition-all ${distance === 42.195 ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 hover:border-gray-300'}`}
              >
                全马 (42k)
              </button>
              <button 
                onClick={() => setDistance(21.0975)}
                className={`flex-1 py-3 rounded-xl border-2 font-medium transition-all ${distance === 21.0975 ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 hover:border-gray-300'}`}
              >
                半马 (21k)
              </button>
            </div>
          </div>

          <div className="mb-8">
            <label className="block text-sm font-semibold mb-2 text-gray-600">目标完赛时间 (HH:MM:SS)</label>
            <input 
              type="text" 
              value={goalTime}
              onChange={(e) => setGoalTime(e.target.value)}
              className="w-full text-3xl font-mono p-4 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none text-center tracking-widest"
            />
            <div className="flex flex-wrap gap-2 mt-4">
              {presets.map(time => (
                <button 
                  key={time}
                  onClick={() => setGoalTime(time)}
                  className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-full text-xs font-medium text-gray-600 transition"
                >
                  Sub {time.slice(0,2)}:{time.slice(3,5)}
                </button>
              ))}
            </div>
          </div>

          {/* 新增：下载按钮 */}
          <button 
            onClick={downloadPDF}
            disabled={isGenerating}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? '正在生成...' : '📄 下载 PDF (可打印)'}
          </button>

          <div className="mt-4 bg-blue-50 p-4 rounded-lg text-sm text-blue-800">
            💡 调整数据后点击下载。建议使用 A4 纸打印，然后沿虚线剪下。
          </div>
        </div>

        {/* 右侧：预览区域 */}
        <div className="flex justify-center items-start overflow-hidden">
          {/* 这里加了 ref，告诉 html2canvas 截取这个 div */}
          <div ref={printRef} className="p-8 bg-white rounded-lg relative inline-block">
            <div className="relative">
              <div id="pace-band-preview" className="bg-white w-24 border-2 border-gray-800 text-[10px] leading-none shadow-2xl">
                <div className="bg-black text-white text-center py-1 font-bold uppercase">
                  {distance > 30 ? 'Marathon' : 'Half'}
                  <div className="text-xs text-yellow-400">{goalTime.slice(0,5)}</div>
                </div>

                <div className="grid grid-cols-2 border-b-2 border-black font-bold bg-gray-200 text-center py-1">
                  <div>KM</div>
                  <div>TIME</div>
                </div>

                {splits.map((split) => (
                  <div 
                    key={split.km} 
                    className={`grid grid-cols-2 text-center py-[2px] border-b border-gray-300 
                      ${split.km % 5 === 0 ? 'bg-gray-100 font-bold border-gray-800 border-b-2' : ''}
                    `}
                  >
                    <div className="border-r border-gray-300">{split.km}</div>
                    <div>{split.time.slice(0, 5)}</div>
                  </div>
                ))}
                
                <div className="bg-black text-white text-[8px] text-center py-1">
                  Good Luck!
                </div>
              </div>

              {/* 剪切线 */}
              <div className="absolute -left-4 top-0 bottom-0 border-l-2 border-dashed border-gray-300 flex items-center">
                <span className="-rotate-90 text-gray-400 text-xs whitespace-nowrap">Cut Here</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

export default App