# Plantry

Plantry is a modern meal planning application that simplifies recipe management, meal planning, and grocery shopping. Built with Next.js, TypeScript, and Tailwind CSS, it provides a seamless experience for users to organize their cooking process from start to finish.

## Features

- **Recipe Management**: Save, organize, and discover recipes
- **Meal Planning**: Plan meals by day or week with a drag-and-drop interface
- **Grocery Lists**: Automatically generate shopping lists from your meal plans
- **AI Recipe Suggestions**: Get personalized recipe ideas based on your preferences and available ingredients

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS + CSS Modules
- **State Management**: Zustand for local UI state; React Query for server data
- **Animations**: Framer Motion
- **Forms & Validation**: React Hook Form + Zod
- **UI Components**: Headless UI for accessible base components
- **Icons**: Lucide React

## Project Structure

```
/app
  /api              # API routes and adapters
  /components
    /ui             # Reusable UI components (Button, Card, etc.)
    /layout         # Layout components (Header, Footer, Navigation)
    /features
      /recipes      # Recipe-specific components
      /grocery      # Grocery list components
      /planner      # Meal planner components
  /types            # TypeScript type definitions
  /hooks            # Custom React hooks
  /lib              # Utility functions and shared code
  /services         # API service layer
  /styles           # Global styles and theme
```

## Getting Started

### Prerequisites

- Node.js 18.x or later
- npm or yarn

### Installation

1. Clone the repository:

```bash
git clone https://github.com/yourusername/plantry.git
cd plantry
```

2. Install dependencies:

```bash
npm install
# or
yarn install
```

3. Run the development server:

```bash
npm run dev
# or
yarn dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

## Development

### Key Commands

- `npm run dev` - Start the development server
- `npm run build` - Build the application for production
- `npm run start` - Start the production server
- `npm run lint` - Run ESLint to check for code quality issues

## Architecture

Plantry follows a layered architecture:

1. **UI Layer**: Presentational components (stateless, themeable)
2. **Logic Layer**: Hooks & services (custom hooks, data-fetching hooks)
3. **API Layer**: `api/` folder with typed adapters (REST or GraphQL)
4. **Domain Models**: Shared `types/` folder for Recipe, GroceryItem, MealPlan

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details. 