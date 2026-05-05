# Pipeline Page Enhancement Documentation

## Overview
The pipeline page has been comprehensively enhanced with advanced features for matter management, filtering, and reporting.

## Features Implemented

### 1. **Statistics Dashboard**
Located at the top of the page, displaying:
- **Total Outstanding**: Sum of all outstanding amounts across all matters
- **Critical Priority Count**: Number of matters with CRITICAL priority requiring immediate attention
- **High Priority Count**: Number of matters with HIGH priority in progress
- **Average per Matter**: Average outstanding amount per matter

### 2. **Advanced Filtering System**
Allows users to filter matters by multiple criteria:
- **Search**: Real-time search by matter reference or debtor name
- **Priority Filter**: Filter by priority level (CRITICAL, HIGH, MEDIUM, LOW)
- **Agent Filter**: Filter by managing agent (if agents exist)
- **Stage Filter**: Filter by pipeline stage (LOD, S129, SUMMONS, JUDGMENT, WRIT, RULE46, SALE, CLOSED)
- **Clear Filters**: Quick reset button to clear all active filters
- **Refresh**: Manual refresh button to reload data

### 3. **Kanban Board**
Enhanced visual layout with:
- **Drag-and-Drop**: Drag matters between stages to advance the collection process
- **Stage Columns**: Each stage shows:
  - Stage name with count of matters
  - Priority indicators (critical/high count badges)
  - Total outstanding amount for the stage
  - Visual indicators for drop zones
  - Responsive scaling on hover
- **Matter Cards**: Each card displays:
  - Matter reference (clickable link to detail page)
  - Debtor name
  - Unit (if applicable)
  - Priority badge with color coding
  - Outstanding amount
  - Quick action menu (three dots)
- **Empty States**: Helpful messaging when stages have no matters

### 4. **Quick Actions Menu**
Available on each matter card (three-dot menu):
- **View Details**: Navigate to the matter detail page
- **View Documents**: Jump to documents section
- **View Tasks**: Jump to tasks section

### 5. **Confirmation Dialogs**
When dragging matters between stages:
- Confirmation dialog appears before updating stage
- Clear messaging about the stage transition
- Loading state during API call
- Error handling with reversion on failure

### 6. **Export & Bulk Actions**
"More" dropdown menu with:
- **Export All (CSV)**: Export all visible matters to CSV file
  - Includes reference, debtor, unit, stage, priority, financial data
- **Export Summary**: Export pipeline summary by stage
  - Shows matter count and outstanding per stage
- **Share Pipeline** (Coming Soon): Future feature for sharing pipeline views

### 7. **Error Handling**
- Error state display when matters fail to load
- "Try Again" button to retry failed requests
- Toast notifications for success/error feedback
- Graceful handling of API failures with data reversion

### 8. **Performance Optimizations**
- Memoized calculations for statistics and filtered data
- Efficient filtering logic
- Minimal re-renders using useMemo and useState
- Optimized drag-and-drop with debouncing

## Component Structure

### PipelineBoard.tsx
Main component managing:
- Matter data fetching and organization
- Filter state management
- Drag-and-drop context
- Statistics calculation
- Stage change confirmation

### StageColumn.tsx
Individual stage column displaying:
- Stage header with metrics
- Matter cards
- Drop target for drag-and-drop
- Priority indicators
- Empty state

### MatterCard.tsx
Matter card component with:
- Matter information display
- Priority badge
- Drag handle
- Quick action menu
- Link to matter detail page

### PipelineControls.tsx
Export and bulk actions menu with:
- CSV export functionality
- Summary export
- Future sharing options

## Technical Details

### State Management
- `mattersState`: Record of matters organized by stage
- `searchQuery`: Search input state
- `selectedPriority`: Selected priority filter
- `selectedAgent`: Selected agent filter
- `selectedStage`: Selected stage filter
- `pendingDrag`: Pending stage change confirmation
- `confirmOpen`: Confirmation dialog visibility

### Hooks Used
- `useListMatters`: Fetch all matters
- `useUpdateMatterStage`: Update matter stage
- `useListAgents`: Fetch managing agents
- `useQueryClient`: React Query client for cache invalidation
- `useToast`: Toast notifications

### Filtering Logic
Filters are applied in real-time:
1. Search by reference or debtor name (case-insensitive)
2. Priority matching (if selected)
3. Agent matching (if selected)
4. Stage matching (if selected)
5. Only valid stages are included

### Export Functionality
- CSV format with proper escaping
- Timestamped filenames
- Includes all financial data
- Summary includes stage breakdowns

## UI/UX Improvements

### Responsive Design
- Flexible grid for statistics cards
- Scrollable kanban board
- Responsive filter controls
- Mobile-friendly layout

### Visual Hierarchy
- Clear typography scale
- Color-coded priorities
- Stage colors using hex values
- Visual feedback on interactions

### Accessibility
- Semantic HTML
- Aria labels on interactive elements
- Keyboard navigation support
- Color not as only indicator

## Future Enhancements

1. **Bulk Actions**
   - Bulk stage changes
   - Bulk priority updates
   - Bulk assignment

2. **Advanced Filtering**
   - Date range filtering
   - Amount range filtering
   - Custom saved filters

3. **Reporting**
   - Generate PDF reports
   - Schedule automated reports
   - Email report delivery

4. **Integrations**
   - WhatsApp messaging
   - Document generation
   - Email notifications

5. **Analytics**
   - Conversion funnels
   - Velocity metrics
   - Predictive analytics

## Usage Examples

### Basic Usage
Navigate to `/pipeline` route to access the pipeline board.

### Searching
Type in the search box to find matters by reference or debtor name.

### Filtering
Use dropdown selectors to filter by priority, agent, or stage.

### Drag-and-Drop
Click and hold the grip handle (⋮) to drag a matter between stages.

### Exporting
Click "More" menu and select "Export All" or "Export Summary" to download CSV files.

## API Integration

The pipeline uses the following API endpoints:
- `GET /api/matters` - Fetch all matters
- `PATCH /api/matters/:id` - Update matter stage
- `GET /api/agents` - Fetch managing agents

## Notes

- All matter state changes are confirmed before updating
- Failed updates revert the optimistic UI changes
- Filters work in combination (AND logic)
- Statistics update in real-time as filters change
- Empty states provide helpful guidance
