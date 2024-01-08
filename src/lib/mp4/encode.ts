import type { OwnMuxer } from '$lib/types';
import { assertDefined, type VideoCodec } from '$lib/utils';
import { FileSystemWritableFileStreamTarget, Muxer as Mp4Muxer } from 'mp4-muxer';

type Mp4MuxerCodec = 'avc' | 'hevc' | 'vp9' | 'av1';

const Mp4MuxerCodecs: { [key in VideoCodec]: Mp4MuxerCodec | undefined } = {
	'av01.0.05M.08': 'av1',
	'av01.0.08M.10.0.112.09.16.09.0': 'av1',
	'avc1.420034': 'avc',
	'avc1.4d0034': 'avc',
	'avc1.640034': 'avc',
	'hev1.1.6.L93.90': 'hevc',
	'hev1.2.6.L93.90': 'hevc',
	'vp09.00.10.08': 'vp9',
	vp8: undefined
};

export const mp4output: (
	fileStream: FileSystemWritableFileStream,
	videoConfig: VideoEncoderConfig,
	params: { width: number; height: number }
) => OwnMuxer = (fileStream, videoConfig, params) => {
	const codec = Mp4MuxerCodecs[videoConfig.codec as VideoCodec];
	assertDefined(codec, 'Unsupported codec');

	const muxer = new Mp4Muxer({
		target: new FileSystemWritableFileStreamTarget(fileStream),
		video: {
			codec,
			width: params.width,
			height: params.height
		},
		audio: {
			codec: 'aac',
			numberOfChannels: 2,
			sampleRate: 44100
		},
		fastStart: false
	});

	let videoFirstTimeStamp: number | undefined = undefined;
	let audioFirstTimeStamp: number | undefined = undefined;

	return {
		encodeFrame: (chunk, meta) => {
			if (videoFirstTimeStamp === undefined) {
				videoFirstTimeStamp = chunk.timestamp;
			}

			muxer.addVideoChunk(chunk, meta, chunk.timestamp - videoFirstTimeStamp);
		},
		encodeAudio: (chunk, meta) => {
			if (audioFirstTimeStamp === undefined) {
				audioFirstTimeStamp = chunk.timestamp;
			}

			muxer.addAudioChunk(chunk, meta, chunk.timestamp - audioFirstTimeStamp);
		},
		finalize: () => muxer.finalize()
	};
};
