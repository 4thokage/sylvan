import { sentryHandle, initCloudflareSentryHandle } from '@sentry/sveltekit';
import * as Sentry from '@sentry/sveltekit';
import { sequence } from '@sveltejs/kit/hooks';
import { withClerkHandler } from 'svelte-clerk/server';
import type { Handle } from '@sveltejs/kit';
import { createAuthSupabase, runWithSupabase } from '$lib/server/supabase';

const clerkHandler = withClerkHandler();

const clerkHandle: Handle = ({ event, resolve }) =>
	clerkHandler({
		event,
		resolve: async (ev) => {
			const auth = ev.locals.auth();
			const token = auth.userId ? await auth.getToken() : null;
			const supabase = createAuthSupabase(token);

			return runWithSupabase(supabase, () => resolve(ev));
		}
	});

export const handle = sequence(
	initCloudflareSentryHandle({
		dsn: 'https://7bcbba23e8ce3576c291fbb6dfa90227@o4508495923511296.ingest.de.sentry.io/4511888293232720',
		tracesSampleRate: 1.0,
		enableLogs: true
	}),
	sentryHandle(),
	clerkHandle
);

const myErrorHandler = ({ error, event }: { error: unknown; event: unknown }) => {
	console.error('An error occurred on the server side:', error, event);
};

export const handleError = Sentry.handleErrorWithSentry(myErrorHandler);
