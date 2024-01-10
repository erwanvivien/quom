<script lang="ts">
  import Main from './main.svelte';

  let supported = true;

  // Ensure to check for browser support for Web Codecs
  if (typeof window !== 'undefined' && (!window.VideoEncoder || !window.VideoDecoder)) {
    console.error('Web Codecs API is not supported in this browser.');
    supported = false;
  }
</script>

{#if supported}
  <Main />
{:else}
  <div class="title">
    <h1>Quom</h1>
    <div style="height: 2rem"></div>
    <p>Web Codecs API is not supported in this browser.</p>
    <p>Try in Chrome for example</p>
  </div>
{/if}

<style>
  h1 {
    font-family: Inter;
    font-size: 3rem;
  }

  .title {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;

    margin-block: 3rem;
  }
</style>
