/// <reference types="svelte-clerk/env" />

declare global {
  namespace App {
    interface Locals {
      auth: import('svelte-clerk/server').Auth;
    }

    interface PageData {
      user?: {
        id: string;
        username: string;
        display_name: string | null;
        is_admin: boolean;
      } | null;
    }
  }
}

export {};
