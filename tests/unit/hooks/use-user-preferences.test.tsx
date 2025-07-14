/**
 * Unit Tests for User Preferences Hooks
 * 
 * Tests the authentication fix and all user preferences hook functionality
 * with proper mocking and error handling validation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { ReactNode } from 'react';
import {
  useUserPreferences,
  useUpdateUserPreferences,
  type UserTradingPreferences,
} from '../../../src/hooks/use-user-preferences';
import { useAuth } from '../../../src/components/auth/supabase-auth-provider';

// Mock the auth hook
vi.mock('../../../src/lib/supabase-auth-client', () => ({
  useAuth: vi.fn(),
}));

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Test wrapper with QueryClient
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  
  return Wrapper;
};

// Sample test data
const mockUser = {
  id: 'test-user-123',
  email: 'test@example.com',
  name: 'Test User',
};

const mockUserPreferences: UserTradingPreferences = {
  userId: 'test-user-123',
  defaultBuyAmountUsdt: 100,
  maxConcurrentSnipes: 3,
  takeProfitLevels: {
    level1: 5,
    level2: 10,
    level3: 15,
    level4: 25,
  },
  defaultTakeProfitLevel: 2,
  stopLossPercent: 5.0,
  riskTolerance: 'medium',
  readyStatePattern: [1, 2, 1],
  targetAdvanceHours: 2,
  calendarPollIntervalSeconds: 60,
  symbolsPollIntervalSeconds: 30,
  selectedExitStrategy: 'balanced',
  autoBuyEnabled: true,
  autoSellEnabled: true,
  autoSnipeEnabled: false,
};

describe('User Preferences Hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default auth mock - authenticated user
    (useAuth as any).mockReturnValue({
      user: mockUser,
      isAuthenticated: true,
      isLoading: false,
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('useUserPreferences', () => {
    it('should fetch user preferences successfully with authentication credentials', async () => {
      // Mock successful API response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          success: true,
          data: mockUserPreferences,
        }),
      });

      const { result } = renderHook(
        () => useUserPreferences('test-user-123'),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.data).toEqual(mockUserPreferences);
      });

      // Verify fetch was called with authentication credentials
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/user-preferences?userId=test-user-123',
        {
          credentials: 'include', // This is the key authentication fix
        }
      );
    });

    it('should handle unauthenticated users correctly', async () => {
      // Mock unauthenticated state
      (useAuth as any).mockReturnValue({
        user: null,
        isAuthenticated: false,
        isLoading: false,
      });

      const { result } = renderHook(
        () => useUserPreferences('test-user-123'),
        { wrapper: createWrapper() }
      );

      // Query should not execute for unauthenticated users
      expect(result.current.isPending).toBe(true);
      expect(result.current.fetchStatus).toBe('idle');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should handle API errors gracefully', async () => {
      // Mock API error response
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({
          success: false,
          error: 'Database connection failed',
        }),
      });

      const { result } = renderHook(
        () => useUserPreferences('test-user-123'),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      });

      expect(result.current.error?.message).toContain('Failed to fetch user preferences');
    });

    it('should only allow users to access their own preferences', async () => {
      const { result } = renderHook(
        () => useUserPreferences('different-user-456'),
        { wrapper: createWrapper() }
      );

      // Query should not execute when accessing different user's data
      expect(result.current.isPending).toBe(true);
      expect(result.current.fetchStatus).toBe('idle');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should require userId parameter', async () => {
      const { result } = renderHook(
        () => useUserPreferences(undefined),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      });

      expect(result.current.error?.message).toBe('User ID is required');
    });
  });

  describe('useUpdateUserPreferences', () => {
    it('should update user preferences with authentication credentials', async () => {
      // Mock successful update response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          success: true,
          data: { ...mockUserPreferences, defaultBuyAmountUsdt: 150 },
        }),
      });

      const { result } = renderHook(
        () => useUpdateUserPreferences(),
        { wrapper: createWrapper() }
      );

      const updateData = {
        userId: 'test-user-123',
        defaultBuyAmountUsdt: 150,
      };

      await result.current.mutateAsync(updateData);

      // Verify fetch was called with authentication credentials
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/user-preferences',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include', // This is the key authentication fix
          body: JSON.stringify(updateData),
        }
      );
    });

    it('should handle authentication errors with detailed error messages', async () => {
      // Mock 307 redirect (unauthenticated)
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 307,
        statusText: 'Temporary Redirect',
        json: () => Promise.resolve({
          error: 'Authentication required',
        }),
      });

      const { result } = renderHook(
        () => useUpdateUserPreferences(),
        { wrapper: createWrapper() }
      );

      const updateData = {
        userId: 'test-user-123',
        defaultBuyAmountUsdt: 150,
      };

      try {
        await result.current.mutateAsync(updateData);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).toContain('Failed to update user preferences');
        expect(error.message).toContain('Authentication required');
        expect(error.message).toContain('Status: 307');
      }
    });

    it('should handle foreign key constraint violations', async () => {
      // Mock foreign key constraint error
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({
          success: false,
          error: 'Foreign key constraint violation: user not found',
        }),
      });

      const { result } = renderHook(
        () => useUpdateUserPreferences(),
        { wrapper: createWrapper() }
      );

      const updateData = {
        userId: 'non-existent-user',
        defaultBuyAmountUsdt: 150,
      };

      try {
        await result.current.mutateAsync(updateData);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).toContain('Foreign key constraint violation');
      }
    });

    it('should handle network errors gracefully', async () => {
      // Mock network error
      mockFetch.mockRejectedValueOnce(new Error('Network connection failed'));

      const { result } = renderHook(
        () => useUpdateUserPreferences(),
        { wrapper: createWrapper() }
      );

      const updateData = {
        userId: 'test-user-123',
        defaultBuyAmountUsdt: 150,
      };

      try {
        await result.current.mutateAsync(updateData);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).toBe('Network connection failed');
      }
    });

    it('should handle JSON parsing errors for non-JSON responses', async () => {
      // Mock HTML response (like auth redirect page)
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 307,
        statusText: 'Temporary Redirect',
        json: () => Promise.reject(new Error('Not JSON')),
      });

      const { result } = renderHook(
        () => useUpdateUserPreferences(),
        { wrapper: createWrapper() }
      );

      const updateData = {
        userId: 'test-user-123',
        defaultBuyAmountUsdt: 150,
      };

      try {
        await result.current.mutateAsync(updateData);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).toContain('Failed to update user preferences');
        expect(error.message).toContain('Temporary Redirect');
        expect(error.message).toContain('Status: 307');
      }
    });

    it('should handle API success response with error flag', async () => {
      // Mock API response that returns success:false
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          success: false,
          error: 'Validation failed: invalid risk tolerance',
        }),
      });

      const { result } = renderHook(
        () => useUpdateUserPreferences(),
        { wrapper: createWrapper() }
      );

      const updateData = {
        userId: 'test-user-123',
        riskTolerance: 'invalid' as any,
      };

      try {
        await result.current.mutateAsync(updateData);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).toBe('Validation failed: invalid risk tolerance');
      }
    });
  });

  describe('Authentication Integration', () => {
    it('should work correctly when user switches accounts', async () => {
      // Start with user A
      let currentUser = { id: 'user-a', email: 'a@example.com' };
      (useAuth as any).mockReturnValue({
        user: currentUser,
        isAuthenticated: true,
        isLoading: false,
      });

      const { result, rerender } = renderHook(
        () => useUserPreferences(currentUser.id),
        { wrapper: createWrapper() }
      );

      // Mock response for user A
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          success: true,
          data: { ...mockUserPreferences, userId: 'user-a' },
        }),
      });

      await waitFor(() => {
        expect(result.current.data).toBeTruthy();
      });

      // Switch to user B
      currentUser = { id: 'user-b', email: 'b@example.com' };
      (useAuth as any).mockReturnValue({
        user: currentUser,
        isAuthenticated: true,
        isLoading: false,
      });

      rerender();

      // Should not fetch data for user B when accessing user A's endpoint
      expect(result.current.fetchStatus).toBe('idle');
    });

    it('should handle authentication state transitions', async () => {
      // Start unauthenticated
      (useAuth as any).mockReturnValue({
        user: null,
        isAuthenticated: false,
        isLoading: true,
      });

      const { result, rerender } = renderHook(
        () => useUserPreferences('test-user-123'),
        { wrapper: createWrapper() }
      );

      // Should not fetch while loading
      expect(result.current.fetchStatus).toBe('idle');
      expect(mockFetch).not.toHaveBeenCalled();

      // Become authenticated
      (useAuth as any).mockReturnValue({
        user: mockUser,
        isAuthenticated: true,
        isLoading: false,
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          success: true,
          data: mockUserPreferences,
        }),
      });

      rerender();

      // Should now fetch data
      await waitFor(() => {
        expect(result.current.data).toEqual(mockUserPreferences);
      });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/user-preferences?userId=test-user-123',
        {
          credentials: 'include',
        }
      );
    });
  });
}); 