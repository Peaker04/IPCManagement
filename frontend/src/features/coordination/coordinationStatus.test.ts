import { describe, expect, it } from 'vitest'
import { deriveCoordinationStatus } from './coordinationStatus'

describe('deriveCoordinationStatus', () => {
  const editable = {
    hasPlans: true,
    isReadOnly: false,
    canEditForecast: true,
    canRequestAdjustment: false,
    useFinalServings: false,
  }
  const locked = {
    hasPlans: true,
    isReadOnly: true,
    canEditForecast: false,
    canRequestAdjustment: true,
    useFinalServings: true,
  }
  const terminal = {
    hasPlans: true,
    isReadOnly: true,
    canEditForecast: false,
    canRequestAdjustment: false,
    useFinalServings: true,
  }

  it.each([
    {
      statuses: [],
      expected: {
        status: 'empty',
        hasPlans: false,
        isReadOnly: true,
        canEditForecast: false,
        canRequestAdjustment: false,
        useFinalServings: false,
      },
    },
    { statuses: ['DRAFT'], expected: { status: 'DRAFT', ...editable } },
    { statuses: ['FORECASTED'], expected: { status: 'FORECASTED', ...editable } },
    { statuses: ['CONFIRMED'], expected: { status: 'CONFIRMED', ...locked } },
    { statuses: ['ADJUSTED'], expected: { status: 'ADJUSTED', ...locked } },
    { statuses: ['COMPLETED'], expected: { status: 'COMPLETED', ...terminal } },
    { statuses: ['ARCHIVED'], expected: { status: 'ARCHIVED', ...terminal } },
    { statuses: ['CANCELLED'], expected: { status: 'CANCELLED', ...terminal } },
    {
      statuses: ['UNKNOWN'],
      expected: {
        status: 'UNKNOWN',
        hasPlans: true,
        isReadOnly: true,
        canEditForecast: false,
        canRequestAdjustment: false,
        useFinalServings: false,
      },
    },
  ])('maps the single-plan state $statuses', ({ statuses, expected }) => {
    expect(deriveCoordinationStatus(statuses)).toEqual(expected)
  })

  it.each([
    [['DRAFT', 'DRAFT'], 'DRAFT'],
    [['DRAFT', 'FORECASTED'], 'FORECASTED'],
    [['FORECASTED', 'DRAFT'], 'FORECASTED'],
    [['FORECASTED', 'FORECASTED'], 'FORECASTED'],
    [['CONFIRMED', 'CONFIRMED'], 'CONFIRMED'],
    [['CONFIRMED', 'ADJUSTED'], 'ADJUSTED'],
    [['ADJUSTED', 'CONFIRMED'], 'ADJUSTED'],
    [['ADJUSTED', 'ADJUSTED'], 'ADJUSTED'],
    [['COMPLETED', 'COMPLETED'], 'COMPLETED'],
    [['COMPLETED', 'ARCHIVED'], 'COMPLETED'],
    [['ARCHIVED', 'COMPLETED'], 'COMPLETED'],
    [['ARCHIVED', 'ARCHIVED'], 'ARCHIVED'],
    [['CANCELLED', 'CANCELLED'], 'CANCELLED'],
  ] as const)('aggregates compatible states %j', (statuses, expectedStatus) => {
    const expectedFlags = expectedStatus === 'DRAFT' || expectedStatus === 'FORECASTED'
      ? editable
      : expectedStatus === 'CONFIRMED' || expectedStatus === 'ADJUSTED'
        ? locked
        : terminal
    expect(deriveCoordinationStatus(statuses)).toEqual({
      status: expectedStatus,
      ...expectedFlags,
    })
  })

  it.each([
    ['DRAFT', 'CONFIRMED'],
    ['FORECASTED', 'ADJUSTED'],
    ['CONFIRMED', 'COMPLETED'],
    ['ADJUSTED', 'ARCHIVED'],
    ['COMPLETED', 'CANCELLED'],
  ])('blocks incompatible mixed states %s + %s', (left, right) => {
    expect(deriveCoordinationStatus([left, right])).toEqual({
      status: 'MIXED',
      hasPlans: true,
      isReadOnly: true,
      canEditForecast: false,
      canRequestAdjustment: false,
      useFinalServings: !([left, right].every((status) => status === 'DRAFT' || status === 'FORECASTED')),
    })
    expect(deriveCoordinationStatus([right, left]).status).toBe('MIXED')
  })

  it('normalizes case, whitespace, null, undefined and blank values', () => {
    expect(deriveCoordinationStatus([' confirmed ', 'adjusted'])).toMatchObject({
      status: 'ADJUSTED',
      isReadOnly: true,
    })
    expect(deriveCoordinationStatus([null])).toMatchObject({ status: 'DRAFT' })
    expect(deriveCoordinationStatus([undefined, ''])).toMatchObject({ status: 'DRAFT' })
  })

  it('gives loading precedence and blocks editing until synchronization completes', () => {
    expect(deriveCoordinationStatus(['COMPLETED'], true)).toEqual({
      status: 'syncing',
      hasPlans: true,
      isReadOnly: true,
      canEditForecast: false,
      canRequestAdjustment: false,
      useFinalServings: false,
    })
    expect(deriveCoordinationStatus([], true)).toEqual({
      status: 'syncing',
      hasPlans: false,
      isReadOnly: true,
      canEditForecast: false,
      canRequestAdjustment: false,
      useFinalServings: false,
    })
  })
})
