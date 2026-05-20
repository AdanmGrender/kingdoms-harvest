import { vi } from 'vitest';

const EventBridge = {
  on: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
  once: vi.fn(),
};

export default EventBridge;
