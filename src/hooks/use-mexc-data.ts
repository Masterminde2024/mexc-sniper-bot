import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ApiResponse } from "@/src/lib/api-response";
import { queryKeys } from "@/src/lib/query-client";
import { useAuth } from "@/src/components/auth/supabase-auth-provider";
import type {
  CalendarEntry,
  SymbolEntry,
} from "@/src/services/api/mexc-unified-exports";

// MEXC Calendar Data Hook
export function useMexcCalendar() {
  return useQuery({
    queryKey: queryKeys.mexcCalendar(),
    queryFn: async () => {
      const response = await fetch("/api/mexc/calendar", {
        credentials: "include", // Include authentication cookies
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const result: ApiResponse<CalendarEntry[]> = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to fetch MEXC calendar");
      }

      return result.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - calendar data cache
    gcTime: 10 * 60 * 1000, // 10 minutes garbage collection
    refetchInterval: false, // Disable automatic refetch to prevent storms
    refetchOnWindowFocus: false, // Don't refetch on window focus
    placeholderData: [], // Prevent loading flicker
    retry: (_failureCount, error) => {
      // Don't retry auth errors
      const errorMessage = error?.message || "";
      if (errorMessage.includes("401") || errorMessage.includes("403")) {
        return false;
      }
      // Don't retry network errors to prevent cascade failures
      if (
        errorMessage.includes("timeout") ||
        errorMessage.includes("ECONNREFUSED") ||
        errorMessage.includes("Circuit breaker")
      ) {
        return false;
      }
      // No retries to prevent storms
      return false;
    },
  });
}

// MEXC Symbols Data Hook
export function useMexcSymbols(vcoinId?: string) {
  return useQuery({
    queryKey: queryKeys.mexcSymbols(vcoinId),
    queryFn: async () => {
      const url = vcoinId
        ? `/api/mexc/symbols?vcoinId=${vcoinId}`
        : "/api/mexc/symbols";
      const response = await fetch(url, {
        credentials: "include", // Include authentication cookies
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const result: ApiResponse<SymbolEntry[]> = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to fetch MEXC symbols");
      }

      return result.data;
    },
    enabled: true, // Always enabled for symbols data
    staleTime: 30 * 1000, // 30 seconds - symbols data cache
    gcTime: 2 * 60 * 1000, // 2 minutes garbage collection
    refetchInterval: false, // Disable automatic refetch to prevent storms
    refetchOnWindowFocus: false, // Don't refetch on window focus
    placeholderData: [], // Prevent loading flicker
    retry: (_failureCount, error) => {
      // Don't retry auth errors
      const errorMessage = error?.message || "";
      if (errorMessage.includes("401") || errorMessage.includes("403")) {
        return false;
      }
      // Don't retry network errors to prevent cascade failures
      if (
        errorMessage.includes("timeout") ||
        errorMessage.includes("ECONNREFUSED") ||
        errorMessage.includes("Circuit breaker")
      ) {
        return false;
      }
      // No retries to prevent storms
      return false;
    },
  });
}

// MEXC Server Time Hook
export function useMexcServerTime() {
  return useQuery({
    queryKey: queryKeys.mexcServerTime(),
    queryFn: async () => {
      const response = await fetch("/api/mexc/server-time", {
        credentials: "include", // Include authentication cookies
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const result = await response.json();
      return result.serverTime;
    },
    staleTime: 60 * 1000, // 1 minute - server time cache
    gcTime: 5 * 60 * 1000, // 5 minutes garbage collection
    refetchInterval: false, // Disable automatic refetch to prevent storms
    refetchOnWindowFocus: false, // Don't refetch on window focus
    placeholderData: Date.now(), // Prevent loading flicker with current time
    retry: (_failureCount, error) => {
      // Don't retry auth errors
      const errorMessage = error?.message || "";
      if (errorMessage.includes("401") || errorMessage.includes("403")) {
        return false;
      }
      // Don't retry network errors to prevent cascade failures
      if (
        errorMessage.includes("timeout") ||
        errorMessage.includes("ECONNREFUSED") ||
        errorMessage.includes("Circuit breaker")
      ) {
        return false;
      }
      // No retries to prevent storms
      return false;
    },
  });
}

// MEXC Connectivity Test Hook with Enhanced Source Information and Health Metrics
export interface MexcConnectivityResult {
  connected: boolean;
  hasCredentials: boolean;
  credentialsValid: boolean;
  credentialSource: "database" | "environment" | "none";
  hasUserCredentials: boolean;
  hasEnvironmentCredentials: boolean;
  message: string;
  timestamp: string;
  status:
    | "fully_connected"
    | "no_credentials"
    | "invalid_credentials"
    | "network_error"
    | "error";
  error?: string;
  retryCount?: number;
  latency?: number;
  lastSuccessfulCheck?: string;
  connectionHealth?: "excellent" | "good" | "poor" | "failed";
}

export function useMexcConnectivity() {
  return useQuery<MexcConnectivityResult>({
    queryKey: ["mexc", "connectivity", "enhanced"],
    queryFn: async () => {
      // Single attempt only to prevent storms - no custom retry loop
      try {
        const connectivityController = new AbortController();
        setTimeout(() => connectivityController.abort(), 10000); // 10 seconds timeout

        const response = await fetch("/api/mexc/connectivity", {
          signal: connectivityController.signal,
          credentials: "include", // Include authentication cookies
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();

        // Store successful result metadata for health monitoring
        if (result && typeof result === "object") {
          result.queryAttempt = 1;
          result.queryTimestamp = new Date().toISOString();
        }

        return result;
      } catch (error) {
        const finalError =
          error instanceof Error ? error : new Error("Unknown error");
        console.warn(`Connectivity check failed:`, finalError.message);
        throw finalError;
      }
    },
    staleTime: 5 * 60 * 1000, // Increased to 5 minutes for less frequent checks
    refetchInterval: false, // Disabled automatic refetch for better performance
    refetchOnWindowFocus: false, // Disabled to prevent storms on focus
    refetchOnReconnect: false, // Disabled to prevent cascade failures
    retry: false, // Disable all retries to prevent storms
    retryOnMount: false, // Don't retry on mount to prevent storms
    refetchIntervalInBackground: false, // Don't refetch in background
    networkMode: "online", // Only run when online
  });
}

// Legacy hook for backward compatibility (returns only connection status)
export function useMexcConnectivityStatus() {
  const { data } = useMexcConnectivity();
  return {
    data: data?.connected,
    isConnected: data?.connected || false,
    hasCredentials: data?.hasCredentials || false,
    isValid: data?.credentialsValid || false,
  };
}

// Mutation for Manual Calendar Refresh
export function useRefreshMexcCalendar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/mexc/calendar", {
        credentials: "include", // Include authentication cookies
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const result = await response.json();
      return result.data;
    },
    onSuccess: (data) => {
      // Update the calendar cache
      queryClient.setQueryData(queryKeys.mexcCalendar(), data);

      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ["mexc"] });
    },
  });
}

// Mutation for Manual Symbols Refresh
export function useRefreshMexcSymbols() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (vcoinId?: string) => {
      const url = vcoinId
        ? `/api/mexc/symbols?vcoinId=${vcoinId}`
        : "/api/mexc/symbols";
      const response = await fetch(url, {
        credentials: "include", // Include authentication cookies
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const result = await response.json();
      return { vcoinId, data: result.data };
    },
    onSuccess: ({ vcoinId, data }) => {
      // Update the symbols cache
      queryClient.setQueryData(queryKeys.mexcSymbols(vcoinId), data);

      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ["mexc", "symbols"] });
    },
  });
}

