/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Check, AlertTriangle, ChevronLeft, Pause, Play } from "lucide-react";
import { Button } from "../ui/button";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
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

  // --- 5. Proxy Stream Refs (for Interruption Robustness) ---
  const proxyStreamRef = useRef<MediaStream | null>(null);
  const recordingCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  // Removing unused audio refs
  const animationRef = useRef<number | null>(null);

  // Sync ref with state
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const RECORDING_LIMIT_SECONDS = 300; // 5 minutes



  const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  // Analysis functions moved down

  // --- PROXY STRATEGY: Render Loop & Audio Routing ---
  const initProxyStream = useCallback((width: number = 1280, height: number = 720) => {
    if (typeof window === "undefined" || (proxyStreamRef.current && recordingCanvasRef.current?.width === width && recordingCanvasRef.current?.height === height)) return;

    // A. Video Proxy via Canvas
    let canvas = recordingCanvasRef.current;
    if (!canvas) {
      canvas = document.createElement("canvas");
      recordingCanvasRef.current = canvas;
    }
    
    canvas.width = width;
    canvas.height = height;
    
    // Only create stream once
    if (!proxyStreamRef.current) {
      type CanvasStream = HTMLCanvasElement & { captureStream?: (fps?: number) => MediaStream; mozCaptureStream?: (fps?: number) => MediaStream };
      const canvasStream = (canvas as CanvasStream).captureStream ? (canvas as CanvasStream).captureStream!(30) : (canvas as CanvasStream).mozCaptureStream ? (canvas as CanvasStream).mozCaptureStream!(30) : null;
      if (!canvasStream) return;

      /* // --- AUDIO BLOCK START ---
      // B. Audio Proxy via AudioContext
      const AudioCtx = (window.AudioContext || (window as any).webkitAudioContext);
      if (!AudioCtx) {
        console.warn("AudioContext not supported, recording may lack audio.");
        proxyStreamRef.current = new MediaStream([...canvasStream.getVideoTracks()]);
        return;
      }

      const audioCtx = new AudioCtx();
      const destination = audioCtx.createMediaStreamDestination();
      
      audioContextRef.current = audioCtx;
      audioDestinationRef.current = destination;

      // C. Combine into Proxy Stream
      const combined = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...destination.stream.getAudioTracks()
      ]);
      proxyStreamRef.current = combined;
      // --- AUDIO BLOCK END --- */

      // Video Only Proxy (Preserving Audio code for future use)
      proxyStreamRef.current = new MediaStream([...canvasStream.getVideoTracks()]);
      
      console.log(`Proxy Stream Initialized (Video Only) at ${width}x${height}`);
    } else {
      console.log(`Proxy Canvas Resized to ${width}x${height}`);
    }
  }, []);

  const updateProxySource = useCallback((newStream: MediaStream) => {
    // 0. Update resolution if available
    const videoTrack = newStream.getVideoTracks()[0];
    if (videoTrack) {
      const settings = videoTrack.getSettings();
      if (settings.width && settings.height) {
        initProxyStream(settings.width, settings.height);
      }
    }

    /* // --- AUDIO ROUTING BLOCK START ---
    if (!audioContextRef.current || !audioDestinationRef.current) return;

    // 1. Update Audio Routing
    if (audioSourceRef.current) {
      audioSourceRef.current.disconnect();
    }
    
    try {
      const source = audioContextRef.current.createMediaStreamSource(newStream);
      source.connect(audioDestinationRef.current);
      audioSourceRef.current = source;
      
      // Ensure context is running (crucial after user interaction)
      if (audioContextRef.current.state === "suspended") {
        audioContextRef.current.resume();
      }
    } catch (e) {
      console.error("Failed to route audio to proxy:", e);
    }
    // --- AUDIO ROUTING BLOCK END --- */

    // 2. Start/Restart Render Loop
    if (animationRef.current) cancelAnimationFrame(animationRef.current);

    const render = () => {
      if (videoRef.current && recordingCanvasRef.current && statusRef.current !== "preview") {
        const video = videoRef.current;
        const canvas = recordingCanvasRef.current;
        const ctx = canvas.getContext("2d");
        
        if (ctx && video.videoWidth > 0) {
          // Since we now dynamicially resize the canvas to match the video settings,
          // we can draw directly without complex 'cover' math, which avoids stretching.
          if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
          }
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        }
      }
      animationRef.current = requestAnimationFrame(render);
    };
    render();
  }, []);

  const startCamera = async (isRefresh = false) => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        toast.error("Camera access is only available over a secure (HTTPS) connection.");
        onClose();
        return;
      }

      const currentStream = stream;

      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: "environment",
          frameRate: { ideal: 30 }
        },
        audio: true
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        try {
          await videoRef.current.play();
        } catch (e) {
          console.error("Video play error during fresh stream attach:", e);
        }
      }

      setStream(newStream);

      // --- FIX: Stop old tracks AFTER the new stream is re-attached ---
      // This prevents the captureStream from becoming inactive during the handoff.
      if (isRefresh && currentStream) {
        currentStream.getTracks().forEach(t => t.stop());
      }

      // --- TIER 2: Track Monitoring (Incoming Call Detection) ---
      newStream.getVideoTracks().forEach(track => {
        track.onmute = () => {
          if (statusRef.current === "recording") {
            console.log("Auto-pause triggered by Video Track Mute");
            handleAutoPause();
          }
        };
      });

      if (!isRefresh) {
        initProxyStream();
        setStatus("idle");
      }
      
      // Update proxy with the new hardware source
      updateProxySource(newStream);
      
      return newStream;
    } catch (err) {
      console.error("Camera access error:", err);
      toast.error("Could not access camera. Please check permissions.");
      if (!isRefresh) onClose();
      return null;
    }
  };

  const startRecording = () => {
    if (!stream || !videoRef.current) return;
    setRecordingTime(0);
    chunksRef.current = [];
    
    // --- PROXY STRATEGY: Record from the STABLE Proxy Stream ---
    // This allows us to swap the underlying camera/mic hardware without the recorder seeing a track end.
    if (!proxyStreamRef.current) {
      initProxyStream();
    }
    const captureStream = proxyStreamRef.current!;

    // Find supported mime type
    const types = ["video/mp4", "video/webm;codecs=vp9", "video/webm;codecs=vp8"];
    const supportedType = types.find(type => MediaRecorder.isTypeSupported(type)) || "video/webm";

    try {
      const mediaRecorder = new MediaRecorder(captureStream, { 
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

  const resumeRecording = async () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "paused") {
      // --- FIX: Re-acquire fresh camera stream after interruption ---
      // This is necessary because mobile OS often kills the camera hardware logic during a call.
      const reAcquired = await startCamera(true);
      
      if (!reAcquired) {
        // Error toast is already shown inside startCamera
        return;
      }
      
      // Give the hardware a moment to stabilize
      setTimeout(() => {
        if (mediaRecorderRef.current) {
          if (mediaRecorderRef.current.state === "paused") {
            mediaRecorderRef.current.resume();
            setStatus("recording");
            setAutoPaused(false);
            startAnalysis();
            console.log("MediaRecorder successfully resumed");
          } else if (mediaRecorderRef.current.state === "inactive") {
            // If it stopped anyway, we need to let the user know
            console.error("MediaRecorder became inactive during resume");
            toast.error("Recording was interrupted and could not be resumed.");
            setStatus("preview"); 
          }
        }
      }, 100);
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
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (proxyStreamRef.current) {
      proxyStreamRef.current.getTracks().forEach(track => track.stop());
      proxyStreamRef.current = null;
    }
  };

  const handleSave = () => {
    if (recordedBlob) {
      const extension = recordedBlob.type.includes("mp4") ? "mp4" : "webm";
      const file = new File([recordedBlob], `recorded-video-${Date.now()}.${extension}`, {
        type: recordedBlob.type,
      });
      onCapture(file);
      handleCompleteReset();
      onClose();
    }
  };

  // --- LIFECYCLE: Dialog Open/Close ---
  // Ignore exhaustive-deps to prevent infinite loops from over-dependency
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
  }, [status]); // Only depend on status, ignoring stopRecording for stability

  // --- LIFECYCLE: Blob to URL Preview Management ---
  useEffect(() => {
    if (!recordedBlob) return setPreviewUrl(null);
    const url = URL.createObjectURL(recordedBlob);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [recordedBlob]);

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
        className="!fixed !inset-0 !top-0 !left-0 !translate-x-0 !translate-y-0 p-0 overflow-hidden bg-black !border-none !h-screen !w-screen !max-w-none !rounded-none shadow-none transition-all duration-300 gap-0"
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
        <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between p-4 sm:p-6 bg-gradient-to-b from-black/60 to-transparent pointer-events-none">
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

        <div className="absolute inset-0 bg-zinc-950 flex items-center justify-center overflow-hidden group">
          
          {/* CAMERA FEED OR PREVIEW RENDERER (Full Viewport Fill) */}
          {status !== "preview" ? (
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700 opacity-0 data-[loaded=true]:opacity-100"
              onLoadedMetadata={(e) => e.currentTarget.setAttribute("data-loaded", "true")}
            />
          ) : (
            <video
              key={previewUrl} 
              src={previewUrl || undefined}
              controls
              autoPlay
              playsInline
              className="absolute inset-0 w-full h-full object-cover bg-black"
            />
          )}

          {/* OVERLAY UI (Only when NOT previewing) */}
          {status !== "preview" && (
            <div className="absolute inset-x-0 top-16 pointer-events-none flex flex-col justify-between p-6 z-40">
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
          BOTTOM OVERLAY CONTROL BAR
          Floating translucent controls for native camera feel
        */}
        <div className="absolute bottom-0 left-0 right-0 z-50 h-40 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex flex-col items-center justify-center p-6 pb-12 pointer-events-none">
          <div className="w-full flex items-center justify-center pointer-events-auto">
            {/* FOOTER CONTROLS BASED ON STATUS */}
            {status === "idle" && (
              <div className="flex items-center justify-center w-full relative">
                <span className="absolute left-6 text-white/50 text-xs font-semibold tracking-widest uppercase hidden sm:block">Video</span>
                {/* Native Style Record Button (White Outer Ring, Red Inner Circle) */}
                <button 
                  onClick={startRecording} 
                  className="relative group flex items-center justify-center w-[76px] h-[76px]"
                >
                  {/* Outer Ring */}
                  <div className="absolute inset-0 rounded-full border-[4px] border-white/80 group-hover:border-white transition-colors duration-200" />
                  {/* Inner Red Fill (Shrinks slightly when pressed) */}
                  <div className="absolute w-[58px] h-[58px] rounded-full bg-red-600 shadow-inner scale-100 group-active:scale-90 transition-transform duration-150" />
                  <span className="sr-only">Start Recording</span>
                </button>
              </div>
            )}

            {(status === "recording" || status === "paused") && (
              <div className="flex items-center justify-center w-full gap-10">
                {/* Pause/Resume Secondary Button */}
                <button
                  onClick={status === "recording" ? pauseRecording : resumeRecording}
                  className="flex flex-col items-center gap-1.5 group"
                >
                  <div className="w-12 h-12 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md border border-white/20 flex items-center justify-center transition-all active:scale-90">
                    {status === "recording" ? (
                      <Pause className="w-4 h-4 text-white" fill="currentColor" />
                    ) : (
                      <Play className="w-4 h-4 text-white ml-0.5" fill="currentColor" />
                    )}
                  </div>
                  <span className="text-[9px] text-white/70 font-bold uppercase tracking-widest">
                    {status === "recording" ? "Pause" : "Resume"}
                  </span>
                </button>

                {/* Native Style Stop Button (White Outer Ring, Red Inner Square) */}
                <button 
                  onClick={stopRecording} 
                  className="relative group flex items-center justify-center w-[76px] h-[76px]"
                >
                  {/* Outer Ring indicating progress roughly */}
                  <div className="absolute inset-0 rounded-full border-[4px] border-white/80" />
                  {/* Circular progress bar overlay for the 5-minute limit */}
                  <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none">
                      <circle 
                        cx="38" cy="38" r="36" 
                        fill="none" 
                        stroke="red" 
                        strokeWidth="4" 
                        strokeDasharray="226" /* 2 * PI * r */
                        strokeDashoffset={226 - (226 * (recordingTime / RECORDING_LIMIT_SECONDS))}
                        className="transition-all duration-1000 ease-linear"
                      />
                  </svg>
                  {/* Inner Red Square (Morphed from Circle) */}
                  <div className="absolute w-[28px] h-[28px] rounded-sm bg-red-600 scale-100 group-active:scale-90 transition-all duration-300" />
                  <span className="sr-only">Stop Recording</span>
                </button>

                {/* Spacer button for layout balance (like a gallery button) */}
                <div className="w-12" />
              </div>
            )}

            {status === "preview" && (
              <div className="flex justify-between items-center w-full px-8 max-w-[450px]">
                {/* Native-style text buttons for post-capture */}
                <button 
                  className="text-white/90 hover:text-white text-[16px] font-medium p-2 transition-colors active:scale-95 flex items-center gap-1"
                  onClick={handleRetake}
                >
                  Retake
                </button>
                <button 
                  className="bg-white text-black font-bold text-[16px] px-8 py-3 rounded-full hover:bg-zinc-200 transition-colors active:scale-95 flex items-center gap-2 shadow-lg"
                  onClick={handleSave}
                >
                  Use Video
                  <Check className="w-4 h-4 stroke-[3px]" />
                </button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
