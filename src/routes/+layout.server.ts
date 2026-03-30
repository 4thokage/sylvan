import { buildClerkProps } from 'svelte-clerk/server';

export const load = async ({ locals }) => {
	return {
		...buildClerkProps(await locals.auth())
	};
};
