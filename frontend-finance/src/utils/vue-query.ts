import { QueryClient } from "@tanstack/vue-query";

export const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			// Let GET requests reach the service worker even without a network.
			networkMode: 'always',
			retry: (count, error: any) => navigator.onLine && error?.response?.status !== 401 && count < 2,
		},
	},
});
