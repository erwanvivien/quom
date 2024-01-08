export function assertDefined(
	value: unknown,
	message?: string
): asserts value is NonNullable<typeof value> {
	if (value === undefined || value === null) {
		throw new Error(message ?? value + ' is not defined');
	}
}

export function assertNever(value: never, message?: string): never {
	throw new Error(message ?? value + ' is not never');
}

export function assert(condition: boolean, message?: string): asserts condition {
	if (!condition) {
		throw new Error(message ?? 'Assertion failed');
	}
}

export const fileNameAndExtension = (file: File): [name: string, extension: string] => {
	const split = file.name.split('.');
	const extension = split.pop() ?? '';
	const name = split.join('.');

	return [name, extension];
};

/**
 * `match` is a string of hex values, e.g. "FFD8FF" and can have * wildcards
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
