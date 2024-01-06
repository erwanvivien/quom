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
	<p>Web Codecs API is not supported in this browser.</p>
{/if}
