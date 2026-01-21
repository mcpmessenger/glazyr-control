# Emergency Stop: How Glazyr's Kill Switch Protects Your AI Agents

**Date:** December 16, 2025  
**Author:** Glazyr Team

---

When AI agents are making real decisions and taking real actions in production systems, you need more than just monitoring—you need an emergency brake. That's why we built Glazyr's kill switch: an instant, reliable way to halt all agent activity when something goes wrong.

## The Problem: When AI Agents Go Rogue

Imagine this scenario: You've deployed an AI agent to automate customer support ticket routing. It's working great—until suddenly it starts:

- Routing all tickets to the wrong department
- Making unauthorized API calls
- Exceeding budget limits
- Performing actions outside allowed domains

In traditional systems, you'd have to:
1. Find the process
2. SSH into the server
3. Manually kill the process
4. Hope you caught it in time

By then, the damage might already be done.

## The Solution: One-Click Emergency Stop

Glazyr's kill switch gives you **instant control** over all agent activity from your mission control dashboard. With a single click, you can:

- ✅ Immediately halt all action execution
- ✅ Block new actions from starting
- ✅ Stop in-progress operations
- ✅ Maintain visibility into what was happening

It's like having a circuit breaker for your AI infrastructure—but smarter, faster, and more reliable.

## How It Works: Multi-Layer Enforcement

The kill switch isn't just a flag in a database. It's a **comprehensive safety mechanism** that enforces policy at every level of the system.

### 1. Web Control Plane → Extension Communication

When you engage the kill switch from the Glazyr dashboard, the control plane immediately broadcasts the kill switch state to all connected browser extensions via secure `window.postMessage` communication:

```javascript
{
  source: "glazyr-web",
  type: "glazyr:killswitch",
  payload: { engaged: true }
}
```

The extension receives this message in real-time and updates its policy state immediately—no polling, no delays.

### 2. Extension Policy Enforcement

Once the kill switch is engaged, the extension enforces it at **multiple enforcement points**:

#### Background Service Worker
Before any action can execute, the background service worker checks the kill switch:

```javascript
if (policyCache.killSwitchEngaged) {
  throw new Error("Blocked by policy: kill switch is engaged.")
}
```

This happens **before** the action is dispatched, preventing it from even starting.

#### Content Scripts
Content scripts that execute actions on web pages also check the kill switch:

```javascript
if (window.__glazyrPolicy.killSwitchEngaged) {
  return { status: "blocked", error: "Kill switch engaged" }
}
```

This provides defense-in-depth: even if an action somehow bypasses the background check, the content script will catch it.

#### Specialized Operations
All specialized operations—region selection, full-page capture, drag-and-drop—check the kill switch before proceeding. Nothing gets through.

### 3. Immediate State Synchronization

The kill switch state is:
- ✅ Stored in Chrome's local storage for persistence
- ✅ Exposed via `window.__glazyrPolicy` for all scripts
- ✅ Refreshed immediately when the state changes
- ✅ Broadcast to all open tabs with the extension

This ensures that **every component** of the extension knows the kill switch is engaged, regardless of when it was activated.

## Real-World Use Cases

### Scenario 1: Budget Overrun Protection

Your agent has a $100 daily budget, but it's already spent $95 and it's only 2 PM. You notice it's about to make another expensive API call.

**Solution:** Engage the kill switch, preventing any further spending while you review the situation.

### Scenario 2: Unauthorized Domain Access

Your agent is configured to only work on `example.com`, but you see it attempting to navigate to `suspicious-site.com`.

**Solution:** Kill switch immediately, then review your domain allowlist and agent logs.

### Scenario 3: Unexpected Behavior

The agent starts performing actions that don't match its intended behavior—maybe it's hallucinating or misinterpreting instructions.

**Solution:** Kill switch, investigate the root cause, then resume with updated safety policies.

### Scenario 4: Security Incident

You detect suspicious activity or a potential security breach.

**Solution:** Kill switch all agents immediately as part of your incident response protocol.

## Why This Matters: Safety-First AI Operations

Traditional AI systems treat safety as an afterthought. Glazyr treats it as a **first-class feature**.

### Instant Response Time

The kill switch works in **milliseconds**, not seconds or minutes. When you need to stop something, it stops—immediately.

### Defense in Depth

Multiple enforcement points mean that even if one check fails, others will catch it. This is critical for production systems where reliability is non-negotiable.

### Complete Visibility

When the kill switch is engaged, you can still see:
- What actions were attempted
- What was blocked
- The current state of all agents
- Full audit trails

You're not flying blind—you're in full control.

## Technical Architecture: Built for Reliability

The kill switch is designed with reliability in mind:

### Real-Time Communication
- Uses `window.postMessage` for instant, reliable communication
- No network latency or polling delays
- Works even if the backend is slow or unavailable

### Persistent State
- Kill switch state is stored in Chrome's local storage
- Survives page refreshes and extension restarts
- Synchronized across all browser tabs

### Multiple Enforcement Points
- Background service worker (primary enforcement)
- Content scripts (secondary enforcement)
- Specialized scripts (tertiary enforcement)

If one fails, others catch it.

## Best Practices

### 1. Test Your Kill Switch Regularly

Just like fire drills, you should test your kill switch to ensure it works when you need it:

1. Engage the kill switch
2. Attempt to execute an action
3. Verify it's blocked
4. Disengage the kill switch
5. Verify actions work again

### 2. Monitor Kill Switch Events

Track when the kill switch is engaged:
- How often is it used?
- What triggers its use?
- How quickly do you respond?

This data helps you improve your safety policies and agent behavior.

### 3. Integrate with Incident Response

Make the kill switch part of your incident response playbook:
- Document when to use it
- Train your team on how to use it
- Set up alerts when it's engaged

### 4. Combine with Other Safety Features

The kill switch works best when combined with:
- Domain allowlists
- Action budgets
- Human-in-the-loop confirmations
- Runtime budgets

Together, these create multiple layers of protection.

## The Future: Enhanced Safety Features

We're continuously improving Glazyr's safety features. Upcoming enhancements include:

- **Automatic kill switch engagement** based on anomaly detection
- **Time-based kill switches** that auto-disengage after a set period
- **Selective kill switches** that only affect specific agents or domains
- **Kill switch analytics** to understand usage patterns

## Conclusion: Safety Is Not Optional

In production AI systems, safety isn't a nice-to-have—it's a requirement. The kill switch is your emergency brake, your circuit breaker, your last line of defense.

With Glazyr's kill switch, you have:
- ✅ Instant control over all agent activity
- ✅ Multiple layers of enforcement
- ✅ Complete visibility into what's happening
- ✅ Peace of mind in production

**Try it yourself:** [Get Started Free](https://glazyr.com/login) and see how the kill switch works in your own environment.

---

## Learn More

- [Glazyr Documentation](https://glazyr.com/docs)
- [Safety & Permissions Guide](https://glazyr.com/docs/safety)
- [Architecture Overview](https://glazyr.com/how-it-works)

**Questions?** Join our [Discord community](https://discord.com) or [open an issue on GitHub](https://github.com).

---

*Glazyr is mission control for AI agents. Govern, monitor, and scale AI automation with confidence.*


