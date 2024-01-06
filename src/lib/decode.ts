import { decode as decodeMp4 } from './mp4/decode';
import type { Kind } from './types';
import { assertNever } from './utils';

export const decode = async (kind: Kind, file: File, encoder: VideoEncoder): Promise<number> => {
	switch (kind) {
		case 'mp4': {
			return await decodeMp4(file, encoder);
		}
		default: {
			assertNever(kind);
		}
	}
};
