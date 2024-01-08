import { decode as decodeMp4, getFileMeta as getMp4FileMeta } from './mp4/decode';
import type { Kind } from './types';
import { arrayMatches, assertNever } from './utils';

export type FileMeta = {
	kind: Kind;
	audio: {
		codec: string;
		numberOfChannels: number;
		sampleRate: number;
		bitrate: number;

		sampleCount: number;
	};
	video: {
		codec: string;
		width: number;
		height: number;
		bitrate: number;

		frameCount: number;
	};
};

export type FrameAndAudioCount = {
	frameCount: number;
	audioCount: number;
};

const tryAllGetMetadata = async (file: File): Promise<FileMeta> => {
	for (const getMetadata of [getMp4FileMeta]) {
		console.debug('Trying', getMetadata.name);
		try {
			return await getMetadata(file);
		} catch (_) {
			continue;
		}
	}

	throw new Error('Unsupported file type');
};

export const getMetadata = async (file: File): Promise<FileMeta> => {
	const fewFirstBytes = await file.slice(0, 1024).arrayBuffer();
	const array = new Uint8Array(fewFirstBytes);

	if (arrayMatches(array, ['*', '*', '*', '*', 0x66, 0x74, 0x79, 0x70])) {
		try {
			return await getMp4FileMeta(file);
		} catch (_) {
			//
		}
	}

	return await tryAllGetMetadata(file);
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
