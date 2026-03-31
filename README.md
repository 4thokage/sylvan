# Sylvan Web
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/4thokage/sylvan)


Magic: The Gathering collection and trade matching platform.

## Features

- **Collection Management**: Import and manage your Magic card collection
- **Trade Matching**: Find trade partners based on your wishlist and collection
- **Card Search**: Powered by Scryfall API for accurate card data
- **User Authentication**: Secure sign-in via Clerk
- **Dark/Light Theme**: Toggle between light, dark, and system themes

## Tech Stack

- **Framework**: SvelteKit with Svelte 5
- **Styling**: Tailwind CSS v4
- **Auth**: Clerk
- **Database**: Supabase
- **Cards Data**: Scryfall API

## Getting Started

### Prerequisites

- Node.js (v20+)
- pnpm (package manager)
- Supabase project
- Clerk account

### Installation

```sh
# Clone the repository
git clone https://github.com/yourusername/sylvan-web.git
cd sylvan-web

# Install dependencies
pnpm install
```

### Environment Variables

Create a `.env` file in the project root:

```
PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

### Development

```sh
# Start development server
pnpm dev
```

The app will be available at http://localhost:5173

### Building

```sh
# Build for production
pnpm build

# Preview production build
pnpm preview
```

## Available Commands

| Command        | Description              |
| -------------- | ------------------------ |
| `pnpm dev`     | Start dev server         |
| `pnpm build`   | Build for production     |
| `pnpm preview` | Preview production build |
| `pnpm check`   | Run TypeScript checks    |
| `pnpm lint`    | Run ESLint and Prettier  |
| `pnpm format`  | Format code              |
| `pnpm test`    | Run unit tests           |

## Project Structure

```
src/
├── lib/
│   ├── components/    # Reusable UI components
│   ├── stores/        # Svelte stores (theme, etc.)
│   ├── scryfall/     # Scryfall API client
│   └── server/       # Server-side utilities
├── routes/
│   ├── +layout.svelte    # Main layout with nav
│   ├── +page.svelte     # Home page
│   ├── collection/      # Collection management
│   └── trades/          # Trade matching
└── app.html           # HTML template
```
