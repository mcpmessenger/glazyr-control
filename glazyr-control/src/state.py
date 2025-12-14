import json
import time
from dataclasses import asdict, dataclass
from typing import Dict, List, Optional

import redis  # type: ignore


@dataclass
class TaskSummary:
    task_id: str
    status: str
    updated_at_ms: int
    input_preview: str
    output_preview: str
    output_sha256: str
    error: str = ""


class TaskStore:
    """
    Stores only safe summaries (no raw screenshots/base64).
    Uses Redis if REDIS_URL is provided, else in-memory.
    """

    def __init__(self, redis_url: str):
        self._redis_url = redis_url.strip()
        self._mem: Dict[str, TaskSummary] = {}
        self._r: Optional["redis.Redis"] = None
        if self._redis_url:
            self._r = redis.Redis.from_url(self._redis_url, decode_responses=True)

    def upsert(self, summary: TaskSummary) -> None:
        if self._r:
            key = f"task:{summary.task_id}"
            self._r.set(key, json.dumps(asdict(summary)))
            # Keep a rolling index of recent tasks
            self._r.zadd("tasks:index", {summary.task_id: time.time()})
            self._r.zremrangebyrank("tasks:index", 0, -1001)  # keep last 1000
            return
        self._mem[summary.task_id] = summary

    def get(self, task_id: str) -> Optional[TaskSummary]:
        if self._r:
            raw = self._r.get(f"task:{task_id}")
            if not raw:
                return None
            try:
                obj = json.loads(raw)
                return TaskSummary(**obj)
            except Exception:
                return None
        return self._mem.get(task_id)

    def list(self, limit: int = 100) -> List[TaskSummary]:
        limit = max(1, min(int(limit), 500))
        if self._r:
            ids = self._r.zrevrange("tasks:index", 0, limit - 1)
            out: List[TaskSummary] = []
            for tid in ids:
                s = self.get(str(tid))
                if s:
                    out.append(s)
            return out
        # in-memory: newest-ish by updated_at_ms
        return sorted(self._mem.values(), key=lambda s: s.updated_at_ms, reverse=True)[:limit]

