import type { FileMeta } from './decode';
import { mp4output } from './mp4/encode';
import type { Kind } from './types';

type CreateEncoder = (
	metadata: FileMeta,
	config: VideoEncoderConfig,
	fileStream: FileSystemWritableFileStream,
	callback: (progress: number) => void
) => {
	videoEncoder: VideoEncoder;
	audioEncoder: AudioEncoder;
	close: () => Promise<void>;
};

const muxers: { [key in Kind]: typeof mp4output } = {
	mp4: mp4output
};

export const createEncoder: CreateEncoder = (metadata, videoConfig, fileStream, callback) => {
	const {
		finalize: muxerFinalize,
		encodeFrame,
		encodeAudio
	} = muxers[metadata.kind](fileStream, videoConfig, { width: 640, height: 360 });

	let encodedFrameCount = 0;
	let encodedSampleCount = 0;

	let resolve: () => void = () => {};
	let reject: (error: DOMException) => void = () => {};
	const close = new Promise<void>((res, rej) => {
		resolve = res;
		reject = rej;
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
			reject(error);
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
		error: (error) => {
			console.error('error', error);
			reject(error);
		}
	});

	const audioConfig: AudioEncoderConfig = {
		...metadata.audio,
		bitrate: 128000 // Default to 128kbps
	};

	for (const validBitrates of [96000, 128000, 160000, 192000]) {
		if (validBitrates >= metadata.audio.bitrate) {
			audioConfig.bitrate = validBitrates;
			break;
		}
	}

	videoEncoder.configure(videoConfig);
	audioEncoder.configure(audioConfig);

	return {
		videoEncoder,
		audioEncoder,
		close: () => close
	};
};
