import { useEffect, useMemo, useState } from "react";
import { scanProcessingService } from "@/services/scans/ScanProcessingService";
import type { ScanJobStatus, UUID } from "@/types";

const TERMINAL_STATUSES: ScanJobStatus[] = ["completed", "failed", "needs_review"];

export function isTerminalScanStatus(status: ScanJobStatus | null | undefined): boolean {
  if (!status) return false;
  return TERMINAL_STATUSES.includes(status);
}

export function useScanStatusPolling(scanId?: UUID | null, enabled = true, intervalMs = 1200) {
  const [status, setStatus] = useState<ScanJobStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setStatus(null);
    setError(null);
    if (!scanId || !enabled) return;
    let active = true;

    const poll = async () => {
      try {
        const nextStatus = await scanProcessingService.getScanStatus(scanId);
        if (!active) return;
        setError(null);
        setStatus(nextStatus);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to poll scan status.");
      }
    };

    void poll();
    const timer = setInterval(() => {
      void poll();
    }, intervalMs);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [scanId, enabled, intervalMs]);

  const isTerminal = useMemo(() => isTerminalScanStatus(status), [status]);
  return { status, isTerminal, error };
}
