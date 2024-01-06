import { FileSystemWritableFileStreamTarget, Muxer as Mp4Muxer } from 'mp4-muxer';

type Kind = 'mp4';

type OwnMuxer = {
	finalize: () => void;
	encoder: EncodedVideoChunkOutputCallback;
};

const mp4output: (fileStream: FileSystemWritableFileStream) => OwnMuxer = (fileStream) => {
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
			console.log('encode');
			if (firstTimeStamp === undefined) {
				firstTimeStamp = chunk.timestamp;
			}

			const time = chunk.timestamp - firstTimeStamp;
			console.log('time', time);

			muxer.addVideoChunk(chunk, meta, chunk.timestamp - firstTimeStamp);
		},
		finalize: () => muxer.finalize()
	};
};

type CreateEncoder = (
	kind: Kind,
	fileStream: FileSystemWritableFileStream
) => {
	encoder: VideoEncoder;
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

	const encoder = new VideoEncoder({
		output,
		error: (error) => {
			console.log('error', error);
		}
	});

	encoder.configure(CONFIGS[kind]);

	return {
		encoder,
		close: async () => {
			await encoder.flush();
			muxerFinalize();
		}
	};
};
