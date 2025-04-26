# Plantry API Layer

This directory contains the API integration code for the Plantry application.

## Structure

- **recipe/**: Recipe-related API functions
- **grocery/**: Grocery list-related API functions
- **planner/**: Meal planner-related API functions
- **auth/**: Authentication-related API functions

## Usage

Each API module follows a consistent pattern:

```typescript
// Import types
import { SomeType } from '@/app/types/SomeType';

// API Functions - These will be used by the React Query hooks
export async function getSomething(): Promise<SomeType[]> {
  // Implementation
}

export async function getSomethingById(id: string): Promise<SomeType | null> {
  // Implementation
}

export async function createSomething(data: SomeFormData): Promise<SomeType> {
  // Implementation
}

export async function updateSomething(id: string, data: Partial<SomeFormData>): Promise<SomeType | null> {
  // Implementation
}

export async function deleteSomething(id: string): Promise<boolean> {
  // Implementation
}
```

## Mock Data

Currently, the API layer uses mock data for development purposes. 
In a production environment, these functions would make actual API calls to a backend service.

## Error Handling

API functions should handle errors gracefully and return appropriate error messages to be displayed to the user. 