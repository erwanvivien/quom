import { assertDefined } from '$lib/utils';
import * as MP4Box from 'mp4box';

export const decode = (file: File, videoEncoder: VideoEncoder) =>
	new Promise<number>((resolve) => {
		let offset = 0;

		// Uses mp4box for demuxing
		const mp4boxfile = MP4Box.createFile();
		const reader = file.stream().getReader();

		let decodedFrames = 0;

		const videoDecoder = new VideoDecoder({
			output: (chunk) => {
				videoEncoder.encode(chunk);
				chunk.close();
			},
			error: (err) => {
				console.error(err);
			}
		});

		mp4boxfile.onReady = (info) => {
			if (info && info.videoTracks && info.videoTracks[0]) {
				const [{ codec }] = info.videoTracks;

				let videoDescription: Uint8Array | undefined = undefined;
				for (const trak of mp4boxfile.moov.traks) {
					const entry = trak.mdia?.minf?.stbl?.stsd?.entries[0];
					// from https://github.com/w3c/webcodecs/blob/446d831/samples/audio-video-player/mp4_pull_demuxer.js#L171-L179
					const box = entry?.avcC || entry?.hvcC || entry?.vpcC || entry?.av1C; //
					if (box) {
						const stream = new MP4Box.DataStream(undefined, 0, MP4Box.DataStream.BIG_ENDIAN);
						box.write(stream);
						videoDescription = new Uint8Array(stream.buffer, 8); // Remove the box header.
						break;
					}
				}

				assertDefined(videoDescription, 'No video description found');

				// configure decoder
				videoDecoder.configure({ codec, description: videoDescription });

				// Setup mp4box file for breaking it into chunks
				mp4boxfile.setExtractionOptions(info.videoTracks[0].id);
				mp4boxfile.start();
			} else {
				throw new Error('URL provided is not a valid mp4 video file.');
			}
		};

		mp4boxfile.onSamples = (track_id, ref, samples) => {
			decodedFrames += samples.length;
			for (let i = 0; i < samples.length; i += 1) {
				const sample = samples[i];

				const videoChunk = new EncodedVideoChunk({
					type: sample.is_sync ? 'key' : 'delta',
					timestamp: (1e6 * sample.cts) / sample.timescale, // from https://github.com/gpac/mp4box.js/issues/374
					duration: (1e6 * sample.duration) / sample.timescale,
					data: sample.data
				});

				videoDecoder.decode(videoChunk);
			}
		};

		function appendBuffers({ done, value }: ReadableStreamReadResult<Uint8Array>) {
			if (done) {
				mp4boxfile.flush();
				resolve(decodedFrames - 1);
				return;
			}

			// We need to cast the value to MP4ArrayBuffer and we then add the fileStart property to it
			// Otherwise, we lose the ArrayBuffer type
			const buf = value.buffer as MP4Box.MP4ArrayBuffer;
			buf.fileStart = offset;
			offset += buf.byteLength;
			mp4boxfile.appendBuffer(buf);

			reader.read().then(appendBuffers);
		}

		reader.read().then(appendBuffers);
	});
