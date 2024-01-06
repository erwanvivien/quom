export type Kind = 'mp4';

export type OwnMuxer = {
	finalize: () => void;
	encodeFrame: EncodedVideoChunkOutputCallback;
	encodeAudio: EncodedAudioChunkOutputCallback;
};
