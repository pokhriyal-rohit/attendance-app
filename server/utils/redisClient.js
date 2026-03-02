const Redis = require("ioredis");

let redisClient = null;

const getRedisClient = () => {
  if (redisClient) {
    return redisClient;
  }

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    return null;
  }

  redisClient = new Redis(redisUrl, {
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
  });

  redisClient.on("error", (error) => {
    console.error("Redis error:", error.message);
  });

  return redisClient;
};

module.exports = { getRedisClient };
