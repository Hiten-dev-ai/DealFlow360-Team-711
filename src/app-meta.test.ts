import { describe, expect, it } from 'vitest';
import { APP_NAME, TEAM_NAME } from './app-meta';

describe('application metadata', () => {
  it('identifies the product and team', () => {
    expect(APP_NAME).toBe('DealFlow360');
    expect(TEAM_NAME).toBe('Team 711');
  });
});
