<script lang="ts">
  export let files: FileList;

  let divElement: HTMLDivElement;
  // export let dirHandle: FileSystemDirectoryHandle;

  let dragInside = false;
  let mouseInside = false;
</script>

<div
  bind:this={divElement}
  class="container"
  style={dragInside ? 'border-color: #aaa; background-color: #fafbff' : ''}
  on:dragenter={() => (dragInside = true)}
  on:dragover={() => (dragInside = true)}
  on:dragleave={() => (dragInside = false)}
  on:mouseenter={() => (mouseInside = true)}
  on:mouseleave={() => (mouseInside = false)}
  role="region"
>
  <h2>
    Drag and drop video files here,<br /> or <span>Browse</span>
  </h2>

  <!-- Video input -->
  <input
    style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; z-index: 100"
    type="file"
    accept="video/*"
    bind:files
    multiple
  />
</div>

<style lang="css">
  .container {
    display: flex;
    position: relative;

    height: 200px;
    max-width: 520px;

    margin: auto;

    flex-direction: column;
    align-items: center;
    justify-content: center;

    border: 6px dashed #ebf3ff;
    border-radius: 2rem;

    text-align: center;
    z-index: 10;

    cursor: pointer;
  }

  h2 {
    font-family: Inter;
  }
</style>
