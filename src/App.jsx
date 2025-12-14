import { useState, useEffect, useRef, useCallback } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { translations } from './translations';

// --- Style Definitions ---

const THEMES = {
  obsidian: {
    id: 'obsidian',
    name: 'Obsidian',
    colors: {
      bg: '#ffffff',
      headerBg: '#000000',
      headerText: '#ffffff',
      accent: '#fbbf24', // amper/yellow
      text: '#1f2937',
      border: '#000000',
      rowEven: '#e5e7eb',
      rowOdd: '#ffffff',
      divider: '#d1d5db'
    }
  },
  oceanic: {
    id: 'oceanic',
    name: 'Oceanic',
    colors: {
      bg: '#f0f9ff',
      headerBg: '#0c4a6e', // deep blue
      headerText: '#e0f2fe',
      accent: '#38bdf8', // light blue
      text: '#0c4a6e',
      border: '#075985',
      rowEven: '#e0f2fe',
      rowOdd: '#f0f9ff',
      divider: '#bae6fd'
    }
  },
  sunset: {
    id: 'sunset',
    name: 'Sunset',
    colors: {
      bg: '#fff7ed',
      headerBg: '#be123c', // rose red
      headerText: '#fff1f2',
      accent: '#fbbf24', // amber
      text: '#881337',
      border: '#be123c',
      rowEven: '#ffe4e6',
      rowOdd: '#fff7ed',
      divider: '#fecdd3'
    }
  },
  forest: {
    id: 'forest',
    name: 'Forest',
    colors: {
      bg: '#f0fdf4',
      headerBg: '#14532d', // dark green
      headerText: '#dcfce7',
      accent: '#4ade80', // bright green
      text: '#14532d',
      border: '#166534',
      rowEven: '#dcfce7',
      rowOdd: '#f0fdf4',
      divider: '#86efac'
    }
  },
  cyber: {
    id: 'cyber',
    name: 'Cyber',
    colors: {
      bg: '#000000',
      headerBg: '#1e1e1e',
      headerText: '#ec4899', // pink
      accent: '#06b6d4', // cyan
      text: '#ffffff',
      border: '#ec4899',
      rowEven: '#111827',
      rowOdd: '#000000',
      divider: '#374151'
    }
  }
};

const PATTERNS = {
  none: { id: 'none', name: 'Solid', css: 'none' },
  lines: {
    id: 'lines',
    name: 'Lines',
    css: 'repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(0,0,0,0.05) 5px, rgba(0,0,0,0.05) 10px)'
  },
  dots: {
    id: 'dots',
    name: 'Dots',
    css: 'radial-gradient(rgba(0,0,0,0.1) 1px, transparent 1px)',
    size: '8px 8px'
  },
  grid: {
    id: 'grid',
    name: 'Grid',
    css: 'linear-gradient(rgba(0,0,0,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.05) 1px, transparent 1px)',
    size: '10px 10px'
  }
};

