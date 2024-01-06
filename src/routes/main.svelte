<script lang="ts">
	import { decode } from '$lib/decode';
	import { createEncoder } from '$lib/encode';
	import { assertDefined, fileNameAndExtension } from '$lib/utils';

	let files: FileList;
	let statuses: number[];
	let directoryStream: FileSystemDirectoryHandle | undefined;

	const askForFolder = async (): Promise<FileSystemDirectoryHandle> => {
		return await window.showDirectoryPicker({ id: 'quom' });
	};

	const decodeOne = async (file: File, callback: (progress: number) => void) => {
		const directoryHandle = directoryStream;
		assertDefined(directoryHandle);

		const [fileName, ext] = fileNameAndExtension(file);

		const fileHandle = await directoryHandle.getFileHandle(`${fileName}_quom.${ext}`, {
			create: true
		});
		const fileStream = await fileHandle.createWritable();

		const Encoder = createEncoder('mp4', fileStream, callback);

		const { frameCount, audioCount } = await decode(
			'mp4',
			file,
			Encoder.videoEncoder,
			Encoder.audioEncoder
		);

		Encoder.setDecodedFrameCount(frameCount);
		Encoder.setDecodedAudioCount(audioCount);
		await Encoder.close();
		fileStream.close(); // Make sure to close the stream

		console.log('Done', file.name);
	};

	$: if (files && files.length !== 0) {
		statuses = Array(files.length).fill(0);

		let promise = Promise.resolve();
		for (let i = 0; i < files.length; i++) {
			const index = i;
			const callback = (progress: number) => {
				statuses[index] = progress;
			};
			promise = promise.then(() => decodeOne(files[i], callback));
		}

		promise.then(() => {
			console.log('Done');
		});
	}
</script>

<button
	on:click={async () => {
		directoryStream = await askForFolder();
	}}
>
	Folder save
</button>

<!-- Video input -->
<input type="file" accept="video/*" bind:files multiple />

{#each files ?? [] as f, index}
	<p>{f.name} {Math.round(statuses[index] * 100)}%</p>
{/each}
