import type { OwnMuxer } from '$lib/types';
import { FileSystemWritableFileStreamTarget, Muxer as Mp4Muxer } from 'mp4-muxer';

export const mp4output: (fileStream: FileSystemWritableFileStream) => OwnMuxer = (fileStream) => {
	const muxer = new Mp4Muxer({
		target: new FileSystemWritableFileStreamTarget(fileStream),
		video: {
			codec: 'avc',
			width: 1280,
			height: 720
		},
		fastStart: false
	});

	let firstTimeStamp: number | undefined = undefined;

	return {
		encoder: (chunk, meta) => {
			if (firstTimeStamp === undefined) {
				firstTimeStamp = chunk.timestamp;
			}

			muxer.addVideoChunk(chunk, meta, chunk.timestamp - firstTimeStamp);
		},
		finalize: () => muxer.finalize()
	};
};
