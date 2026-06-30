import { describe, it, expect } from 'vitest'
import { isNoiseError } from '@/lib/error-noise'

describe('isNoiseError', () => {
  it('drops the Outlook-style extension error that was 55% of captured exceptions', () => {
    expect(
      isNoiseError(
        'Non-Error promise rejection captured with value: Object Not Found Matching Id:3, MethodName:update, ParamCount:4',
      ),
    ).toBe(true)
  })

  it('drops benign ResizeObserver loop warnings', () => {
    expect(isNoiseError('ResizeObserver loop limit exceeded')).toBe(true)
    expect(isNoiseError('ResizeObserver loop completed with undelivered notifications.')).toBe(true)
  })

  it('keeps real application errors', () => {
    expect(isNoiseError("NotFoundError: Failed to execute 'removeChild' on 'Node'")).toBe(false)
    expect(isNoiseError('TypeError: Cannot read properties of undefined')).toBe(false)
    expect(isNoiseError('Failed to fetch')).toBe(false)
  })

  it('handles null/undefined/empty safely', () => {
    expect(isNoiseError(null)).toBe(false)
    expect(isNoiseError(undefined)).toBe(false)
    expect(isNoiseError('')).toBe(false)
  })
})
