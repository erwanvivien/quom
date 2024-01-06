import { mp4output } from './mp4/encode';
import type { Kind, OwnMuxer } from './types';

type CreateEncoder = (
	kind: Kind,
	fileStream: FileSystemWritableFileStream
) => {
	encoder: VideoEncoder;
	setDecodedFrameCount: (count: number) => void;
	close: () => Promise<void>;
};

const muxers: { [key in Kind]: (fileStream: FileSystemWritableFileStream) => OwnMuxer } = {
	mp4: mp4output
};

const CONFIGS: { [key in Kind]: VideoEncoderConfig } = {
	mp4: { codec: 'avc1.42001f', width: 640, height: 360, bitrate: 1000000 }
};

export const createEncoder: CreateEncoder = (kind, fileStream) => {
	const { finalize: muxerFinalize, encoder: output } = muxers[kind](fileStream);

	let encodedFrameCount = 0;
	let decodedFrameCount: number | undefined;

	let resolve: () => void = () => {};
	const close = new Promise<void>((r) => {
		resolve = r;
	});

	const encoder = new VideoEncoder({
		output: (chunk, meta) => {
			output(chunk, meta);
			encodedFrameCount += 1;

			if (encodedFrameCount % 100 === 0) {
				console.log('encoded', encodedFrameCount, 'frames');
			}

			if (decodedFrameCount !== undefined && encodedFrameCount >= decodedFrameCount) {
				encoder.flush().then(() => {
					muxerFinalize();
					resolve();
				});
			}
		},
		error: (error) => {
			console.error('error', error);
		}
	});

	encoder.configure(CONFIGS[kind]);

	return {
		encoder,
		setDecodedFrameCount: (count: number) => {
			decodedFrameCount = count;
		},
		close: () => close
	};
};
