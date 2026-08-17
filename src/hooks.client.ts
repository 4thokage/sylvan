import * as Sentry from '@sentry/sveltekit';

Sentry.init({
	dsn: 'https://7bcbba23e8ce3576c291fbb6dfa90227@o4508495923511296.ingest.de.sentry.io/4511888293232720',

	tracesSampleRate: 1.0,

	tracePropagationTargets: ['localhost', /^https:\/\/[a-z0-9]+\.supabase\.co/],

	integrations: [
		Sentry.feedbackIntegration({
			colorScheme: 'system'
		})
	],

	enableLogs: true
});

const myErrorHandler = ({ error, event }: { error: unknown; event: unknown }) => {
	console.error('An error occurred on the client side:', error, event);
};

export const handleError = Sentry.handleErrorWithSentry(myErrorHandler);
