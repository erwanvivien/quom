<script lang="ts">
  import Files from '../components/files.svelte';
  import MainScreen from '../components/main_screen.svelte';
  import WhyQuom from '../components/why_quom.svelte';

  let files: FileList;
</script>

<div class="title">
  <h1>Quom</h1>
</div>

{#if files && files.length !== 0}
  <Files {files} />
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
</style>
