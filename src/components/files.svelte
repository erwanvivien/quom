<script lang="ts">
  import { browser } from '$app/environment';
  import { decodeEncode, getFileKind } from '$lib/codecs';
  import type { Kind, OutputConfig } from '$lib/codecs/types';
  import {
    completeAudioConfig,
    completeVideoConfig,
    getDefaultAudioConfig,
    getDefaultVideoConfig,
    type IndividualAudioConfig,
    type IndividualVideoConfig
  } from '$lib/config';
  import {
    assertDefined,
    classes,
    fileNameAndExtension,
    getSupportedAudioConfigs,
    getSupportedVideoConfigs
  } from '$lib/utils';
  import Progress from './progress.svelte';
  import Folder from './svgs/folder.svelte';
  import Play from './svgs/play.svelte';

  export let files: FileList;

  let directoryStream: FileSystemDirectoryHandle | undefined;
  let decodingState: 'decoding' | 'done' | 'ready' = 'ready';

  let globalVideoConfig: VideoEncoderConfig | undefined;
  let globalAudioConfig: AudioEncoderConfig | undefined;

  let filesConfigs: {
    progress: number;
    fileType: Kind | undefined;
    videoConfig: IndividualVideoConfig;
    audioConfig: IndividualAudioConfig;
    file: File;
  }[] = [];

  if (browser) {
    // Inits the first config
    getSupportedVideoConfigs().then((configs) => (globalVideoConfig = configs[0]));
    getSupportedAudioConfigs().then((configs) => (globalAudioConfig = configs[0]));
  }

  const askForFolder = async (): Promise<void> => {
    const tmpFolder = await window.showDirectoryPicker({ id: 'quom' });
    try {
      const FILE_NAME = '__quom_non_existing_file__.tmp';
      await tmpFolder.getFileHandle(FILE_NAME, { create: true });
      await tmpFolder.removeEntry(FILE_NAME);
      directoryStream = tmpFolder;
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
        encoderVideo: completeVideoConfig(filesConfigs[index].videoConfig, globalVideoConfig),
        encoderAudio: completeAudioConfig(filesConfigs[index].audioConfig, globalAudioConfig)
      };

      await decodeEncode(file, config, callback);
    } catch (e) {
      console.error(e);
    } finally {
      fileStream.close();
    }
  };

  $: {
    const promises = Array(files.length)
      .fill(undefined)
      .map(async (_, index) => ({
        progress: 0,
        audioConfig: getDefaultAudioConfig(),
        videoConfig: getDefaultVideoConfig(),
        fileType: await getFileKind(files[index]),
        file: files[index]
      }));

    Promise.all(promises).then((configs) => (filesConfigs = configs));
  }

  const start = async () => {
    if (!directoryStream || decodingState !== 'ready') {
      return;
    }

    decodingState = 'decoding';

    for (let i = 0; i < files.length; i++) {
      console.log(filesConfigs[i].fileType);
      if (!filesConfigs[i].fileType) {
        continue;
      }

      const index = i;
      console.log(filesConfigs[index].file.name);
      const callback = (progress: number) => (filesConfigs[index].progress = progress);
      await decodeOne(filesConfigs[i].file, index, callback);
    }

    decodingState = 'done';
    console.info('Done all files');
  };
</script>

<div class="progress-container">
  <div class="buttons">
    <button class="button" on:click={askForFolder}>
      <p>Select save folder</p>
      <Folder />
    </button>
    <button class={classes('button', !directoryStream && 'inactive-button')} on:click={start}>
      <p>Start</p>
      <Play />
    </button>
  </div>

  {#if directoryStream}
    <p class="done">
      All files {decodingState === 'done' ? 'are' : 'will'} be saved to
      <b>{directoryStream.name}</b> folder
    </p>
  {/if}
  {#each filesConfigs as config, index (config.file.name + index)}
    <Progress
      fileName={config.file.name}
      progress={config.progress}
      status={config.fileType === undefined ? 'invalid' : 'valid'}
    />
  {/each}
</div>

<style>
  .progress-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;

    gap: 16px;

    margin-block: 3rem;
  }

  .buttons {
    display: flex;
    gap: 16px;
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

  .inactive-button {
    box-shadow:
      rgb(50, 50, 50, 0.1) 3px 3px 6px 0px inset,
      rgba(0, 0, 0, 0.1) -3px -3px 6px 1px inset;
    cursor: not-allowed;
  }

  .done {
    font-family: Inter;
    font-size: 1.2rem;
  }
</style>
