# Design Document

## Overview

The simplified article workflow redesigns the current kanban board interface into two distinct, focused sections that clearly separate the article planning/generation workflow from the scheduling/publishing workflow. This design prioritizes clarity, simplicity, and task-focused interfaces to reduce cognitive load and improve user efficiency.

## Architecture

### High-Level Structure

The new interface will consist of two main sections accessible via tabs or a split-view layout:

1. **Article Planning Hub** - Focuses on creating ideas and managing generation
2. **Publishing Pipeline** - Focuses on scheduling and publishing completed articles

### Navigation Pattern

- **Tab-based Navigation**: Two primary tabs at the top level
- **Context-aware Actions**: Actions change based on the current section and article states
- **Unified Header**: Common actions and user controls remain consistent across sections

## Components and Interfaces

### 1. Article Planning Hub

#### Layout Structure

```
┌─────────────────────────────────────────────────────────┐
│ [Article Planning] [Publishing Pipeline]               │
├─────────────────────────────────────────────────────────┤
│ + Add Article Idea    [Generate All] [Schedule All]    │
├─────────────────────────────────────────────────────────┤
│ ┌─ Ideas (3) ──────────────────────────────────────────┐ │
│ │ □ Article Title 1                    [Generate Now] │ │
│ │   Keywords: seo, content             [Schedule]     │ │
│ │                                                     │ │
│ │ □ Article Title 2                    [Generate Now] │ │
│ │   Scheduled: Tomorrow 9:00 AM        [Edit]         │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ ┌─ Generating (2) ────────────────────────────────────┐ │
│ │ ⚡ Article Title 3                                  │ │
│ │    Progress: ████████░░ 80%                         │ │
│ │    Est. completion: 5 minutes                       │ │
│ │                                                     │ │
│ │ ⚡ Article Title 4                                  │ │
│ │    Progress: ███░░░░░░░ 30%                         │ │
│ │    Est. completion: 15 minutes                      │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

#### Key Features

- **Simple Article Creation**: Minimal form with title and optional keywords
- **Clear Status Grouping**: Ideas and Generating sections with counts
- **Prominent Actions**: Generate Now and Schedule buttons for each article
- **Progress Indicators**: Real-time generation progress with time estimates
- **Bulk Actions**: Generate All and Schedule All for efficiency

### 2. Publishing Pipeline

#### Layout Structure

```
┌─────────────────────────────────────────────────────────┐
│ [Article Planning] [Publishing Pipeline]               │
├─────────────────────────────────────────────────────────┤
│ [Publish All Ready] [Schedule All] [Settings]          │
├─────────────────────────────────────────────────────────┤
│ ┌─ Ready to Publish (4) ──────────────────────────────┐ │
│ │ ✓ Article Title 5                   [Publish Now]  │ │
│ │   Generated: 2 hours ago            [Schedule]     │ │
│ │   Word count: 1,200                                │ │
│ │                                                    │ │
│ │ ✓ Article Title 6                   [Publish Now]  │ │
│ │   Scheduled: Today 3:00 PM          [Edit Time]   │ │
│ │   Word count: 950                                  │ │
│ └────────────────────────────────────────────────────┘ │
│                                                        │
│ ┌─ Published (12) ───────────────────────────────────┐ │
│ │ 📄 Article Title 7                                 │ │
│ │    Published: Yesterday 2:00 PM                    │ │
│ │    Views: 1,234 | Clicks: 89                      │ │
│ │                                                    │ │
│ │ 📄 Article Title 8                                 │ │
│ │    Published: 2 days ago                           │ │
│ │    Views: 2,156 | Clicks: 145                     │ │
│ └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

#### Key Features

- **Ready-to-Publish Focus**: Clear separation of articles ready for publishing
- **Publishing Actions**: Publish Now and Schedule options for each article
- **Article Metadata**: Word count, generation time, and performance metrics
- **Scheduled Publishing**: Clear display of scheduled publish times
- **Published Archive**: Historical view with basic analytics

