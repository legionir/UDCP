import Redis from 'ioredis';

export function createRedis() {
  const redis = new Redis();

  return {
    set(key, val) {
      redis.set(key, JSON.stringify(val));
    }
  };
}