// Hook for real-time pattern detection
export function useMexcPatternDetection(vcoinId?: string) {
  const { data: symbols, isLoading, error } = useMexcSymbols(vcoinId);

  // Analyze symbols for ready state pattern (sts:2, st:2, tt:4)
  const readyStatePattern = Array.isArray(symbols)
    ? symbols.find(
        (symbol: SymbolEntry) =>
          symbol.sts === 2 && symbol.st === 2 && symbol.tt === 4
      )
    : undefined;

  const hasReadyPattern = !!readyStatePattern;
  const patternConfidence = hasReadyPattern ? 95 : 0;

  return {
    symbols: Array.isArray(symbols) ? symbols : [],
    readyStatePattern,
    hasReadyPattern,
    patternConfidence,
    isLoading,
    error,
  };
}

// Hook for upcoming launches (next 24 hours)
export function useUpcomingLaunches() {
  const { data: calendar, ...rest } = useMexcCalendar();

  const upcomingLaunches = Array.isArray(calendar)
    ? calendar.filter((entry: CalendarEntry) => {
        try {
          const launchTime = new Date(entry.firstOpenTime);
          const now = new Date();
          const hours24 = 24 * 60 * 60 * 1000;

          return (
            launchTime.getTime() > now.getTime() &&
            launchTime.getTime() < now.getTime() + hours24
          );
        } catch (_error) {
          console.warn("Invalid date in calendar entry:", entry.firstOpenTime);
          return false;
        }
      })
    : [];

  return {
    data: upcomingLaunches,
    count: upcomingLaunches.length,
    ...rest,
  };
}

