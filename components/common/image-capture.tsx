"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { AlertTriangle, ChevronLeft, X } from "lucide-react";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogTitle } from "../ui/dialog";
import { toast } from "sonner";

interface CapturedImage {
  file: File;
  preview: string;
  qualityScore: number;
}

interface ImageCaptureProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (photos: CapturedImage[]) => void;
  title?: string;
  maxPhotos?: number;
  initialCount?: number;
}

export function ImageCapture({ 
  isOpen, 
  onClose, 
  onCapture, 
  title = "Capture Photo", 
  maxPhotos = 1,
  initialCount = 0 
}: ImageCaptureProps) {
  const [capturedImages, setCapturedImages] = useState<{ blob: Blob; preview: string; qualityScore: number }[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const workerRef = useRef<Worker | null>(null);
  const analysisIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [qualityScore, setQualityScore] = useState<number>(0);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const flashRef = useRef<HTMLDivElement>(null);

  const startCamera = async () => {
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: "environment", 
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 } 
        },
        audio: false
      });
      if (videoRef.current) videoRef.current.srcObject = newStream;
      setStream(newStream);
      startAnalysis();
    } catch (err) {
      toast.error("Could not access camera.");
      onClose();
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    if (analysisIntervalRef.current) clearInterval(analysisIntervalRef.current);
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
    setWarnings([]);
    setQualityScore(0);
  };

  const startAnalysis = () => {
    if (!workerRef.current) {
      workerRef.current = new Worker("/workers/video-analyzer.worker.js");
      workerRef.current.onmessage = (e) => {
        setWarnings(e.data.warnings || []);
        setQualityScore(e.data.qualityScore || 0);
      };
    }
    const canvas = document.createElement("canvas");
    canvas.width = 150;
    canvas.height = 150;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    analysisIntervalRef.current = setInterval(() => {
      if (!videoRef.current || !ctx || videoRef.current.readyState !== 4) return;
      ctx.drawImage(videoRef.current, 0, 0, 150, 150);
      const imgData = ctx.getImageData(0, 0, 150, 150);
      const buffer = imgData.data.buffer;
      workerRef.current?.postMessage({ buffer, width: 150, height: 150 }, [buffer]);
    }, 200);
  };

  const capturePhoto = () => {
    if (!videoRef.current || (initialCount + capturedImages.length) >= maxPhotos) return;
    // Trigger Flash Effect
    if (flashRef.current) {
      flashRef.current.style.opacity = "1";
      setTimeout(() => {
        if (flashRef.current) flashRef.current.style.opacity = "0";
      }, 150);
    }

    const canvas = document.createElement("canvas");
    // Ensure we capture at the full resolution of the video stream (target 720p)
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext("2d")?.drawImage(videoRef.current, 0, 0);
    // Use 1.0 (100% quality) for maximum bitrate/detail as requested
    canvas.toBlob((blob) => {
      if (blob) {
        setCapturedImages(prev => [...prev, { blob, preview: URL.createObjectURL(blob), qualityScore }]);
        toast.success(`Photo ${initialCount + capturedImages.length + 1} captured`);
      }
    }, "image/jpeg", 1.0);
  };

  const removePhoto = (index: number) => {
    setCapturedImages(prev => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const isSaving = useRef(false);

  const handleSave = () => {
    if (capturedImages.length < 1) {
      toast.error("Please capture at least 1 image.");
      return;
    }
    isSaving.current = true;
    onCapture(capturedImages.map((img, i) => ({
      file: new File([img.blob], `cap-${Date.now()}-${i}.jpg`, { type: "image/jpeg" }),
      preview: img.preview,
      qualityScore: img.qualityScore
    })));
    onClose();
  };

  useEffect(() => {
    if (isOpen) {
      isSaving.current = false;
      startCamera();
    } else {
      stopCamera();
      if (!isSaving.current) {
        capturedImages.forEach(img => URL.revokeObjectURL(img.preview));
      }
      setCapturedImages([]);
    }
    return () => stopCamera();
  }, [isOpen]);

  const totalCount = initialCount + capturedImages.length;
  const isMaxReached = totalCount >= maxPhotos;

  const getScoreColor = (score: number) => {
    if (score > 70) return "text-emerald-400";
    if (score > 40) return "text-yellow-400";
    return "text-red-400";
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="!fixed !top-0 !left-0 !translate-x-0 !translate-y-0 p-0 bg-black !h-[100dvh] !w-screen !max-w-none !rounded-none border-none">
        <DialogTitle className="sr-only">{title}</DialogTitle>
        
        {/* Header Overlay */}
        <div className="absolute top-0 inset-x-0 z-50 flex items-center justify-between p-4 bg-gradient-to-b from-black/60 to-transparent">
          <Button variant="ghost" size="icon" onClick={onClose} className="bg-black/40 text-white rounded-full transition-colors hover:bg-black/60">
            <ChevronLeft className="w-6 h-6" />
          </Button>
          
          <div className="flex flex-col items-center">
            <div className="flex gap-2 mb-1">
              {Array.from({ length: maxPhotos }).map((_, i) => (
                <div key={i} className={`w-2 h-2 rounded-full transition-all duration-300 ${i < totalCount ? 'bg-emerald-500 scale-110' : 'bg-white/20'}`} />
              ))}
            </div>
            <span className="text-[10px] text-white/60 font-medium uppercase tracking-widest">{totalCount} / {maxPhotos} Captured</span>
          </div>

          <div className="w-10 h-10 flex items-center justify-center bg-black/40 rounded-full border border-white/10">
            <span className={`text-xs font-bold ${getScoreColor(qualityScore)}`}>{qualityScore}%</span>
          </div>
        </div>

        {/* Camera View Container */}
        <div className="flex-1 w-full bg-black overflow-hidden relative">
          <video 
            ref={videoRef} 
            autoPlay 
            muted 
            playsInline 
            className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700 opacity-0 data-[loaded=true]:opacity-100"
            onLoadedMetadata={(e) => e.currentTarget.setAttribute("data-loaded", "true")}
          />
          
          {/* Flash Effect */}
          <div 
            ref={flashRef}
            className="absolute inset-0 bg-white opacity-0 z-[70] pointer-events-none transition-opacity duration-150"
          />
        </div>
        
        {/* Quality Alerts */}
        <div className="absolute top-24 inset-x-0 flex flex-col items-center gap-2 z-40 pointer-events-none">
          {warnings.map(w => (
            <div key={w} className="bg-black/70 backdrop-blur-md px-4 py-2 rounded-full border border-yellow-500/30 text-yellow-400 text-[11px] font-bold shadow-xl flex items-center gap-2 animate-in slide-in-from-top-2">
              <AlertTriangle className="w-4 h-4" /> {w.replace('_', ' ')}
            </div>
          ))}
        </div>

        {/* Controls Overlay */}
        <div className="absolute bottom-0 inset-x-0 z-50 h-60 bg-gradient-to-t from-black via-black/40 to-transparent flex flex-col items-center justify-end p-8 pb-12 gap-8 pointer-events-none">
          {/* Quality Indicator Bar */}
          <div className="w-48 h-1.5 bg-white/10 rounded-full overflow-hidden backdrop-blur-sm">
            <div 
              className={`h-full transition-all duration-500 ${qualityScore > 70 ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : qualityScore > 40 ? 'bg-yellow-500' : 'bg-red-500'}`}
              style={{ width: `${qualityScore}%` }}
            />
          </div>

          <div className="flex items-center justify-between w-full max-w-sm px-4 pointer-events-auto">
            <button 
              onClick={onClose} 
              className="w-20 text-white/60 text-[10px] font-bold uppercase tracking-widest hover:text-white transition-colors"
            >
              Cancel
            </button>

            {/* Native Style Shutter Button (White Outer Ring, White Inner Circle) */}
            <div className="relative group">
              <button 
                onClick={capturePhoto} 
                disabled={isMaxReached} 
                className="relative flex items-center justify-center w-[80px] h-[80px] disabled:opacity-20 active:scale-95 transition-transform"
              >
                {/* Outer Ring */}
                <div className="absolute inset-0 rounded-full border-[4px] border-white/80 group-hover:border-white transition-colors duration-200" />
                {/* Inner White Fill (Morphed/Scaled) */}
                <div className="absolute w-[62px] h-[62px] rounded-full bg-white shadow-inner scale-100 group-hover:scale-95 transition-transform duration-150" />
              </button>
              {isMaxReached && (
                <span className="absolute -top-10 left-1/2 -translate-x-1/2 text-[10px] text-white/40 font-bold whitespace-nowrap uppercase tracking-tighter">Max reach (3)</span>
              )}
            </div>

            <button 
              onClick={handleSave} 
              disabled={capturedImages.length < 1} 
              className="w-20 px-4 py-2.5 rounded-xl bg-emerald-500 text-white font-bold text-[11px] uppercase tracking-wider transition-all hover:bg-emerald-600 disabled:opacity-30 disabled:grayscale shadow-lg"
            >
              Done {totalCount > 0 && `(${totalCount})`}
            </button>
          </div>
        </div>

        {/* Capture Flash Effect */}
        <div className="absolute inset-0 bg-white opacity-0 pointer-events-none data-[flashing=true]:animate-flash" />
      </DialogContent>
    </Dialog>
  );
}
