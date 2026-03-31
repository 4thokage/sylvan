# Development Workflow

## Prerequisites

- Node.js (use pnpm as package manager)
- Supabase project (for database)
- Clerk account (for authentication)

## Getting Started

```sh
# Install dependencies
pnpm install

# Start development server
pnpm dev
```

## Available Commands

| Command        | Description                               |
| -------------- | ----------------------------------------- |
| `pnpm dev`     | Start dev server at http://localhost:5173 |
| `pnpm build`   | Build for production                      |
| `pnpm preview` | Preview production build                  |
| `pnpm check`   | Run TypeScript checks                     |
| `pnpm lint`    | Run ESLint and Prettier                   |
| `pnpm format`  | Format code with Prettier                 |
| `pnpm test`    | Run unit tests                            |

## Environment Variables

Create a `.env` file with the following variables:

```
PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
SUPABASE_URL=https://...
SUPABASE_ANON_KEY=...
```

## Tech Stack

- **Framework**: SvelteKit with Svelte 5
- **Styling**: Tailwind CSS v4
- **Auth**: Clerk
- **Database**: Supabase
- **Cards Data**: Scryfall API
