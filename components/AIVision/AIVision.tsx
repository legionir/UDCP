import React, { useEffect, useRef, useState } from 'react';
import { useCamera } from '../../hooks/useCamera';
import { useUdcpSender } from '../../hooks/useUdcpSender';
import type { AIModule, AIModuleType } from '../../types/udcp';

// Lazy import MediaPipe tasks (dynamic import to reduce initial bundle)
let FaceDetector: any = null;
let HandLandmarker: any = null;
let PoseLandmarker: any = null;
let ObjectDetector: any = null;
let BarcodeDetector: any = null;

async function loadVisionDeps() {
  if (!FaceDetector) {
    const vision = await import('@mediapipe/tasks-vision');
    FaceDetector = vision.FaceDetector;
    HandLandmarker = vision.HandLandmarker;
    PoseLandmarker = vision.PoseLandmarker;
    ObjectDetector = vision.ObjectDetector;
    BarcodeDetector = vision.BarcodeDetector; // if available
  }
}

export function AIVisionModule() {
  const [modules, setModules] = useState<AIModule[]>([
    {
      id: 'face-01',
      type: 'face_detect',
      name: 'Face Detector',
      enabled: true,
      config: {
        confidenceThreshold: 0.5,
        maxDetections: 5,
        resolution: '480p',
        fpsTarget: 15,
        transport: ['ws'],
        qos: 0
      },
      stats: { frames: 0, detections: 0 }
    },
    {
      id: 'hand-01',
      type: 'hand_track',
      name: 'Hand Landmarker',
      enabled: true,
      config: {
        confidenceThreshold: 0.6,
        maxDetections: 2,
        resolution: '480p',
        fpsTarget: 15,
        transport: ['ws'],
        qos: 0
      },
      stats: { frames: 0, detections: 0 }
    }
  ]);
  
  const [activeModuleId, setActiveModuleId] = useState<string>('face-01');
  const activeModule = modules.find(m => m.id === activeModuleId)!;
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<any>(null);
  const rafRef = useRef<number | null>(null);
  const lastSendRef = useRef<number>(0);
  
  const { sendStream } = useUdcpSender();
  const { stream, error: camError, start, stop, isActive } = useCamera();
  
  // Initialize detector when active module changes
  useEffect(() => {
    let cancelled = false;
    
    async function initDetector() {
      if (!activeModule.enabled) {
        stopDetector();
        return;
      }
      
      await loadVisionDeps();
      
      try {
        const cfg = activeModule.config;
        
        if (activeModule.type === 'face_detect') {
          detectorRef.current = await FaceDetector.createFromOptions({
            baseOptions: { modelAssetPath: '/models/face_detector.tflite' },
            runningMode: 'VIDEO',
            minDetectionConfidence: cfg.confidenceThreshold,
            maxResults: cfg.maxDetections
          });
        } else if (activeModule.type === 'hand_track') {
          detectorRef.current = await HandLandmarker.createFromOptions({
            baseOptions: { modelAssetPath: '/models/hand_landmarker.task' },
            runningMode: 'VIDEO',
            numHands: cfg.maxDetections,
            minHandDetectionConfidence: cfg.confidenceThreshold,
            minHandPresenceConfidence: cfg.confidenceThreshold * 0.8
          });
        } else if (activeModule.type === 'pose') {
          detectorRef.current = await PoseLandmarker.createFromOptions({
            baseOptions: { modelAssetPath: '/models/pose_landmarker.task' },
            runningMode: 'VIDEO',
            numPoses: cfg.maxDetections,
            minPoseDetectionConfidence: cfg.confidenceThreshold,
            minPosePresenceConfidence: cfg.confidenceThreshold * 0.8
          });
        } else if (activeModule.type === 'object_detect') {
          detectorRef.current = await ObjectDetector.createFromOptions({
            baseOptions: { modelAssetPath: '/models/object_detector.tflite' },
            runningMode: 'VIDEO',
            scoreThreshold: cfg.confidenceThreshold,
            maxResults: cfg.maxDetections
          });
        } else if (activeModule.type === 'qr_barcode') {
          // BarcodeDetector is available in some browsers / MediaPipe builds
          if (BarcodeDetector) {
            detectorRef.current = await BarcodeDetector.create({ formats: ['qr_code', 'ean_13'] });
          } else {
            // Fallback: no-op or use external library
            detectorRef.current = null;
            setModules(ms => ms.map(m => m.id===activeModuleId ? { ...m, stats: { ...m.stats, error: 'BarcodeDetector not supported in this build' } } : m));
          }
        } else if (activeModule.type === 'ocr') {
          // OCR typically requires additional model (not always in MediaPipe Tasks). Placeholder.
          detectorRef.current = null;
          setModules(ms => ms.map(m => m.id===activeModuleId ? { ...m, stats: { ...m.stats, error: 'OCR not available in this MediaPipe build. Use external OCR.' } } : m));
        } else if (activeModule.type === 'color_track') {
          detectorRef.current = { type: 'color_track', mode: 'manual' }; // Custom logic below
        }
        
        if (!cancelled) {
          console.log('[AI Vision] Detector ready:', activeModule.type);
        }
      } catch (err: any) {
        console.error('[AI Vision] Init error:', err);
        if (!cancelled) {
          setModules(ms => ms.map(m => m.id===activeModuleId ? { ...m, stats: { ...m.stats, error: err.message } } : m));
        }
      }
    }
    
    initDetector();
    return () => { cancelled = true; stopDetector(); };
  }, [activeModuleId, activeModule.enabled, activeModule.type, activeModule.config]);
  
  function stopDetector() {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    detectorRef.current = null;
  }
  
  // Start/stop camera when enabled or resolution changes
  useEffect(() => {
    async function ensureCamera() {
      if (!activeModule.enabled) {
        stop();
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(t => t.stop());
          streamRef.current = null;
        }
        return;
      }
      
      // Determine constraints based on resolution
      const res = activeModule.config.resolution;
      const constraints: MediaStreamConstraints = {
        video: res === '720p' ? { width: { ideal: 1280 }, height: { ideal: 720 } } :
               res === '480p' ? { width: { ideal: 640 }, height: { ideal: 480 } } :
               { width: { ideal: 640 }, height: { ideal: 360 } },
        audio: false
      };
      
      try {
        const s = await start(constraints);
        streamRef.current = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          await videoRef.current.play();
        }
      } catch (err) {
        console.error('[Camera] Error:', err);
        setModules(ms => ms.map(m => m.id===activeModuleId ? { ...m, stats: { ...m.stats, error: String(err) } } : m));
      }
    }
    
    ensureCamera();
    
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    };
  }, [activeModule.enabled, activeModule.config.resolution, start, stop, activeModuleId]);
  
  // Main detection loop
  useEffect(() => {
    if (!activeModule.enabled || !detectorRef.current || !videoRef.current || !canvasRef.current) {
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
      return;
    }
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d')!;
    const video = videoRef.current;
    
    let lastTs = performance.now();
    
    const detectLoop = async () => {
      if (!video.videoWidth || !video.videoHeight) {
        rafRef.current = requestAnimationFrame(detectLoop);
        return;
      }
      
      // Set canvas size to match video
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }
      
      const now = performance.now();
      const dt = now - lastTs;
      const fpsTargetMs = 1000 / Math.max(1, activeModule.config.fpsTarget || 15);
      
      if (dt < fpsTargetMs) {
        rafRef.current = requestAnimationFrame(detectLoop);
        return;
      }
      lastTs = now;
      
      // Stats
      setModules(ms => ms.map(m => m.id===activeModuleId ? { ...m, stats: { ...m.stats, frames: (m.stats?.frames||0)+1 } } : m));
      
      try {
        let results: any = null;
        
        // Run detection based on type
        if (activeModule.type === 'face_detect' && detectorRef.current) {
          results = await detectorRef.current.detectForVideo(video, now);
          // results.detections: [{boundingBox:{x,y,width,height}, categories:[{categoryName, score}]}]
        } else if (activeModule.type === 'hand_track' && detectorRef.current) {
          results = await detectorRef.current.detectForVideo(video, now);
          // results.landmarks: Array<[{x,y,z}]> (per hand)
        } else if (activeModule.type === 'pose' && detectorRef.current) {
          results = await detectorRef.current.detectForVideo(video, now);
          // results.landmarks: Array<[{x,y,z}]>
        } else if (activeModule.type === 'object_detect' && detectorRef.current) {
          results = await detectorRef.current.detectForVideo(video, now);
        } else if (activeModule.type === 'qr_barcode' && detectorRef.current) {
          // BarcodeDetector.detect returns [{rawValue, format, cornerPoints}]
          results = await detectorRef.current.detect(video);
        } else if (activeModule.type === 'color_track' && detectorRef.current?.type === 'color_track') {
          // Custom color tracking: sample center region / use color picker ROI
          results = await runColorTracking(video, canvas, activeModule.config);
        } else {
          // No detector
          results = null;
        }
        
        // Clear + draw overlay
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawOverlay(ctx, activeModule.type, results, activeModule.config);
        
        // Count detections
        const detectionCount = countDetections(results, activeModule.type);
        setModules(ms => ms.map(m => m.id===activeModuleId ? { ...m, stats: { ...m.stats, detections: detectionCount } } : m));
        
        // Throttle sending to UDCP (avoid flooding)
        const nowSend = Date.now();
        if (nowSend - lastSendRef.current > 1000 / Math.max(1, activeModule.config.fpsTarget || 15)) {
          // Send stream to UDCP
          await sendStream({
            type: 'stream',
            name: `ai_vision_${activeModule.type}`,
            value: {
              timestamp: now,
              type: activeModule.type,
              config: {
                confidenceThreshold: activeModule.config.confidenceThreshold,
                maxDetections: activeModule.config.maxDetections
              },
              results,
              stats: {
                frames: (activeModule.stats?.frames || 0),
                detections: detectionCount
              }
            },
            qos: activeModule.config.qos ?? 0,
            transport: activeModule.config.transport || ['ws'],
            rate: activeModule.config.fpsTarget || 15
          });
          lastSendRef.current = nowSend;
        }
        
      } catch (err) {
        console.error('[AI Vision] Detect error:', err);
        setModules(ms => ms.map(m => m.id===activeModuleId ? { ...m, stats: { ...m.stats, error: String(err) } } : m));
      }
      
      rafRef.current = requestAnimationFrame(detectLoop);
    };
    
    rafRef.current = requestAnimationFrame(detectLoop);
    
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [activeModule.enabled, activeModule.type, activeModule.config, activeModuleId, sendStream]);
  
  // Update module config
  const updateModuleConfig = (patch: Partial<AIModule['config']>) => {
    setModules(ms => ms.map(m => m.id===activeModuleId ? { ...m, config: { ...m.config, ...patch } } : m));
  };
  
  const updateModule = (patch: Partial<AIModule>) => {
    setModules(ms => ms.map(m => m.id===activeModuleId ? { ...m, ...patch } : m));
  };
  
  const addModule = (type: AIModuleType) => {
    const id = `${type}-${Date.now().toString(36)}`;
    const defaults: Partial<AIModule> = {
      face_detect: {
        name: 'Face Detector', enabled: true,
        config: { confidenceThreshold: 0.5, maxDetections: 5, resolution: '480p', fpsTarget: 15, transport: ['ws'], qos: 0 }
      },
      hand_track: {
        name: 'Hand Landmarker', enabled: true,
        config: { confidenceThreshold: 0.6, maxDetections: 2, resolution: '480p', fpsTarget: 15, transport: ['ws'], qos: 0 }
      },
      pose: {
        name: 'Pose Landmarker', enabled: true,
        config: { confidenceThreshold: 0.5, maxDetections: 1, resolution: '480p', fpsTarget: 15, transport: ['ws'], qos: 0 }
      },
      object_detect: {
        name: 'Object Detector', enabled: true,
        config: { confidenceThreshold: 0.5, maxDetections: 5, resolution: '480p', fpsTarget: 15, transport: ['ws'], qos: 0 }
      },
      qr_barcode: {
        name: 'QR/Barcode', enabled: true,
        config: { confidenceThreshold: 0.5, maxDetections: 5, resolution: '480p', fpsTarget: 15, transport: ['ws'], qos: 0 }
      },
      ocr: {
        name: 'OCR (Text)', enabled: false,
        config: { confidenceThreshold: 0.5, maxDetections: 5, resolution: '480p', fpsTarget: 10, transport: ['ws'], qos: 0 }
      },
      color_track: {
        name: 'Color Tracker', enabled: true,
        config: { confidenceThreshold: 0.6, maxDetections: 1, resolution: '480p', fpsTarget: 20, transport: ['ws'], qos: 0 }
      }
    }[type] || {
      name: type.replace('_',' ').replace(/\b\w/g, c=>c.toUpperCase()), enabled: true,
      config: { confidenceThreshold: 0.5, maxDetections: 5, resolution: '480p', fpsTarget: 15, transport: ['ws'], qos: 0 }
    };
    
    const mod: AIModule = {
      id,
      type,
      name: defaults.name!,
      enabled: defaults.enabled!,
      config: defaults.config!,
      stats: { frames: 0, detections: 0 }
    };
    setModules(ms => [...ms, mod]);
    setActiveModuleId(id);
  };
  
  const removeModule = (id: string) => {
    if (modules.length <= 1) return;
    setModules(ms => ms.filter(m => m.id !== id));
    if (activeModuleId === id) setActiveModuleId(modules.find(m=>m.id!==id)?.id || modules[0].id);
  };
  
  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Toolbar */}
      <div className="bg-gray-800 border-b border-gray-700 p-3 flex items-center gap-3">
        <h2 className="text-xl font-bold">👁️ AI Vision Integration</h2>
        
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">Module:</span>
          <select 
            className="bg-gray-900 p-2 rounded text-sm"
            value={activeModuleId}
            onChange={e => setActiveModuleId(e.target.value)}
          >
            {modules.map(m => (
              <option key={m.id} value={m.id}>
                {m.enabled ? '🟢' : '⚪'} {m.name} ({m.type.replace('_',' ')})
              </option>
            ))}
          </select>
          <button className="btn btn-outline text-xs" onClick={() => addModule('face_detect')}>➕ Add Face</button>
          <button className="btn btn-outline text-xs" onClick={() => addModule('hand_track')}>➕ Add Hand</button>
        </div>
        
        <div className="ml-auto flex items-center gap-3">
          <div className="text-xs">
            <span className="text-gray-400">Camera:</span>{' '}
            <span className={isActive ? 'text-green-400' : 'text-red-400'}>
              {isActive ? '🟢 Active' : '🔴 Off'}
            </span>
          </div>
          <div className="text-xs">
            <span className="text-gray-400">FPS Target:</span>{' '}
            <span className="font-mono text-cyan-400">{activeModule.config.fpsTarget}</span>
          </div>
          {camError && <div className="text-xs text-red-400">⚠️ {camError}</div>}
        </div>
      </div>
      
      <div className="flex-1 flex">
        {/* Left: Video + Canvas */}
        <div className="flex-1 flex flex-col bg-black relative">
          <div className="flex-1 flex items-center justify-center p-4">
            <div className="relative border-2 border-gray-700 rounded-lg overflow-hidden bg-gray-900">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="block"
                style={{ maxWidth: '100%', maxHeight: '70vh', display: activeModule.enabled ? 'block' : 'none' }}
              />
              <canvas
                ref={canvasRef}
                className="absolute inset-0"
                style={{ maxWidth: '100%', maxHeight: '70vh', display: activeModule.enabled ? 'block' : 'none' }}
              />
              
              {!activeModule.enabled && (
                <div className="w-[640px] max-w-full h-[360px] flex items-center justify-center text-gray-500">
                  <div className="text-center">
                    <div className="text-6xl mb-4">👁️</div>
                    <div className="text-xl font-bold">AI Vision غیرفعال است</div>
                    <div className="text-sm mt-2">ماژول را فعال کنید و دوربین را روشن کنید</div>
                  </div>
                </div>
              )}
              
              {activeModule.enabled && !isActive && (
                <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                  <div className="text-center text-yellow-300">
                    <div className="text-4xl mb-2">📷</div>
                    <div className="text-lg font-bold">در حال درخواست دسترسی به دوربین...</div>
                    <div className="text-sm mt-1">لطفاً اجازه دهید.</div>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Stats bar */}
          <div className="bg-gray-800 border-t border-gray-700 px-4 py-2 flex items-center gap-6 text-xs">
            <div><span className="text-gray-400">Frames:</span> <span className="font-mono text-cyan-400">{activeModule.stats?.frames ?? 0}</span></div>
            <div><span className="text-gray-400">Detections:</span> <span className="font-mono text-green-400">{activeModule.stats?.detections ?? 0}</span></div>
            <div><span className="text-gray-400">Last Inference:</span> <span className="font-mono">{activeModule.stats?.lastInferenceMs ?? '-'}ms</span></div>
            <div><span className="text-gray-400">Model:</span> <span className="font-mono">{activeModule.type.replace('_',' ')}</span></div>
            <div><span className="text-gray-400">Transport:</span> <span className="font-mono text-blue-400">{activeModule.config.transport.join('+')}</span></div>
            <div><span className="text-gray-400">Stream:</span> <span className="font-mono">ai_vision_{activeModule.type}</span></div>
          </div>
        </div>
        
        {/* Right: Inspector + Modules List */}
        <div className="w-96 bg-gray-800 border-l border-gray-700 p-3 flex flex-col">
          <h3 className="text-lg font-bold mb-3">🔍 AI Vision Inspector</h3>
          
          {/* Active module config */}
          <div className="bg-gray-900 rounded p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="font-bold text-lg">{activeModule.name}</div>
              <div className="flex items-center gap-2">
                <label className="text-xs flex items-center gap-1">
                  <input 
                    type="checkbox"
                    checked={activeModule.enabled}
                    onChange={e => updateModule({ enabled: e.target.checked })}
                  />
                  <span>Enabled</span>
                </label>
                <button className="btn btn-outline text-xs" onClick={() => removeModule(activeModule.id)}>🗑️</button>
              </div>
            </div>
            
            <div className="space-y-2 text-sm">
              <div>
                <label className="text-xs text-gray-400 block">Type</label>
                <div className="font-mono text-cyan-300">{activeModule.type.replace('_',' ').toUpperCase()}</div>
              </div>
              
              <div>
                <label className="text-xs text-gray-400 block">Resolution</label>
                <select 
                  className="w-full bg-gray-900 p-1 rounded"
                  value={activeModule.config.resolution}
                  onChange={e => updateModuleConfig({ resolution: e.target.value as any })}
                >
                  <option value="360p">360p</option>
                  <option value="480p">480p</option>
                  <option value="720p">720p</option>
                </select>
              </div>
              
              <div>
                <label className="text-xs text-gray-400 block">FPS Target</label>
                <select 
                  className="w-full bg-gray-900 p-1 rounded"
                  value={activeModule.config.fpsTarget}
                  onChange={e => updateModuleConfig({ fpsTarget: Number(e.target.value) })}
                >
                  <option value={5}>5 FPS</option>
                  <option value={10}>10 FPS</option>
                  <option value={15}>15 FPS</option>
                  <option value={20}>20 FPS</option>
                  <option value={30}>30 FPS</option>
                </select>
                <div className="text-[10px] text-gray-500">⚠️ بالاتر از 20 FPS روی موبایل/ESP ممکن است مصرف باتری بالا برود.</div>
              </div>
              
              <div>
                <label className="text-xs text-gray-400 block">Confidence Threshold</label>
                <div className="flex items-center gap-2">
                  <input 
                    type="range" min={0} max={1} step={0.01}
                    value={activeModule.config.confidenceThreshold}
                    onChange={e => updateModuleConfig({ confidenceThreshold: Number(e.target.value) })}
                    className="flex-1"
                  />
                  <span className="font-mono w-12 text-right">{activeModule.config.confidenceThreshold.toFixed(2)}</span>
                </div>
              </div>
              
              <div>
                <label className="text-xs text-gray-400 block">Max Detections</label>
                <input 
                  type="number" min={1} max={10}
                  className="w-full bg-gray-900 p-1 rounded"
                  value={activeModule.config.maxDetections}
                  onChange={e => updateModuleConfig({ maxDetections: Number(e.target.value) })}
                />
              </div>
              
              <div>
                <label className="text-xs text-gray-400 block">QoS</label>
                <select 
                  className="w-full bg-gray-900 p-1 rounded"
                  value={activeModule.config.qos}
                  onChange={e => updateModuleConfig({ qos: Number(e.target.value) as 0|1|2 })}
                >
                  <option value={0}>QoS0</option>
                  <option value={1}>QoS1</option>
                  <option value={2}>QoS2</option>
                </select>
              </div>
              
              <div>
                <label className="text-xs text-gray-400 block">Transport</label>
                <div className="flex gap-2">
                  {(['ws','http'] as const).map(t => (
                    <label key={t} className="flex items-center gap-1 text-xs">
                      <input 
                        type="checkbox"
                        checked={activeModule.config.transport.includes(t)}
                        onChange={e => {
                          const next = e.target.checked
                            ? [...activeModule.config.transport, t]
                            : activeModule.config.transport.filter(x => x !== t);
                          updateModuleConfig({ transport: next });
                        }}
                      />
                      <span className={t==='ws'?'text-blue-400':'text-orange-400'}>{t.toUpperCase()}</span>
                    </label>
                  ))}
                </div>
              </div>
              
              {activeModule.stats?.error && (
                <div className="bg-red-900/50 border border-red-700 text-red-200 p-2 rounded text-xs">
                  ❌ {activeModule.stats.error}
                </div>
              )}
            </div>
          </div>
          
          {/* Modules list */}
          <div className="mt-4 flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-bold">📋 All Modules</h4>
              <button className="text-xs btn btn-outline px-2 py-0.5" onClick={() => addModule('face_detect')}>
                ➕ Add
              </button>
            </div>
            <div className="flex-1 overflow-auto space-y-2">
              {modules.map(m => (
                <div 
                  key={m.id}
                  className={`p-2 rounded border cursor-pointer ${
                    m.id === activeModuleId ? 'border-cyan-400 bg-gray-900' : 'border-gray-700 bg-gray-900/60 hover:bg-gray-900'
                  }`}
                  onClick={() => setActiveModuleId(m.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-sm">{m.enabled ? '🟢' : '⚪'} {m.name}</div>
                    <div className="text-xs text-gray-400">{m.type.replace('_',' ')}</div>
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    FPS:{m.config.fpsTarget} • Thr:{m.config.confidenceThreshold.toFixed(2)} • Dets:{m.config.maxDetections}
                  </div>
                  <div className="text-[10px] text-gray-500 mt-1">
                    Frames: {m.stats?.frames ?? 0} | Detections: {m.stats?.detections ?? 0}
                  </div>
                  {m.stats?.error && (
                    <div className="text-[10px] text-red-400 mt-1">⚠️ {m.stats.error}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
          
          {/* Help / Tips */}
          <div className="mt-4 p-2 bg-gray-900 rounded text-xs">
            <div className="font-bold text-cyan-300">💡 Tips</div>
            <ul className="list-disc ml-4 space-y-0.5 text-gray-300">
              <li>برای <strong>Face/Hand/Pose</strong> مدل‌های <code>.task</code> لازم است (public/models/)</li>
              <li>برای <strong>QR/Barcode</strong> ممکن است در برخی مرورگرها پشتیبانی نشود.</li>
              <li>برای <strong>UDP</strong> نیاز به سرور proxy/ESP32 دارید (مرورگر مستقیم UDP ندارد).</li>
              <li>FPS بالا → مصرف باتری/CPU بیشتر. روی موبایل 15–20FPS توصیه می‌شود.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Helper functions (overlay + detection counting)
// ──────────────────────────────────────────────────────────────

function drawOverlay(ctx: CanvasRenderingContext2D, type: AIModuleType, results: any, config: AIModule['config']) {
  if (!results) return;
  
  ctx.lineWidth = 2;
  ctx.font = '14px monospace';
  
  if (type === 'face_detect' && results.detections) {
    ctx.strokeStyle = '#00ff00';
    ctx.fillStyle = '#00ff00';
    results.detections.forEach((d: any) => {
      const { x, y, width, height } = d.boundingBox;
      ctx.strokeRect(x, y, width, height);
      const score = (d.categories?.[0]?.score ?? 0) * 100;
      ctx.fillText(`${score.toFixed(0)}%`, x, Math.max(0, y - 5));
    });
  }
  
  if ((type === 'hand_track' || type === 'pose') && results.landmarks) {
    ctx.strokeStyle = '#ff0000';
    ctx.fillStyle = '#ff0000';
    results.landmarks.forEach((landmark: any[]) => {
      landmark.forEach((pt: any) => {
        ctx.beginPath();
        ctx.arc(pt.x * ctx.canvas.width, pt.y * ctx.canvas.height, 3, 0, Math.PI*2);
        ctx.fill();
      });
      // Optionally connect key points (hand/pose skeleton)
    });
  }
  
  if (type === 'object_detect' && results.detections) {
    ctx.strokeStyle = '#3b82f6';
    ctx.fillStyle = '#3b82f6';
    results.detections.forEach((d: any) => {
      const { x, y, width, height } = d.boundingBox;
      ctx.strokeRect(x, y, width, height);
      const label = d.categories?.[0]?.categoryName || 'obj';
      const score = (d.categories?.[0]?.score ?? 0) * 100;
      ctx.fillText(`${label} ${score.toFixed(0)}%`, x, Math.max(0, y - 5));
    });
  }
  
  if (type === 'qr_barcode' && Array.isArray(results)) {
    ctx.strokeStyle = '#f59e0b';
    ctx.fillStyle = '#f59e0b';
    results.forEach((b: any) => {
      if (b.cornerPoints && b.cornerPoints.length >= 4) {
        const pts = b.cornerPoints.map((p: any) => ({x: p.x, y: p.y}));
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i=1;i<pts.length;i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.closePath();
        ctx.stroke();
        ctx.fillText(`${b.format || 'QR'}: ${b.rawValue || ''}`, pts[0].x, Math.max(0, pts[0].y - 5));
      }
    });
  }
  
  if (type === 'color_track' && results) {
    // results = { cx, cy, color: {r,g,b}, maskArea? }
    ctx.strokeStyle = '#a855f7';
    ctx.fillStyle = '#a855f7';
    if (results.cx != null && results.cy != null) {
      ctx.beginPath();
      ctx.arc(results.cx * ctx.canvas.width, results.cy * ctx.canvas.height, 8, 0, Math.PI*2);
      ctx.fill();
      ctx.stroke();
      if (results.color) {
        ctx.fillStyle = `rgb(${results.color.r},${results.color.g},${results.color.b})`;
        ctx.fillRect(10, 10, 60, 30);
        ctx.fillStyle = '#a855f7';
        ctx.fillText(`RGB(${results.color.r},${results.color.g},${results.color.b})`, 80, 30);
      }
    }
  }
}

function countDetections(results: any, type: AIModuleType): number {
  if (!results) return 0;
  if (type === 'face_detect' && results.detections) return results.detections.length;
  if ((type === 'hand_track' || type === 'pose') && results.landmarks) return results.landmarks.length;
  if (type === 'object_detect' && results.detections) return results.detections.length;
  if (type === 'qr_barcode' && Array.isArray(results)) return results.length;
  if (type === 'color_track' && results) return 1;
  return 0;
}

async function runColorTracking(video: HTMLVideoElement, canvas: HTMLCanvasElement, config: AIModule['config']) {
  // Simple center-region color tracking: sample a small ROI around center
  const ctx = canvas.getContext('2d')!;
  const w = canvas.width, h = canvas.height;
  const cx = w / 2, cy = h / 2;
  const size = 40; // ROI size
  ctx.drawImage(video, 0, 0, w, h);
  const imgData = ctx.getImageData(Math.floor(cx - size/2), Math.floor(cy - size/2), size, size);
  
  // Compute average color in ROI
  let r=0,g=0,b=0,count=0;
  for (let i=0;i<imgData.data.length;i+=4) {
    r += imgData.data[i];
    g += imgData.data[i+1];
    b += imgData.data[i+2];
    count++;
  }
  r = Math.round(r/count);
  g = Math.round(g/count);
  b = Math.round(b/count);
  
  // Simple thresholding: compute "color saliency" vs background (optional)
  // Here we return center color
  return {
    cx: cx/w,
    cy: cy/h,
    color: { r, g, b },
    maskArea: count / (size*size)
  };
}

export default AIVisionModule;

