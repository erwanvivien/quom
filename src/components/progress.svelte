<script lang="ts">
  export let fileName: string;
  export let progress: number;
  export let valid: boolean;

  import { fileNameAndExtension } from '$lib/utils';

  import Check from '../components/svgs/check.svelte';
  import Cross from '../components/svgs/cross.svelte';
</script>

<div class="progressbar" style="">
  <div class="tooltip">
    {#if valid}
      <Check class="svg" />
    {:else}
      <Cross class="svg" />
    {/if}

    {#if !valid}
      <span class="tooltip-text">
        Invalid file format {fileNameAndExtension(new File([''], fileName))[1]}
      </span>
    {/if}
  </div>

  <p style="text-overflow: ellipsis; overflow: hidden; text-wrap: nowrap;">{fileName}</p>
  <div style="flex: 1" />
  <p>{Math.round(progress * 100)}%</p>
</div>

<style>
  .progressbar {
    display: flex;
    align-items: center;

    padding-inline: 1rem;

    min-width: 300px;
    width: 70%;
    max-width: 600px;
    height: 3rem;

    background-color: #d4d3ff;
    box-shadow: rgba(0, 0, 0, 0.16) 0px 1px 4px;
    border-radius: 8px;

    font-family: 'Courier New', Courier, monospace;
    font-size: large;

    gap: 4px;
  }

  .tooltip {
    position: relative;
  }

  .tooltip .tooltip-text {
    visibility: hidden;
    width: 240px;
    background-color: #d4d3ff;
    border: 1px solid #00000040;
    text-align: center;
    border-radius: 6px;
    padding: 5px;

    position: absolute;
    z-index: 1;
    top: -200%;
    left: 50%;
    margin-left: -120px;
  }

  .tooltip:hover .tooltip-text {
    visibility: visible;
  }

  :global(.svg) {
    width: 1.5rem;
    height: 1.5rem;
  }
</style>
