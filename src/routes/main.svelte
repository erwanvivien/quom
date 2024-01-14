<script lang="ts">
  import { browser } from '$app/environment';
  import { decodeEncode } from '$lib/codecs';
  import { type OutputConfig } from '$lib/codecs/types';
  import {
    assertDefined,
    fileNameAndExtension,
    getSupportedVideoConfigs,
    getSupportedAudioConfigs
  } from '$lib/utils';
  import MainScreen from '../components/main_screen.svelte';
  import Progress from '../components/progress.svelte';
  import WhyQuom from '../components/why_quom.svelte';
  import Folder from '../components/svgs/folder.svelte';
  import {
    completeVideoConfig,
    completeAudioConfig,
    getDefaultVideoConfig,
    getDefaultAudioConfig,
    type IndividualAudioConfig,
    type IndividualVideoConfig
  } from '$lib/config';

  let files: FileList;
  let statuses: number[];
  let videoConfigs: IndividualVideoConfig[];
  let audioConfigs: IndividualAudioConfig[];
  let directoryStream: FileSystemDirectoryHandle | undefined;

  let globalVideoConfig: VideoEncoderConfig | undefined;
  let globalAudioConfig: AudioEncoderConfig | undefined;

  if (browser) {
    // Inits the first config
    getSupportedVideoConfigs().then((configs) => (globalVideoConfig = configs[0]));
    getSupportedAudioConfigs().then((configs) => (globalAudioConfig = configs[0]));
  }

  const askForFolder = async (): Promise<void> => {
    directoryStream = await window.showDirectoryPicker({ id: 'quom' });
    try {
      const FILE_NAME = '__quom_non_existing_file__.tmp';
      await directoryStream.getFileHandle(FILE_NAME, { create: true });
      await directoryStream.removeEntry(FILE_NAME);
    } catch (e) {
      directoryStream = undefined;
      throw e;
    }
  };

  const decodeOne = async (file: File, index: number, callback: (progress: number) => void) => {
    const directoryHandle = directoryStream;
    assertDefined(directoryHandle);

    const [fileName, ext] = fileNameAndExtension(file);

    const fileHandle = await directoryHandle.getFileHandle(`${fileName}_quom.${ext}`, {
      create: true
    });
    const fileStream = await fileHandle.createWritable();

    assertDefined(globalVideoConfig);
    assertDefined(globalAudioConfig);

    try {
      const config: OutputConfig = {
        kind: 'mp4',
        fileStream,
        encoderVideo: completeVideoConfig(videoConfigs[index], globalVideoConfig),
        encoderAudio: completeAudioConfig(audioConfigs[index], globalAudioConfig)
      };

      await decodeEncode(file, config, callback);
    } catch (e) {
      console.error(e);
    } finally {
      fileStream.close();
    }
  };

  $: if (files && files.length !== 0) {
    statuses = Array(files.length).fill(0);
    videoConfigs = Array(files.length)
      .fill(undefined)
      .map(() => getDefaultVideoConfig());
    audioConfigs = Array(files.length)
      .fill(undefined)
      .map(() => getDefaultAudioConfig());
  }

  $: if (files && files.length !== 0 && directoryStream) {
    let promise = Promise.resolve();
    for (let i = 0; i < files.length; i++) {
      const index = i;
      const callback = (progress: number) => {
        statuses[index] = progress;
      };
      promise = promise.then(() => decodeOne(files[i], i, callback));
    }

    promise.then(() => {
      console.info('Done all files');
    });
  }
</script>

<div class="title">
  <h1>Quom</h1>
</div>

{#if files && files.length !== 0}
  <div class="progress-container">
    {#if !directoryStream}
      <button class="button" on:click={askForFolder}>
        <p>Select save folder</p>
        <Folder />
      </button>
    {:else}
      {#each files as file, index}
        <Progress fileName={file.name} progress={statuses[index]} />
      {/each}
    {/if}
  </div>
{:else}
  <MainScreen bind:files />
{/if}

<WhyQuom />

<style>
  h1 {
    font-family: Inter;
    font-size: 3rem;
  }

  .progress-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;

    gap: 16px;

    margin-block: 3rem;
  }

  .button {
    display: flex;
    flex-direction: row;

    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 15px 32px;

    background-color: #d4d3ff;
    box-shadow: rgba(0, 0, 0, 0.16) 0px 1px 4px;

    border: none;
    border-radius: 16px;

    font-family: Inter;
    font-size: 16px;

    color: white;
    cursor: pointer;
  }

  .title {
    display: flex;
    justify-content: center;

    margin-block: 3rem;
  }
</style>
