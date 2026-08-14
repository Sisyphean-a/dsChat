import { describe, expect, it } from 'vitest'
import { getHttpsEndpointError, normalizeHttpsEndpoint } from './endpointValidation'

describe('endpointValidation', () => {
  it('normalizes HTTPS endpoints and rejects embedded credentials', () => {
    expect(normalizeHttpsEndpoint(' https://api.example.com/v1 ', '服务地址')).toBe('https://api.example.com/v1')
    expect(() => normalizeHttpsEndpoint('https://user:pass@example.com', '服务地址'))
      .toThrow('不能包含用户名或密码')
    expect(() => normalizeHttpsEndpoint('https://example.com/api?tenant=a', '服务地址'))
      .toThrow('不能包含查询参数或片段')
  })

  it('returns an actionable error for non-HTTPS endpoints', () => {
    expect(getHttpsEndpointError('http://localhost:8080/api', '服务地址'))
      .toBe('服务地址必须使用 HTTPS。')
  })
})
