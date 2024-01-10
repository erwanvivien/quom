// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// declare module 'mp4box' {
//   type MP4MediaTrack = {
//     alternate_group: number;
//     bitrate: number;
//     codec: string;
//     created: Date;
//     duration: number;
//     id: number;
//     language: string;
//     layer: number;
//     modified: Date;
//     movie_duration: number;
//     nb_samples: number;
//     timescale: number;
//     track_height: number;
//     track_width: number;
//     volume: number;
//   };

//   type MP4VideoData = {
//     height: number;
//     width: number;
//   };

//   type MP4VideoTrack = MP4MediaTrack & {
//     video: MP4VideoData;
//   };

//   type MP4AudioData = {
//     channel_count: number;
//     sample_rate: number;
//     sample_size: number;
//   };

//   type MP4AudioTrack = MP4MediaTrack & {
//     audio: MP4AudioData;
//   };

//   type MP4Track = MP4VideoTrack | MP4AudioTrack;

//   type MP4Info = {
//     brands: Array<string>;
//     created: Date;
//     duration: number;
//     fragment_duration: number;
//     hasIOD: boolean;
//     isFragmented: boolean;
//     isProgressive: boolean;
//     mime: string;
//     modified: Date;
//     timescale: number;
//     tracks: Array<MP4Track>;
//   };

//   export type MP4ArrayBuffer = ArrayBuffer & { fileStart: number };

//   export type MP4File = {
//     appendBuffer(data: MP4ArrayBuffer): number;
//     flush(): void;
//     onError?: (e: string) => void;
//     onReady?: (info: MP4Info) => void;
//   };

//   export function createFile(): MP4File;
// }

declare module 'mp4box' {
  export interface MP4MediaTrack {
    id: number;
    created: Date;
    modified: Date;
    movie_duration: number;
    movie_timescale: number;
    layer: number;
    alternate_group: number;
    volume: number;
    track_width: number;
    track_height: number;
    timescale: number;
    duration: number;
    bitrate: number;
    codec: string;
    language: string;
    nb_samples: number;
  }

  export interface MP4VideoData {
    width: number;
    height: number;
  }

  export interface MP4VideoTrack extends MP4MediaTrack {
    video: MP4VideoData;
  }

  export interface MP4AudioData {
    sample_rate: number;
    channel_count: number;
    sample_size: number;
  }

  export interface MP4AudioTrack extends MP4MediaTrack {
    audio: MP4AudioData;
  }

  export type MP4Track = MP4VideoTrack | MP4AudioTrack;

  export interface MP4Info {
    duration: number;
    timescale: number;
    fragment_duration: number;
    isFragmented: boolean;
    isProgressive: boolean;
    hasIOD: boolean;
    brands: string[];
    created: Date;
    modified: Date;
    tracks: MP4Track[];
    audioTracks: MP4AudioTrack[];
    videoTracks: MP4VideoTrack[];
  }

  export interface MP4Sample {
    alreadyRead: number;
    chunk_index: number;
    chunk_run_index: number;
    cts: number;
    data: Uint8Array;
    degradation_priority: number;
    depends_on: number;
    description: unknown;
    description_index: number;
    dts: number;
    duration: number;
    has_redundancy: number;
    is_depended_on: number;
    is_leading: number;
    is_sync: boolean;
    number: number;
    offset: number;
    size: number;
    timescale: number;
    track_id: number;
  }

  export type MP4ArrayBuffer = ArrayBuffer & { fileStart: number };

  export class DataStream {
    static BIG_ENDIAN: boolean;
    static LITTLE_ENDIAN: boolean;
    buffer: ArrayBuffer;
    constructor(arrayBuffer?: ArrayBuffer, byteOffset: number, endianness: boolean): void;
    // TODO: Complete interface
  }

  export interface AvcC {
    configurationVersion: number;
    AVCProfileIndication: number;
    profile_compatibility: number;
    AVCLevelIndication: number;
    lengthSizeMinusOne: number;
    sps: Uint8Array[];
    pps: Uint8Array[];

    nb_SPS_nalus: number;
    SPS: {
      length: number;
      nalu: Uint8Array;
    }[];
  }

  export type Entry = {
    // Video
    avcC?: {
      write: (stream: DataStream) => void;
    };
    hvcC?: {
      write: (stream: DataStream) => void;
    };
    vpcC?: {
      write: (stream: DataStream) => void;
    };
    av1C?: {
      write: (stream: DataStream) => void;
    };

    // Audio
    esds?: {
      esd: {
        tag: number;
        oti: number;
        descs: {
          tag: number;
          oti: number;
          descs: {
            tag: number;
            data: Uint8Array;
            size: number;
          }[];
        }[];
      };
    };
  };

  export type Entry = {
    avcC?: {
      write: (stream: DataStream) => void;
    };
    hvcC?: {
      write: (stream: DataStream) => void;
    };
    vpcC?: {
      write: (stream: DataStream) => void;
    };
    av1C?: {
      write: (stream: DataStream) => void;
    };
  };

  export interface Trak {
    mdia?: {
      minf?: {
        stbl?: {
          stsd?: {
            entries: Entry[];
          };
        };
      };
    };
    // TODO: Complete interface
  }

  export interface MP4File {
    onMoovStart?: () => void;
    onReady?: (info: MP4Info) => void;
    onError?: (e: string) => void;
    onSamples?: (id: number, user: unknown, samples: MP4Sample[]) => unknown;
    moov: {
      traks: Trak[];
    };

    appendBuffer(data: MP4ArrayBuffer): number;
    start(): void;
    stop(): void;
    flush(): void;
    releaseUsedSamples(trackId: number, sampleNumber: number): void;
    setExtractionOptions(
      trackId: number,
      user?: unknown,
      options?: { nbSamples?: number; rapAlignment?: number }
    ): void;
    getTrackById(trackId: number): Trak;
  }

  export function createFile(): MP4File;

  export {};
}
