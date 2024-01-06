import { mp4output } from './mp4/encode';
import type { Kind, OwnMuxer } from './types';

type CreateEncoder = (
	kind: Kind,
	fileStream: FileSystemWritableFileStream,
	callback: (progress: number) => void
) => {
	videoEncoder: VideoEncoder;
	audioEncoder: AudioEncoder;
	setDecodedFrameCount: (count: number) => void;
	setDecodedAudioCount: (count: number) => void;
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

const CONFIGS: { [key in Kind]: { video: VideoEncoderConfig; audio: AudioEncoderConfig } } = {
	mp4: {
		video: { codec: 'avc1.42001f', width: 640, height: 360, bitrate: 1_000_000 },
		audio: { codec: 'mp4a.40.2', bitrate: 128000, numberOfChannels: 2, sampleRate: 44100 }
	}
};

export const createEncoder: CreateEncoder = (kind, fileStream, callback) => {
	const {
		finalize: muxerFinalize,
		encodeFrame,
		encodeAudio
	} = muxers[kind](fileStream, { width: 640, height: 360 });

	let encodedFrameCount = 0;
	let decodedFrameCount: number | undefined;

	let encodedAudioCount = 0;
	let decodedAudioCount: number | undefined;

	let resolve: () => void = () => {};
	const close = new Promise<void>((r) => {
		resolve = r;
	});

	const videoEncoder = new VideoEncoder({
		output: (chunk, meta) => {
			encodeFrame(chunk, meta);
			encodedFrameCount += 1;

			if (encodedFrameCount % 100 === 0) {
				console.log('encoded', encodedFrameCount, 'frames out of ', decodedFrameCount ?? 'unknown');
			}

			if (decodedFrameCount !== undefined) {
				callback(encodedFrameCount / decodedFrameCount);
			}

			if (decodedFrameCount !== undefined && encodedFrameCount >= decodedFrameCount) {
				videoEncoder.flush().then(() => {
					if (decodedAudioCount !== undefined && encodedAudioCount >= decodedAudioCount) {
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
		},
		error: (error) => {
			encodedAudioCount += 1;

			console.error('error', error);
			if (decodedAudioCount !== undefined && encodedAudioCount >= decodedAudioCount) {
				videoEncoder.flush().then(() => {
					if (decodedFrameCount !== undefined && encodedFrameCount >= decodedFrameCount) {
						muxerFinalize();
						resolve();
					}
				});
			}
		}
	});

	videoEncoder.configure(CONFIGS[kind].video);
	audioEncoder.configure(CONFIGS[kind].audio);

	return {
		videoEncoder,
		audioEncoder,
		setDecodedFrameCount: (count: number) => {
			decodedFrameCount = count;
		},
		setDecodedAudioCount: (count: number) => {
			decodedAudioCount = count;
		},
		close: () => close
	};
};
