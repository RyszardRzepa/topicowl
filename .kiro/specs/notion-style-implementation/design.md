# Design Document

## Overview

This design outlines the systematic implementation of the Notion-inspired UI style guide across the entire application. The approach focuses on updating the Tailwind CSS configuration, creating a comprehensive design token system, and refactoring all existing components to match the style guide specifications.

The implementation will be done incrementally, starting with the foundational design system (Tailwind config and CSS variables) and then updating components from the most basic UI elements to complex feature components.

## Architecture

### Design Token System

The design will implement a comprehensive design token system using Tailwind CSS 4.0's `@theme` directive. This approach provides:

- **Centralized Design Tokens**: All colors, typography, spacing, and other design decisions defined in one place
- **CSS Custom Properties**: Automatic generation of CSS variables for runtime theming support
- **Type Safety**: Full TypeScript support for design tokens
- **Consistency**: Guaranteed consistency across all components

### Component Hierarchy

The component update strategy follows a bottom-up approach:

1. **Foundation Layer**: CSS variables, Tailwind config, global styles
2. **Primitive Components**: Button, Input, Card, Badge - basic building blocks
3. **Composite Components**: Forms, Navigation, Layout components
4. **Feature Components**: Kanban board, Settings forms, etc.
5. **Page Components**: Full page layouts and templates

### Styling Strategy

- **Utility-First**: Leverage Tailwind's utility classes with custom design tokens
- **Component Variants**: Use conditional classes for different component states
- **Semantic Naming**: Design tokens use semantic names (primary, secondary) rather than literal colors
- **Responsive Design**: Maintain responsive behavior while implementing the style guide

## Components and Interfaces

### 1. Tailwind Configuration

**File**: `src/styles/globals.css`

The global CSS file will be updated to include:
- Complete design token definitions using `@theme` directive
- Typography scale with Inter font family
- Color system with semantic naming
- Spacing scale following 8-point grid
- Animation and transition definitions

**Key Design Tokens**:
```css
@theme {
  --color-default-text: #373530;
  --color-default-bg: #FFFFFF;
  --color-gray-text: #787774;
  --color-gray-bg: #F1F1EF;
  --color-accent-blue: #2F80ED;
  --font-sans: Inter, ui-sans-serif, system-ui, sans-serif;
  --font-size-body: 0.9375rem; /* 15px */
  --font-size-small: 0.875rem; /* 14px */
  --line-height-relaxed: 1.6;
  --spacing-1: 0.25rem; /* 4px */
  --spacing-2: 0.5rem; /* 8px */
  --border-radius-default: 0.25rem; /* 4px */
}
```

### 2. Button Component

**File**: `src/components/ui/button.tsx`

The button component will implement three main variants:
- **Primary**: White background with subtle border and shadow effects
- **Ghost**: Transparent background with hover states
- **Danger**: Red text and border with appropriate hover states

**Interface**:
```typescript
interface ButtonProps {
  variant?: 'primary' | 'ghost' | 'danger';
  size?: 'default' | 'sm' | 'lg';
  // ... other props
}
```

### 3. Input Components

**File**: `src/components/ui/input.tsx` (new)

Form inputs will follow the style guide specifications:
- 32px height with 8px horizontal padding
- Light gray border with accent blue focus ring
- 3px border radius
- Consistent typography

### 4. Card Component

**File**: `src/components/ui/card.tsx`

Cards will be updated to match Notion's panel styling:
- White background with subtle border
- 4px border radius
- Subtle shadow for elevation
- Consistent padding using spacing tokens

### 5. Layout Components

**File**: `src/components/layout/` (new directory)

New layout components will be created:
- **ContentContainer**: Implements 680px default width with full-width option
- **PageLayout**: Standard page structure with proper spacing
- **Section**: Semantic content sections with consistent spacing

## Data Models

### Design Token Types

```typescript
// src/types/design-tokens.ts
export interface DesignTokens {
  colors: {
    default: { text: string; bg: string };
    gray: { text: string; bg: string };
    accent: { blue: string };
    semantic: {
      brown: { text: string; bg: string };
      orange: { text: string; bg: string };
      yellow: { text: string; bg: string };
      green: { text: string; bg: string };
      blue: { text: string; bg: string };
      purple: { text: string; bg: string };
      pink: { text: string; bg: string };
      red: { text: string; bg: string };
    };
  };
  typography: {
    fontFamily: { sans: string };
    fontSize: Record<string, string>;
    lineHeight: Record<string, string>;
    fontWeight: Record<string, string>;
  };
  spacing: Record<string, string>;
  borderRadius: Record<string, string>;
}
```

### Component Prop Interfaces

Updated interfaces for all components to support the new design system:

```typescript
// Consistent variant system across components
type ComponentVariant = 'default' | 'gray' | 'accent' | 'semantic';
type ComponentSize = 'sm' | 'default' | 'lg';
type ComponentState = 'default' | 'hover' | 'active' | 'disabled';
```

## Error Handling

### Fallback Styling

- **Missing Design Tokens**: Components will gracefully fallback to default Tailwind values
- **Invalid Variants**: Components will default to 'default' variant when invalid props are passed
- **CSS Loading Issues**: Critical styles will be inlined to prevent FOUC (Flash of Unstyled Content)

### Development Warnings

- TypeScript warnings for deprecated component props
- Console warnings in development for missing required design tokens
- ESLint rules to enforce consistent component usage

## Testing Strategy

### Visual Regression Testing

- **Component Screenshots**: Automated screenshots of all component variants
- **Cross-browser Testing**: Ensure consistent rendering across browsers
- **Responsive Testing**: Verify components work at different screen sizes

### Unit Testing

- **Component Rendering**: Test that components render with correct classes
- **Prop Validation**: Verify component behavior with different prop combinations
- **Accessibility**: Test focus management and ARIA attributes

### Integration Testing

- **Design Token Usage**: Verify all components use design tokens correctly
- **Theme Consistency**: Test that color schemes are applied consistently
- **Layout Behavior**: Test responsive layout changes and content width modes

### Manual Testing Checklist

1. **Typography**: Verify all text uses Inter font and correct sizes
2. **Color Contrast**: Check accessibility compliance with contrast ratios
3. **Interactive States**: Test hover, focus, and active states on all components
4. **Spacing**: Verify consistent spacing using 8-point grid
5. **Animation**: Check transition timing and easing functions
6. **Responsive**: Test layout behavior at different screen sizes

### Testing Tools

- **Jest + React Testing Library**: Unit and integration tests
- **Storybook**: Component documentation and visual testing
- **Playwright**: End-to-end testing and visual regression
- **axe-core**: Automated accessibility testing

## Implementation Phases

### Phase 1: Foundation
- Update Tailwind configuration with design tokens
- Create global CSS with complete design system
- Set up Inter font loading

### Phase 2: Core Components
- Update Button, Card, Badge components
- Create new Input and Form components
- Implement layout components

### Phase 3: Feature Components
- Update Kanban board styling
- Update Settings form components
- Apply styling to all existing feature components

### Phase 4: Pages and Layouts
- Update page layouts and templates
- Implement content width modes
- Final polish and consistency checks

This phased approach ensures that foundational changes are in place before updating dependent components, minimizing breaking changes and ensuring consistency throughout the implementation process.