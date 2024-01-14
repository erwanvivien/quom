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

export const VideoCodecs = [
  // h264
  'avc1.420034',
  'avc1.4d0034',
  'avc1.640034',
  // h265
  'hev1.1.6.L93.90',
  'hev1.2.6.L93.90',
  // vp8
  'vp8',
  // vp9
  'vp09.00.10.08',
  // av1
  'av01.0.05M.08',
  'av01.0.08M.10.0.112.09.16.09.0'
] as const;

export type VideoCodec = (typeof VideoCodecs)[number];

/**
 * Return a list of supported video encoder configurations for the current
 * browser.
 *
 * This is a workaround for the lack of a `getSupportedConfigurations` method
 * on the `VideoEncoder` interface.
 */
export const getSupportedVideoConfigs = async (): Promise<VideoEncoderConfig[]> => {
  const accelerations = ['prefer-hardware', 'prefer-software'] as const;

  const configs: VideoEncoderConfig[] = [];
  for (const acceleration of accelerations) {
    for (const codec of VideoCodecs) {
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

      if (await VideoEncoder.isConfigSupported(config)) {
        configs.push(config);
      }
    }
  }

  return configs;
};

/**
 * Return a list of supported audio encoder configurations for the current
 * browser.
 *
 * This is a workaround for the lack of a `getSupportedConfigurations` method
 * on the `AudioEncoder` interface.
 */
export const getSupportedAudioConfigs = async (): Promise<AudioEncoderConfig[]> => {
  const codecs = ['opus', 'aac'];

  const configs: AudioEncoderConfig[] = [];
  for (const codec of codecs) {
    const config = {
      codec,
      numberOfChannels: 2,
      sampleRate: 48000
    };

    if (await AudioEncoder.isConfigSupported(config)) {
      configs.push(config);
    }
  }

  return configs;
};

/**
 * Clamp a value between a minimum and maximum.
 */
export const clamp = (value: number, min: number, max: number): number => {
  return Math.min(Math.max(value, min), max);
};
