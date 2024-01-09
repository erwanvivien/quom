import type { FileMeta } from './decode';
import { mp4output } from './mp4/encode';
import type { Kind } from './types';
import { sleep } from './utils';

type CreateEncoder = (
	metadata: FileMeta,
	config: VideoEncoderConfig,
	fileStream: FileSystemWritableFileStream,
	callback: (progress: number) => void
) => {
	videoEncoder: VideoEncoder;
	audioEncoder: AudioEncoder | undefined;
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

	const sampleCount = metadata.audio?.sampleCount;
	const frameCount = metadata.video.frameCount;

	const videoEncoder = new VideoEncoder({
		output: (chunk, meta) => {
			encodeFrame(chunk, meta);
			encodedFrameCount += 1;

			// if (encodedFrameCount % 100 === 0) {
			console.log('encoded', encodedFrameCount, 'frames out of ', frameCount);
			// }

			callback(encodedFrameCount / frameCount);
		},
		error: console.error
	});
	videoEncoder.configure(videoConfig);

	let audioEncoder: AudioEncoder | undefined;
	if (metadata.audio) {
		audioEncoder = new AudioEncoder({
			output: (chunk, meta) => {
				encodeAudio(chunk, meta);
				encodedSampleCount += 1;

				if (encodedSampleCount % 100 === 0) {
					console.log('encoded', encodedSampleCount, 'samples out of ', sampleCount);
				}
			},
			error: console.error
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
		audioEncoder.configure(audioConfig);
	}

	return {
		videoEncoder,
		audioEncoder,
		close: async () => {
			await videoEncoder.flush();
			await audioEncoder?.flush();

			console.log('Finalizing');

			muxerFinalize();
		}
	};
};