// Hook for ready launches (upcoming coin launches within 4 hours)
export function useReadyLaunches() {
  const { data: calendar, ...rest } = useMexcCalendar();

  const readyLaunches = Array.isArray(calendar)
    ? calendar.filter((entry: CalendarEntry) => {
        try {
          const launchTime = new Date(entry.firstOpenTime);
          const now = new Date();
          const hours4 = 4 * 60 * 60 * 1000;

          return (
            launchTime.getTime() > now.getTime() &&
            launchTime.getTime() < now.getTime() + hours4
          );
        } catch (_error) {
          console.warn("Invalid date in calendar entry:", entry.firstOpenTime);
          return false;
        }
      })
    : [];

  return {
    data: readyLaunches,
    count: readyLaunches.length,
    ...rest,
  };
}

// Legacy hook for backward compatibility - DEPRECATED: Use useReadyLaunches instead
export function useReadyTargets() {
  console.warn(
    "useReadyTargets is deprecated. Use useReadyLaunches instead for calendar launches or useSnipeTargets for actual trading targets."
  );
  return useReadyLaunches();
}

// Hook for actual snipe targets (trading targets from database)
export function useSnipeTargets(userId?: string) {
  const { user, isAuthenticated } = useAuth();

  return useQuery({
    queryKey: ["snipe-targets", userId || "anonymous"],
    queryFn: async () => {
      if (!userId) {
        throw new Error("User ID is required for snipe targets");
      }

      const response = await fetch(`/api/snipe-targets?userId=${userId}`, {
        credentials: "include",
      });

      if (!response.ok) {
        if (
          !isAuthenticated &&
          (response.status === 403 || response.status === 401)
        ) {
          return [];
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      return result.success ? result.data : [];
    },
    staleTime: 30 * 1000, // 30 seconds - snipe targets cache
    gcTime: 5 * 60 * 1000, // 5 minutes garbage collection
    refetchInterval: false, // Don't auto-refetch to prevent storms
    refetchOnWindowFocus: false, // Don't refetch on window focus
    placeholderData: [], // Prevent loading flicker
    retry: false, // No retries to prevent storms
    enabled: !!userId && (isAuthenticated || userId === "system"),
  });
}

// Hook for MEXC account balance
export function useMexcAccount(userId?: string) {
  const { user, isAuthenticated } = useAuth();

  return useQuery({
    queryKey: ["mexc", "account", userId || "anonymous", "active"],
    queryFn: async () => {
      if (!userId) {
        throw new Error("User ID is required");
      }

      const response = await fetch(`/api/mexc/account?userId=${userId}`, {
        credentials: "include", // Include authentication cookies
      });
      if (!response.ok) {
        // Don't throw errors for 403/401 when not authenticated
        if (
          !isAuthenticated &&
          (response.status === 403 || response.status === 401)
        ) {
          return null;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const result = await response.json();
      return result;
    },
    staleTime: 30 * 1000, // 30 seconds - account data cache
    gcTime: 5 * 60 * 1000, // 5 minutes garbage collection
    refetchInterval: false, // Disable automatic refetch to prevent storms
    refetchOnWindowFocus: false, // Don't refetch on window focus for account data
    placeholderData: null, // Prevent loading flicker
    retry: (_failureCount, error) => {
      // Don't retry auth errors
      const errorMessage = error?.message || "";
      if (errorMessage.includes("401") || errorMessage.includes("403")) {
        return false;
      }
      // Don't retry network errors to prevent cascade failures
      if (
        errorMessage.includes("timeout") ||
        errorMessage.includes("ECONNREFUSED") ||
        errorMessage.includes("Circuit breaker")
      ) {
        return false;
      }
      // No retries to prevent storms
      return false;
    },
    // Only fetch if user is authenticated and accessing their own data
    enabled: !!userId && isAuthenticated && user?.id === userId,
  });
}
