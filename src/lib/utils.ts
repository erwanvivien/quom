import { z } from 'zod';

/**
 * Asserts that the given value is not `undefined` or `null`.
 */
export function assertDefined(
  value: unknown,
  message?: string
): asserts value is NonNullable<typeof value> {
  if (value === undefined || value === null) {
    throw new Error(message ?? value + ' is not defined');
  }
}

/**
 * Asserts that the given value is never.
 */
export function assertNever(value: never, message?: string): never {
  throw new Error(message ?? value + ' is not never');
}

/**
 * Asserts that the given condition is truthy.
 */
export function assert(condition: boolean, message?: string): asserts condition {
  if (!condition) {
    throw new Error(message ?? 'Assertion failed');
  }
}

/**
 * Sleep for the given number of milliseconds.
 */
export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Splits the file name and extension.
 *
 * @example
 * fileNameAndExtension(new File([''], 'test.mp4')) // ['test', 'mp4']
 * fileNameAndExtension(new File([''], 'test')) // ['test', '']
 * fileNameAndExtension(new File([''], 'test.test.mp4')) // ['test.test', 'mp4']
 */
export const fileNameAndExtension = (file: File): [name: string, extension: string] => {
  if (!file.name.includes('.')) {
    return [file.name, ''];
  }

  const split = file.name.split('.');
  const extension = split.pop() ?? '';
  const name = split.join('.');

  return [name, extension];
};

/**
 * Check that an array of bytes matches a pattern.
 *
 * @example
 * arrayMatches(new Uint8Array([0x00, 0x01, 0x02]), [0x00, 0x01, 0x02]) // true
 * arrayMatches(new Uint8Array([0x00, 0x01, 0x02]), [0x00, 0x01, '*']) // true
 */
export const arrayMatches = (array: Uint8Array, match: (number | '*')[]): boolean => {
  for (let i = 0; i < match.length; i++) {
    const matchValue = match[i];
    const arrayValue = array[i];

    if (matchValue === '*') {
      continue;
    }

    if (matchValue !== arrayValue) {
      return false;
    }
  }

  return true;
};

const CodecFormat = z.record(z.object({ description: z.string() }));

const fetch = async (url: RequestInfo): Promise<Response> => {
  if (typeof window === 'undefined') {
    return Promise.resolve(new Response('{}'));
  }

  return await window.fetch(url);
};

const _genericVideo = await fetch('/codecs/video/index.json');
const GenericVideo = CodecFormat.parse(await _genericVideo.json());
const _vp9 = await fetch('/codecs/video/vp9.json');
const Vp9Codecs = CodecFormat.parse(await _vp9.json());
const _av1 = await fetch('/codecs/video/av1.json');
const Av1Codecs = CodecFormat.parse(await _av1.json());
const _avc = await fetch('/codecs/video/avc.json');
const AvcCodecs = CodecFormat.parse(await _avc.json());
const _hevc = await fetch('/codecs/video/hevc.json');
const HevcCodecs = CodecFormat.parse(await _hevc.json());
const Vp8Codecs = { vp8: { description: 'VP8' } };

export const VideoCodecs: Record<string, { description: string }> = {
  ...GenericVideo,
  ...Vp8Codecs,
  ...Vp9Codecs,
  ...Av1Codecs,
  ...AvcCodecs,
  ...HevcCodecs
};

let supportedVideoConfigs: VideoEncoderConfig[] | undefined;

/**
 * Return a list of supported video encoder configurations for the current
 * browser.
 *
 * This is a workaround for the lack of a `getSupportedConfigurations` method
 * on the `VideoEncoder` interface.
 */
export const getSupportedVideoConfigs = async (): Promise<VideoEncoderConfig[]> => {
  if (supportedVideoConfigs) {
    return supportedVideoConfigs;
  }

  const accelerations = ['prefer-hardware', 'prefer-software'] as const;

  const configs: VideoEncoderConfig[] = [];
  for (const acceleration of accelerations) {
    for (const codec in VideoCodecs) {
      const config: VideoEncoderConfig = {
        codec,
        hardwareAcceleration: acceleration,
        width: 1280,
        height: 720
      };

      if (codec.startsWith('avc1')) {
        config.avc = { format: 'annexb' };
      } else if (codec.startsWith('hev1')) {
        // @ts-expect-error hevc is not in the type definition but it seems to be used here:
        // https://webrtc.internaut.com/wc/wtSender/ line 287
        config.hevc = { format: 'annexb' };
      }

      const { supported } = await VideoEncoder.isConfigSupported(config);
      if (supported) {
        configs.push(config);
      }
    }
  }

  supportedVideoConfigs = configs;
  return configs;
};

const _genericAudio = await fetch('/codecs/audio/index.json');
const GenericAudio = CodecFormat.parse(await _genericAudio.json());
const _mp3 = await fetch('/codecs/audio/mp3.json');
const Mp3Codecs = CodecFormat.parse(await _mp3.json());
const _mp4a = await fetch('/codecs/audio/mp4a.json');
const Mp4aCodecs = CodecFormat.parse(await _mp4a.json());

export const AudioCodecs: Record<string, { description: string }> = {
  ...GenericAudio,
  ...Mp3Codecs,
  ...Mp4aCodecs
};

let supportedAudioConfigs: AudioEncoderConfig[] | undefined;

/**
 * Return a list of supported audio encoder configurations for the current
 * browser.
 *
 * This is a workaround for the lack of a `getSupportedConfigurations` method
 * on the `AudioEncoder` interface.
 */
export const getSupportedAudioConfigs = async (): Promise<AudioEncoderConfig[]> => {
  if (supportedAudioConfigs) {
    return supportedAudioConfigs;
  }

  const configs: AudioEncoderConfig[] = [];
  for (const codec in AudioCodecs) {
    const config = {
      codec,
      numberOfChannels: 2,
      sampleRate: 48000
    };

    const { supported } = await AudioEncoder.isConfigSupported(config);
    if (supported) {
      configs.push(config);
    }
  }

  supportedAudioConfigs = configs;
  return configs;
};

/**
 * Clamp a value between a minimum and maximum.
 */
export const clamp = (value: number, min: number, max: number): number => {
  return Math.min(Math.max(value, min), max);
};

export const classes = (...args: (string | unknown)[]): string => {
  return args.filter(Boolean).join(' ');
};
