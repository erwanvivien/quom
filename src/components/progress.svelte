<script lang="ts">
  export let fileName: string;
  export let progress: number;
</script>

<div class="progressbar" style="">
  <p style="text-overflow: ellipsis; overflow: hidden;">{fileName}</p>
  <div style="flex: 1" />
  <p>{Math.round(progress * 100)}%</p>
</div>

<style>
  .progressbar {
    display: flex;
    align-items: center;

    padding-inline: 3rem;

    min-width: 300px;
    width: 70%;
    max-width: 600px;
    height: 3rem;

    background-color: #89a1ff;
    border-radius: 1.5rem;

    font-family: 'Courier New', Courier, monospace;
    font-size: large;
  }
</style>
