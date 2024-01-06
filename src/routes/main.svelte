<script lang="ts">
	import { decode } from '$lib/decode';
	import { createEncoder } from '$lib/encode';
	import { assertDefined } from '$lib/utils';

	let files: FileList;
	let fileStream: FileSystemWritableFileStream | undefined;

	const askForFile = async () => {
		const fileHandle = await window.showSaveFilePicker({
			suggestedName: `video.mp4`,
			types: [
				{
					description: 'Video File',
					accept: { 'video/mp4': ['.mp4'] }
				}
			]
		});
		return await fileHandle.createWritable();
	};

	const askForFolder = async () => {
		const dirHandle = await window.showDirectoryPicker();
		const fileHandle = await dirHandle.getFileHandle('video.mp4', { create: true });
		return await fileHandle.createWritable();
	};

	$: if (files && files.length !== 0) {
		const stream = fileStream;
		assertDefined(stream);

		const { encoder, close } = createEncoder('mp4', stream);
		decode(files[0], encoder);

		setTimeout(async () => {
			await close();
			stream.close(); // Make sure to close the stream
		}, 5000);
	}
</script>

<button
	on:click={async () => {
		fileStream = await askForFile();
	}}
>
	File save
</button>

<button
	on:click={async () => {
		fileStream = await askForFolder();
	}}
>
	Folder save
</button>

<!-- Video input -->
<input type="file" accept="video/*" bind:files />
