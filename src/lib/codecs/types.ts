export type Kind = 'mp4';

export type InputConfig = {
  kind: Kind;
  audio?: AudioDecoderConfig & { sampleCount: number; bitrate: number; tracks: Set<number> };
  video: VideoDecoderConfig & { frameCount: number; bitrate: number; tracks: Set<number> };
};

export type OutputConfig = {
  kind: 'mp4';
  encoderVideo: VideoEncoderConfig;
  encoderAudio: AudioEncoderConfig;
  fileStream: FileSystemWritableFileStream;
};

type MuxVideo = (chunk: EncodedVideoChunk, meta?: EncodedVideoChunkMetadata | undefined) => void;

type MuxAudio = (chunk: EncodedAudioChunk, meta?: EncodedAudioChunkMetadata | undefined) => void;

export type Muxer = {
  addVideoChunk: MuxVideo;
  addAudioChunk: MuxAudio;
  finalize: () => void;
};

export type Demuxer = {
  decode: (file: File) => Promise<void>;
};

export type SharedQueue = {
  video: {
    encoded: number;
    decoded: number;
  };
  audio: {
    encoded: number;
    decoded: number;
  };
};
