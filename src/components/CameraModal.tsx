import React, { useRef, useState, useEffect } from 'react';
import { Camera, RefreshCw, X, AlertCircle, Zap, ZapOff, Grid, Maximize2, Smartphone, Monitor } from 'lucide-react';

interface CameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (imageDataUrl: string) => void;
}

type ViewfinderMode = 'portrait' | 'landscape' | 'receipt' | 'full';

export const CameraModal: React.FC<CameraModalProps> = ({
  isOpen,
  onClose,
  onCapture,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [error, setError] = useState<string | null>(null);
  const [hasTorch, setHasTorch] = useState<boolean>(false);
  const [isTorchOn, setIsTorchOn] = useState<boolean>(false);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [viewfinderMode, setViewfinderMode] = useState<ViewfinderMode>('portrait');
  const [isAutoCropping, setIsAutoCropping] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      return;
    }

    startCamera();

    return () => {
      stopCamera();
    };
  }, [isOpen, facingMode]);

  const startCamera = async () => {
    setError(null);
    try {
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      setStream(mediaStream);

      // Check if torch is available
      const track = mediaStream.getVideoTracks()[0];
      if (track) {
        const capabilities = (track.getCapabilities?.() || {}) as { torch?: boolean };
        setHasTorch(Boolean(capabilities.torch));
      }

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play();
      }
    } catch (err) {
      console.error('Camera access failed:', err);
      // Try fallback to any available video device
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
        setStream(fallbackStream);
        if (videoRef.current) {
          videoRef.current.srcObject = fallbackStream;
          videoRef.current.play();
        }
      } catch {
        setError('Camera permission was denied or no camera device was found.');
      }
    }
  };

  const toggleTorch = async () => {
    if (!stream) return;
    const track = stream.getVideoTracks()[0];
    if (track) {
      try {
        const nextState = !isTorchOn;
        // @ts-expect-error torch constraint
        await track.applyConstraints({ advanced: [{ torch: nextState }] });
        setIsTorchOn(nextState);
      } catch (e) {
        console.warn('Torch control not supported on this track:', e);
      }
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsTorchOn(false);
  };

  const handleCapture = () => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    const videoWidth = video.videoWidth || 1280;
    const videoHeight = video.videoHeight || 720;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (isAutoCropping && viewfinderMode !== 'full') {
      // Calculate crop box coordinates relative to video dimensions
      let cropW = videoWidth;
      let cropH = videoHeight;

      if (viewfinderMode === 'portrait') {
        // 3:4 document ratio
        cropW = Math.min(videoWidth * 0.78, videoHeight * (3 / 4));
        cropH = cropW * (4 / 3);
      } else if (viewfinderMode === 'landscape') {
        // 16:10 or 4:3 wide ratio
        cropW = videoWidth * 0.88;
        cropH = Math.min(videoHeight * 0.65, cropW * (10 / 16));
      } else if (viewfinderMode === 'receipt') {
        // Narrow vertical receipt
        cropW = Math.min(videoWidth * 0.6, videoHeight * 0.45);
        cropH = cropW * (16 / 9);
      }

      const cropX = (videoWidth - cropW) / 2;
      const cropY = (videoHeight - cropH) / 2;

      canvas.width = cropW;
      canvas.height = cropH;

      ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
    } else {
      canvas.width = videoWidth;
      canvas.height = videoHeight;
      ctx.drawImage(video, 0, 0, videoWidth, videoHeight);
    }

    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    stopCamera();
    onCapture(dataUrl);
    onClose();
  };

  const toggleFacingMode = () => {
    setFacingMode(prev => (prev === 'environment' ? 'user' : 'environment'));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="bg-slate-900 border border-emerald-500/30 w-full max-w-xl rounded-2xl overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-3.5 bg-slate-800/95 flex items-center justify-between text-white border-b border-slate-700/80">
          <div className="flex items-center space-x-2">
            <Camera className="w-5 h-5 text-emerald-400" />
            <span className="font-bold text-xs sm:text-sm tracking-wide">Document Scanner Camera</span>
          </div>

          <div className="flex items-center space-x-1.5">
            {hasTorch && (
              <button
                onClick={toggleTorch}
                title="Toggle Torch / Flashlight"
                className={`p-2 rounded-lg text-xs flex items-center gap-1 transition-colors ${
                  isTorchOn ? 'bg-amber-400 text-slate-950 font-bold' : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
                }`}
              >
                {isTorchOn ? <Zap className="w-4 h-4" /> : <ZapOff className="w-4 h-4" />}
              </button>
            )}

            <button
              onClick={() => setShowGrid(prev => !prev)}
              title="Toggle Grid Guidelines"
              className={`p-2 rounded-lg text-xs flex items-center gap-1 transition-colors ${
                showGrid ? 'bg-emerald-600 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
              }`}
            >
              <Grid className="w-4 h-4" />
            </button>

            <button
              onClick={toggleFacingMode}
              title="Switch Camera (Front / Back)"
              className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs flex items-center gap-1 transition-colors"
            >
              <RefreshCw className="w-4 h-4 text-emerald-300" />
              <span className="hidden sm:inline">Flip</span>
            </button>

            <button
              onClick={() => {
                stopCamera();
                onClose();
              }}
              className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Viewfinder Orientation Selector */}
        <div className="px-3 py-2 bg-slate-800 border-b border-slate-700 flex items-center justify-between flex-wrap gap-2 text-xs">
          <span className="text-slate-400 text-[11px] font-medium hidden sm:inline">Document Frame:</span>
          <div className="flex items-center space-x-1.5 overflow-x-auto w-full sm:w-auto">
            <button
              onClick={() => setViewfinderMode('portrait')}
              className={`px-2.5 py-1 rounded-lg flex items-center gap-1 text-xs font-semibold transition-all whitespace-nowrap ${
                viewfinderMode === 'portrait'
                  ? 'bg-emerald-500 text-slate-950 font-bold shadow-xs'
                  : 'bg-slate-700/70 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Portrait (ဒေါင်လိုက် A4)</span>
            </button>

            <button
              onClick={() => setViewfinderMode('landscape')}
              className={`px-2.5 py-1 rounded-lg flex items-center gap-1 text-xs font-semibold transition-all whitespace-nowrap ${
                viewfinderMode === 'landscape'
                  ? 'bg-emerald-500 text-slate-950 font-bold shadow-xs'
                  : 'bg-slate-700/70 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>Landscape (အလျားလိုက်)</span>
            </button>

            <button
              onClick={() => setViewfinderMode('receipt')}
              className={`px-2.5 py-1 rounded-lg flex items-center gap-1 text-xs font-semibold transition-all whitespace-nowrap ${
                viewfinderMode === 'receipt'
                  ? 'bg-emerald-500 text-slate-950 font-bold shadow-xs'
                  : 'bg-slate-700/70 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <span>Receipt (ပြေစာ)</span>
            </button>

            <button
              onClick={() => setViewfinderMode('full')}
              className={`px-2 py-1 rounded-lg flex items-center gap-1 text-xs font-semibold transition-all whitespace-nowrap ${
                viewfinderMode === 'full'
                  ? 'bg-emerald-500 text-slate-950 font-bold shadow-xs'
                  : 'bg-slate-700/70 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>Full</span>
            </button>
          </div>
        </div>

        {/* Video Viewport Area with Viewfinder Overlay */}
        <div className="relative bg-black min-h-[360px] max-h-[500px] aspect-4/3 sm:aspect-16/10 flex items-center justify-center overflow-hidden select-none">
          {error ? (
            <div className="p-6 text-center text-slate-300 flex flex-col items-center">
              <AlertCircle className="w-10 h-10 text-rose-500 mb-2" />
              <p className="text-sm font-medium">{error}</p>
              <p className="text-xs text-slate-400 mt-1">
                You can also use "From Gallery" to upload a document image or select a sample document.
              </p>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                playsInline
                autoPlay
                muted
                className="w-full h-full object-contain"
              />

              {/* Dynamic Viewfinder Frame Overlay */}
              {viewfinderMode !== 'full' && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-4">
                  {/* Viewfinder Target Container */}
                  <div
                    className={`relative transition-all duration-300 flex flex-col justify-between ${
                      viewfinderMode === 'portrait'
                        ? 'w-[75%] h-[88%] border-2 border-emerald-400/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] rounded-xl'
                        : viewfinderMode === 'landscape'
                        ? 'w-[90%] h-[65%] border-2 border-emerald-400/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] rounded-xl'
                        : 'w-[62%] h-[92%] border-2 border-emerald-400/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] rounded-xl'
                    }`}
                  >
                    {/* Glowing Corner Accents */}
                    <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-emerald-300 rounded-tl-lg shadow-sm"></div>
                    <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-emerald-300 rounded-tr-lg shadow-sm"></div>
                    <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-emerald-300 rounded-bl-lg shadow-sm"></div>
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-emerald-300 rounded-br-lg shadow-sm"></div>

                    {/* Rule of Thirds Grid Guidelines */}
                    {showGrid && (
                      <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none opacity-40">
                        <div className="border-r border-b border-emerald-300/40"></div>
                        <div className="border-r border-b border-emerald-300/40"></div>
                        <div className="border-b border-emerald-300/40"></div>
                        <div className="border-r border-b border-emerald-300/40"></div>
                        <div className="border-r border-b border-emerald-300/40"></div>
                        <div className="border-b border-emerald-300/40"></div>
                        <div className="border-r border-emerald-300/40"></div>
                        <div className="border-r border-emerald-300/40"></div>
                        <div></div>
                      </div>
                    )}

                    {/* Laser Scanning Animation Line */}
                    <div className="absolute left-1 right-1 h-0.5 bg-gradient-to-r from-transparent via-emerald-300 to-transparent shadow-[0_0_8px_#34d399] animate-bounce top-1/2 -translate-y-1/2"></div>

                    {/* Top Guide Label */}
                    <div className="pt-2 text-center">
                      <span className="px-3 py-1 bg-slate-950/80 backdrop-blur-xs text-emerald-300 text-[11px] font-semibold rounded-full border border-emerald-500/30">
                        {viewfinderMode === 'portrait'
                          ? '📄 A4 Portrait Frame'
                          : viewfinderMode === 'landscape'
                          ? '📑 Landscape Wide Table Frame'
                          : '🧾 Receipt Frame'}
                      </span>
                    </div>

                    {/* Center Crosshair */}
                    <div className="self-center w-3 h-3 border border-emerald-300/50 rounded-full"></div>

                    {/* Bottom Guide Prompt */}
                    <div className="pb-2 text-center">
                      <span className="px-3 py-0.5 bg-black/75 backdrop-blur-xs text-slate-200 text-[10px] rounded-full">
                        Align document edges inside frame
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Action Bottom Bar */}
        <div className="p-4 bg-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsAutoCropping(prev => !prev)}
              className={`text-xs px-2.5 py-1.5 rounded-lg border transition-all ${
                isAutoCropping
                  ? 'bg-emerald-950/70 border-emerald-400 text-emerald-300 font-semibold'
                  : 'bg-slate-700/60 border-slate-600 text-slate-400 hover:text-slate-200'
              }`}
            >
              {isAutoCropping ? '✓ Crop to Frame' : 'Full Frame'}
            </button>
          </div>

          {/* Shutter Capture Button */}
          <button
            onClick={handleCapture}
            disabled={!stream}
            className="w-16 h-16 rounded-full bg-white hover:bg-emerald-50 disabled:opacity-50 p-1 flex items-center justify-center shadow-lg shadow-emerald-500/20 transition-transform active:scale-95"
            title="Capture Document"
          >
            <div className="w-full h-full rounded-full border-4 border-emerald-500 bg-white flex items-center justify-center">
              <div className="w-5 h-5 rounded-full bg-emerald-500" />
            </div>
          </button>

          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="px-3.5 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white text-xs font-medium transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

