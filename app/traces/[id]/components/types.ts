export interface TraceAttribute {
  pipeline?: string | null;
  attribute?: string | null;
  value?: string | null;
  evidence?: string | null;
  frame_s3_uri?: string | null;
  frame_s3_uri_url?: string | null;
  timestamp_seconds?: number | null;
  feedback?: string | null;
  error?: string | null;
  status?: "correct" | "wrong";
}

export interface TraceVideoInfo {
  s3_uri?: string | null;
  region?: string | null;
  container_type?: string | null;
}

export interface ResultJson {
  video?: TraceVideoInfo;
  attributes?: TraceAttribute[];
  [key: string]: unknown;
  error?: string | null;
}

export interface ResultDetail {
  id: string;
  videoId: string;
  status: string;
  json: ResultJson;
  videoUrl?: string | null;
  createdByUserId?: string | null;
  createdByName?: string | null;
  createdByEmail?: string | null;
  createdAt: string;
}