function App() {
  // State Management
  const [goalTime, setGoalTime] = useState('03:00:00');
  const [unit, setUnit] = useState('km'); // 'km' or 'mi'
  const [distance, setDistance] = useState(42.195);
  const [splits, setSplits] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);

  // Style State
  const [currentTheme, setCurrentTheme] = useState(THEMES.obsidian);
  const [currentPattern, setCurrentPattern] = useState(PATTERNS.none);

  // Language State
  const [lang, setLang] = useState('zh');
  const t = translations[lang];

  const printRef = useRef(null);
  const presets = ['03:00:00', '03:30:00', '04:00:00', '04:30:00', '05:00:00'];

  // Handle unit change
  const handleUnitChange = (newUnit) => {
    if (newUnit === unit) return;

    // Convert current distance to new unit to maintain race type if possible,
    // or just reset to standard Marathon distance in new unit for simplicity?
    // Let's reset to full marathon in the new unit to avoid weird floating point conversions of arbitrary values.
    // Or better: check if it's currently a standard distance and switch to the equivalent standard.

    // const isMarathon = Math.abs(distance - 42.195) < 0.1 || Math.abs(distance - 26.2188) < 0.1;

    const isHalf = Math.abs(distance - 21.0975) < 0.1 || Math.abs(distance - 13.1094) < 0.1;

    setUnit(newUnit);

    if (newUnit === 'km') {
      if (isHalf) setDistance(21.0975);
      else setDistance(42.195);
    } else {
      if (isHalf) setDistance(13.1094);
      else setDistance(26.2188);
    }
  };

  const setRaceDistance = (type) => { // type: 'full' | 'half'
    if (unit === 'km') {
      setDistance(type === 'full' ? 42.195 : 21.0975);
    } else {
      setDistance(type === 'full' ? 26.2188 : 13.1094);
    }
  };

  const calculateSplits = useCallback(() => {
    const [h, m, s] = goalTime.split(':').map(Number);
    if (isNaN(h)) return;
    const totalSeconds = (h || 0) * 3600 + (m || 0) * 60 + (s || 0);
    const pacePerUnit = totalSeconds / distance;

    const newSplits = [];
    const floorDist = Math.floor(distance);

    // 1. Integer units
    for (let i = 1; i <= floorDist; i++) {
      const currentTotalSeconds = pacePerUnit * i;
      const hh = Math.floor(currentTotalSeconds / 3600);
      const mm = Math.floor((currentTotalSeconds % 3600) / 60);
      const ss = Math.floor(currentTotalSeconds % 60);
      const timeStr = `${hh}:${mm.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}`;
      newSplits.push({
        dist: i,
        time: timeStr
      });
    }

    // 2. Final Exact Distance (Finish Line)
    const hh = Math.floor(totalSeconds / 3600);
    const mm = Math.floor((totalSeconds % 3600) / 60);
    const ss = Math.floor(totalSeconds % 60);
    const finishTimeStr = `${hh}:${mm.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}`;

    // Format distance nicely for display
    const displayDist = unit === 'km'
      ? distance.toFixed(3).replace(/\.?0+$/, '')
      : distance.toFixed(2).replace(/\.?0+$/, '');

    newSplits.push({ dist: displayDist, time: finishTimeStr });

    setSplits(newSplits);
  }, [goalTime, distance, unit]);

  useEffect(() => {
    calculateSplits();
  }, [goalTime, distance, calculateSplits]);

  const downloadPDF = async () => {
    if (!printRef.current) return;
    setIsGenerating(true);

    // Save current scroll position
    const scrollPos = window.scrollY;

    try {
      // Scroll to top to prevent canvas offset issues
      window.scrollTo(0, 0);

      const canvas = await html2canvas(printRef.current, {
        scale: 3, // Slightly reduced from 4 to improve stability
        useCORS: true,
        backgroundColor: null,
        scrollY: 0, // Force scroll position to 0 for capture
        scrollX: 0
      });

      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgData = canvas.toDataURL('image/png');

      const imgProps = pdf.getImageProperties(imgData);

      // Standard Pace Band Width is roughly 5-6cm
      const printWidth = 50;
      const printHeight = (imgProps.height * printWidth) / imgProps.width;

      // Center horizontally on A4 (210mm wide)
      const marginX = (210 - printWidth) / 2;

      pdf.addImage(imgData, 'PNG', marginX, 10, printWidth, printHeight);
      pdf.save(`pace-band-${goalTime}.pdf`);
    } catch (error) {
      console.error('PDF Generation Failed', error);
      alert('Failed to generate PDF, please try again.');
    } finally {
      // Restore scroll
      window.scrollTo(0, scrollPos);
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 py-10 px-4 font-sans text-slate-800">
      <main className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10">

        {/* Left: Controls (Size: 4 cols) */}
        <section className="lg:col-span-4 space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-xl">
            <header className="mb-6 flex justify-between items-center">
              <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                <span>🏃‍♂️</span> {t.title}
              </h1>
              <div className="flex bg-slate-100 rounded-lg p-1">
                <button
                  onClick={() => setLang('en')}
                  className={`px-2 py-1 text-xs font-bold rounded ${lang === 'en' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}
                >
                  EN
                </button>
                <button
                  onClick={() => setLang('zh')}
                  className={`px-2 py-1 text-xs font-bold rounded ${lang === 'zh' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}
                >
                  中
                </button>
              </div>
            </header>

            {/* Unit Selection */}
            <div className="mb-6 bg-slate-100 p-1 rounded-xl flex">
              <button
                onClick={() => handleUnitChange('km')}
                className={`flex-1 py-1 text-xs font-bold rounded-lg transition-all ${unit === 'km' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
              >
                {t.unit_km}
              </button>
              <button
                onClick={() => handleUnitChange('mi')}
                className={`flex-1 py-1 text-xs font-bold rounded-lg transition-all ${unit === 'mi' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
              >
                {t.unit_mi}
              </button>
            </div>

            {/* Distance Selection */}
            <div className="mb-6">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">{t.distance_label}</label>
              <div className="flex bg-slate-100 p-1 rounded-xl">
                <button
                  onClick={() => setRaceDistance('full')}
                  className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${(distance > 30 && unit === 'km') || (distance > 20 && unit === 'mi') ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  {t.full_marathon} ({unit === 'km' ? '42k' : '26.2m'})
                </button>
                <button
                  onClick={() => setRaceDistance('half')}
                  className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${(distance < 30 && unit === 'km') || (distance < 20 && unit === 'mi') ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  {t.half_marathon} ({unit === 'km' ? '21k' : '13.1m'})
                </button>
              </div>
            </div>

            {/* Time Target */}
            <div className="mb-6">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">{t.target_time_label}</label>
              <input
                type="text"
                value={goalTime}
                onChange={(e) => setGoalTime(e.target.value)}
                className="w-full text-2xl font-mono font-bold p-3 border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:outline-none text-center tracking-widest bg-slate-50 transition-colors"
                aria-label="Target Time"
              />
              <div className="flex flex-wrap gap-2 mt-3">
                {presets.map(time => (
                  <button
                    key={time}
                    onClick={() => setGoalTime(time)}
                    className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded text-[10px] font-bold text-slate-600 transition uppercase"
                  >
                    {time.slice(0, 5)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Style Controls */}
          <div className="bg-white p-6 rounded-2xl shadow-xl">
            <h2 className="text-lg font-bold mb-4 text-slate-800">{t.style_customization}</h2>

            {/* Theme Selection */}
            <div className="mb-6">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">{t.color_theme_label}</label>
              <div className="grid grid-cols-5 gap-2">
                {Object.values(THEMES).map(theme => (
                  <button
                    key={theme.id}
                    onClick={() => setCurrentTheme(theme)}
                    title={t[`theme_${theme.id}`]}
                    aria-label={`Select ${t[`theme_${theme.id}`]} theme`}
                    className={`w-full aspect-square rounded-full border-2 transition-transform hover:scale-110 ${currentTheme.id === theme.id ? 'border-slate-800 scale-110 ring-2 ring-blue-200' : 'border-transparent'}`}
                    style={{ background: `linear-gradient(135deg, ${theme.colors.headerBg} 50%, ${theme.colors.accent} 50%)` }}
                  />
                ))}
              </div>
              <div className="text-center mt-2 text-xs font-medium text-slate-500">{t[`theme_${currentTheme.id}`]}</div>
            </div>

            {/* Pattern Selection */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">{t.texture_label}</label>
              <div className="grid grid-cols-4 gap-2">
                {Object.values(PATTERNS).map(pattern => (
                  <button
                    key={pattern.id}
                    onClick={() => setCurrentPattern(pattern)}
                    aria-label={`Select ${t[`pattern_${pattern.id}`]} pattern`}
                    className={`h-12 rounded-lg border-2 transition-all ${currentPattern.id === pattern.id ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 hover:border-slate-300'}`}
                    style={{
                      background: pattern.css !== 'none' ? pattern.css : undefined,
                      backgroundSize: pattern.size
                    }}
                  >
                    <span className="sr-only">{t[`pattern_${pattern.id}`]}</span>
                  </button>
                ))}
              </div>
              <div className="text-center mt-2 text-xs font-medium text-slate-500">{t[`pattern_${currentPattern.id}`]}</div>
            </div>
          </div>

          <button
            onClick={downloadPDF}
            disabled={isGenerating}
            className="w-full py-4 bg-slate-900 hover:bg-black text-white font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group"
          >
            {isGenerating ? (
              t.generating
            ) : (
              <>
                <span>{t.download_btn}</span>
                <span className="group-hover:translate-x-1 transition-transform">→</span>
              </>
            )}
          </button>
        </section>

        {/* Right: Preview (Size: 8 cols) */}
        <section className="lg:col-span-8 flex justify-center items-start bg-slate-200/50 rounded-2xl p-10 overflow-auto border border-slate-200 shadow-inner">
          <div ref={printRef} className="p-8 bg-white rounded-lg relative inline-block shadow-2xl">
            <div className="relative">
              {/* Pace Band Implementation */}
              <div
                id="pace-band-preview"
                className="w-24 text-[10px] leading-none shadow-sm flex flex-col"
                style={{
                  fontFamily: 'Inter, sans-serif',
                  borderColor: currentTheme.colors.border,
                  borderWidth: '2px',
                  color: currentTheme.colors.text
                }}
              >
                {/* Header */}
                <header
                  className="py-2 px-1 text-center font-bold uppercase flex flex-col justify-center items-center gap-1 relative overflow-hidden"
                  style={{
                    backgroundColor: currentTheme.colors.headerBg,
                    color: currentTheme.colors.headerText
                  }}
                >
                  {/* Texture Overlay */}
                  <div
                    className="absolute inset-0 opacity-20 pointer-events-none"
                    style={{
                      backgroundImage: currentPattern.css,
                      backgroundSize: currentPattern.size
                    }}
                  />

                  <span className="relative z-10 tracking-widest text-[9px] opacity-80">{distance > 25 ? t.preview_marathon : t.preview_half}</span>
                  <span className="relative z-10 text-lg leading-none" style={{ color: currentTheme.colors.accent }}>{goalTime.slice(0, 5)}</span>
                </header>

                {/* Table Header */}
                <div
                  className="grid grid-cols-2 text-center py-1 font-bold text-[8px] tracking-wider"
                  style={{
                    backgroundColor: currentTheme.colors.divider,
                    borderBottom: `1px solid ${currentTheme.colors.border}`,
                    color: currentTheme.colors.text
                  }}
                >
                  <div style={{ borderRight: `1px solid ${currentTheme.colors.border}` }}>{unit === 'km' ? t.preview_km : t.preview_mi}</div>
                  <div>{t.preview_time}</div>
                </div>

                {/* Splits */}
                <div className="flex-1">
                  {splits.map((split, index) => {
                    // Check if it's a "major" split (every 5km or 5mi)
                    // Note: split.dist might be a string for the last row ("42.195"), so parseInt handles generic check
                    // But for the last row we might want special styling?
                    // Let's simple check: if it's close to finish or multiple of 5
                    const distVal = parseInt(split.dist);
                    const isMajor = distVal > 0 && distVal % 5 === 0;

                    const rowBg = index % 2 === 0 ? currentTheme.colors.rowOdd : currentTheme.colors.rowEven;

                    return (
                      <div
                        key={split.dist}
                        className={`grid grid-cols-2 text-center py-[4px] border-b relative items-center leading-tight`}
                        style={{
                          backgroundColor: isMajor ? currentTheme.colors.divider : rowBg,
                          borderColor: currentTheme.colors.divider,
                          fontWeight: isMajor ? 'bold' : 'normal',
                          color: isMajor ? currentTheme.colors.text : currentTheme.colors.text
                        }}
                      >
                        {/* Texture Overlay on rows too? Maybe too busy. Let's keep it clean for data. */}
                        <div
                          className="absolute inset-0 opacity-5 pointer-events-none"
                          style={{
                            backgroundImage: currentPattern.css,
                            backgroundSize: currentPattern.size
                          }}
                        />

                        <div style={{ borderRight: `1px solid ${currentTheme.colors.divider}` }}>{split.dist}</div>
                        <div>{split.time.slice(0, 5)}</div>
                      </div>
                    );
                  })}
                </div>

                {/* Footer */}
                <div
                  className="text-center py-1 text-[8px] uppercase tracking-wide"
                  style={{
                    backgroundColor: currentTheme.colors.headerBg,
                    color: currentTheme.colors.headerText
                  }}
                >
                  {t.finish_strong}
                </div>
              </div>

              {/* Cut Line */}
              <div className="absolute -left-6 top-0 bottom-0 border-l-2 border-dashed border-gray-400 flex items-center h-full">
                <span className="-rotate-90 text-gray-400 text-xs whitespace-nowrap origin-center translate-x-[-10px]">{t.cut_here}</span>
              </div>
            </div>
          </div>
        </section>

      </main>
    </div>
  )
}

export default App