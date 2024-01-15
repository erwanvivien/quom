import { arrayMatches, assertDefined, assertNever, clamp } from '$lib/utils';
import { createMp4Demuxer, createMp4Muxer, extractConfig } from './mp4';
import type { Demuxer, InputConfig, Kind, Muxer, OutputConfig, SharedQueue } from './types';

/**
 * Checks the first 64 bytes of the file to determine the file type.
 *
 * Currently only supports MP4.
 */
export const getFileKind = async (file: File): Promise<Kind | undefined> => {
  const arrayBuffer = await file.slice(0, 64).arrayBuffer();
  const array = new Uint8Array(arrayBuffer);

  if (arrayMatches(array, ['*', '*', '*', '*', 0x66, 0x74, 0x79, 0x70])) {
    return 'mp4';
  }

  return undefined;
};

/**
 * Create a video and audio encoder and configure them.
 *
 * sharedQueue will be mutated by the encoders on each call to `encode`.
 */
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
    codec: config.encoderVideo.codec,
    width: config.encoderVideo.width,
    height: config.encoderVideo.height,
    bitrate: 1_000_000,
    framerate: 30
  });
  audioEncoder.configure({
    codec: 'opus', // 'aac' is not supported by Chrome
    numberOfChannels: config.encoderAudio.numberOfChannels,
    sampleRate: config.encoderAudio.sampleRate,
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

/**
 * Create a video and audio decoder and configure them.
 */
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
    error: console.error
  });

  // Configure and reset if not supported. More sophisticated fallback recommended.
  videoDecoder.configure(videoConfig);

  let audioDecoder: AudioDecoder | undefined;
  if (audioConfig) {
    audioDecoder = new AudioDecoder({
      output: (audioData) => {
        audioConfig.audioEncoder.encode(audioData);
        audioData.close();
      },
      error: console.error
    });
    audioDecoder.configure(audioConfig);
  }

  return { audioDecoder, videoDecoder };
};

/**
 * This function yields the progress of the encoding process and throws an
 * error if the encoding process takes too long.
 *
 * `shared` is a mutable object that is shared between the demuxer and the
 * muxers. It counts the number of frames that have been decoded and encoded.
 */
async function* syncEncodeDecode(
  shared: SharedQueue['audio' | 'video']
): AsyncGenerator<number, number> {
  let tries = 0;
  let lastEncoded = 0;
  while (tries < 50 && shared.encoded < shared.decoded) {
    console.info('Waiting for video to encode', shared.encoded, shared.decoded);
    await new Promise((resolve) => setTimeout(resolve, 100));

    if (lastEncoded === shared.encoded) {
      tries += 1;
    } else {
      tries = 0;
    }
    lastEncoded = shared.encoded;
    yield clamp(shared.encoded / shared.decoded, 0, 0.99);
  }

  const lastProgress = shared.encoded / shared.decoded;
  if (tries === 200 && lastProgress < 0.98) {
    throw new Error('Max retries reached');
  }

  return 1;
}

/**
 * Decode and encode a file.
 */
export const decodeEncode = async (
  file: File,
  outputConfig: OutputConfig,
  progressCallback: (progress: number) => void
) => {
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

  let decodeConfig: InputConfig;
  switch (kind) {
    case 'mp4': {
      decodeConfig = await extractConfig(file);
      break;
    }
    default:
      assertNever(kind);
  }

  const { audioEncoder, videoEncoder } = await buildAndConfigureEncoders(
    muxer.addVideoChunk,
    muxer.addAudioChunk,
    {
      ...outputConfig,
      encoderAudio: {
        ...outputConfig.encoderAudio,
        // Most often, input sample rate should be used for output sample rate.
        sampleRate: decodeConfig.audio?.sampleRate ?? outputConfig.encoderAudio.sampleRate
      }
    },
    sharedQueue
  );

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

  console.info("Waiting for demuxer's promise to resolve");
  await demuxer.decode(file);
  console.info('OK');

  for await (const progress of syncEncodeDecode(sharedQueue.video)) {
    progressCallback(progress);
  }
  for await (const _progress of syncEncodeDecode(sharedQueue.audio)) {
    // Nothing
  }

  progressCallback(1);

  console.info('Waiting for decoders to flush');
  await Promise.all([videoDecoder.flush(), audioDecoder?.flush()]);
  console.info('OK');

  console.info('Waiting for encoders to flush');
  await Promise.all([videoEncoder.flush(), audioEncoder.flush()]);
  console.info('OK');
  console.info('Closing muxer');
  muxer.finalize();
  console.info('OK');
};
