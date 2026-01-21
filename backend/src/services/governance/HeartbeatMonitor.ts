import { WebSocketServer, WebSocket } from 'ws';

interface HeartbeatPayload {
    agentId: string;
    currentUrl: string;
    resourceUsage: number;
}

export class HeartbeatMonitor {
    private wss: WebSocketServer | null = null;
    private blacklist: RegExp[] = [];
    private killSwitchEnabled: boolean = false;

    constructor() {
        this.killSwitchEnabled = process.env.KILL_SWITCH_ENABLED === 'true';
        this.loadBlacklist();
    }

    private loadBlacklist() {
        try {
            const urls = JSON.parse(process.env.GOVERNANCE_BLACKLIST_URLS || '[]');
            this.blacklist = urls.map((pattern: string) => this.wildcardToRegex(pattern));
            console.log(`[Governance] Loaded ${this.blacklist.length} blacklist patterns.`);
        } catch (error) {
            console.error('[Governance] Failed to parse blacklist URLs:', error);
            this.blacklist = [];
        }
    }

    private wildcardToRegex(pattern: string): RegExp {
        // Escaping special characters and converting * to .*
        const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
        return new RegExp(`^${escaped.replace(/\*/g, '.*')}$`, 'i');
    }

    start(port: number = 8080) {
        if (!this.killSwitchEnabled) {
            console.warn('[Governance] Kill Switch is DISABLED. Monitoring only.');
        }

        this.wss = new WebSocketServer({ port, path: '/v2/governance/ws' });

        this.wss.on('connection', (ws: WebSocket) => {
            console.log('[Governance] New agent connected.');

            ws.on('message', (message: string) => {
                try {
                    const heartbeat: HeartbeatPayload = JSON.parse(message);
                    this.checkCompliance(ws, heartbeat);
                } catch (err) {
                    console.error('[Governance] Invalid heartbeat format.');
                }
            });
        });

        console.log(`[Governance] Heartbeat Monitor running on ws://localhost:${port}/v2/governance/ws`);
    }

    private checkCompliance(ws: WebSocket, heartbeat: HeartbeatPayload) {
        const isViolating = this.blacklist.some((regex) => regex.test(heartbeat.currentUrl));

        if (isViolating) {
            console.warn(`[Governance] VIOLATION DETECTED: Agent ${heartbeat.agentId} accessing ${heartbeat.currentUrl}`);

            if (this.killSwitchEnabled) {
                this.enforceKillSwitch(ws, heartbeat.agentId);
            }
        }
    }

    private enforceKillSwitch(ws: WebSocket, agentId: string) {
        console.warn(`[Governance] TERMINATING AGENT ${agentId} IMMEDIATELY.`);

        // 1. Send TERMINATE command
        ws.send(JSON.stringify({
            command: 'TERMINATE',
            reason: 'Policy Violation: Accessing blacklisted URL',
        }));

        // 2. Revoke Credentials (Mock)
        this.revokeCredentials(agentId);

        // 3. Force close connection
        ws.close();
    }

    private revokeCredentials(agentId: string) {
        // In a real scenario, this would call IAM or the auth provider to invalidate tokens
        console.log(`[Governance] Credentials revoked for Agent ${agentId}`);
    }

    close() {
        if (this.wss) {
            this.wss.close();
        }
    }
}
