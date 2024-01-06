import * as MP4Box from 'mp4box';
import { assertDefined } from './utils';

const getExtradata = (avccBox: MP4Box.AvcC) => {
	// generate the property "description" for the object used in VideoDecoder.configure
	// This function have been written by Thomas Guilbert from Google

	// let avccBox = file.moov.traks[0].mdia.minf.stbl.stsd.entries[0].avcC;

	let size = 7;
	for (let i = 0; i < avccBox.SPS.length; i++) size += 2 + avccBox.SPS[i].length;
	for (let i = 0; i < avccBox.PPS.length; i++) size += 2 + avccBox.PPS[i].length;

	let index = 0;
	const data = new Uint8Array(size);

	const writeUint8 = (value: number) => {
		data.set([value], index);
		index++;
	};

	const writeUint16 = (value: number) => {
		const arr = new Uint8Array(1);
		arr[0] = value;
		const buffer = new Uint8Array(arr.buffer);
		data.set([buffer[1], buffer[0]], index);
		index += 2;
	};

	const writeUint8Array = (value: ArrayLike<number>) => {
		data.set(value, index);
		index += value.length;
	};

	writeUint8(avccBox.configurationVersion);
	writeUint8(avccBox.AVCProfileIndication);
	writeUint8(avccBox.profile_compatibility);
	writeUint8(avccBox.AVCLevelIndication);
	writeUint8(avccBox.lengthSizeMinusOne + (63 << 2));

	writeUint8(avccBox.nb_SPS_nalus + (7 << 5));
	for (let i = 0; i < avccBox.SPS.length; i++) {
		writeUint16(avccBox.SPS[i].length);
		writeUint8Array(avccBox.SPS[i].nalu);
	}

	writeUint8(avccBox.nb_PPS_nalus);
	for (let i = 0; i < avccBox.PPS.length; i++) {
		writeUint16(avccBox.PPS[i].length);
		writeUint8Array(avccBox.PPS[i].nalu);
	}

	if (index !== size) {
		throw 'size mismatched !';
	}

	return data;
};

export const decode = async (file: File, encoder: VideoEncoder) => {
	console.time('Starting');
	let offset = 0;

	// Uses mp4box for demuxing
	const mp4boxfile = MP4Box.createFile();
	const reader = file.stream().getReader();

	const decoder = new VideoDecoder({
		output: (chunk) => {
			encoder.encode(chunk);
			chunk.close();
		},
		error: (err) => {
			console.error(err);
		}
	});

	mp4boxfile.onReady = (info) => {
		if (info && info.videoTracks && info.videoTracks[0]) {
			const [{ codec }] = info.videoTracks;

			let avccBox: MP4Box.AvcC | undefined;
			for (const trak of mp4boxfile.moov.traks) {
				if (trak.mdia?.minf?.stbl?.stsd?.entries[0].avcC) {
					avccBox = trak.mdia?.minf?.stbl?.stsd?.entries[0].avcC;
					break;
				}
			}

			assertDefined(avccBox, 'avccBox is undefined');
			const extradata = getExtradata(avccBox);

			// configure decoder
			decoder.configure({ codec, description: extradata });

			// Setup mp4box file for breaking it into chunks
			mp4boxfile.setExtractionOptions(info.videoTracks[0].id);
			mp4boxfile.start();
		} else {
			throw new Error('URL provided is not a valid mp4 video file.');
		}
	};

	mp4boxfile.onSamples = (track_id, ref, samples) => {
		for (let i = 0; i < samples.length; i += 1) {
			const sample = samples[i];

			const chunk = new EncodedVideoChunk({
				type: sample.is_sync ? 'key' : 'delta',
				timestamp: (1e6 * sample.cts) / sample.timescale,
				duration: (1e6 * sample.duration) / sample.timescale,
				data: sample.data
			});

			decoder.decode(chunk);
		}
	};

	function appendBuffers({ done, value }: ReadableStreamReadResult<Uint8Array>) {
		if (done) {
			mp4boxfile.flush();
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
};
