<script lang="ts">
  import type { Container } from '$lib/config';
  import Config from '../components/config.svelte';
  import Files from '../components/files.svelte';
  import MainScreen from '../components/main_screen.svelte';
  import WhyQuom from '../components/why_quom.svelte';

  let files: FileList;
  let container: Container = 'mp4';
  let globalVideoConfig: VideoEncoderConfig;
  let globalAudioConfig: AudioEncoderConfig;
</script>

<div class="title">
  <h1>Quom</h1>
</div>

{#if files && files.length !== 0}
  <div class="container">
    <Files {files} {globalVideoConfig} {globalAudioConfig} />
    <Config bind:globalVideoConfig bind:globalAudioConfig />
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

  .title {
    display: flex;
    justify-content: center;

    margin-block: 2rem 1rem;
  }

  .container {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;

    gap: 3rem;
  }
</style>
