import React, { useState } from 'react';
import {
  Sparkles,
  Plus,
  Trash2,
  Copy,
  Check,
  RotateCw,
  Compass,
  CircleDot,
  ArrowUp,
  ArrowDown,
  Lock,
  Palette
} from 'lucide-react';
import { GradientStop, buildGradientCss } from '../utils/themeHelper';

interface CssGradientGeneratorProps {
  stops: GradientStop[];
  gradientType: 'linear' | 'radial';
  gradientAngle: number;
  radialShape?: 'circle' | 'ellipse';
  isSpark: boolean;
  language: 'tr' | 'en';
  onChange: (data: {
    stops: GradientStop[];
    gradientType: 'linear' | 'radial';
    gradientAngle: number;
    radialShape: 'circle' | 'ellipse';
    css: string;
  }) => void;
  onApplyToTheme?: () => void;
}

export const CssGradientGenerator: React.FC<CssGradientGeneratorProps> = ({
  stops,
  gradientType,
  gradientAngle,
  radialShape = 'circle',
  isSpark,
  language,
  onChange,
  onApplyToTheme
}) => {
  const [copied, setCopied] = useState(false);

  // Generate current CSS
  const currentCss = buildGradientCss(gradientType, stops, gradientAngle, radialShape);

  // Trigger parent change with latest state
  const emitChange = (
    newStops: GradientStop[],
    newType: 'linear' | 'radial',
    newAngle: number,
    newShape: 'circle' | 'ellipse'
  ) => {
    const css = buildGradientCss(newType, newStops, newAngle, newShape);
    onChange({
      stops: newStops,
      gradientType: newType,
      gradientAngle: newAngle,
      radialShape: newShape,
      css
    });
  };

  // Add a new color stop
  const handleAddStop = () => {
    // Generate a complementary or pleasing default color
    const defaultColors = ['#ec4899', '#f59e0b', '#06b6d4', '#10b981', '#8b5cf6', '#ef4444'];
    const nextColor = defaultColors[stops.length % defaultColors.length];

    // Compute midpoint position
    const sortedPositions = [...stops].map((s) => s.position).sort((a, b) => a - b);
    let nextPos = 50;
    if (sortedPositions.length > 0) {
      const last = sortedPositions[sortedPositions.length - 1];
      nextPos = Math.min(100, Math.round(last + (100 - last) / 2));
      if (nextPos === last) nextPos = Math.max(0, last - 15);
    }

    const newStop: GradientStop = {
      id: `stop_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      color: nextColor,
      position: nextPos
    };

    const newStops = [...stops, newStop].sort((a, b) => a.position - b.position);
    emitChange(newStops, gradientType, gradientAngle, radialShape);
  };

  // Delete a color stop (minimum 2 stops required)
  const handleDeleteStop = (id: string) => {
    if (stops.length <= 2) return;
    const newStops = stops.filter((s) => s.id !== id);
    emitChange(newStops, gradientType, gradientAngle, radialShape);
  };

  // Update color of a stop
  const handleColorChange = (id: string, color: string) => {
    const formatted = color.startsWith('#') ? color : `#${color}`;
    const newStops = stops.map((s) => (s.id === id ? { ...s, color: formatted } : s));
    emitChange(newStops, gradientType, gradientAngle, radialShape);
  };

  // Update position percentage of a stop (0 - 100%)
  const handlePositionChange = (id: string, position: number) => {
    const bounded = Math.max(0, Math.min(100, position));
    const newStops = stops.map((s) => (s.id === id ? { ...s, position: bounded } : s));
    emitChange(newStops, gradientType, gradientAngle, radialShape);
  };

  // Reorder stop: Move up / down
  const handleMoveStop = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === stops.length - 1)
    ) {
      return;
    }
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const newStops = [...stops];
    const temp = newStops[index];
    newStops[index] = newStops[targetIndex];
    newStops[targetIndex] = temp;

    emitChange(newStops, gradientType, gradientAngle, radialShape);
  };

  // Copy CSS to clipboard
  const handleCopyCss = () => {
    const fullCssRule = `background: ${currentCss};`;
    navigator.clipboard.writeText(fullCssRule);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-3xl bg-[#0c0c0e] border border-zinc-800 p-5 md:p-6 space-y-6 shadow-xl">
      {/* Module Title & Spark Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/80 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Palette className="w-5 h-5 text-amber-400" />
            <h3 className="text-base font-extrabold text-white tracking-tight">
              {language === 'tr' ? 'CSS Gradyan (Renk Geçişi) Oluşturucu' : 'CSS Gradient Generator'}
            </h3>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-mono font-bold flex items-center gap-1">
              <Sparkles className="w-3 h-3 fill-emerald-400" />
              <span>{language === 'tr' ? 'HERKESE AÇIK' : 'FREE FOR ALL'}</span>
            </span>
          </div>
          <p className="text-xs text-zinc-400">
            {language === 'tr'
              ? 'Çoklu renk durakları ekleyin, lineer açı veya radyal dairesel dağılımı ayarlayın.'
              : 'Add multi-color stops, configure linear angles or radial distributions.'}
          </p>
        </div>

        {onApplyToTheme && (
          <button
            type="button"
            onClick={onApplyToTheme}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-extrabold text-xs shadow-lg shadow-purple-600/20 flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 fill-white" />
            <span>{language === 'tr' ? 'Temaya Uygula' : 'Apply to Theme'}</span>
          </button>
        )}
      </div>

      {/* Interactive Live Preview Box */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-zinc-400 font-mono">
          <span>{language === 'tr' ? 'Canlı Önizleme' : 'Live Preview'}</span>
          <span>{gradientType === 'linear' ? `${gradientAngle}° Lineer` : `Radyal (${radialShape})`}</span>
        </div>
        <div
          className="w-full h-32 md:h-40 rounded-2xl border border-zinc-700/60 shadow-inner flex items-center justify-center relative overflow-hidden transition-all duration-300"
          style={{ background: currentCss }}
        >
          <div className="px-4 py-2 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 text-white font-mono text-xs font-bold shadow-xl">
            {gradientType === 'linear' ? `Angle: ${gradientAngle}°` : `Radial: ${radialShape}`}
          </div>
        </div>
      </div>

      {/* Gradient Type Selector (Lineer / Radyal) */}
      <div className="space-y-3">
        <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider block font-mono">
          {language === 'tr' ? '1. Gradyan Türü & Yön Ayarı' : '1. Gradient Type & Direction'}
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => emitChange(stops, 'linear', gradientAngle, radialShape)}
            className={`p-3 rounded-2xl border text-left transition-all flex items-center gap-3 cursor-pointer ${
              gradientType === 'linear'
                ? 'bg-blue-600/15 border-blue-500/60 text-white ring-1 ring-blue-500/30'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700'
            }`}
          >
            <div className={`p-2 rounded-xl ${gradientType === 'linear' ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400'}`}>
              <Compass className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold">{language === 'tr' ? 'Lineer (Doğrusal)' : 'Linear'}</div>
              <div className="text-[10px] text-zinc-500">{language === 'tr' ? '0° - 360° Açı Geçişi' : '0° - 360° Angle Flow'}</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => emitChange(stops, 'radial', gradientAngle, radialShape)}
            className={`p-3 rounded-2xl border text-left transition-all flex items-center gap-3 cursor-pointer ${
              gradientType === 'radial'
                ? 'bg-blue-600/15 border-blue-500/60 text-white ring-1 ring-blue-500/30'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700'
            }`}
          >
            <div className={`p-2 rounded-xl ${gradientType === 'radial' ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400'}`}>
              <CircleDot className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold">{language === 'tr' ? 'Radyal (Dairesel)' : 'Radial'}</div>
              <div className="text-[10px] text-zinc-500">{language === 'tr' ? 'Merkezden Dışarı Açılan' : 'Center-Outward Flow'}</div>
            </div>
          </button>
        </div>

        {/* Direction Controls */}
        {gradientType === 'linear' ? (
          <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RotateCw className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-bold text-zinc-200">
                  {language === 'tr' ? 'Açı Ayarı (Derece / deg):' : 'Angle Setting (Degrees / deg):'}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min="0"
                  max="360"
                  value={gradientAngle}
                  onChange={(e) => {
                    const val = Number(e.target.value) || 0;
                    emitChange(stops, 'linear', val, radialShape);
                  }}
                  className="w-16 px-2 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-white font-mono text-xs text-center focus:border-blue-500 focus:outline-none"
                />
                <span className="text-xs font-mono text-zinc-400">°</span>
              </div>
            </div>

            {/* Slider */}
            <div className="space-y-1">
              <input
                type="range"
                min="0"
                max="360"
                value={gradientAngle}
                onChange={(e) => emitChange(stops, 'linear', Number(e.target.value), radialShape)}
                className="w-full accent-blue-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] font-mono text-zinc-500">
                <span>0° (Üst)</span>
                <span>90° (Sağ)</span>
                <span>135° (Çapraz)</span>
                <span>180° (Alt)</span>
                <span>270° (Sol)</span>
                <span>360°</span>
              </div>
            </div>

            {/* Quick Angle Presets */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {[0, 45, 90, 135, 180, 225, 270, 315].map((ang) => (
                <button
                  key={ang}
                  type="button"
                  onClick={() => emitChange(stops, 'linear', ang, radialShape)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer ${
                    gradientAngle === ang
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800'
                  }`}
                >
                  {ang}°
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Radial Settings */
          <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-200">
                {language === 'tr' ? 'Radyal Şekil & Dağılım:' : 'Radial Shape & Spread:'}
              </span>
              <div className="flex gap-1 bg-zinc-900 p-1 rounded-xl border border-zinc-800">
                <button
                  type="button"
                  onClick={() => emitChange(stops, 'radial', gradientAngle, 'circle')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    radialShape === 'circle' ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {language === 'tr' ? 'Daire (Circle)' : 'Circle'}
                </button>
                <button
                  type="button"
                  onClick={() => emitChange(stops, 'radial', gradientAngle, 'ellipse')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    radialShape === 'ellipse' ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {language === 'tr' ? 'Elips (Ellipse)' : 'Ellipse'}
                </button>
              </div>
            </div>
            <p className="text-[11px] text-zinc-400">
              {language === 'tr'
                ? 'Renkler merkezden dışarıya doğru dairesel yayılır. Aşağıdaki durak yüzdelerinden merkez ve dış dağılımı ayarlayabilirsiniz.'
                : 'Colors diffuse outwards from center. Adjust stop percentages below for center/edge spread.'}
            </p>
          </div>
        )}
      </div>

      {/* Color Stops Section (Çoklu Renk Desteği - 2'den fazla) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider block font-mono">
            {language === 'tr'
              ? `2. Renk Durakları (${stops.length} Renk)`
              : `2. Color Stops (${stops.length} Colors)`}
          </label>
          <button
            type="button"
            onClick={handleAddStop}
            className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{language === 'tr' ? 'Renk Durağı Ekle' : 'Add Color Stop'}</span>
          </button>
        </div>

        {/* Stops List */}
        <div className="space-y-2.5">
          {stops.map((stop, index) => (
            <div
              key={stop.id}
              className="p-3 rounded-2xl bg-zinc-950 border border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              {/* Left: Color Picker & Hex Input */}
              <div className="flex items-center gap-3">
                <div className="relative flex items-center">
                  <input
                    type="color"
                    value={stop.color}
                    onChange={(e) => handleColorChange(stop.id, e.target.value)}
                    className="w-9 h-9 rounded-xl border border-zinc-700/80 p-0.5 bg-zinc-900 cursor-pointer"
                  />
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] font-mono text-zinc-500 block uppercase">
                    Durak {index + 1}
                  </span>
                  <input
                    type="text"
                    value={stop.color}
                    onChange={(e) => handleColorChange(stop.id, e.target.value)}
                    className="w-24 px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-xs font-mono text-white focus:border-blue-500 focus:outline-none"
                    placeholder="#4c1d95"
                  />
                </div>
              </div>

              {/* Middle: Position Slider & Numeric Input */}
              <div className="flex-1 flex items-center gap-3 max-w-md">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={stop.position}
                  onChange={(e) => handlePositionChange(stop.id, Number(e.target.value))}
                  className="w-full accent-blue-500 cursor-pointer"
                />
                <div className="flex items-center gap-1 flex-shrink-0">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={stop.position}
                    onChange={(e) => handlePositionChange(stop.id, Number(e.target.value))}
                    className="w-14 px-2 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-xs font-mono text-white text-center focus:border-blue-500 focus:outline-none"
                  />
                  <span className="text-xs font-mono text-zinc-500">%</span>
                </div>
              </div>

              {/* Right: Reorder Up/Down & Delete */}
              <div className="flex items-center gap-1 justify-end flex-shrink-0">
                <button
                  type="button"
                  title={language === 'tr' ? 'Yukarı Taşı' : 'Move Up'}
                  disabled={index === 0}
                  onClick={() => handleMoveStop(index, 'up')}
                  className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 disabled:opacity-30 cursor-pointer"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  title={language === 'tr' ? 'Aşağı Taşı' : 'Move Down'}
                  disabled={index === stops.length - 1}
                  onClick={() => handleMoveStop(index, 'down')}
                  className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 disabled:opacity-30 cursor-pointer"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  title={language === 'tr' ? 'Durağı Sil' : 'Delete Stop'}
                  disabled={stops.length <= 2}
                  onClick={() => handleDeleteStop(stop.id)}
                  className="p-1.5 rounded-lg bg-zinc-900 hover:bg-red-500/20 text-zinc-400 hover:text-red-400 border border-zinc-800 disabled:opacity-30 cursor-pointer transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Generated CSS Code Box with Copy */}
      <div className="space-y-2 pt-2 border-t border-zinc-800/80">
        <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
          <span>{language === 'tr' ? 'Oluşturulan CSS Kodu:' : 'Generated CSS Code:'}</span>
          <button
            type="button"
            onClick={handleCopyCss}
            className="flex items-center gap-1.5 text-blue-400 hover:text-blue-300 font-bold transition-colors cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">{language === 'tr' ? 'Kopyalandı!' : 'Copied!'}</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>{language === 'tr' ? 'CSS Kopyala' : 'Copy CSS'}</span>
              </>
            )}
          </button>
        </div>
        <div className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800/90 font-mono text-xs text-emerald-400 select-all overflow-x-auto break-all">
          background: {currentCss};
        </div>
      </div>
    </div>
  );
};