### 3. Shared Components

#### Article Card Component

```typescript
interface ArticleCardProps {
  article: Article;
  mode: "planning" | "publishing";
  onGenerate?: (id: string) => void;
  onScheduleGeneration?: (id: string, date: Date) => void;
  onPublish?: (id: string) => void;
  onSchedulePublishing?: (id: string, date: Date) => void;
}
```

#### Quick Action Modal

- **Generation Scheduling**: Simple date/time picker with presets (Tomorrow 9 AM, This Weekend, etc.)
- **Publishing Scheduling**: Date/time picker with content calendar integration
- **Bulk Actions**: Multi-select interface for batch operations

#### Status Indicators

- **Planning Phase**: Idea (💡), Generating (⚡), Ready (✓)
- **Publishing Phase**: Scheduled (📅), Published (📄)
- **Progress Bars**: Real-time generation progress
- **Time Displays**: Relative times (2 hours ago, Tomorrow 9 AM)

## Data Models

### Enhanced Article Model

```typescript
interface Article {
  id: string;
  title: string;
  keywords?: string[];
  status: "idea" | "generating" | "ready" | "scheduled" | "published";

  // Generation tracking
  generationStartedAt?: Date;
  generationCompletedAt?: Date;
  generationProgress?: number;
  generationScheduledAt?: Date;

  // Publishing tracking
  publishScheduledAt?: Date;
  publishedAt?: Date;

  // Content metadata
  wordCount?: number;
  estimatedReadTime?: number;

  // Analytics (basic)
  views?: number;
  clicks?: number;

  createdAt: Date;
  updatedAt: Date;
}
```

### Workflow State Management

```typescript
interface WorkflowState {
  activeTab: "planning" | "publishing";
  selectedArticles: string[];
  bulkActionMode: boolean;

  // Planning state
  planningFilters: {
    status: ArticleStatus[];
    scheduled: boolean;
  };

  // Publishing state
  publishingFilters: {
    readyOnly: boolean;
    scheduledOnly: boolean;
  };
}
```

## Error Handling

### User-Friendly Error Messages

- **Generation Failures**: "Article generation failed. Would you like to try again?"
- **Scheduling Conflicts**: "This time slot is busy. Try scheduling for [suggested time]."
- **Publishing Errors**: "Unable to publish article. Check your connection and try again."

### Graceful Degradation

- **Offline Mode**: Queue actions for when connection is restored
- **Partial Failures**: Show which articles succeeded/failed in bulk operations
- **Recovery Options**: Automatic retry with exponential backoff

## Testing Strategy

### User Experience Testing

1. **Task-based Testing**: Time users completing common workflows
2. **A/B Testing**: Compare new interface against current kanban board
3. **Accessibility Testing**: Ensure keyboard navigation and screen reader compatibility
4. **Mobile Responsiveness**: Test on various device sizes

### Functional Testing

1. **Workflow State Management**: Test transitions between planning and publishing
2. **Real-time Updates**: Verify generation progress and status updates
3. **Scheduling Accuracy**: Test generation and publishing scheduling
4. **Bulk Operations**: Test multi-article actions and error handling

### Performance Testing

1. **Large Article Lists**: Test with 100+ articles
2. **Real-time Updates**: Ensure smooth progress updates during generation
3. **Search and Filtering**: Test response times with large datasets

## Implementation Phases

### Phase 1: Core Interface

- Implement tab-based navigation
- Create Article Planning Hub with basic functionality
- Migrate existing article creation and generation

### Phase 2: Publishing Pipeline

- Implement Publishing Pipeline interface
- Add scheduling functionality for publishing
- Create published articles archive

### Phase 3: Enhanced Features

- Add bulk operations
- Implement quick action modals
- Add basic analytics display

### Phase 4: Polish and Optimization

- Add keyboard shortcuts
- Implement advanced filtering
- Performance optimizations and caching
