import { describe, expect, it } from 'vitest';
import { CircuitBreaker, CircuitOpenError } from './circuit-breaker';

describe('CircuitBreaker', () => {
  it('starts closed', () => {
    const cb = new CircuitBreaker();
    expect(cb.isOpen()).toBe(false);
    expect(() => cb.ensureClosed()).not.toThrow();
  });

  it('stays closed under threshold critical errors', () => {
    const cb = new CircuitBreaker({ threshold: 3, windowSize: 10 });
    cb.recordCriticalError();
    cb.recordCriticalError();
    expect(cb.isOpen()).toBe(false);
  });

  it('opens at threshold critical errors', () => {
    const cb = new CircuitBreaker({ threshold: 3, windowSize: 10 });
    cb.recordCriticalError();
    cb.recordCriticalError();
    cb.recordCriticalError();
    expect(cb.isOpen()).toBe(true);
  });

  it('ensureClosed throws CircuitOpenError when open', () => {
    const cb = new CircuitBreaker({ threshold: 1, windowSize: 5 });
    cb.recordCriticalError();
    expect(() => cb.ensureClosed()).toThrow(CircuitOpenError);
  });

  it('counts criticals on a sliding window', () => {
    const cb = new CircuitBreaker({ threshold: 3, windowSize: 4 });
    cb.recordCriticalError();
    expect(cb.getCriticalCount()).toBe(1);
    cb.recordSuccess();
    cb.recordSuccess();
    cb.recordSuccess();
    expect(cb.getCriticalCount()).toBe(1);
    cb.recordSuccess();
    expect(cb.getCriticalCount()).toBe(0);
  });

  it('does not open when criticals are spread beyond the window', () => {
    const cb = new CircuitBreaker({ threshold: 3, windowSize: 5 });
    cb.recordCriticalError();
    for (let i = 0; i < 5; i++) {
      cb.recordSuccess();
    }
    cb.recordCriticalError();
    for (let i = 0; i < 5; i++) {
      cb.recordSuccess();
    }
    cb.recordCriticalError();
    expect(cb.isOpen()).toBe(false);
  });

  it('opens when criticals cluster within the window', () => {
    const cb = new CircuitBreaker({ threshold: 3, windowSize: 10 });
    for (let i = 0; i < 7; i++) {
      cb.recordSuccess();
    }
    cb.recordCriticalError();
    cb.recordCriticalError();
    cb.recordCriticalError();
    expect(cb.isOpen()).toBe(true);
  });

  it('stays open after further events until reset', () => {
    const cb = new CircuitBreaker({ threshold: 1, windowSize: 5 });
    cb.recordCriticalError();
    expect(cb.isOpen()).toBe(true);
    cb.recordSuccess();
    cb.recordSuccess();
    cb.recordSuccess();
    expect(cb.isOpen()).toBe(true);
  });

  it('reset closes the breaker and clears the window', () => {
    const cb = new CircuitBreaker({ threshold: 1, windowSize: 5 });
    cb.recordCriticalError();
    cb.reset();
    expect(cb.isOpen()).toBe(false);
    expect(cb.getCriticalCount()).toBe(0);
    expect(() => cb.ensureClosed()).not.toThrow();
  });
});
