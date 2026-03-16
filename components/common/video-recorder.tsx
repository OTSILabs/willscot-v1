"use client";

import { useState, useRef, useEffect } from "react";
import { StopCircle, RefreshCcw, Check } from "lucide-react";
import { Button } from "../ui/button";
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
  const [status, setStatus] = useState<"idle" | "recording" | "preview">("idle");
  const [recordingTime, setRecordingTime] = useState(0);
  
  // 2. Media References
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);

  // 3. Mutable Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const RECORDING_LIMIT_SECONDS = 300; // 5 minutes

  // --- LIFECYCLE: Dialog Open/Close ---
  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      handleCompleteReset();
    }
    return () => handleCompleteReset();
  }, [isOpen]);

  // --- LIFECYCLE: Timer Management ---
  useEffect(() => {
    if (status === "recording") {
      setRecordingTime(0);
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
      setStatus("idle");
    } catch (err) {
      console.error("Camera access error:", err);
      toast.error("Could not access camera. Please check permissions.");
      onClose();
    }
  };

  const startRecording = () => {
    if (!stream) return;
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
      
    } catch (err) {
      console.error("MediaRecorder error:", err);
      toast.error("Failed to start recording.");
      setStatus("idle");
    }
  };

  const stopRecording = () => {
    // Calling stop() triggers the onstop handler above which handles the blob and changes state to "preview"
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    } else {
      // Fallback just in case recorder failed internally but state is stuck
      setStatus("preview"); 
    }
  };

  const resetState = () => {
    setStatus("idle");
    setRecordedBlob(null);
    setPreviewUrl(null);
    setRecordingTime(0);
    chunksRef.current = [];
  };

  const handleRetake = () => {
    resetState();
    if (stream && videoRef.current) videoRef.current.srcObject = stream;
  };

  const handleCompleteReset = () => {
    resetState();
    if (stream) stream.getTracks().forEach(track => track.stop());
    setStream(null);
    if (timerRef.current) clearInterval(timerRef.current);
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
      if (!open && status !== "recording") onClose();
      else if (!open && status === "recording") toast.warning("Please stop recording first");
    }}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden bg-black border-none h-[85vh] md:h-[80vh] flex flex-col gap-0 max-w-[95vw] rounded-3xl shadow-2xl transition-all duration-300">
        <DialogHeader className="p-4 bg-zinc-900/90 backdrop-blur-md border-b border-zinc-800 shrink-0 z-10 transition-colors">
          <DialogTitle className="text-zinc-400 text-[10px] font-black uppercase tracking-[0.2em] text-center">{title}</DialogTitle>
        </DialogHeader>

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
            <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-6">
              <div className="flex justify-between items-start">
                {status === "recording" ? (
                  <div className="flex items-center gap-2.5 bg-red-600/90 backdrop-blur-md px-3.5 py-1.5 rounded-full text-white text-[11px] font-black animate-pulse shadow-lg ring-1 ring-white/20">
                    <div className="w-2 h-2 rounded-full bg-white shadow-[0_0_8px_white]" />
                    {formatTime(recordingTime)}
                  </div>
                ) : (
                  <div className="bg-black/40 backdrop-blur-sm px-3 py-1.5 rounded-full text-white/70 text-[10px] font-normal md:font-bold ring-1 ring-white/10 uppercase tracking-wider">
                    Ready to capture
                  </div>
                )}
                <div className="bg-black/40 backdrop-blur-sm px-3 py-1.5 rounded-full text-white/70 text-[10px] font-normal md:font-bold ring-1 ring-white/10">
                  720p 30fps
                </div>
              </div>
              
              {/* Corner brackets for "camera" UI feel */}
              {[
                "top-10 left-10 border-t-2 border-l-2 rounded-tl-lg",
                "top-10 right-10 border-t-2 border-r-2 rounded-tr-lg",
                "bottom-10 left-10 border-b-2 border-l-2 rounded-bl-lg",
                "bottom-10 right-10 border-b-2 border-r-2 rounded-br-lg",
              ].map((c) => (
                <div key={c} className={`absolute w-8 h-8 border-white/20 ${c}`} />
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="p-8 pb-10 bg-zinc-900 shrink-0 flex flex-row items-center justify-center gap-8 border-t border-zinc-800/50 shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
          
          {/* FOOTER CONTROLS BASED ON STATUS */}
          {status === "idle" && (
            <div className="relative group">
              <div className="absolute -inset-4 bg-red-500/20 rounded-full blur-xl group-hover:bg-red-500/30 transition-all duration-500 opacity-0 group-hover:opacity-100" />
              <Button 
                onClick={startRecording} 
                variant="destructive" 
                size="lg" 
                className="relative rounded-full w-20 h-20 p-0 border-[4px] border-white shadow-2xl hover:scale-110 active:scale-95 transition-all duration-300 bg-red-600"
              >
                <div className="w-16 h-16 rounded-full border-2 border-black/10 flex items-center justify-center">
                  <div className="w-8 h-8 rounded-full bg-white transition-all duration-300" />
                </div>
                <span className="sr-only">Start Recording</span>
              </Button>
            </div>
          )}

          {status === "recording" && (
            <div className="flex flex-col items-center gap-4 w-full">
              <Button 
                onClick={stopRecording} 
                variant="outline" 
                size="lg" 
                className="rounded-full w-20 h-20 p-0 border-[4px] border-white shadow-2xl bg-white hover:bg-zinc-100 hover:scale-110 active:scale-95 transition-all duration-300"
              >
                <StopCircle className="w-10 h-10 text-red-600 fill-red-600 animate-pulse" />
                <span className="sr-only">Stop Recording</span>
              </Button>
              <div className="w-48 h-1 bg-zinc-800 rounded-full overflow-hidden shrink-0 ring-1 ring-white/5">
                <div 
                  className="h-full bg-red-500 transition-all duration-1000 ease-linear"
                  style={{ width: `${(recordingTime / RECORDING_LIMIT_SECONDS) * 100}%` }}
                />
              </div>
            </div>
          )}

          {status === "preview" && (
            <div className="flex gap-4 w-full max-w-xs transition-all duration-500 translate-y-0 opacity-100 animate-in fade-in slide-in-from-bottom-4">
              <Button 
                variant="outline" 
                className="flex-1 bg-zinc-800/50 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-white h-14 rounded-2xl font-normal md:font-bold transition-all" 
                onClick={handleRetake}
              >
                <RefreshCcw className="w-5 h-5 mr-2" />
                Retake
              </Button>
              <Button 
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white h-14 rounded-2xl font-normal md:font-bold shadow-lg shadow-blue-900/40 transition-all active:scale-95" 
                onClick={handleSave}
              >
                <Check className="w-5 h-5 mr-2" />
                Upload Recording
              </Button>
            </div>
          )}

        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
