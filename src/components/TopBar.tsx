import { Download } from 'lucide-react';
import { StudioMode } from '../types/studio';

interface TopBarProps {
  activeMode: StudioMode;
  onModeChange: (mode: StudioMode) => void;
  onExportPng: () => void;
  exportLabel: string;
}

const NAV_ITEMS: Array<{ id: StudioMode; label: string }> = [
  { id: 'tilemap', label: 'Tilemap Atlas' },
  { id: 'spritesheet', label: 'Spritesheet Studio' },
  { id: 'testbed', label: 'Grid Testbed' },
];

export function TopBar({
  activeMode,
  onModeChange,
  onExportPng,
  exportLabel,
}: TopBarProps) {
  return (
    <header className="h-14 border-b border-slate-800 bg-slate-950 px-5 flex items-center justify-between gap-8 shrink-0">
      <a
        href="#top"
        onClick={(e) => {
          e.preventDefault();
          onModeChange('tilemap');
        }}
        className="font-display text-lg font-bold tracking-tight text-slate-50 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded"
      >
        IsoPixel Forge
      </a>

      <nav className="flex items-center gap-6 overflow-x-auto" aria-label="Studio views">
        {NAV_ITEMS.map((item) => {
          const active = activeMode === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onModeChange(item.id)}
              className={`relative py-4 text-sm font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-sm ${
                active
                  ? 'text-emerald-400'
                  : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              {item.label}
              {active && (
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 bottom-0 h-0.5 bg-emerald-500"
                />
              )}
            </button>
          );
        })}
      </nav>

      <div className="flex items-center shrink-0">
        <button
          type="button"
          onClick={onExportPng}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-950 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 rounded-md transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{exportLabel}</span>
        </button>
      </div>
    </header>
  );
}
