import React, { useEffect, useRef, useState } from 'react';
import { Camera, RefreshCw, Sparkles, AlertCircle } from 'lucide-react';
import { ControllerMode, GameAction } from '../types';

interface WebcamControllerProps {
  onActionTriggered: (action: GameAction) => void;
  controllerMode: ControllerMode;
  setControllerMode: (mode: ControllerMode) => void;
  gameAction: GameAction;
}

interface CustomSample {
  vector: number[];
  label: 'idle' | 'jump' | 'crouch';
}

export default function WebcamController({
  onActionTriggered,
  controllerMode,
  setControllerMode,
  gameAction,
}: WebcamControllerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // States
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Teachable Machine Load States
  const [tmModelUrl, setTmModelUrl] = useState('');
  const [tmLoading, setTmLoading] = useState(false);
  const [tmError, setTmError] = useState<string | null>(null);
  const [tmModelLoaded, setTmModelLoaded] = useState(false);
  const [tmModel, setTmModel] = useState<any>(null);

  // Built-in Trainer Samples
  const [samples, setSamples] = useState<CustomSample[]>([]);
  const [isRecording, setIsRecording] = useState<'idle' | 'jump' | 'crouch' | null>(null);

  // Real-time Confidence States for both models
  const [confidence, setConfidence] = useState({
    idle: 1.0,
    jump: 0.0,
    crouch: 0.0,
  });

  // Local model state (loads /model/ directory served as static by Vite)
  const [localModelLoaded, setLocalModelLoaded] = useState(false);
  const [localModelLoading, setLocalModelLoading] = useState(false);
  const [localModelError, setLocalModelError] = useState<string | null>(null);
  const [localModel, setLocalModel] = useState<any>(null);
  const [localModelLabels, setLocalModelLabels] = useState<string[]>([]);
  const [localScores, setLocalScores] = useState<Record<string, number>>({});

  // Load TensorFlow.js and Teachable Machine dynamically to avoid compilations or dependency locks
  const [libsReady, setLibsReady] = useState({ tf: false, tm: false });

  useEffect(() => {
    // Dynamic loading of scripts
    if (controllerMode !== ControllerMode.TEACHABLE_MACHINE && controllerMode !== ControllerMode.LOCAL_MODEL) return;
    if (libsReady.tf && libsReady.tm) return;

    const loadScripts = async () => {
      try {
        setTmLoading(true);
        if (!(window as any).tf) {
          const tfScript = document.createElement('script');
          tfScript.src = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.17.0/dist/tf.min.js';
          tfScript.async = true;
          document.head.appendChild(tfScript);
          await new Promise((resolve) => (tfScript.onload = resolve));
        }

        if (!(window as any).tmImage) {
          const tmScript = document.createElement('script');
          tmScript.src = 'https://cdn.jsdelivr.net/npm/@teachablemachine/image@0.8.5/dist/teachablemachine-image.min.js';
          tmScript.async = true;
          document.head.appendChild(tmScript);
          await new Promise((resolve) => (tmScript.onload = resolve));
        }

        setLibsReady({ tf: true, tm: true });
        setTmLoading(false);
      } catch (err) {
        console.error('Failed to load libraries from CDN', err);
        setTmError('Failed to load TensorFlow libraries. Check network.');
        setTmLoading(false);
      }
    };

    loadScripts();
  }, [controllerMode, libsReady]);

  // Auto-load the local /model/ when mode is LOCAL_MODEL and TF libs are ready
  useEffect(() => {
    if (controllerMode !== ControllerMode.LOCAL_MODEL) return;
    if (!libsReady.tf || !libsReady.tm) return;
    if (localModelLoaded || localModelLoading) return;

    const loadLocal = async () => {
      setLocalModelLoading(true);
      setLocalModelError(null);
      try {
        const tmImage = (window as any).tmImage;
        if (!tmImage) throw new Error('TM library not ready');

        const loaded = await tmImage.load('/model/model.json', '/model/metadata.json');
        setLocalModel(loaded);

        const metaRes = await fetch('/model/metadata.json');
        const meta = await metaRes.json();
        setLocalModelLabels((meta.labels as string[]).map((l: string) => l.toLowerCase()));
        setLocalModelLoaded(true);
      } catch (err: any) {
        console.error('Local model load error:', err);
        setLocalModelError('Could not load /model/. Ensure model.json, metadata.json and weights.bin are in the /model/ folder.');
      } finally {
        setLocalModelLoading(false);
      }
    };

    loadLocal();
  }, [controllerMode, libsReady, localModelLoaded, localModelLoading]);

  // Handle camera activation
  const startCamera = async () => {
    setCameraLoading(true);
    setCameraError(null);
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      const constraints = {
        video: {
          width: 320,
          height: 240,
          facingMode: 'user',
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      setCameraActive(true);
    } catch (err: any) {
      console.error('Camera capture error', err);
      setCameraError(
        'Could not access camera. Please allow camera permissions in your browser or iframe header.'
      );
    } finally {
      setCameraLoading(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  useEffect(() => {
    if (controllerMode !== ControllerMode.KEYBOARD) {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [controllerMode]);

  // Downsample webcam frame to 20x20 Grayscale Vector
  const getFrameVector = (): number[] | null => {
    if (!videoRef.current || !canvasRef.current || !cameraActive) return null;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Draw video to tiny 20x20 processing canvas
    ctx.drawImage(videoRef.current, 0, 0, 20, 20);

    const imgData = ctx.getImageData(0, 0, 20, 20);
    const data = imgData.data;
    const vector: number[] = [];

    // Form 400 grayscale pixels
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      // Luminance formula
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      vector.push(gray);
    }

    // Vector normalization to counteract lighting shifts
    const mean = vector.reduce((sum, val) => sum + val, 0) / vector.length;
    const variance = vector.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / vector.length;
    const std = Math.sqrt(variance) || 1;

    return vector.map((val) => (val - mean) / std);
  };

  // Capture training sample
  const captureSample = (label: 'idle' | 'jump' | 'crouch') => {
    const vector = getFrameVector();
    if (vector) {
      setSamples((prev) => [...prev, { vector, label }]);
    }
  };

  // Record loop trigger helper
  useEffect(() => {
    if (!isRecording) return;

    const interval = setInterval(() => {
      captureSample(isRecording);
    }, 150);

    return () => clearInterval(interval);
  }, [isRecording, cameraActive]);

  // Load Google Teachable Machine model
  const loadTeachableModel = async () => {
    if (!tmModelUrl.trim()) return;
    setTmLoading(true);
    setTmError(null);
    setTmModelLoaded(false);

    try {
      const normalizedUrl = tmModelUrl.endsWith('/') ? tmModelUrl : tmModelUrl + '/';
      const modelURL = normalizedUrl + 'model.json';
      const metadataURL = normalizedUrl + 'metadata.json';

      const tmImage = (window as any).tmImage;
      if (!tmImage) {
        throw new Error('Teachable Machine Image library is not ready');
      }

      const loadedModel = await tmImage.load(modelURL, metadataURL);
      setTmModel(loadedModel);
      setTmModelLoaded(true);
    } catch (err: any) {
      console.error('TM Model Loading Error:', err);
      setTmError(
        'Could not load Teachable Machine model. Make sure the URL is public and contains your exported files.'
      );
    } finally {
      setTmLoading(false);
    }
  };

  // Prediction Loop Handler (Runs continuously when camera is active)
  useEffect(() => {
    let animationId: number;

    const predictLoop = async () => {
      if (!cameraActive) return;

      if (controllerMode === ControllerMode.BUILTIN_MOTION) {
        const currentVector = getFrameVector();
        if (currentVector && samples.length > 0) {
          // Perform neighbor-based comparisons
          const distances = samples.map((sample) => {
            let sumSq = 0;
            for (let i = 0; i < currentVector.length; i++) {
              sumSq += Math.pow(currentVector[i] - sample.vector[i], 2);
            }
            return {
              label: sample.label,
              dist: Math.sqrt(sumSq),
            };
          });

          distances.sort((a, b) => a.dist - b.dist);

          const k = Math.min(5, distances.length);
          const topK = distances.slice(0, k);

          const votes = { idle: 0, jump: 0, crouch: 0 };
          topK.forEach((item) => {
            const weight = 1 / (item.dist + 0.1);
            votes[item.label] += weight;
          });

          const totalWeight = votes.idle + votes.jump + votes.crouch;
          if (totalWeight > 0) {
            const idleConf = votes.idle / totalWeight;
            const jumpConf = votes.jump / totalWeight;
            const crouchConf = votes.crouch / totalWeight;

            setConfidence({
              idle: idleConf,
              jump: jumpConf,
              crouch: crouchConf,
            });

            if (jumpConf > 0.60) {
              onActionTriggered(GameAction.JUMP);
            } else if (crouchConf > 0.60) {
              onActionTriggered(GameAction.CROUCH);
            } else {
              onActionTriggered(GameAction.NONE);
            }
          }
        }
      } else if (controllerMode === ControllerMode.TEACHABLE_MACHINE && tmModelLoaded && tmModel) {
        try {
          if (videoRef.current) {
            const predictions = await tmModel.predict(videoRef.current);
            const scores: any = {};
            predictions.forEach((p: any) => {
              const label = p.className.toLowerCase();
              scores[label] = p.probability;
            });

            const idleVal = scores['idle'] || scores['neutral'] || scores['resting'] || 0;
            const jumpVal = scores['jump'] || scores['up'] || scores['high'] || 0;
            const crouchVal = scores['crouch'] || scores['down'] || scores['low'] || 0;

            const total = (idleVal + jumpVal + crouchVal) || 1;

            setConfidence({
              idle: idleVal / total,
              jump: jumpVal / total,
              crouch: crouchVal / total,
            });

            if (jumpVal > 0.60) {
              onActionTriggered(GameAction.JUMP);
            } else if (crouchVal > 0.60) {
              onActionTriggered(GameAction.CROUCH);
            } else {
              onActionTriggered(GameAction.NONE);
            }
          }
        } catch (err) {
          console.error('Prediction loop error:', err);
        }
      } else if (controllerMode === ControllerMode.LOCAL_MODEL && localModelLoaded && localModel) {
        // Local model: happy → JUMP, sad → CROUCH, angry → ignored
        try {
          if (videoRef.current) {
            const predictions = await localModel.predict(videoRef.current);
            const scores: Record<string, number> = {};
            predictions.forEach((p: any) => {
              scores[p.className.toLowerCase()] = p.probability;
            });
            setLocalScores(scores);

            const happyVal = scores['happy'] ?? 0;
            const sadVal   = scores['sad']   ?? 0;
            const angryVal = scores['angry'] ?? 0;

            if (happyVal > 0.65) {
              onActionTriggered(GameAction.JUMP);
            } else if (sadVal > 0.65) {
              onActionTriggered(GameAction.CROUCH);
            } else if (angryVal > 0.65) {
              // Angry = keep running (NONE resets to normal run state)
              onActionTriggered(GameAction.NONE);
            } else {
              onActionTriggered(GameAction.NONE);
            }
          }
        } catch (err) {
          console.error('Local model prediction error:', err);
        }
      }

      animationId = requestAnimationFrame(predictLoop);
    };

    predictLoop();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [cameraActive, controllerMode, samples, tmModel, tmModelLoaded, localModel, localModelLoaded]);

  const sampleCounts = {
    idle: samples.filter((s) => s.label === 'idle').length,
    jump: samples.filter((s) => s.label === 'jump').length,
    crouch: samples.filter((s) => s.label === 'crouch').length,
  };

  const clearSamples = () => {
    setSamples([]);
    setConfidence({ idle: 1.0, jump: 0, crouch: 0 });
    onActionTriggered(GameAction.NONE);
  };

  return (
    <div id="retro_controller_panel" className="bg-white border-4 border-black p-6 text-black shadow-brutal font-mono flex-1">
      
      {/* Title block */}
      <div className="flex flex-col md:flex-row items-center justify-between border-b-4 border-black pb-4 mb-4 gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-[#FF4444] p-2 border-2 border-black">
            <Camera className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-black tracking-tight uppercase">
              Webcam Controller
            </h2>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">
              TEACHABLE MACHINE CLASSIFIERS
            </p>
          </div>
        </div>

        {/* Input Control Switch Mode Tabs */}
        <div className="flex bg-gray-100 border-2 border-black p-1 w-full md:w-auto">
          <button
            id="mode_btn_keyboard"
            onClick={() => setControllerMode(ControllerMode.KEYBOARD)}
            className={`flex-1 md:flex-none py-1.5 px-3 text-[10px] uppercase font-bold transition-all duration-100 border ${
              controllerMode === ControllerMode.KEYBOARD
                ? 'bg-black text-white border-black'
                : 'text-black border-transparent hover:bg-black/5'
            }`}
          >
            🕹️ Keyboard
          </button>
          <button
            id="mode_btn_builtin"
            onClick={() => setControllerMode(ControllerMode.BUILTIN_MOTION)}
            className={`flex-1 md:flex-none py-1.5 px-3 text-[10px] uppercase font-bold transition-all duration-100 border ${
              controllerMode === ControllerMode.BUILTIN_MOTION
                ? 'bg-black text-white border-black'
                : 'text-black border-transparent hover:bg-black/5'
            }`}
          >
            ⚡ In-App Trainer
          </button>
          <button
            id="mode_btn_teachable"
            onClick={() => setControllerMode(ControllerMode.TEACHABLE_MACHINE)}
            className={`flex-1 md:flex-none py-1.5 px-3 text-[10px] uppercase font-bold transition-all duration-100 border ${
              controllerMode === ControllerMode.TEACHABLE_MACHINE
                ? 'bg-black text-white border-black'
                : 'text-black border-transparent hover:bg-black/5'
            }`}
          >
            🧠 TM Link
          </button>
          <button
            id="mode_btn_local_model"
            onClick={() => setControllerMode(ControllerMode.LOCAL_MODEL)}
            className={`flex-1 md:flex-none py-1.5 px-3 text-[10px] uppercase font-bold transition-all duration-100 border ${
              controllerMode === ControllerMode.LOCAL_MODEL
                ? 'bg-[#FFD700] text-black border-black'
                : 'text-black border-transparent hover:bg-yellow-50'
            }`}
          >
            🎭 Local Model
          </button>
        </div>
      </div>

      {/* Main Column */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Webcam stream rendering */}
        <div className="lg:col-span-5 flex flex-col items-center">
          <div className="relative w-full max-w-[280px] aspect-[4/3] bg-black border-4 border-black flex items-center justify-center shadow-brutal-sm rounded-sm overflow-hidden">
            
            {/* Diagnostics Tag */}
            <div className="absolute top-2 left-2 z-10 bg-black border border-white/40 px-1.5 py-0.5 text-[8px] font-bold text-white uppercase flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full ${cameraActive ? 'bg-[#00FF00]' : 'bg-red-500'}`} />
              CAM_FEED
            </div>

            {gameAction !== GameAction.NONE && (
              <div className="absolute top-2 right-2 z-10 bg-black border border-[#FF4444] text-[#FF4444] px-1.5 py-0.5 text-[8px] font-bold uppercase animate-pulse">
                {gameAction === GameAction.JUMP && '⚡ JUMPING'}
                {gameAction === GameAction.CROUCH && '🦖 CROUCHING'}
              </div>
            )}

            <canvas ref={canvasRef} className="hidden" width={20} height={20} />

            <video
              ref={videoRef}
              className={`w-full h-full object-cover transform -scale-x-100 ${
                cameraActive ? 'opacity-90' : 'opacity-0'
              } transition-opacity duration-300`}
              playsInline
              muted
            />

            {!cameraActive && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center bg-[#f0f0f0] text-black">
                {cameraLoading ? (
                  <div className="flex flex-col items-center gap-2">
                    <RefreshCw className="w-8 h-8 text-black animate-spin" />
                    <span className="text-[10px] font-bold">BOOTING CAMERA...</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <div className="bg-black text-white p-2.5 border-2 border-black rounded-full shrink-0">
                      <Camera className="w-6 h-6" />
                    </div>
                    {controllerMode === ControllerMode.KEYBOARD ? (
                      <div>
                        <span className="text-[9px] text-gray-700 font-bold block bg-gray-200 border border-black/20 px-1 py-0.5">KEYBOARD ACTIVE</span>
                        <p className="text-[9px] text-gray-500 mt-1 leading-tight">Camera is offline</p>
                      </div>
                    ) : (
                      <div>
                        <button
                          onClick={startCamera}
                          className="px-3 py-1 bg-[#FF4444] text-white hover:bg-[#dd3333] border-2 border-black text-[10px] font-bold active:scale-95 duration-75 select-none"
                        >
                          ENABLE CAMERA
                        </button>
                        {cameraError && (
                          <div className="text-[9px] text-red-600 mt-1.5 leading-none px-1">
                            {cameraError}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          {cameraActive && (
            <p className="text-[9px] text-gray-500 font-bold uppercase mt-2 text-center leading-normal">
              💡 Stand centered under bright light.
            </p>
          )}
        </div>

        {/* Controller Sub-Panels */}
        <div className="lg:col-span-7 flex flex-col justify-between">
          
          {/* A. KEYBOARD INFO CARD */}
          {controllerMode === ControllerMode.KEYBOARD && (
            <div className="bg-white border-4 border-black p-4 flex-1 flex flex-col justify-center">
              <h3 className="text-xs font-black uppercase text-[#FF4444] mb-2 flex items-center gap-1.5">
                🕹️ KEYBOARD SHORTCUTS ENABLED
              </h3>
              <p className="text-[11px] text-gray-800 font-semibold mb-4 leading-relaxed">
                Classic prompt input binds instantly. Perfect for instant response:
              </p>
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="bg-[#fffdf0] border-2 border-black p-2 shadow-brutal-sm">
                  <span className="text-[10px] font-black inline-block px-2 py-0.5 bg-white border-2 border-black rounded shadow-sm">
                    SPACE / UP
                  </span>
                  <div className="text-[9px] text-gray-700 uppercase font-bold mt-1.5">Leap Obstacles</div>
                </div>
                <div className="bg-[#fffdf0] border-2 border-black p-2 shadow-brutal-sm">
                  <span className="text-[10px] font-black inline-block px-2 py-0.5 bg-white border-2 border-black rounded shadow-sm">
                    DOWN ARROW
                  </span>
                  <div className="text-[9px] text-gray-700 uppercase font-bold mt-1.5">Crouch / Slide</div>
                </div>
              </div>
            </div>
          )}

          {/* B. IN-APP KNN SAMPLER PANEL */}
          {controllerMode === ControllerMode.BUILTIN_MOTION && (
            <div className="flex flex-col gap-3 flex-1">
              <div className="bg-gray-50 border-2 border-black p-3.5">
                <div className="flex justify-between items-center mb-2.5">
                  <span className="text-[10px] font-black uppercase text-gray-600 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-yellow-500" />
                    RECORD NEST SAMPLES
                  </span>
                  {samples.length > 0 && (
                    <button
                      onClick={clearSamples}
                      className="text-[9px] font-bold text-red-600 hover:bg-red-50 hover:underline flex items-center gap-1 border border-black px-2 py-0.5 bg-white"
                    >
                      RESET TRAINING DATA
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {/* idle train */}
                  <div className="flex flex-col gap-1">
                    <button
                      onMouseDown={() => { if (cameraActive) setIsRecording('idle'); }}
                      onMouseUp={() => setIsRecording(null)}
                      onMouseLeave={() => setIsRecording(null)}
                      onTouchStart={() => { if (cameraActive) setIsRecording('idle'); }}
                      onTouchEnd={() => setIsRecording(null)}
                      className={`py-2 px-1 text-[10px] font-black uppercase border-2 border-black transition-all text-center select-none ${
                        isRecording === 'idle'
                          ? 'bg-[#10B981] text-white animate-pulse'
                          : 'bg-white text-[#10B981] hover:bg-gray-100'
                      }`}
                      disabled={!cameraActive}
                    >
                      🏠 Idle
                    </button>
                    <div className="text-[9px] text-center font-bold text-gray-500">
                      {sampleCounts.idle} / 12 units
                    </div>
                  </div>

                  {/* jump train */}
                  <div className="flex flex-col gap-1">
                    <button
                      onMouseDown={() => { if (cameraActive) setIsRecording('jump'); }}
                      onMouseUp={() => setIsRecording(null)}
                      onMouseLeave={() => setIsRecording(null)}
                      onTouchStart={() => { if (cameraActive) setIsRecording('jump'); }}
                      onTouchEnd={() => setIsRecording(null)}
                      className={`py-2 px-1 text-[10px] font-black uppercase border-2 border-black transition-all text-center select-none ${
                        isRecording === 'jump'
                          ? 'bg-[#3B82F6] text-white animate-pulse'
                          : 'bg-white text-[#3B82F6] hover:bg-gray-100'
                      }`}
                      disabled={!cameraActive}
                    >
                      🚀 Jump
                    </button>
                    <div className="text-[9px] text-center font-bold text-gray-500">
                      {sampleCounts.jump} / 12 units
                    </div>
                  </div>

                  {/* crouch train */}
                  <div className="flex flex-col gap-1">
                    <button
                      onMouseDown={() => { if (cameraActive) setIsRecording('crouch'); }}
                      onMouseUp={() => setIsRecording(null)}
                      onMouseLeave={() => setIsRecording(null)}
                      onTouchStart={() => { if (cameraActive) setIsRecording('crouch'); }}
                      onTouchEnd={() => setIsRecording(null)}
                      className={`py-2 px-1 text-[10px] font-black uppercase border-2 border-black transition-all text-center select-none ${
                        isRecording === 'crouch'
                          ? 'bg-[#EF4444] text-white animate-pulse'
                          : 'bg-white text-[#EF4444] hover:bg-gray-100'
                      }`}
                      disabled={!cameraActive}
                    >
                      🦖 Crouch
                    </button>
                    <div className="text-[9px] text-center font-bold text-gray-500">
                      {sampleCounts.crouch} / 12 units
                    </div>
                  </div>
                </div>

                <div className="text-[9px] text-gray-500 font-bold mt-2 border-t border-black/10 pt-1.5 leading-tight uppercase">
                  🔴 Hold buttons for 2 secs while posing in camera to record vectors.
                </div>
              </div>

              {/* Confidence bars in style: bg-white edge border */}
              <div className="bg-white border-4 border-black p-4 shadow-brutal-sm">
                <span className="text-[10px] font-black text-black block mb-3 uppercase border-b-2 border-black pb-1 flex justify-between">
                  <span>AI Classifier Output</span>
                  <span className="text-[#00CC00] animate-pulse">● Active</span>
                </span>
                
                {samples.length === 0 ? (
                  <div className="text-[10px] text-yellow-600 font-bold py-1 text-center flex items-center justify-center gap-1 select-none">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" /> UNTRAINED FEED. PLEASE RECORD SAMPLES ABOVE!
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* Neutral */}
                    <div className="flex items-center gap-3">
                      <span className="w-16 text-[10px] font-bold uppercase">Neutral</span>
                      <div className="flex-1 h-6 bg-gray-100 border-2 border-black">
                        <div
                          className="h-full bg-[#10B981] border-r-4 border-black transition-all duration-75 relative"
                          style={{ width: `${confidence.idle * 100}%` }}
                        />
                      </div>
                      <span className="w-10 text-right font-black text-[10px]">{Math.round(confidence.idle * 100)}%</span>
                    </div>

                    {/* Jump */}
                    <div className="flex items-center gap-3">
                      <span className="w-16 text-[10px] font-bold uppercase">Jump</span>
                      <div className="flex-1 h-6 bg-gray-100 border-2 border-black">
                        <div
                          className="h-full bg-[#3B82F6] border-r-4 border-black transition-all duration-75 relative"
                          style={{ width: `${confidence.jump * 100}%` }}
                        />
                      </div>
                      <span className="w-10 text-right font-black text-[10px]">{Math.round(confidence.jump * 100)}%</span>
                    </div>

                    {/* Crouch */}
                    <div className="flex items-center gap-3">
                      <span className="w-16 text-[10px] font-bold uppercase">Crouch</span>
                      <div className="flex-1 h-6 bg-gray-100 border-2 border-black">
                        <div
                          className="h-full bg-[#EF4444] border-r-4 border-black transition-all duration-75 relative"
                          style={{ width: `${confidence.crouch * 100}%` }}
                        />
                      </div>
                      <span className="w-10 text-right font-black text-[10px]">{Math.round(confidence.crouch * 100)}%</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* C. TEACHABLE MACHINE LINK CARD */}
          {controllerMode === ControllerMode.TEACHABLE_MACHINE && (
            <div className="bg-white border-2 border-black p-4 flex-1 flex flex-col justify-between gap-3 shadow-brutal-sm">
              <div>
                <h3 className="text-[11px] font-black uppercase text-black flex items-center gap-1.5 mb-1 bg-yellow-300 p-1.5 border border-black">
                  🧠 GOOGLE TEACHABLE MACHINE CONNECT
                </h3>
                <p className="text-[10px] text-gray-600 font-bold uppercase tracking-wide leading-tight mb-2">
                  Upload exported model to Teachable Cloud, then copy/paste its public target link.
                </p>

                <div className="flex gap-2">
                  <input
                    id="teachable_url_input"
                    type="text"
                    placeholder="https://teachablemachine.withgoogle.com/models/xxxx/"
                    value={tmModelUrl}
                    onChange={(e) => setTmModelUrl(e.target.value)}
                    className="flex-1 text-[11px] bg-white border-2 border-black px-2.5 py-1.5 focus:outline-none focus:bg-gray-50 font-mono text-black placeholder:text-gray-400 truncate"
                  />
                  <button
                    id="teachable_load_btn"
                    onClick={loadTeachableModel}
                    disabled={tmLoading || !tmModelUrl.trim() || !cameraActive}
                    className="px-3 py-1.5 bg-[#FF4444] text-white hover:bg-red-600 disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200 border-2 border-black text-[11px] font-extrabold select-none shrink-0"
                  >
                    {tmLoading ? 'WAIT...' : 'CONNECT'}
                  </button>
                </div>

                {tmError && (
                  <div className="mt-2 text-[9px] text-red-600 font-bold uppercase">
                    ⚠️ {tmError}
                  </div>
                )}
                {tmModelLoaded && (
                  <div className="mt-2 text-[9px] text-[#00AA00] font-bold uppercase flex items-center gap-1">
                    ✅ Cloud model hooked! Active predict flow.
                  </div>
                )}
              </div>

              {/* Prediction results for TM */}
              {tmModelLoaded && (
                <div className="border-t-2 border-dashed border-black pt-2">
                  <span className="text-[9px] font-black text-black block mb-2 uppercase select-none">
                    📈 CLOUD TM MODEL FEED CONFIDENCES:
                  </span>
                  <div className="space-y-2">
                    {/* Neutral */}
                    <div className="flex items-center gap-3">
                      <span className="w-12 text-[10px] font-bold uppercase">Idle</span>
                      <div className="flex-1 h-4 bg-gray-100 border border-black">
                        <div className="h-full bg-green-500 border-r-2 border-black" style={{ width: `${confidence.idle * 100}%` }} />
                      </div>
                      <span className="text-[10px] font-black w-8 text-right">{Math.round(confidence.idle * 100)}%</span>
                    </div>

                    {/* Jump */}
                    <div className="flex items-center gap-3">
                      <span className="w-12 text-[10px] font-bold uppercase">Jump</span>
                      <div className="flex-1 h-4 bg-gray-100 border border-black">
                        <div className="h-full bg-[#3B82F6] border-r-2 border-black" style={{ width: `${confidence.jump * 100}%` }} />
                      </div>
                      <span className="text-[10px] font-black w-8 text-right">{Math.round(confidence.jump * 100)}%</span>
                    </div>

                    {/* Crouch */}
                    <div className="flex items-center gap-3">
                      <span className="w-12 text-[10px] font-bold uppercase">Crouch</span>
                      <div className="flex-1 h-4 bg-gray-100 border border-black">
                        <div className="h-full bg-[#EF4444] border-r-2 border-black" style={{ width: `${confidence.crouch * 100}%` }} />
                      </div>
                      <span className="text-[10px] font-black w-8 text-right">{Math.round(confidence.crouch * 100)}%</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* D. LOCAL MODEL PANEL — /model/ auto-loaded, happy=JUMP, sad=CROUCH */}
          {controllerMode === ControllerMode.LOCAL_MODEL && (
            <div className="bg-white border-2 border-black p-4 flex-1 flex flex-col gap-3 shadow-brutal-sm">
              <h3 className="text-[11px] font-black uppercase text-black flex items-center gap-1.5 bg-[#FFD700] p-1.5 border border-black">
                🎭 LOCAL TEACHABLE MACHINE MODEL
              </h3>

              {/* Loading state */}
              {(localModelLoading || (!localModelLoaded && !localModelError)) && (
                <div className="flex items-center gap-2 text-[10px] font-bold text-gray-600 uppercase">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
                  {localModelLoading ? 'LOADING MODEL FROM /model/...' : 'WAITING FOR TENSORFLOW...'}
                </div>
              )}

              {/* Error state */}
              {localModelError && (
                <div className="text-[9px] text-red-600 font-bold uppercase flex items-start gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  {localModelError}
                </div>
              )}

              {/* Loaded state */}
              {localModelLoaded && (
                <>
                  <div className="text-[9px] text-[#00AA00] font-bold uppercase flex items-center gap-1">
                    ✅ Model ready! Make a face to control the runner.
                  </div>

                  {/* Legend */}
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-[#fffdf0] border-2 border-black p-2">
                      <div className="text-lg">😄</div>
                      <div className="text-[9px] font-black uppercase text-[#3B82F6]">Happy = JUMP</div>
                    </div>
                    <div className="bg-[#fffdf0] border-2 border-black p-2">
                      <div className="text-lg">😢</div>
                      <div className="text-[9px] font-black uppercase text-[#EF4444]">Sad = CROUCH</div>
                    </div>
                    <div className="bg-[#fffdf0] border-2 border-black p-2">
                      <div className="text-lg">😠</div>
                      <div className="text-[9px] font-black uppercase text-[#9c27b0]">Angry = RUN</div>
                    </div>
                  </div>

                  {/* Confidence bars per model label */}
                  <div className="border-t-2 border-dashed border-black pt-2 space-y-2">
                    <span className="text-[9px] font-black text-black block mb-1 uppercase select-none">
                      📈 LIVE CONFIDENCE:
                    </span>
                    {localModelLabels.map((label) => {
                      const val = localScores[label] ?? 0;
                      const isJump   = label === 'happy';
                      const isCrouch = label === 'sad';
                      const emoji = isJump ? '😄' : isCrouch ? '😢' : '😠';
                      const color = isJump ? '#3B82F6' : isCrouch ? '#EF4444' : '#9c27b0';
                      const actionTag = isJump ? ' → JUMP' : isCrouch ? ' → CROUCH' : ' → RUN';
                      return (
                        <div key={label} className="flex items-center gap-2">
                          <span className="text-sm w-5 shrink-0">{emoji}</span>
                          <span className="w-16 text-[9px] font-bold uppercase truncate" style={{ color }}>
                            {label}{actionTag}
                          </span>
                          <div className="flex-1 h-4 bg-gray-100 border border-black">
                            <div
                              className="h-full border-r-2 border-black transition-all duration-75"
                              style={{ width: `${val * 100}%`, backgroundColor: color }}
                            />
                          </div>
                          <span className="text-[10px] font-black w-8 text-right">{Math.round(val * 100)}%</span>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
