import { useState, useCallback } from 'react'

type MutationState<T> = {
  isLoading: boolean
  error: Error | null
  data: T | null
}

type MutateFunction<T, P> = (params: P) => Promise<T>
type OptimisticUpdater<T, P> = (currentData: T, params: P) => T
type RollbackFunction<T> = (originalData: T) => void

/**
 * A hook for handling optimistic mutations with automatic rollback on failure
 * 
 * @param mutationFn The function that performs the actual mutation
 * @param onSuccess Optional callback for successful mutations
 * @returns An object with the mutation function and state
 */
export function useOptimisticMutation<T, P = any>(
  mutationFn: MutateFunction<T, P>,
  optimisticUpdate: OptimisticUpdater<T, P>,
  rollbackFn: RollbackFunction<T>,
  onSuccess?: (data: T) => void
) {
  const [state, setState] = useState<MutationState<T>>({
    isLoading: false,
    error: null,
    data: null
  })

  const mutate = useCallback(
    async (params: P, currentData: T) => {
      setState({ isLoading: true, error: null, data: null })

      // Store original data for potential rollback
      const originalData = currentData

      try {
        // Apply optimistic update immediately
        const optimisticData = optimisticUpdate(currentData, params)

        // Perform the actual mutation
        const result = await mutationFn(params)

        // Update state with the result
        setState({
          isLoading: false,
          error: null,
          data: result
        })

        // Call success callback if provided
        if (onSuccess) {
          onSuccess(result)
        }

        return result
      } catch (error) {
        // Rollback on error
        rollbackFn(originalData)

        // Update state with the error
        setState({
          isLoading: false,
          error: error as Error,
          data: null
        })

        // Re-throw the error for the caller to handle
        throw error
      }
    },
    [mutationFn, optimisticUpdate, rollbackFn, onSuccess]
  )

  return {
    mutate,
    ...state
  }
}