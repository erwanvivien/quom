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

    background-color: #d4d3ff;
    box-shadow: rgba(0, 0, 0, 0.16) 0px 1px 4px;
    border-radius: 8px;

    font-family: 'Courier New', Courier, monospace;
    font-size: large;
  }
</style>
