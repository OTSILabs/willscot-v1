"use client";

import { useState, useRef, useEffect } from "react";
import { StopCircle, RefreshCcw, Check, Video } from "lucide-react";
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
  const [isRecording, setIsRecording] = useState(false);
  const [recordedVideo, setRecordedVideo] = useState<Blob | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const RECORDING_LIMIT_SECONDS = 300; // 5 minutes

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      closeStream();
    }
    return () => {
      closeStream();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isRecording) {
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
      if (timerRef.current) clearInterval(timerRef.current);
      setRecordingTime(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const startCamera = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        },
        audio: true
      });
      setStream(s);
      if (videoRef.current) {
        videoRef.current.srcObject = s;
      }
    } catch (err) {
      console.error("Camera access error:", err);
      toast.error("Could not access camera. Please check permissions.");
      onClose();
    }
  };

  const startRecording = () => {
    if (!stream) return;
    chunksRef.current = [];
    
    const types = ["video/mp4", "video/webm;codecs=vp9", "video/webm;codecs=vp8"];
    const supportedType = types.find(type => MediaRecorder.isTypeSupported(type)) || "";

    try {
      const mediaRecorder = new MediaRecorder(stream, { 
        mimeType: supportedType,
        videoBitsPerSecond: 2500000 // 2.5 Mbps for smooth 720p
      });
      mediaRecorderRef.current = mediaRecorder;
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: supportedType || "video/webm" });
        setRecordedVideo(blob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
    } catch (err) {
      console.error("MediaRecorder error:", err);
      toast.error("Failed to start recording.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleSave = () => {
    if (recordedVideo) {
      const extension = recordedVideo.type.includes("mp4") ? "mp4" : "webm";
      const file = new File([recordedVideo], `recorded-video-${Date.now()}.${extension}`, {
        type: recordedVideo.type,
      });
      onCapture(file);
      handleReset();
      onClose();
    }
  };

  const handleReset = () => {
    setRecordedVideo(null);
    chunksRef.current = [];
    setRecordingTime(0);
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  };

  const closeStream = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open && !isRecording) onClose();
      else if (!open && isRecording) toast.warning("Please stop recording first");
    }}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden bg-black border-none h-[85vh] md:h-[80vh] flex flex-col gap-0 max-w-[95vw] rounded-3xl shadow-2xl transition-all duration-300">
        <DialogHeader className="p-4 bg-zinc-900/90 backdrop-blur-md border-b border-zinc-800 shrink-0 z-10 transition-colors">
          <DialogTitle className="text-zinc-400 text-[10px] font-black uppercase tracking-[0.2em] text-center">{title}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 relative bg-zinc-950 flex items-center justify-center overflow-hidden group">
          {!recordedVideo ? (
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
              src={URL.createObjectURL(recordedVideo)}
              controls
              className="w-full h-full object-contain bg-black"
            />
          )}

          {/* Overlay UI */}
          {!recordedVideo && (
            <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-6">
              <div className="flex justify-between items-start">
                {isRecording ? (
                  <div className="flex items-center gap-2.5 bg-red-600/90 backdrop-blur-md px-3.5 py-1.5 rounded-full text-white text-[11px] font-black animate-pulse shadow-lg ring-1 ring-white/20">
                    <div className="w-2 h-2 rounded-full bg-white shadow-[0_0_8px_white]" />
                    {formatTime(recordingTime)}
                  </div>
                ) : (
                  <div className="bg-black/40 backdrop-blur-sm px-3 py-1.5 rounded-full text-white/70 text-[10px] font-bold ring-1 ring-white/10 uppercase tracking-wider">
                    Ready to capture
                  </div>
                )}
                <div className="bg-black/40 backdrop-blur-sm px-3 py-1.5 rounded-full text-white/70 text-[10px] font-bold ring-1 ring-white/10">
                  720p 30fps
                </div>
              </div>
              
              {/* Corner brackets for "camera" feel */}
              <div className="absolute top-10 left-10 w-8 h-8 border-t-2 border-l-2 border-white/20 rounded-tl-lg" />
              <div className="absolute top-10 right-10 w-8 h-8 border-t-2 border-r-2 border-white/20 rounded-tr-lg" />
              <div className="absolute bottom-10 left-10 w-8 h-8 border-b-2 border-l-2 border-white/20 rounded-bl-lg" />
              <div className="absolute bottom-10 right-10 w-8 h-8 border-b-2 border-r-2 border-white/20 rounded-br-lg" />
            </div>
          )}
        </div>

        <DialogFooter className="p-8 pb-10 bg-zinc-900 shrink-0 flex flex-row items-center justify-center gap-8 border-t border-zinc-800/50 shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
          {!recordedVideo ? (
            !isRecording ? (
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
            ) : (
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
            )
          ) : (
            <div className="flex gap-4 w-full max-w-xs transition-all duration-500 translate-y-0 opacity-100 animate-in fade-in slide-in-from-bottom-4">
              <Button 
                variant="outline" 
                className="flex-1 bg-zinc-800/50 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-white h-14 rounded-2xl font-bold transition-all" 
                onClick={handleReset}
              >
                <RefreshCcw className="w-5 h-5 mr-2" />
                Retake
              </Button>
              <Button 
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white h-14 rounded-2xl font-bold shadow-lg shadow-blue-900/40 transition-all active:scale-95" 
                onClick={handleSave}
              >
                <Check className="w-5 h-5 mr-2" />
                Capture
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
