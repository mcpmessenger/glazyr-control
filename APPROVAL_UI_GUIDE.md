# Extension Approval UI Guide

This guide explains the approval UI implementation for Playwright actions in the Chrome extension.

## Overview

The approval UI system provides a user-facing modal dialog that appears when high-risk Playwright actions require user confirmation before execution.

## Components

### 1. Approval Modal (`approval-modal.html`)

A standalone HTML component with embedded CSS that provides:
- Modal overlay and dialog
- Action details display
- Risk level indicators
- Approve/Deny buttons

The modal is styled to match the extension's design system with:
- Responsive layout
- Clear visual hierarchy
- Accessibility support (ESC key, ARIA labels)

### 2. Approval Manager (`approval-manager.ts`)

TypeScript class that manages the approval workflow:

```typescript
import { approvalManager } from './approval-ui/approval-manager';

// Request approval
const approved = await approvalManager.requestApproval(
  requestId,
  step,
  dryRun
);
```

Features:
- Modal lifecycle management
- Message routing between background script and UI
- Request timeout handling (60 seconds)
- Multiple pending request support

### 3. Background Script Integration (`background-playwright-handler.ts`)

Handles message routing and approval flow coordination:

```typescript
// Background script receives approval request
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'PLAYWRIGHT_APPROVAL_REQUEST') {
    // Store pending request
    // Show UI (via message to extension contexts)
    // Wait for user response
  }
});
```

## Message Flow

```
1. Playwright Bridge → Background Script
   └─> Request approval for high-risk action

2. Background Script → Approval Manager (popup/content)
   └─> Show approval modal

3. User → Approval Manager
   └─> Approve or Deny

4. Approval Manager → Background Script
   └─> Send approval response

5. Background Script → Playwright Bridge
   └─> Continue execution or block
```

## Integration Steps

### 1. Add Modal HTML to Extension

Include the approval modal in your extension's HTML:

```html
<!-- In popup.html or content script -->
<script src="approval-modal.html"></script>
```

Or inject it dynamically:

```typescript
// Load and inject modal
const response = await fetch(chrome.runtime.getURL('approval-modal.html'));
const html = await response.text();
document.body.insertAdjacentHTML('beforeend', html);
```

### 2. Initialize Approval Manager

In your extension's popup or content script:

```typescript
import { approvalManager } from './approval-ui/approval-manager';

// Initialize on page load
approvalManager.initialize();
```

### 3. Handle Approval Requests

The approval manager automatically listens for messages:

```typescript
// This is already set up in approval-manager.ts
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'PLAYWRIGHT_APPROVAL_REQUEST') {
    approvalManager.requestApproval(...);
  }
});
```

### 4. Background Script Handler

Ensure your background script handles approval responses:

```typescript
// In background-playwright-handler.ts (already implemented)
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'PLAYWRIGHT_APPROVAL_RESPONSE') {
    // Resolve pending approval request
    const pending = pendingApprovalRequests.get(message.request_id);
    if (pending) {
      pending.resolve(message.approved);
    }
  }
});
```

## Usage in Playwright Bridge

The Playwright bridge automatically triggers approval for high-risk actions:

```typescript
// In playwright-bridge.ts
const dryRun = await connector.dryRun(step, constraints);

if (dryRun.requiresHumanApproval && !step.requires_human_approval) {
  const approved = await showApprovalUI(step, dryRun);
  if (!approved) {
    return { status: 'blocked', error: 'Human approval denied' };
  }
}
```

## Customization

### Styling

Modify the CSS in `approval-modal.html` to match your extension's theme:

```css
.glazyr-approval-dialog {
  background: #your-color;
  border-radius: 12px;
}
```

### Risk Level Display

Customize how risk levels are displayed:

```typescript
// In approval-manager.ts
private formatRiskLevel(risk: string): string {
  const mapping = {
    'low': '🟢 Low Risk',
    'medium': '🟡 Medium Risk',
    'high': '🔴 High Risk'
  };
  return mapping[risk] || risk;
}
```

### Timeout Configuration

Adjust the approval timeout:

```typescript
// In background-playwright-handler.ts
setTimeout(() => {
  pending.resolve(false); // Auto-deny on timeout
}, 60000); // 60 seconds
```

## Security Considerations

1. **Text Masking**: Sensitive text (passwords, API keys) is automatically masked
2. **Selector Validation**: Only safe selectors are displayed
3. **Timeout Protection**: Requests timeout after 60 seconds to prevent hanging
4. **User Consent**: Every high-risk action requires explicit user approval

## Testing

Test the approval UI:

```typescript
// Mock approval request
const step = {
  step_id: 'test-1',
  action: 'type',
  input: { selector: '#password', text_ref: 'vault_password' }
};

const dryRun = {
  estimatedRisk: 'high',
  requiresHumanApproval: true
};

const approved = await approvalManager.requestApproval('test-1', step, dryRun);
console.log('Approved:', approved);
```

## Future Enhancements

1. **Approval History**: Store approval decisions for audit
2. **Bulk Approvals**: Allow users to approve multiple similar actions
3. **Smart Defaults**: Learn from user approval patterns
4. **Approval Policies**: User-configurable rules for auto-approval
