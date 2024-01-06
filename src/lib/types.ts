export type Kind = 'mp4';

export type OwnMuxer = {
	finalize: () => void;
	encoder: EncodedVideoChunkOutputCallback;
};
