import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import type { RenpyAudio, AudioMetadata } from '@/types';

interface AudioEditorViewProps {
  audio: RenpyAudio;
  metadata?: AudioMetadata;
  onSaveMetadata: (currentFilePath: string, newMetadata: AudioMetadata) => Promise<void>;
  onCopyToProject: (sourceFilePath: string, metadata: AudioMetadata) => void;
}

const BAR_COUNT = 64;
const CANVAS_H = 120;

const AudioEditorView: React.FC<AudioEditorViewProps> = ({ audio, metadata, onSaveMetadata, onCopyToProject }) => {
  const [renpyName, setRenpyName] = useState('');
  const [tags, setTags] = useState('');
  const [subfolder, setSubfolder] = useState('');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);

  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const animFrameRef = useRef<number>(0);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setRenpyName(metadata?.renpyName || audio.fileName.split('.').slice(0, -1).join('.'));
    setTags((metadata?.tags || []).join(', '));
    setSubfolder(metadata?.projectSubfolder || '');
    setSaveState('idle');
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  }, [audio, metadata]);

  useEffect(() => () => {
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    cancelAnimationFrame(animFrameRef.current);
    if (audioContextRef.current) audioContextRef.current.close();
  }, []);

  const initAudioContext = useCallback(() => {
    if (!audioRef.current || sourceRef.current) return;
    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = BAR_COUNT * 4;
    analyser.smoothingTimeConstant = 0.75;
    const source = ctx.createMediaElementSource(audioRef.current);
    source.connect(analyser);
    analyser.connect(ctx.destination);
    audioContextRef.current = ctx;
    analyserRef.current = analyser;
    sourceRef.current = source;
  }, []);

  const drawEqualizer = useCallback(() => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(data);

    ctx.clearRect(0, 0, W, H);

    // Background scanlines
    ctx.fillStyle = '#050d14';
    ctx.fillRect(0, 0, W, H);
    for (let y = 0; y < H; y += 4) {
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(0, y, W, 1);
    }

    const slotW = W / BAR_COUNT;
    const barW = Math.max(1, slotW - 2);

    for (let i = 0; i < BAR_COUNT; i++) {
      const value = data[Math.floor(i * data.length / BAR_COUNT)] / 255;
      const barH = Math.max(2, value * H);
      const x = i * slotW + (slotW - barW) / 2;
      const y = H - barH;

      // Gradient: cyan bottom → blue mid → violet top
      const grad = ctx.createLinearGradient(0, H, 0, 0);
      grad.addColorStop(0, '#00ffe7');
      grad.addColorStop(0.5, '#0088ff');
      grad.addColorStop(1, '#a020f0');

      ctx.shadowColor = value > 0.1 ? '#00ffe7' : 'transparent';
      ctx.shadowBlur = value > 0.6 ? 18 : value > 0.2 ? 8 : 0;

      ctx.fillStyle = grad;
      ctx.fillRect(x, y, barW, barH);

      // Peak dot
      if (value > 0.15) {
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 6;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x, y - 2, barW, 2);
      }
    }

    ctx.shadowBlur = 0;
    animFrameRef.current = requestAnimationFrame(drawEqualizer);
  }, []);

  const drawIdle = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = canvas.width;
    const H = canvas.height;

    ctx.fillStyle = '#050d14';
    ctx.fillRect(0, 0, W, H);
    for (let y = 0; y < H; y += 4) {
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(0, y, W, 1);
    }

    const slotW = W / BAR_COUNT;
    const barW = Math.max(1, slotW - 2);

    ctx.shadowColor = '#006655';
    ctx.shadowBlur = 4;
    for (let i = 0; i < BAR_COUNT; i++) {
      const wave = 0.04 + 0.08 * Math.abs(Math.sin(i * 0.25));
      const barH = Math.max(2, wave * H);
      const x = i * slotW + (slotW - barW) / 2;
      const y = H - barH;
      ctx.fillStyle = '#003d35';
      ctx.fillRect(x, y, barW, barH);
    }
    ctx.shadowBlur = 0;
  }, []);

  useEffect(() => {
    drawIdle();
  }, [drawIdle, audio]);

  const handlePlayPause = useCallback(async () => {
    const el = audioRef.current;
    if (!el) return;
    initAudioContext();
    if (audioContextRef.current?.state === 'suspended') {
      await audioContextRef.current.resume();
    }
    if (el.paused) {
      await el.play();
    } else {
      el.pause();
    }
  }, [initAudioContext]);

  const handleAudioPlay = useCallback(() => {
    setIsPlaying(true);
    cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = requestAnimationFrame(drawEqualizer);
  }, [drawEqualizer]);

  const handleAudioPause = useCallback(() => {
    setIsPlaying(false);
    cancelAnimationFrame(animFrameRef.current);
    drawIdle();
  }, [drawIdle]);

  const handleAudioEnded = useCallback(() => {
    setIsPlaying(false);
    cancelAnimationFrame(animFrameRef.current);
    drawIdle();
  }, [drawIdle]);

  const handleTimeUpdate = useCallback(() => {
    if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    if (audioRef.current) setDuration(audioRef.current.duration);
  }, []);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const t = parseFloat(e.target.value);
    if (audioRef.current) audioRef.current.currentTime = t;
    setCurrentTime(t);
  }, []);

  const handleVolume = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    if (audioRef.current) audioRef.current.volume = v;
    setVolume(v);
  }, []);

  const fmt = (s: number) => {
    if (!isFinite(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const handleSaveMetadata = async () => {
    const currentFilePath = audio.projectFilePath || audio.filePath;
    const newMetadata: AudioMetadata = {
      renpyName: renpyName.trim().replace(/\s+/g, '_'),
      tags: tags.split(',').map(t => t.trim().replace(/\s+/g, '_')).filter(Boolean),
      projectSubfolder: subfolder.trim(),
    };
    setSaveState('saving');
    try {
      await onSaveMetadata(currentFilePath, newMetadata);
      setSaveState('saved');
      savedTimerRef.current = setTimeout(() => setSaveState('idle'), 2000);
    } catch {
      setSaveState('error');
      savedTimerRef.current = setTimeout(() => setSaveState('idle'), 2000);
    }
  };

  const handleCopyToProject = () => {
    const newMetadata: AudioMetadata = {
      renpyName: renpyName.trim().replace(/\s+/g, '_'),
      tags: tags.split(',').map(t => t.trim().replace(/\s+/g, '_')).filter(Boolean),
      projectSubfolder: subfolder.trim(),
    };
    onCopyToProject(audio.filePath, newMetadata);
  };

  const renpyTag = `play audio "game/audio/${subfolder ? `${subfolder}/` : ''}${audio.fileName}"`;

  return (
    <div className="w-full h-full flex flex-row bg-gray-100 dark:bg-gray-900 overflow-hidden">

      {/* Left — player area */}
      <div className="flex-grow flex flex-col items-center justify-center bg-[#050d14] p-6 gap-5 overflow-hidden">
        <h2
          className="text-xl font-bold font-mono tracking-widest truncate max-w-full"
          style={{ color: '#00ffe7', textShadow: '0 0 12px #00ffe7, 0 0 24px #0088ff' }}
        >
          {audio.fileName}
        </h2>

        {/* Equalizer canvas */}
        <canvas
          ref={canvasRef}
          width={480}
          height={CANVAS_H}
          className="rounded-md w-full max-w-xl"
          style={{ imageRendering: 'pixelated', border: '1px solid #0d2a3a', boxShadow: '0 0 20px #001a2a' }}
        />

        {/* Seek bar */}
        <div className="w-full max-w-xl flex items-center gap-2">
          <span className="text-xs font-mono text-cyan-400 w-10 text-right">{fmt(currentTime)}</span>
          <input
            type="range" min={0} max={duration || 0} step={0.01} value={currentTime}
            onChange={handleSeek}
            className="flex-grow h-1 appearance-none rounded-full cursor-pointer"
            style={{ accentColor: '#00ffe7' }}
          />
          <span className="text-xs font-mono text-cyan-400 w-10">{fmt(duration)}</span>
        </div>

        {/* Controls row */}
        <div className="flex items-center gap-6">
          {/* Play/Pause */}
          <button
            onClick={handlePlayPause}
            className="w-14 h-14 rounded-full flex items-center justify-center transition-all focus:outline-none"
            style={{
              background: isPlaying ? 'rgba(0,255,231,0.12)' : 'rgba(0,255,231,0.08)',
              border: '2px solid #00ffe7',
              boxShadow: isPlaying ? '0 0 20px #00ffe7, 0 0 40px #0088ff' : '0 0 8px #00ffe780',
              color: '#00ffe7',
            }}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <rect x="4" y="3" width="4" height="14" rx="1"/>
                <rect x="12" y="3" width="4" height="14" rx="1"/>
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <path d="M5 3l13 7-13 7V3z"/>
              </svg>
            )}
          </button>

          {/* Volume */}
          <div className="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 20 20" fill="#00ffe7" className="opacity-60 flex-shrink-0">
              <path d="M3 7v6h4l5 5V2L7 7H3z"/>
              {volume > 0.5 && <path d="M14.5 4.5a7 7 0 010 11M17 2a10 10 0 010 16" stroke="#00ffe7" strokeWidth="1.5" fill="none"/>}
              {volume > 0 && volume <= 0.5 && <path d="M14.5 7a3.5 3.5 0 010 6" stroke="#00ffe7" strokeWidth="1.5" fill="none"/>}
            </svg>
            <input
              type="range" min={0} max={1} step={0.01} value={volume}
              onChange={handleVolume}
              className="w-24 h-1 appearance-none rounded-full cursor-pointer"
              style={{ accentColor: '#00ffe7' }}
            />
          </div>
        </div>

        {/* Hidden audio element */}
        <audio
          ref={audioRef}
          src={audio.dataUrl}
          onPlay={handleAudioPlay}
          onPause={handleAudioPause}
          onEnded={handleAudioEnded}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          preload="metadata"
          key={audio.filePath || audio.dataUrl}
        />
      </div>

      {/* Right — sidebar */}
      <aside className="w-80 flex-shrink-0 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col overflow-y-auto overscroll-contain">
        <div className="p-4 space-y-4 flex-grow">

          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b pb-2 border-gray-200 dark:border-gray-700">File Info</h3>
            <div className="mt-2 space-y-1 text-xs">
              <p><span className="font-semibold text-gray-500 dark:text-gray-400">Path: </span><code className="break-all">{audio.filePath}</code></p>
              {audio.lastModified && (
                <p><span className="font-semibold text-gray-500 dark:text-gray-400">Modified: </span>{new Date(audio.lastModified).toLocaleString()}</p>
              )}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b pb-2 border-gray-200 dark:border-gray-700">Ren'Py Definition</h3>
            <div className="mt-3 space-y-3">
              <div>
                <label htmlFor="renpyName" className="text-xs font-medium text-gray-700 dark:text-gray-300">Ren'Py Name</label>
                <input
                  id="renpyName"
                  type="text"
                  value={renpyName}
                  onChange={e => setRenpyName(e.target.value)}
                  placeholder="e.g., town_theme"
                  className="w-full mt-1 p-2 text-sm rounded bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 focus:ring-indigo-500 focus:border-indigo-500"
                />
                <p className="text-xs text-gray-400 mt-0.5">Short name for use in code (optional).</p>
              </div>
              <div>
                <label htmlFor="tags" className="text-xs font-medium text-gray-700 dark:text-gray-300">Tags</label>
                <input
                  id="tags"
                  type="text"
                  value={tags}
                  onChange={e => setTags(e.target.value)}
                  placeholder="e.g., happy, upbeat"
                  className="w-full mt-1 p-2 text-sm rounded bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 focus:ring-indigo-500 focus:border-indigo-500"
                />
                <p className="text-xs text-gray-400 mt-0.5">Comma-separated searchable tags.</p>
              </div>
              <div className="bg-gray-100 dark:bg-gray-700/50 p-2 rounded-md">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Example Usage</p>
                <code className="text-xs font-mono break-all">{renpyTag}</code>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b pb-2 border-gray-200 dark:border-gray-700">Project Settings</h3>
            <div className="mt-3 space-y-3">
              <div>
                <label htmlFor="subfolder" className="text-xs font-medium text-gray-700 dark:text-gray-300">Project Subfolder</label>
                <div className="flex items-center mt-1">
                  <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-2 rounded-l-md border border-r-0 border-gray-300 dark:border-gray-600 whitespace-nowrap">game/audio/</span>
                  <input
                    id="subfolder"
                    type="text"
                    value={subfolder}
                    onChange={e => setSubfolder(e.target.value)}
                    placeholder="e.g., sfx/footsteps"
                    className="flex-grow p-2 text-sm rounded-r-md bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <p className="text-xs text-gray-400 mt-0.5">Optional subfolder within game/audio/.</p>
              </div>

              {audio.isInProject ? (
                <button
                  onClick={handleSaveMetadata}
                  disabled={saveState === 'saving'}
                  className={`w-full py-2 px-4 rounded-md font-bold text-sm transition-colors disabled:cursor-not-allowed ${
                    saveState === 'saved' ? 'bg-green-600 text-white' :
                    saveState === 'error' ? 'bg-red-600 text-white' :
                    'bg-indigo-600 hover:bg-indigo-700 text-white'
                  }`}
                >
                  {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? '✓ Saved' : saveState === 'error' ? 'Error — try again' : 'Save Metadata'}
                </button>
              ) : audio.projectFilePath ? (
                <div className="text-center text-sm text-green-600 dark:text-green-400 font-bold p-2 border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/30 rounded">
                  Copied to Project
                </div>
              ) : (
                <button
                  onClick={handleCopyToProject}
                  className="w-full py-2 px-4 rounded-md bg-green-600 hover:bg-green-700 text-white font-bold text-sm transition-colors"
                >
                  Copy to Project
                </button>
              )}
            </div>
          </div>

        </div>
      </aside>
    </div>
  );
};

export default memo(AudioEditorView);
