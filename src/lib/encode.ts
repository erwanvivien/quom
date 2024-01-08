import type { FileMeta } from './decode';
import { mp4output } from './mp4/encode';
import type { Kind, OwnMuxer } from './types';

type CreateEncoder = (
	metadata: FileMeta,
	fileStream: FileSystemWritableFileStream,
	callback: (progress: number) => void
) => {
	videoEncoder: VideoEncoder;
	audioEncoder: AudioEncoder;
	close: () => Promise<void>;
};

const muxers: {
	[key in Kind]: (
		fileStream: FileSystemWritableFileStream,
		params: { width: number; height: number }
	) => OwnMuxer;
} = {
	mp4: mp4output
};

export const createEncoder: CreateEncoder = (metadata, fileStream, callback) => {
	const {
		finalize: muxerFinalize,
		encodeFrame,
		encodeAudio
	} = muxers[metadata.kind](fileStream, { width: 640, height: 360 });

	let encodedFrameCount = 0;
	let encodedSampleCount = 0;

	let resolve: () => void = () => {};
	const close = new Promise<void>((r) => {
		resolve = r;
	});

	const {
		audio: { sampleCount },
		video: { frameCount }
	} = metadata;

	const videoEncoder = new VideoEncoder({
		output: (chunk, meta) => {
			encodeFrame(chunk, meta);
			encodedFrameCount += 1;

			if (encodedFrameCount % 100 === 0) {
				console.log('encoded', encodedFrameCount, 'frames out of ', frameCount);
			}

			callback(encodedFrameCount / frameCount);

			if (encodedFrameCount >= frameCount) {
				videoEncoder.flush().then(() => {
					console.log('flushed video');
					if (encodedSampleCount >= sampleCount) {
						muxerFinalize();
						resolve();
					}
				});
			}
		},
		error: (error) => {
			console.error('error', error);
		}
	});

	const audioEncoder = new AudioEncoder({
		output: (chunk, meta) => {
			encodeAudio(chunk, meta);
			encodedSampleCount += 1;

			if (encodedSampleCount % 100 === 0) {
				console.log('encoded', encodedSampleCount, 'samples out of ', sampleCount);
			}

			if (encodedSampleCount + 1 >= sampleCount) {
				audioEncoder.flush().then(() => {
					console.log('flushed audio');
					if (encodedFrameCount >= frameCount) {
						muxerFinalize();
						resolve();
					}
				});
			}
		},
		error: (error) => console.error('error', error)
	});

	videoEncoder.configure(metadata.video);
	audioEncoder.configure(metadata.audio);

	return {
		videoEncoder,
		audioEncoder,
		close: () => close
	};
};
