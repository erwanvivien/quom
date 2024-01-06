import { decode as decodeMp4 } from './mp4/decode';
import type { Kind } from './types';
import { assertNever } from './utils';

export type FrameAndAudioCount = {
	frameCount: number;
	audioCount: number;
};

export const decode = async (
	kind: Kind,
	file: File,
	videoEncoder: VideoEncoder,
	audioEncoder: AudioEncoder
): Promise<FrameAndAudioCount> => {
	switch (kind) {
		case 'mp4': {
			return await decodeMp4(file, videoEncoder, audioEncoder);
		}
		default: {
			assertNever(kind);
		}
	}
};
