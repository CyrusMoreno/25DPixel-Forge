import { useState } from 'react';
import { Check, Copy, FileCode2, FileJson, FileText } from 'lucide-react';
import {
  EngineTarget,
  GeneratedAtlas,
  PaletteTheme,
  StudioMode,
  TilemapConfig,
} from '../types/studio';
import {
  downloadAgkSubimages,
  downloadAtlasPng,
  downloadJsonManifest,
  getEngineGuideSpec,
} from '../engine/exportBuilder';

interface EngineSpecPanelProps {
  engine: EngineTarget;
  onEngineChange: (engine: EngineTarget) => void;
  mode: StudioMode;
  atlas: GeneratedAtlas;
  tileConfig: TilemapConfig;
  palette: PaletteTheme;
  assetPrefix: string;
}

const ENGINE_TABS: Array<{ id: EngineTarget; label: string }> = [
  { id: 'godot', label: 'Godot 4' },
  { id: 'gamemaker', label: 'GameMaker' },
  { id: 'agk', label: 'AGK Studio' },
];

export function EngineSpecPanel({
  engine,
  onEngineChange,
  mode,
  atlas,
  tileConfig,
  palette,
  assetPrefix,
}: EngineSpecPanelProps) {
  const [copied, setCopied] = useState(false);

  const guide = getEngineGuideSpec(engine, mode, atlas, tileConfig);

  const handleCopySnippet = async () => {
    try {
      await navigator.clipboard.writeText(guide.snippetCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard blocked in some embedded contexts; ignore gracefully
    }
  };

  return (
    <aside className="w-full lg:w-[300px] shrink-0 border-t lg:border-t-0 lg:border-l border-slate-800 bg-slate-900/50 flex flex-col overflow-y-auto">
      <div className="p-4 border-b border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-100">
            Engine Import Specs
          </h2>
          <span className="text-xs font-mono text-slate-400">RGBA PNG</span>
        </div>

        <div className="grid grid-cols-3 gap-1 p-1 bg-slate-950 border border-slate-800 rounded-md">
          {ENGINE_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onEngineChange(tab.id)}
              className={`py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
                engine === tab.id
                  ? 'bg-slate-800 text-emerald-300'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 space-y-4 flex-1">
        <div className="space-y-2">
          <div className="text-xs font-medium text-slate-300">
            {guide.engineName}
          </div>
          <dl className="divide-y divide-slate-800/80 border border-slate-800 rounded bg-slate-950/60">
            {guide.specs.map((spec) => (
              <div
                key={spec.label}
                className="px-3 py-2 flex items-center justify-between gap-2 text-xs"
              >
                <dt className="text-slate-400 truncate">{spec.label}</dt>
                <dd className="font-mono tabular-nums text-slate-100 text-right shrink-0">
                  {spec.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Copyable Code Snippet */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
              <FileCode2 className="w-3.5 h-3.5 text-slate-400" />
              <span>{guide.snippetTitle}</span>
            </span>
            <button
              type="button"
              onClick={handleCopySnippet}
              className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
          <pre className="p-3 text-[11px] leading-relaxed font-mono text-slate-300 bg-slate-950 border border-slate-800 rounded overflow-x-auto">
            {guide.snippetCode}
          </pre>
        </div>

        {/* Download Files */}
        <div className="space-y-2 pt-2 border-t border-slate-800">
          <span className="block text-xs font-medium text-slate-300">
            Download Asset Files
          </span>

          <button
            type="button"
            onClick={() => downloadAtlasPng(atlas, `${assetPrefix}.png`)}
            className="w-full py-2 px-3 text-xs font-semibold text-slate-950 bg-emerald-500 hover:bg-emerald-400 rounded transition-colors cursor-pointer"
          >
            Download Transparent PNG ({atlas.width}×{atlas.height})
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() =>
                downloadJsonManifest(
                  atlas,
                  mode,
                  palette,
                  `${assetPrefix}.json`,
                  tileConfig,
                )
              }
              className="inline-flex items-center justify-center gap-1.5 py-2 px-2.5 text-xs font-medium text-slate-200 bg-slate-950 hover:bg-slate-800 border border-slate-700 rounded transition-colors cursor-pointer"
            >
              <FileJson className="w-3.5 h-3.5 text-slate-400" />
              <span>Atlas .json</span>
            </button>

            <button
              type="button"
              onClick={() =>
                downloadAgkSubimages(atlas, `${assetPrefix} subimages.txt`)
              }
              className="inline-flex items-center justify-center gap-1.5 py-2 px-2.5 text-xs font-medium text-slate-200 bg-slate-950 hover:bg-slate-800 border border-slate-700 rounded transition-colors cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              <span>subimages.txt</span>
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
