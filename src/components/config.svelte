<script lang="ts">
  import { type Container, VALID_CONTAINERS } from '$lib/config';
  import {
    AudioCodecs,
    VideoCodecs,
    classes,
    getSupportedAudioConfigs,
    getSupportedVideoConfigs
  } from '$lib/utils';

  let panel: 'video' | 'audio' = 'video';

  const DEFAULT_VIDEO_CONFIG: VideoEncoderConfig = {
    codec: 'avc1.4d0034',
    hardwareAcceleration: 'prefer-hardware',
    width: 1920,
    height: 1080,
    avc: { format: 'annexb' }
  };

  const DEFAULT_AUDIO_CONFIG: AudioEncoderConfig = {
    codec: 'opus',
    bitrate: 128000,
    numberOfChannels: 2,
    sampleRate: 48000
  };

  let videoConfigs: VideoEncoderConfig[] = [DEFAULT_VIDEO_CONFIG];
  let audioConfigs: AudioEncoderConfig[] = [DEFAULT_AUDIO_CONFIG];

  export let container: Container = 'mp4';
  export let globalVideoConfig: VideoEncoderConfig = DEFAULT_VIDEO_CONFIG;
  export let globalAudioConfig: AudioEncoderConfig = DEFAULT_AUDIO_CONFIG;

  $: {
    getSupportedVideoConfigs().then((configs) => {
      videoConfigs = configs;
      const allCodecs = configs.map((config) => config.codec);
      if (!allCodecs.includes(globalVideoConfig.codec)) {
        globalVideoConfig = configs[0];
      }
    });
    getSupportedAudioConfigs().then((configs) => {
      audioConfigs = configs;
      const allCodecs = configs.map((config) => config.codec);
      if (!allCodecs.includes(globalAudioConfig.codec)) {
        globalAudioConfig = configs[0];
      }
    });
  }
</script>

<div class="container">
  <h2>Export parameters</h2>

  <h3>Container</h3>

  <div>
    <select bind:value={container}>
      {#each VALID_CONTAINERS as container}
        <option value={container}>{container}</option>
      {/each}
    </select>
  </div>

  <div class="dimension-container">
    <input type="number" bind:value={globalVideoConfig.width} />
    <span> × </span>
    <input type="number" bind:value={globalVideoConfig.height} />
  </div>

  <div>
    <button class={classes(panel === 'video' && 'active')} on:click={() => (panel = 'video')}>
      Video
    </button>
    <button class={classes(panel === 'audio' && 'active')} on:click={() => (panel = 'audio')}>
      Audio
    </button>
  </div>

  {#if panel === 'video'}
    <div>
      <select bind:value={globalVideoConfig.codec}>
        {#each videoConfigs ?? [] as config}
          <option value={config.codec}>{VideoCodecs[config.codec].description}</option>
        {/each}
      </select>
    </div>
  {:else}
    <div>
      <select bind:value={globalAudioConfig.codec}>
        {#each audioConfigs ?? [] as config}
          <option value={config.codec}>{AudioCodecs[config.codec].description}</option>
        {/each}
      </select>
    </div>
  {/if}
</div>

<style>
  .container {
    display: flex;
    flex-direction: column;
    justify-content: center;

    width: 300px;
    gap: 12px;
  }

  button {
    color: #02020230;
    background: none;
    border: none;
    outline: none;
    cursor: pointer;

    font-size: 1em;
  }

  .active {
    color: #000;
    font-weight: bold;
  }

  .dimension-container {
    display: flex;
    gap: 8px;

    align-items: center;
  }

  select,
  input {
    width: 100%;
    padding: 8px 16px;

    border: none;
    border-radius: 8px;

    background-color: #d4d3ff;
    box-shadow: rgba(0, 0, 0, 0.16) 0px 1px 4px;

    font-family: Inter;
    font-size: 16px;
  }
</style>
