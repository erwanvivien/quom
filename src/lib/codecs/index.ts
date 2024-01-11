import { arrayMatches, assertDefined, assertNever } from '$lib/utils';
import { createMp4Demuxer, createMp4Muxer, extractConfig } from './mp4';
import type { Demuxer, InputConfig, Kind, Muxer, OutputConfig, SharedQueue } from './types';

const getFileKind = async (file: File): Promise<Kind | undefined> => {
  const arrayBuffer = await file.slice(0, 64).arrayBuffer();
  const array = new Uint8Array(arrayBuffer);

  if (arrayMatches(array, ['*', '*', '*', '*', 0x66, 0x74, 0x79, 0x70])) {
    return 'mp4';
  }

  return undefined;
};

const outputVideoCodecToEncoderCodec = (codec: OutputConfig['video']['codec']): string => {
  switch (codec) {
    case 'av1':
      return 'av01.0.05M.08';
    case 'avc':
      return 'avc1.420034';
    case 'hevc':
      return 'hev1.2.4.L120.90';
    case 'vp9':
      return 'vp09.00.10.08';
    default:
      assertNever(codec);
  }
};

const buildAndConfigureEncoders = async (
  muxVideo: EncodedVideoChunkOutputCallback,
  muxAudio: EncodedAudioChunkOutputCallback,
  config: OutputConfig,
  sharedQueue: SharedQueue
): Promise<{
  audioEncoder: AudioEncoder;
  videoEncoder: VideoEncoder;
}> => {
  // Build encoders.
  const videoEncoder = new VideoEncoder({
    output: (chunk, metadata) => {
      console.info('Encoded video chunk');
      sharedQueue.video.encoded += 1;
      muxVideo(chunk, metadata);
    },
    error: console.error
  });
  const audioEncoder = new AudioEncoder({
    output: (chunk, metadata) => {
      console.info('Encoded audio chunk');
      sharedQueue.audio.encoded += 1;
      muxAudio(chunk, metadata);
    },
    error: console.error
  });

  // Configure and reset if not supported. More sophisticated fallback recommended.
  videoEncoder.configure({
    codec: outputVideoCodecToEncoderCodec(config.video.codec),
    width: config.video.width,
    height: config.video.height,
    bitrate: 1_000_000,
    framerate: 30
  });
  console.log({
    codec: config.audio.codec,
    numberOfChannels: config.audio.numberOfChannels,
    sampleRate: config.audio.sampleRate,
    bitrate: 128000
  });
  audioEncoder.configure({
    codec: config.audio.codec,
    numberOfChannels: config.audio.numberOfChannels,
    sampleRate: config.audio.sampleRate,
    bitrate: 128000
  });

  return { audioEncoder, videoEncoder };
};

type DecodeVideoConfig = {
  videoEncoder: VideoEncoder;
  codec: string;
  description: AllowSharedBufferSource;
};

type DecodeAudioConfig = {
  audioEncoder: AudioEncoder;
  codec: string;
  numberOfChannels: number;
  sampleRate: number;
  description: AllowSharedBufferSource;
};

const buildAndConfigureDecoders = async (
  videoConfig: DecodeVideoConfig,
  audioConfig: DecodeAudioConfig | undefined
): Promise<{
  audioDecoder?: AudioDecoder;
  videoDecoder: VideoDecoder;
}> => {
  // Build decoders.
  const videoDecoder = new VideoDecoder({
    output: (videoFrame) => {
      videoConfig.videoEncoder.encode(videoFrame);
      videoFrame.close();
    },
    error: (error) => {
      console.error("videoDecoder's error", error);
      throw error;
    }
  });

  // Configure and reset if not supported. More sophisticated fallback recommended.
  console.log(videoConfig);
  videoDecoder.configure(videoConfig);

  let audioDecoder: AudioDecoder | undefined;
  if (audioConfig) {
    audioDecoder = new AudioDecoder({
      output: (audioData) => {
        audioConfig.audioEncoder.encode(audioData);
        audioData.close();
      },
      error: (error) => {
        console.error("audioDecoder's error", error);
        throw error;
      }
    });
    audioDecoder.configure(audioConfig);
  }

  return { audioDecoder, videoDecoder };
};

export const decodeEncode = async (file: File, outputConfig: OutputConfig) => {
  const sharedQueue = {
    video: {
      encoded: 0,
      decoded: 0
    },
    audio: {
      encoded: 0,
      decoded: 0
    }
  };

  const kind = await getFileKind(file);
  assertDefined(kind);

  let muxer: Muxer;
  switch (outputConfig.kind) {
    case 'mp4': {
      muxer = createMp4Muxer(outputConfig);
      break;
    }
    default:
      assertNever(outputConfig.kind);
  }

  console.log(outputConfig);

  const { audioEncoder, videoEncoder } = await buildAndConfigureEncoders(
    muxer.addVideoChunk,
    muxer.addAudioChunk,
    outputConfig,
    sharedQueue
  );

  let decodeConfig: InputConfig;
  switch (kind) {
    case 'mp4': {
      decodeConfig = await extractConfig(file);
      break;
    }
    default:
      assertNever(kind);
  }

  assertDefined(decodeConfig.video.description);

  const { audioDecoder, videoDecoder } = await buildAndConfigureDecoders(
    {
      videoEncoder,
      codec: decodeConfig.video.codec,
      description: decodeConfig.video.description
    },
    decodeConfig.audio?.description
      ? {
          audioEncoder,
          codec: decodeConfig.audio.codec,
          numberOfChannels: decodeConfig.audio.numberOfChannels,
          sampleRate: decodeConfig.audio.sampleRate,
          description: decodeConfig.audio.description // Checked above
        }
      : undefined
  );

  let demuxer: Demuxer;
  switch (kind) {
    case 'mp4': {
      demuxer = createMp4Demuxer(
        {
          videoDecoder,
          frameCount: decodeConfig.video.frameCount,
          tracks: decodeConfig.video.tracks
        },
        {
          audioDecoder,
          sampleCount: decodeConfig.audio?.sampleCount ?? 0,
          tracks: decodeConfig.audio?.tracks ?? new Set()
        },
        sharedQueue
      );
      break;
    }
    default:
      assertNever(kind);
  }

  console.log("Waiting for demuxer's promise to resolve");
  await demuxer.decode(file);
  console.log('OK');

  while (sharedQueue.video.encoded < sharedQueue.video.decoded) {
    console.info(
      'Waiting for video to encode',
      sharedQueue.video.encoded,
      sharedQueue.video.decoded
    );
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  while (sharedQueue.audio.encoded < sharedQueue.audio.decoded) {
    console.info(
      'Waiting for audio to encode',
      sharedQueue.audio.encoded,
      sharedQueue.audio.decoded
    );
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  console.log(JSON.stringify(sharedQueue, null, 2));

  console.log('Waiting for decoders to flush');
  await Promise.all([videoDecoder.flush(), audioDecoder?.flush()]);
  console.log('OK');

  console.log('Waiting for encoders to flush');
  await Promise.all([videoEncoder.flush(), audioEncoder.flush()]);
  console.log('OK');
  console.log('Closing muxer');
  muxer.finalize();
  console.log('OK');
};
