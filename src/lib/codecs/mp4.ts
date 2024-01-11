import { assert, assertDefined } from '$lib/utils';
import { FileSystemWritableFileStreamTarget, Muxer as Mp4Muxer } from 'mp4-muxer';
import * as MP4Box from 'mp4box';
import type { Demuxer, InputConfig, Muxer, OutputConfig, SharedQueue } from './types';

const audioConfigFromPartial = (
  audioConfig: Partial<NonNullable<InputConfig['audio']>>
): InputConfig['audio'] | undefined => {
  const { bitrate, codec, numberOfChannels, sampleCount, sampleRate, tracks, description } =
    audioConfig;
  if (codec && numberOfChannels && sampleRate && bitrate && sampleCount && tracks) {
    return { codec, numberOfChannels, sampleRate, bitrate, sampleCount, tracks, description };
  }

  return undefined;
};

export const extractConfig = (file: File) =>
  new Promise<InputConfig>((resolve) => {
    const mp4boxfile = MP4Box.createFile();
    const reader = file.stream().getReader();

    let ready = false;

    mp4boxfile.onReady = (info) => {
      ready = true;

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

      const videoTracks = new Set<number>();
      const audioTracks = new Set<number>();

      if (info.videoTracks.length >= 1) {
        videoTracks.add(info.videoTracks[0].id);
      }
      if (info.audioTracks.length >= 1) {
        audioTracks.add(info.audioTracks[0].id);
      }

      assertDefined(videoDescription, 'No video description found');
      assertDefined(audioDescription, 'No audio description found');

      const {
        track_height: height,
        track_width: width,
        bitrate: videoBitrate
      } = info.videoTracks[0];
      const frameCount = info.videoTracks[0].nb_samples;
      const videoCodec = info.videoTracks?.[0]?.codec;

      const videoConfig: InputConfig['video'] = {
        codec: videoCodec,
        codedHeight: height,
        codedWidth: width,
        frameCount: frameCount - 1,
        bitrate: videoBitrate,
        description: videoDescription,
        tracks: videoTracks
      };

      const audioConfig: InputConfig['audio'] = audioConfigFromPartial({
        codec: info.audioTracks?.[0]?.codec,
        numberOfChannels: info.audioTracks?.[0]?.audio?.channel_count,
        sampleRate: info.audioTracks?.[0]?.audio?.sample_rate,
        bitrate: info.audioTracks?.[0]?.bitrate,
        sampleCount: info.audioTracks?.[0]?.nb_samples,
        description: audioDescription,
        tracks: audioTracks
      });

      resolve({
        kind: 'mp4',
        video: videoConfig,
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

export const createMp4Muxer = (outputConfig: OutputConfig): Muxer => {
  const mp4muxer = new Mp4Muxer({
    target: new FileSystemWritableFileStreamTarget(outputConfig.fileStream),
    video: outputConfig.video,
    audio: outputConfig.audio,
    fastStart: false
  });

  let videoFirstTimeStamp: number | undefined = undefined;
  let audioFirstTimeStamp: number | undefined = undefined;

  return {
    addVideoChunk: (chunk, meta) => {
      if (videoFirstTimeStamp === undefined) {
        videoFirstTimeStamp = chunk.timestamp;
      }

      mp4muxer.addVideoChunk(chunk, meta, chunk.timestamp - videoFirstTimeStamp);
    },
    addAudioChunk: (chunk, meta) => {
      if (audioFirstTimeStamp === undefined) {
        audioFirstTimeStamp = chunk.timestamp;
      }

      mp4muxer.addAudioChunk(chunk, meta, chunk.timestamp - audioFirstTimeStamp);
    },
    finalize: () => mp4muxer.finalize()
  };
};

type VideoDecoderConfig = {
  videoDecoder: VideoDecoder;
  tracks: Set<number>;
  frameCount: number;
};

type AudioDecoderConfig = {
  audioDecoder?: AudioDecoder;
  tracks: Set<number>;
  sampleCount: number;
};

const maxRetries = 200;

export const createMp4Demuxer = (
  videoConfig: VideoDecoderConfig,
  audioConfig: AudioDecoderConfig,
  sharedQueue: SharedQueue
): Demuxer => {
  // Uses mp4box for demuxing
  const mp4boxfile = MP4Box.createFile();

  sharedQueue.video.decoded = -1; // I don't know why there is an off-by-one error

  const { videoDecoder, tracks: videoTracks } = videoConfig;
  const { audioDecoder, tracks: audioTracks } = audioConfig;

  mp4boxfile.onReady = () => {
    for (const track of videoTracks) {
      mp4boxfile.setExtractionOptions(track);
    }

    for (const track of audioTracks) {
      mp4boxfile.setExtractionOptions(track);
    }

    mp4boxfile.start();
  };

  mp4boxfile.onSamples = async (trackId, _ref, samples) => {
    for (let i = 0; i < samples.length; i += 1) {
      const sample = samples[i];

      if (videoTracks.has(trackId)) {
        const videoChunk = new EncodedVideoChunk({
          type: sample.is_sync ? 'key' : 'delta',
          timestamp: (1e6 * sample.cts) / sample.timescale, // from https://github.com/gpac/mp4box.js/issues/374
          duration: (1e6 * sample.duration) / sample.timescale,
          data: sample.data
        });

        let i = 0;
        const shared = sharedQueue.video;
        for (i = 0; i < maxRetries && shared.encoded - shared.decoded > 10; i++) {
          await new Promise((resolve) => setTimeout(resolve, 10));
        }

        if (i === maxRetries) {
          throw new Error('Max retries reached');
        }

        sharedQueue.video.decoded += 1;
        videoDecoder.decode(videoChunk);
      } else if (audioTracks.has(trackId)) {
        assertDefined(audioDecoder, 'Audio decoder not defined');

        const audioChunk = new EncodedAudioChunk({
          type: sample.is_sync ? 'key' : 'delta',
          timestamp: (1e6 * sample.cts) / sample.timescale, // from
          duration: (1e6 * sample.duration) / sample.timescale,
          data: sample.data
        });

        let i = 0;
        const shared = sharedQueue.audio;
        for (i = 0; i < maxRetries && shared.encoded - shared.decoded > 10; i++) {
          await new Promise((resolve) => setTimeout(resolve, 10));
        }

        if (i === maxRetries) {
          throw new Error('Max retries reached');
        }

        console.log('decoded audio chunk');
        sharedQueue.audio.decoded += 1;
        audioDecoder.decode(audioChunk);
      }
    }
  };

  const decode = async (file: File) => {
    // const wholeFile = (await file.arrayBuffer()) as MP4Box.MP4ArrayBuffer;
    // wholeFile.fileStart = 0;
    // mp4boxfile.appendBuffer(wholeFile);

    // ==========================

    const reader = file.stream().getReader();

    let offset = 0;
    const maxReads = 1e9;
    for (let i = 0; i < maxReads; i++) {
      const { done, value } = await reader.read();
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
    }

    throw new Error('Max reads reached');

    // ==========================

    // const reader = file.stream().getReader();
    // let offset = 0;

    // function appendBuffers({ done, value }: ReadableStreamReadResult<Uint8Array>) {
    //   if (done) {
    //     mp4boxfile.flush();
    //     return;
    //   }

    //   // We need to cast the value to MP4ArrayBuffer and we then add the fileStart property to it
    //   // Otherwise, we lose the ArrayBuffer type
    //   const buf = value.buffer as MP4Box.MP4ArrayBuffer;
    //   buf.fileStart = offset;
    //   offset = mp4boxfile.appendBuffer(buf);

    //   reader.read().then(appendBuffers);
    // }

    // reader.read().then(appendBuffers);
  };

  return { decode };
};
