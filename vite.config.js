import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.js',
				test: {
					name: 'lib',
					environment: 'happy-dom',
					include: ['src/**/*.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
