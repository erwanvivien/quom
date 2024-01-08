<script lang="ts">
	import { decode, getMetadata } from '$lib/decode';
	import { createEncoder } from '$lib/encode';
	import { assertDefined, fileNameAndExtension, getSupportedVideoConfigs } from '$lib/utils';
	import MainScreen from '../components/main_screen.svelte';
	import Progress from '../components/progress.svelte';
	import Folder from '../components/svgs/folder.svelte';

	let files: FileList;
	let statuses: number[];
	let directoryStream: FileSystemDirectoryHandle | undefined;

	let config: VideoEncoderConfig | undefined;

	if (typeof window !== 'undefined') {
		// Inits the first config
		getSupportedVideoConfigs().then((configs) => (config = configs[0]));
	}

	const askForFolder = async (): Promise<void> => {
		directoryStream = await window.showDirectoryPicker({ id: 'quom' });
	};

	const decodeOne = async (file: File, callback: (progress: number) => void) => {
		const directoryHandle = directoryStream;
		assertDefined(directoryHandle);
		assertDefined(config);

		const [fileName, ext] = fileNameAndExtension(file);

		const fileHandle = await directoryHandle.getFileHandle(`${fileName}_quom.${ext}`, {
			create: true
		});
		const fileStream = await fileHandle.createWritable();

		try {
			const metadata = await getMetadata(file);
			const Encoder = createEncoder(metadata, config, fileStream, callback);

			await decode(metadata.kind, file, Encoder.videoEncoder, Encoder.audioEncoder);
			await Encoder.close();

			console.log('Done', file.name);
		} catch (e) {
			console.error(e);
		} finally {
			fileStream.close();
		}
	};

	$: if (files && files.length !== 0) {
		statuses = Array(files.length).fill(0);
	}

	$: if (files && files.length !== 0 && directoryStream) {
		let promise = Promise.resolve();
		for (let i = 0; i < files.length; i++) {
			const index = i;
			const callback = (progress: number) => {
				statuses[index] = progress;
			};
			promise = promise.then(() => decodeOne(files[i], callback));
		}

		promise.then(() => {
			console.log('Done all files');
		});
	}
</script>

<div class="title">
	<h1>Quom</h1>
</div>

{#if files && files.length !== 0}
	<div class="progress-container">
		{#if !directoryStream}
			<button class="button" on:click={askForFolder}>
				<p>Select save folder</p>
				<Folder />
			</button>
		{/if}

		{#each files as file, index}
			<Progress fileName={file.name} progress={statuses[index]} />
		{/each}
	</div>
{:else}
	<MainScreen bind:files />
{/if}

<style>
	h1 {
		font-family: Inter;
		font-size: 3rem;
	}

	.progress-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;

		gap: 16px;

		margin-block: 3rem;
	}

	.button {
		display: flex;
		flex-direction: row;

		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 15px 32px;

		background-color: #04aa6d; /* Green */
		border: none;

		font-family: Inter;
		font-size: 16px;

		color: white;
		cursor: pointer;
	}

	.title {
		display: flex;
		justify-content: center;

		margin-block: 3rem;
	}
</style>
