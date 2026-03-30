/// <reference types="svelte-clerk/env" />

declare global {
	namespace App {
		interface Locals {
			auth: import('svelte-clerk/server').Auth;
		}
	}
}

export {};
