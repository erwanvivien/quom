export type IndividualVideoConfig = {
  [K in keyof VideoEncoderConfig]: VideoEncoderConfig[K] | 'global';
};

export type IndividualAudioConfig = {
  [K in keyof AudioEncoderConfig]: AudioEncoderConfig[K] | 'global';
};

export const getDefaultVideoConfig = (): IndividualVideoConfig => ({
  codec: 'global',
  height: 'global',
  width: 'global',
  alpha: 'global',
  avc: 'global',
  bitrate: 'global',
  bitrateMode: 'global',
  displayHeight: 'global',
  displayWidth: 'global',
  framerate: 'global',
  hardwareAcceleration: 'global',
  latencyMode: 'global',
  scalabilityMode: 'global'
});

export const getDefaultAudioConfig = (): IndividualAudioConfig => ({
  codec: 'global',
  bitrate: 'global',
  numberOfChannels: 'global',
  sampleRate: 'global'
});

const globalOrValue = <T>(global: T, value: T | 'global'): T => {
  if (value === 'global') {
    return global;
  }
  return value;
};

export const completeVideoConfig = (
  config: IndividualVideoConfig,
  globalConfig: VideoEncoderConfig
): VideoEncoderConfig => {
  return {
    codec: globalOrValue(globalConfig.codec, config.codec),
    height: globalOrValue(globalConfig.height, config.height),
    width: globalOrValue(globalConfig.width, config.width),
    alpha: globalOrValue(globalConfig.alpha, config.alpha),
    avc: globalOrValue(globalConfig.avc, config.avc),
    bitrate: globalOrValue(globalConfig.bitrate, config.bitrate),
    bitrateMode: globalOrValue(globalConfig.bitrateMode, config.bitrateMode),
    displayHeight: globalOrValue(globalConfig.displayHeight, config.displayHeight),
    displayWidth: globalOrValue(globalConfig.displayWidth, config.displayWidth),
    framerate: globalOrValue(globalConfig.framerate, config.framerate),
    hardwareAcceleration: globalOrValue(
      globalConfig.hardwareAcceleration,
      config.hardwareAcceleration
    ),
    latencyMode: globalOrValue(globalConfig.latencyMode, config.latencyMode),
    scalabilityMode: globalOrValue(globalConfig.scalabilityMode, config.scalabilityMode)
  };
};

export const completeAudioConfig = (
  config: IndividualAudioConfig,
  globalConfig: AudioEncoderConfig
): AudioEncoderConfig => {
  return {
    codec: globalOrValue(globalConfig.codec, config.codec),
    bitrate: globalOrValue(globalConfig.bitrate, config.bitrate),
    numberOfChannels: globalOrValue(globalConfig.numberOfChannels, config.numberOfChannels),
    sampleRate: globalOrValue(globalConfig.sampleRate, config.sampleRate)
  };
};

export const VALID_CONTAINERS = ['mp4'] as const;
export type Container = (typeof VALID_CONTAINERS)[number];
