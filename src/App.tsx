import React, { useState, useEffect } from 'react';
import { GameState, ControllerMode, GameAction, GameStats } from './types';
import WebcamController from './components/WebcamController';
import RetroGameCanvas from './components/RetroGameCanvas';
import { 
  Trophy, 
  Sparkles, 
  Star, 
  Zap, 
  HelpCircle,
  HelpCircle as InfoIcon,
  Play,
  Award
} from 'lucide-react';

export default function App() {
  const [controllerMode, setControllerMode] = useState<ControllerMode>(ControllerMode.KEYBOARD);
  const [activeAction, setActiveAction] = useState<GameAction>(GameAction.NONE);
  const [gameState, setGameState] = useState<GameState>(GameState.IDLE);

  // Initialize stats with persistent High Score loading
  const [stats, setStats] = useState<GameStats>(() => {
    let savedHighScore = 0;
    try {
      const stored = localStorage.getItem('teachable_high_score');
      if (stored) {
        savedHighScore = parseInt(stored, 10);
      }
    } catch (e) {
      console.error('Local storage reading error:', e);
    }
    return {
      score: 0,
      highScore: savedHighScore,
      coins: 0,
      distance: 0,
      speedMultiplier: 1.0,
    };
  });

  // Track and save high score changes
  useEffect(() => {
    try {
      localStorage.setItem('teachable_high_score', stats.highScore.toString());
    } catch (e) {
      console.error('Local storage saving error:', e);
    }
  }, [stats.highScore]);

  // Handle active command predictions
  const handleActionTriggered = (action: GameAction) => {
    setActiveAction(action);
  };

  return (
    <div id="retro_app_wrapper" className="min-h-screen bg-[#FFD700] text-black flex flex-col justify-between selection:bg-black selection:text-[#FFD700] p-4 md:p-8 font-mono overflow-x-hidden">
      
      {/* 1. RETRO BRUTAL HEADER */}
      <header className="w-full max-w-7xl mx-auto bg-white border-4 border-black p-4 md:p-6 mb-6 shadow-brutal flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-[#FF4444] border-4 border-black shrink-0 animate-bounce"></div>
          <div>
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-black tracking-tighter text-black uppercase font-sans">
              NEURO-RUNNER 8-BIT
            </h1>
            <p className="text-[10px] md:text-xs text-black/75 font-mono font-bold uppercase tracking-wider mt-0.5">
              🚀 8-Bit Canvas Engine ● Webcam Motion Classifiers
            </p>
          </div>
        </div>

        {/* Dynamic High Scores panel of the template */}
        <div className="flex gap-4 sm:gap-8 text-lg sm:text-2xl font-black uppercase text-black font-mono">
          <div>HI <span className="bg-black text-white px-3 py-0.5 rounded-xs">{stats.highScore.toString().padStart(5, '0')}</span></div>
          <div>SCORE <span className="bg-black text-[yellow] px-3 py-0.5 rounded-xs">{stats.score.toString().padStart(5, '0')}</span></div>
        </div>
      </header>

      {/* 2. MAIN RETRO NEIGHBORHOOD BENTO GRID */}
      <main className="max-w-7xl mx-auto w-full flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COMPONENT COLUMN: THE ARCADE CABINET SCREEN */}
        <div className="lg:col-span-12 xl:col-span-7 flex flex-col gap-6">
          
          {/* Main Game Screen Canvas Block */}
          <div className="w-full">
            <RetroGameCanvas
              activeAction={activeAction}
              gameState={gameState}
              setGameState={setGameState}
              stats={stats}
              setStats={setStats}
            />
          </div>

          {/* Neo-brutalist Statistics boxes */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            
            {/* Score Box */}
            <div className="bg-white border-4 border-black p-4 shadow-brutal-sm flex flex-col justify-between hover:-translate-y-1 transition duration-100">
              <span className="text-[10px] font-bold tracking-widest text-black/60 uppercase">
                🏁 Active Score
              </span>
              <div className="text-xl sm:text-2xl font-black text-black mt-2 font-mono">
                {stats.score.toString().padStart(6, '0')}
              </div>
              <span className="text-[9px] text-gray-400 mt-1 uppercase font-bold">
                +1pt / game frame
              </span>
            </div>

            {/* High score box */}
            <div className="bg-white border-4 border-black p-4 shadow-brutal-sm flex flex-col justify-between hover:-translate-y-1 transition duration-100">
              <span className="text-[10px] font-bold tracking-widest text-[#d85d00] uppercase flex items-center gap-1">
                🏆 Best Streak
              </span>
              <div className="text-xl sm:text-2xl font-black text-[#d85d00] mt-2 font-mono">
                {stats.highScore.toString().padStart(6, '0')}
              </div>
              <span className="text-[9px] text-gray-400 mt-1 uppercase font-bold">
                Level Saved Local
              </span>
            </div>

            {/* Coins box */}
            <div className="bg-white border-4 border-black p-4 shadow-brutal-sm flex flex-col justify-between hover:-translate-y-1 transition duration-100">
              <span className="text-[10px] font-bold tracking-widest text-[#3b82f6] uppercase flex items-center gap-1">
                ⭐ GOLD COINS
              </span>
              <div className="text-xl sm:text-2xl font-black text-[#3b82f6] mt-2 font-mono">
                {stats.coins.toString().padStart(3, '0')}
              </div>
              <span className="text-[9px] text-gray-400 mt-1 uppercase font-bold">
                +100 bonus pts
              </span>
            </div>

            {/* Speed Multiplier Box */}
            <div className="bg-white border-4 border-black p-4 shadow-brutal-sm flex flex-col justify-between hover:-translate-y-1 transition duration-100">
              <span className="text-[10px] font-bold tracking-widest text-[#9c27b0] uppercase flex items-center gap-1">
                ⚡ PACE RATE
              </span>
              <div className="text-xl sm:text-2xl font-black text-[#9c27b0] mt-2 font-mono">
                {stats.speedMultiplier.toFixed(2)}x
              </div>
              <div className="w-full bg-gray-200 border-2 border-black h-3.5 mt-1.5 overflow-hidden">
                <div 
                  className="h-full bg-[#9c27b0] border-r-2 border-black transition-all duration-300" 
                  style={{ width: `${Math.min(100, (stats.speedMultiplier - 1.0) * 100)}%` }}
                />
              </div>
            </div>

          </div>

          {/* Helpful keyboard details if in keyboard mode */}
          {controllerMode === ControllerMode.KEYBOARD && gameState === GameState.RUNNING && (
            <div className="bg-white border-4 border-black p-4 shadow-brutal-sm flex items-start gap-3">
              <HelpCircle className="w-5 h-5 text-black shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-black uppercase text-black">🕹️ Keyboard hotkeys enabled!</h4>
                <p className="text-[11px] text-black font-semibold leading-relaxed mt-0.5 font-mono">
                  Use the <b>Spacebar / Up Arrow</b> path to Jump, and the <b>Down Arrow</b> key to slide/crouch under birds. Connect camera motion tracking panel to play using webcam gestures!
                </p>
              </div>
            </div>
          )}

        </div>

        {/* RIGHT COLUMN: THE NEURAL WEBCAM INTERFACE AND KNN POSTURE CLASSIFIERS */}
        <div className="lg:col-span-12 xl:col-span-5 flex flex-col h-full">
          <WebcamController
            onActionTriggered={handleActionTriggered}
            controllerMode={controllerMode}
            setControllerMode={setControllerMode}
            gameAction={activeAction}
          />
        </div>

      </main>

      {/* 3. RETRO EDUCATION BLOCK */}
      <section className="max-w-7xl mx-auto w-full mt-8">
        <div className="bg-white border-4 border-black p-6 shadow-brutal">
          <div className="flex items-center gap-2 mb-4 border-b-2 border-black pb-2">
            <InfoIcon className="w-5 h-5 text-[#FF4444]" />
            <h2 className="text-sm font-black tracking-wider uppercase">
              How it works: machine learning controller specifications
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-black text-xs leading-relaxed">
            
            <div className="bg-[#fff9da] border-2 border-black p-4 shadow-brutal-sm flex flex-col gap-2">
              <div className="text-[#FF4444] font-black uppercase flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-[#FF4444] border border-black rounded-full" />
                1. Posture Normalization
              </div>
              <p className="text-gray-800">
                The <b>In-App Trainer</b> captures your camera frame, scaling it to a <b>20x20 Grayscale matrix</b>. High luminosity normalization handles lighting changes, running pixel comparisons instantly.
              </p>
            </div>

            <div className="bg-[#e3f2fd] border-2 border-black p-4 shadow-brutal-sm flex flex-col gap-2">
              <div className="text-[#3b82f6] font-black uppercase flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-[#3b82f6] border border-black rounded-full" />
                2. Teachable Machine Link
              </div>
              <p className="text-gray-800">
                Create custom postures in <b>Google Teachable Machine</b>. Record poses, click <b>Export Model</b>, use the cloud HTTPS share link, paste the URL in the <b>TM Link Tab</b> and connect!
              </p>
            </div>

            <div className="bg-[#e8f5e9] border-2 border-black p-4 shadow-brutal-sm flex flex-col gap-2">
              <div className="text-[#2e7d32] font-black uppercase flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-[#2e7d32] border border-black rounded-full" />
                3. Aligning Poses
              </div>
              <p className="text-gray-800">
                For best outputs, keep <b>Neutral</b> centered. Stand on toes or raise hands for <b>Jump</b>. Crouch down or lean to trigger your responsive <b>Slide/Crouch</b>!
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* 4. FOOTER CREDITS */}
      <footer className="w-full text-center max-w-7xl mx-auto mt-8 pt-4 border-t-2 border-black flex justify-between items-center text-[10px] font-bold uppercase text-black/60">
        <div>NEURO-RUNNER CONSOLE</div>
        <div>STABLE CPU CLOUD RUNTIME</div>
      </footer>

    </div>
  );
}
