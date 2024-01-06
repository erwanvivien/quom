import type { OwnMuxer } from '$lib/types';
import { FileSystemWritableFileStreamTarget, Muxer as Mp4Muxer } from 'mp4-muxer';

export const mp4output: (
	fileStream: FileSystemWritableFileStream,
	params: { width: number; height: number }
) => OwnMuxer = (fileStream, params) => {
	const muxer = new Mp4Muxer({
		target: new FileSystemWritableFileStreamTarget(fileStream),
		video: {
			codec: 'avc',
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
