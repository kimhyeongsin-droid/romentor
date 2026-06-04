import { describe, it, expect } from 'vitest'
import {
  tierOf,
  decideAlert,
  ALERT_DEFICIT_MIN_DROP,
  ALERT_BELOW_TARGET_MIN_DROP,
  type AlertState,
} from './quote-calc'

// tierOf(effectiveExec, expected, amount)
describe('tierOf (실행가 경계선)', () => {
  it('effectiveExec ≤ expected 면 normal', () => {
    expect(tierOf(70, 80, 100)).toBe('normal')
    expect(tierOf(80, 80, 100)).toBe('normal') // 경계: 실제 = 예상
  })
  it('expected < effectiveExec ≤ amount 면 below_target', () => {
    expect(tierOf(90, 80, 100)).toBe('below_target')
    expect(tierOf(80.01, 80, 100)).toBe('below_target') // 예상 바로 초과
    expect(tierOf(100, 80, 100)).toBe('below_target') // 경계: 실제 = 금액
  })
  it('effectiveExec > amount 면 deficit', () => {
    expect(tierOf(100.01, 80, 100)).toBe('deficit') // 금액 바로 초과
    expect(tierOf(130, 80, 100)).toBe('deficit')
  })
  it('회귀: 목표(15%) 이상인 좋은 공종은 normal (오발송 금지)', () => {
    // amount=100000, expected=floor(100000*0.85)=85000
    // 철거 이윤율 36.7% → effective=63300, 창호 61.4% → effective=38600 (둘 다 expected 미만 = 좋음)
    expect(tierOf(63300, 85000, 100000)).toBe('normal')
    expect(tierOf(38600, 85000, 100000)).toBe('normal')
  })
  it('회귀: expected를 15%(이윤)로 잘못 쓰면 좋은 공종이 below_target으로 오발송됨 (버그 재현)', () => {
    // expected를 floor(amount*0.15)=15000 으로 계산하면(=bug #3) 위 좋은 공종들이 잘못 트리거
    expect(tierOf(63300, 15000, 100000)).toBe('below_target')
    expect(tierOf(38600, 15000, 100000)).toBe('below_target')
  })
  it('부분 입력: 미입력 항목은 예상=실제로 상쇄, 입력 항목만 경계에 반영', () => {
    // 항목A actual=60(예상50), 항목B 미입력(예상30) → effectiveExec=60+30=90, expected=50+30=80, amount=100
    expect(tierOf(90, 80, 100)).toBe('below_target')
    // 항목A actual=130(예상50), 항목B 미입력(예상30) → effectiveExec=160 > amount=100
    expect(tierOf(160, 80, 100)).toBe('deficit')
  })
})

const state = (tier: AlertState['tier'], profit: number, rate: number): AlertState => ({ tier, profit, rate })

describe('decideAlert', () => {
  it('normal 이면 항상 미발송', () => {
    expect(decideAlert(state('normal', 100, 20), undefined)).toBe(false)
    expect(decideAlert(state('normal', 100, 20), state('deficit', -100, -5))).toBe(false)
  })

  it('직전 상태 없으면 below_target/deficit 발송', () => {
    expect(decideAlert(state('below_target', 50, 10), undefined)).toBe(true)
    expect(decideAlert(state('deficit', -100, -5), undefined)).toBe(true)
  })

  it('tier 한 단계 악화 시 발송', () => {
    expect(decideAlert(state('deficit', -100, -5), state('below_target', 50, 10))).toBe(true)
    expect(decideAlert(state('below_target', 50, 10), state('normal', 100, 20))).toBe(true)
  })

  it('호전(tier 개선)에는 미발송', () => {
    expect(decideAlert(state('below_target', 50, 10), state('deficit', -100, -5))).toBe(false)
  })

  it('deficit 동일 tier — 이윤이 임계 이상 더 하락하면 발송', () => {
    const prev = state('deficit', -100000, -5)
    expect(decideAlert(state('deficit', -100000 - ALERT_DEFICIT_MIN_DROP, -8), prev)).toBe(true)
  })

  it('deficit 동일 tier — 임계 미만 미세 하락은 미발송(히스테리시스)', () => {
    const prev = state('deficit', -100000, -5)
    expect(decideAlert(state('deficit', -150000, -7), prev)).toBe(false) // 5만원 하락
  })

  it('deficit 동일 tier — 이윤 호전은 미발송', () => {
    expect(decideAlert(state('deficit', -50000, -2), state('deficit', -200000, -9))).toBe(false)
  })

  it('below_target 동일 tier — 이윤율이 임계 이상 더 하락하면 발송', () => {
    const prev = state('below_target', 50, 10)
    expect(decideAlert(state('below_target', 40, 10 - ALERT_BELOW_TARGET_MIN_DROP), prev)).toBe(true)
  })

  it('below_target 동일 tier — 임계 미만 미세 하락은 미발송(히스테리시스)', () => {
    const prev = state('below_target', 50, 10)
    expect(decideAlert(state('below_target', 48, 9.5), prev)).toBe(false) // 0.5%p 하락
  })

  it('below_target 동일 tier — 이윤율 호전은 미발송', () => {
    expect(decideAlert(state('below_target', 60, 12), state('below_target', 50, 10))).toBe(false)
  })
})
