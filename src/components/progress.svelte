<script lang="ts">
  export let fileName: string;
  export let progress: number | Error;

  import Information from './svgs/information.svelte';
</script>

<div class="progressbar" style="">
  <p style="text-overflow: ellipsis; overflow: hidden; text-wrap: nowrap;">{fileName}</p>
  <div style="flex: 1" />
  {#if typeof progress === 'number'}
    <p>{Math.round(progress * 100)}%</p>
  {:else if progress instanceof Error}
    <div class="tooltip">
      Error <Information class="svg" />

      <span class="tooltip-text">
        {progress.message}
      </span>
    </div>
  {/if}
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

    font-family: 'Inter';
    font-size: large;

    gap: 4px;
  }

  .tooltip {
    display: flex;
    gap: 8px;
    align-items: center;

    position: relative;
  }

  .tooltip .tooltip-text {
    visibility: hidden;
    max-width: 480px;
    width: max-content;
    background-color: #d4d3ff;
    border: 1px solid #00000040;
    text-align: center;
    border-radius: 6px;
    padding: 5px;

    position: absolute;
    z-index: 1;

    bottom: 2rem;
    transform: translateX(-50%);
    left: 50%;
  }

  .tooltip:hover .tooltip-text {
    visibility: visible;
  }

  :global(.svg) {
    width: 1.5rem;
    height: 1.5rem;
  }
</style>
