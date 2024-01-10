import type { FileMeta, FrameAndAudioCount } from '$lib/decode';
import { assert, assertDefined } from '$lib/utils';
import * as MP4Box from 'mp4box';

const audioConfigFromPartial = (
  audioConfig: Partial<NonNullable<FileMeta['audio']>>
): FileMeta['audio'] | undefined => {
  const { bitrate, codec, numberOfChannels, sampleCount, sampleRate } = audioConfig;
  if (codec && numberOfChannels && sampleRate && bitrate && sampleCount) {
    return { codec, numberOfChannels, sampleRate, bitrate, sampleCount };
  }

  return undefined;
};

export const getFileMeta = (file: File) =>
  new Promise<FileMeta>((resolve) => {
    const mp4boxfile = MP4Box.createFile();
    const reader = file.stream().getReader();

    let ready = false;

    mp4boxfile.onReady = (info) => {
      console.log('READY', info);
      ready = true;

      const videoCodec = info.videoTracks?.[0]?.codec;

      const audioConfig: FileMeta['audio'] | undefined = audioConfigFromPartial({
        codec: info.audioTracks?.[0]?.codec,
        numberOfChannels: info.audioTracks?.[0]?.audio?.channel_count,
        sampleRate: info.audioTracks?.[0]?.audio?.sample_rate,
        bitrate: info.audioTracks?.[0]?.bitrate,
        sampleCount: info.audioTracks?.[0]?.nb_samples
      });

      const {
        track_height: height,
        track_width: width,
        bitrate: videoBitrate
      } = info.videoTracks[0];
      const frameCount = info.videoTracks[0].nb_samples;

      resolve({
        kind: 'mp4',
        video: {
          codec: videoCodec,
          width,
          height,
          bitrate: videoBitrate,
          frameCount: frameCount - 1
        },
        audio: audioConfig
      });
    };

    let offset = 0;
    function appendBuffers({ done, value }: ReadableStreamReadResult<Uint8Array>) {
      if (done || ready) {
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
  });

export const decode = (file: File, videoEncoder: VideoEncoder, audioEncoder?: AudioEncoder) =>
  new Promise<FrameAndAudioCount>((resolve) => {
    // Uses mp4box for demuxing
    const mp4boxfile = MP4Box.createFile();
    const reader = file.stream().getReader();

    let decodedFrames = 0;
    let decodedSamples = 0;

    let frameCount = 0;
    let sampleCount = 0;

    const videoDecoder = new VideoDecoder({
      output: (chunk) => {
        videoEncoder.encode(chunk);
        chunk.close();
      },
      error: (err) => {
        console.error(err);
      }
    });

    let audioDecoder: AudioDecoder | undefined;
    if (audioEncoder) {
      audioDecoder = new AudioDecoder({
        output: (chunk) => {
          audioEncoder.encode(chunk);
          chunk.close();
        },
        error: (err) => {
          console.error(err);
        }
      });
    }

    const videoTracks = new Set<number>();
    const audioTracks = new Set<number>();

    mp4boxfile.onReady = (info) => {
      if (info && info.videoTracks && info.videoTracks[0]) {
        const videoCodec = info.videoTracks?.[0]?.codec;
        const audioCodec = info.audioTracks?.[0]?.codec;

        frameCount = info.videoTracks[0].nb_samples;
        sampleCount = info.audioTracks?.[0]?.nb_samples || 0;

        const channel_count = info.audioTracks?.[0]?.audio?.channel_count;
        const sample_rate = info.audioTracks?.[0]?.audio?.sample_rate;

        let videoDescription: Uint8Array | undefined = undefined;
        let audioDescription: Uint8Array | undefined = undefined;
        for (const trak of mp4boxfile.moov.traks) {
          const entry = trak.mdia?.minf?.stbl?.stsd?.entries[0];
          // from https://github.com/w3c/webcodecs/blob/446d831/samples/audio-video-player/mp4_pull_demuxer.js#L171-L179
          const videoBox = entry?.avcC || entry?.hvcC || entry?.vpcC || entry?.av1C; //
          if (!videoDescription && videoBox) {
            const stream = new MP4Box.DataStream(undefined, 0, MP4Box.DataStream.BIG_ENDIAN);
            videoBox.write(stream);
            videoDescription = new Uint8Array(stream.buffer, 8); // Remove the box header.
          }

          const audioBox = entry?.esds;
          if (!audioDescription && audioBox) {
            // 0x04 is the DecoderConfigDescrTag. Assuming MP4Box always puts this at position 0.
            assert(audioBox.esd.descs[0].tag == 0x04);
            // 0x40 is the Audio OTI, per table 5 of ISO 14496-1
            assert(audioBox.esd.descs[0].oti == 0x40);
            // 0x05 is the DecSpecificInfoTag
            assert(audioBox.esd.descs[0].descs[0].tag == 0x05);

            audioDescription = audioBox.esd.descs[0].descs[0].data;
          }
        }

        // configure decoders
        assertDefined(videoDescription, 'No video description found');
        videoDecoder.configure({ codec: videoCodec, description: videoDescription });

        if (audioDecoder) {
          assertDefined(audioDescription, 'No audio description found');
          audioDecoder.configure({
            codec: audioCodec,
            description: audioDescription,
            numberOfChannels: channel_count,
            sampleRate: sample_rate
          });
        }

        // Setup mp4box file for breaking it into chunks
        mp4boxfile.setExtractionOptions(info.videoTracks[0].id);
        videoTracks.add(info.videoTracks[0].id);

        if (audioDecoder) {
          mp4boxfile.setExtractionOptions(info.audioTracks[0].id);
          audioTracks.add(info.audioTracks[0].id);
        }

        mp4boxfile.start();
      } else {
        throw new Error('URL provided is not a valid mp4 video file.');
      }
    };

    mp4boxfile.onSamples = async (trackId, ref, samples) => {
      if (videoTracks.has(trackId)) {
        decodedFrames += samples.length;
      } else if (audioTracks.has(trackId)) {
        decodedSamples += samples.length;
      }

      for (let i = 0; i < samples.length; i += 1) {
        const sample = samples[i];

        if (videoTracks.has(trackId)) {
          const videoChunk = new EncodedVideoChunk({
            type: sample.is_sync ? 'key' : 'delta',
            timestamp: (1e6 * sample.cts) / sample.timescale, // from https://github.com/gpac/mp4box.js/issues/374
            duration: (1e6 * sample.duration) / sample.timescale,
            data: sample.data
          });

          videoDecoder.decode(videoChunk);
        } else if (audioTracks.has(trackId)) {
          assertDefined(audioDecoder, 'Audio decoder not defined');

          const audioChunk = new EncodedAudioChunk({
            type: sample.is_sync ? 'key' : 'delta',
            timestamp: (1e6 * sample.cts) / sample.timescale, // from
            duration: (1e6 * sample.duration) / sample.timescale,
            data: sample.data
          });

          audioDecoder.decode(audioChunk);
        }
      }

      if (decodedFrames === frameCount && decodedSamples === sampleCount) {
        resolve({ frameCount, sampleCount });
      }
    };

    let offset = 0;

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
  });
