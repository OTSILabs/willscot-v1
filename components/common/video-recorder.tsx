"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { StopCircle, RefreshCcw, Check, AlertTriangle, X, ChevronLeft, Pause, Play } from "lucide-react";
import { Button } from "../ui/button";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog";
import { toast } from "sonner";

interface VideoRecorderProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
  title?: string;
}

export function VideoRecorder({ isOpen, onClose, onCapture, title = "Record Video" }: VideoRecorderProps) {
  // 1. Core State
  const [status, setStatus] = useState<"idle" | "recording" | "paused" | "preview">("idle");
  const [recordingTime, setRecordingTime] = useState(0);
  const [autoPaused, setAutoPaused] = useState(false);
  
  // 2. Media References
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);

  // 3. Mutable Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // 4. Analysis State & Refs
  const [warnings, setWarnings] = useState<string[]>([]);
  const workerRef = useRef<Worker | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const analysisIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const statusRef = useRef(status);
  const freezeCountRef = useRef(0);

  // Sync ref with state
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const RECORDING_LIMIT_SECONDS = 300; // 5 minutes

  // --- LIFECYCLE: Dialog Open/Close ---
  useEffect(() => {
    if (isOpen) {
      startCamera();
      initWorker();
    } else {
      handleCompleteReset();
    }
    return () => handleCompleteReset();
  }, [isOpen]);

  // --- LIFECYCLE: Timer Management ---
  useEffect(() => {
    if (status === "recording") {
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          if (prev >= RECORDING_LIMIT_SECONDS - 1) {
            stopRecording();
            toast.info("Recording limit reached (5m)");
            return RECORDING_LIMIT_SECONDS;
          }
          return prev + 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [status]);

  // --- LIFECYCLE: Blob to URL Preview Management ---
  useEffect(() => {
    if (!recordedBlob) return setPreviewUrl(null);
    const url = URL.createObjectURL(recordedBlob);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [recordedBlob]);

  const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  const initWorker = useCallback(() => {
    if (typeof window !== "undefined" && !workerRef.current) {
      workerRef.current = new Worker("/workers/video-analyzer.worker.js");
      workerRef.current.onmessage = (e) => {
        if (e.data.warnings) {
          setWarnings(e.data.warnings);
        }
        
        // --- TIER 3: Frozen Frame Detection (Iframe-Safe) ---
        // If avgMotion is EXACTLY 0, the device has likely frozen the video feed for a call.
        if (statusRef.current === "recording" && e.data.metrics && e.data.metrics.avgMotion === 0) {
          freezeCountRef.current += 1;
          // If frozen for ~1 second (5 checks at 5fps)
          if (freezeCountRef.current >= 5) {
            console.log("Auto-pause triggered by Frozen Frame detection");
            handleAutoPause();
          }
        } else {
          freezeCountRef.current = 0;
        }
      };
      
      // Initialize an offscreen canvas for downsampling frames
      const canvas = document.createElement("canvas");
      canvas.width = 150;
      canvas.height = 150;
      canvasRef.current = canvas;
    }
  }, []);

  const startAnalysis = useCallback(() => {
    if (analysisIntervalRef.current) clearInterval(analysisIntervalRef.current);
    
    analysisIntervalRef.current = setInterval(() => {
      // Use ref to avoid stale closure on status
      if (!videoRef.current || !canvasRef.current || !workerRef.current || statusRef.current !== "recording") return;
      if (videoRef.current.readyState !== videoRef.current.HAVE_ENOUGH_DATA) return;

      const ctx = canvasRef.current.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;

      // Draw the current video frame downsampled to 150x150
      ctx.drawImage(videoRef.current, 0, 0, 150, 150);
      const imageData = ctx.getImageData(0, 0, 150, 150);

      // Send pixel buffer to the background worker
      workerRef.current.postMessage({
        imageData: imageData,
        width: 150,
        height: 150
      });
    }, 200); // 5 FPS is enough for quality checking
  }, []);

  const stopAnalysis = useCallback(() => {
    if (analysisIntervalRef.current) {
      clearInterval(analysisIntervalRef.current);
      analysisIntervalRef.current = null;
    }
    setWarnings([]); // Clear warnings immediately on stop
  }, []);

  const startCamera = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        toast.error("Camera access is only available over a secure (HTTPS) connection. If you are developing locally, please use localhost or set up HTTPS.");
        onClose();
        return;
      }

      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
          facingMode: "environment" // Try rear camera if available
        },
        audio: true
      });
      setStream(newStream);
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }

      // --- TIER 2: Track Monitoring (Incoming Call Detection) ---
      // Mobile browsers often "mute" the track hardware-side when a call starts.
      newStream.getVideoTracks().forEach(track => {
        track.onmute = () => {
          if (statusRef.current === "recording") {
            console.log("Auto-pause triggered by Video Track Mute");
            handleAutoPause();
          }
        };
      });

      setStatus("idle");
    } catch (err) {
      console.error("Camera access error:", err);
      toast.error("Could not access camera. Please check permissions.");
      onClose();
    }
  };

  const startRecording = () => {
    if (!stream) return;
    setRecordingTime(0);
    chunksRef.current = [];
    
    // Find supported mime type
    const types = ["video/mp4", "video/webm;codecs=vp9", "video/webm;codecs=vp8"];
    const supportedType = types.find(type => MediaRecorder.isTypeSupported(type)) || "";

    try {
      const mediaRecorder = new MediaRecorder(stream, { 
        mimeType: supportedType,
        videoBitsPerSecond: 2500000 // 2.5 Mbps
      });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.onerror = (e) => {
        console.error("MediaRecorder error detected:", e);
        toast.error("Recording error occurred.");
        stopRecording();
      };
      
      // Collect chunks
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      // When stopped, build the final blob and trigger preview
      mediaRecorder.onstop = () => {
        const finalBlob = new Blob(chunksRef.current, { type: supportedType || "video/webm" });
        setRecordedBlob(finalBlob);
        setStatus("preview"); // Changing state to preview reveals the video player immediately
      };

      mediaRecorder.start(1000); // Trigger data chunks every second
      setStatus("recording");    // Start the timer visually
      startAnalysis();           // Start analyzing quality in background

      
    } catch (err) {
      console.error("MediaRecorder error:", err);
      toast.error("Failed to start recording.");
      setStatus("idle");
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.pause();
      setStatus("paused");
      stopAnalysis();
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "paused") {
      // --- FIX: Re-validate tracks and re-attach stream ---
      if (stream) {
        stream.getTracks().forEach(track => {
          if (track.readyState === "live") {
            track.enabled = true; // Force-enable track
          }
        });
        
        // Ensure the video element is showing the live feed again
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(e => console.error("Error playing video on resume:", e));
        }
      }

      // Small delay (300ms) to let hardware warm up before recorder starts
      setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === "paused") {
          mediaRecorderRef.current.resume();
          setStatus("recording");
          setAutoPaused(false);
          startAnalysis();
        }
      }, 300);
    }
  };

  const handleAutoPause = useCallback(() => {
    if (statusRef.current === "recording") {
      pauseRecording();
      setAutoPaused(true);
      toast.info("Recording Auto-Paused due to interruption", {
        description: "Please check your feed and resume when ready.",
        duration: 5000,
      });
    }
  }, []);

  // --- TIER 1: Visibility Change Detection ---
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && statusRef.current === "recording") {
        console.log("Auto-pause triggered by Visibility Change");
        handleAutoPause();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [handleAutoPause]);

  const stopRecording = () => {
    // Calling stop() triggers the onstop handler above which handles the blob and changes state to "preview"
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    } else {
      // Fallback just in case recorder failed internally but state is stuck
      setStatus("preview"); 
    }
    stopAnalysis();
  };

  const resetState = () => {
    setStatus("idle");
    setRecordedBlob(null);
    setPreviewUrl(null);
    setRecordingTime(0);
    setAutoPaused(false);
    freezeCountRef.current = 0;
    chunksRef.current = [];
  };

  const handleRetake = () => {
    resetState();
    setTimeout(() => {
      if (stream && videoRef.current) videoRef.current.srcObject = stream;
    }, 0);
  };

  const handleCompleteReset = () => {
    resetState();
    stopAnalysis();
    if (stream) stream.getTracks().forEach(track => track.stop());
    setStream(null);
    if (timerRef.current) clearInterval(timerRef.current);
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
  };

  const handleSave = () => {
    if (recordedBlob) {
      const extension = recordedBlob.type.includes("mp4") ? "mp4" : "webm";
      const file = new File([recordedBlob], `recorded-video-${Date.now()}.${extension}`, {
        type: recordedBlob.type,
      });
      onCapture(file);  // Sends the verified File object back to the upload form
      handleCompleteReset();
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      const isActive = status === "recording" || status === "paused";
      if (!open && !isActive) onClose();
      else if (!open && isActive) toast.warning("Please stop recording first");
    }}>
      {/* 
        Changes for "Native Feel":
        1. max-w-[100vw] h-[100dvh] (full viewport height/width on mobile)
        2. Removed rounded corners and borders for edge-to-edge feel
        3. Removed default bg and default header
      */}
      <DialogContent 
        className="p-0 overflow-hidden bg-black border-none h-[100dvh] max-h-[100dvh] max-w-[100vw] sm:max-w-[400px] sm:h-[85vh] sm:rounded-[40px] shadow-2xl transition-all duration-300 flex flex-col gap-0"
        aria-describedby="video-recorder-description" // Adding standard accessibility prop
      >
        {/* Invisible Description for Screen Readers to satisfy Dialog requirements */}
        <div id="video-recorder-description" className="sr-only">
          Record a live video trace.
        </div>
        <DialogTitle className="sr-only">{title}</DialogTitle>

        {/* 
          TOP OVERLAY BAR 
          Positioned absolute over the video for native feel overlay
        */}
        <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between p-4 sm:p-6 bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
          {/* Back/Close Button */}
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => {
              if (status === "recording") {
                toast.warning("Please stop recording first");
                return;
              }
              onClose();
            }}
            className="rounded-full w-10 h-10 bg-black/40 backdrop-blur-md hover:bg-black/60 text-white pointer-events-auto border border-white/10"
          >
            <ChevronLeft className="w-6 h-6" />
            <span className="sr-only">Close Camera</span>
          </Button>

          {/* Optional: Add flash or settings icons here on the right to balance it */}
          <div className="w-10 h-10" /> 
        </div>

        <div className="flex-1 relative bg-zinc-950 flex items-center justify-center overflow-hidden group">
          
          {/* CAMERA FEED OR PREVIEW RENDERER */}
          {status !== "preview" ? (
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover transition-opacity duration-700 opacity-0 data-[loaded=true]:opacity-100"
              onLoadedMetadata={(e) => e.currentTarget.setAttribute("data-loaded", "true")}
            />
          ) : (
            <video
              key={previewUrl} // Force remount if URL changes occasionally
              src={previewUrl || undefined}
              controls
              autoPlay    // INSTAGRAM FLOW: Automatically plays the preview
              playsInline
              className="w-full h-full object-contain bg-black"
            />
          )}

          {/* OVERLAY UI (Only when NOT previewing) */}
          {status !== "preview" && (
            <div className="absolute inset-x-0 top-16 pointer-events-none flex flex-col justify-between p-6">
              <div className="flex justify-center items-start w-full">
                {/* 
                  Moved Center Top: Timer and Quality Warnings 
                  This is the standard iOS/Android place for the recording dot
                */}
                <div className="flex flex-col items-center gap-2 relative">
                  {(status === "recording" || status === "paused") && (
                    <div className={cn(
                      "flex items-center gap-2 backdrop-blur-md px-3 py-1 rounded-md text-white text-[13px] font-mono font-bold shadow-lg ring-1 ring-white/20 transition-colors duration-300",
                      status === "recording" ? "bg-red-600/90" : "bg-zinc-700/90"
                    )}>
                       <div className={cn(
                        "w-2 h-2 rounded-full bg-white shadow-[0_0_8px_white]",
                        status === "recording" && "animate-pulse"
                      )} />
                      {formatTime(recordingTime)}
                      {status === "paused" && (
                        <span className="ml-1 text-[10px] uppercase tracking-wider opacity-80">
                          {autoPaused ? "Auto-Paused" : "Paused"}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Quality Warnings List */}
                  {status === "recording" && warnings.length > 0 && (
                    <div className="flex flex-col gap-1.5 mt-2 items-center">
                      {warnings.includes("LOW_LIGHT") && (
                        <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur px-3 py-1.5 rounded-full border border-yellow-500/50 text-yellow-400 text-[11px] font-bold shadow-md tracking-wide animate-in fade-in slide-in-from-top-1">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Too Dark
                        </div>
                      )}
                      {warnings.includes("TOO_BRIGHT") && (
                        <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur px-3 py-1.5 rounded-full border border-blue-500/50 text-blue-400 text-[11px] font-bold shadow-md tracking-wide animate-in fade-in slide-in-from-top-1">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Too Bright, Adjust Angle
                        </div>
                      )}
                      {warnings.includes("TOO_FAST") && (
                        <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur px-3 py-1.5 rounded-full border border-rose-500/50 text-rose-400 text-[11px] font-bold shadow-md tracking-wide animate-in fade-in slide-in-from-top-1">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Too Fast, Slow Down
                        </div>
                      )}
                      {warnings.includes("TOO_SHAKY") && (
                        <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur px-3 py-1.5 rounded-full border border-orange-500/50 text-orange-400 text-[11px] font-bold shadow-md tracking-wide animate-in fade-in slide-in-from-top-1">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Too Shaky
                        </div>
                      )}
                      {warnings.includes("BLURRY") && (
                        <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur px-3 py-1.5 rounded-full border border-indigo-500/50 text-indigo-400 text-[11px] font-bold shadow-md tracking-wide animate-in fade-in slide-in-from-top-1">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Blurry
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 
          BOTTOM CONTROL BAR
          Solid black backdrop, native feeling controls
        */}
        <DialogFooter className="h-32 sm:h-36 bg-black flex flex-col items-center justify-center border-t border-white/10 shrink-0">
          
          {/* FOOTER CONTROLS BASED ON STATUS */}
          {status === "idle" && (
            <div className="flex items-center justify-center w-full relative">
              <span className="absolute left-6 text-white/50 text-xs font-semibold tracking-widest uppercase">Video</span>
              {/* Native Style Record Button (White Outer Ring, Red Inner Circle) */}
              <button 
                onClick={startRecording} 
                className="relative group flex items-center justify-center w-[72px] h-[72px]"
              >
                {/* Outer Ring */}
                <div className="absolute inset-0 rounded-full border-[4px] border-white/80 group-hover:border-white transition-colors duration-200" />
                {/* Inner Red Fill (Shrinks slightly when pressed) */}
                <div className="absolute w-[56px] h-[56px] rounded-full bg-red-600 shadow-inner scale-100 group-active:scale-90 transition-transform duration-150" />
                <span className="sr-only">Start Recording</span>
              </button>
            </div>
          )}

          {(status === "recording" || status === "paused") && (
            <div className="flex items-center justify-center w-full gap-8">
              {/* Pause/Resume Secondary Button */}
              <button
                onClick={status === "recording" ? pauseRecording : resumeRecording}
                className="flex flex-col items-center gap-1.5 group"
              >
                <div className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/10 flex items-center justify-center transition-all active:scale-90">
                  {status === "recording" ? (
                    <Pause className="w-5 h-5 text-white" fill="currentColor" />
                  ) : (
                    <Play className="w-5 h-5 text-white ml-0.5" fill="currentColor" />
                  )}
                </div>
                <span className="text-[10px] text-white/60 font-medium uppercase tracking-wider">
                  {status === "recording" ? "Pause" : "Resume"}
                </span>
              </button>

              {/* Native Style Stop Button (White Outer Ring, Red Inner Square) */}
              <button 
                onClick={stopRecording} 
                className="relative group flex items-center justify-center w-[72px] h-[72px]"
              >
                 {/* Outer Ring indicating progress roughly */}
                <div className="absolute inset-0 rounded-full border-[4px] border-white/80" />
                 {/* Circular progress bar overlay for the 5-minute limit */}
                 <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none">
                    <circle 
                      cx="36" cy="36" r="34" 
                      fill="none" 
                      stroke="red" 
                      strokeWidth="4" 
                      strokeDasharray="213" /* 2 * PI * r */
                      strokeDashoffset={213 - (213 * (recordingTime / RECORDING_LIMIT_SECONDS))}
                      className="transition-all duration-1000 ease-linear"
                    />
                 </svg>
                {/* Inner Red Square (Morphed from Circle) */}
                <div className="absolute w-[32px] h-[32px] rounded border border-red-500/50 bg-red-600 scale-100 group-active:scale-90 transition-all duration-300" />
                <span className="sr-only">Stop Recording</span>
              </button>

              {/* Spacer button for layout balance (like a gallery button) */}
              <div className="w-12 opacity-0 pointer-events-none" />
            </div>
          )}

          {status === "preview" && (
            <div className="flex justify-between items-center w-full px-8 max-w-[400px]">
              {/* Native-style text buttons for post-capture */}
              <button 
                className="text-white/90 hover:text-white text-[15px] p-2 transition-colors active:scale-95 flex items-center gap-1"
                onClick={handleRetake}
              >
                Retake
              </button>
              <button 
                className="bg-white text-black font-semibold text-[15px] px-6 py-2.5 rounded-full hover:bg-zinc-200 transition-colors active:scale-95 flex items-center gap-2"
                onClick={handleSave}
              >
                Use Video
                <Check className="w-4 h-4" />
              </button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
