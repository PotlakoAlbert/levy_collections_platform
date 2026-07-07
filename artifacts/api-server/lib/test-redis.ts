// artifacts/api-server/src/lib/test-redis.ts
import IORedis from 'ioredis'

const redis = new IORedis(process.env.REDIS_URL!, { maxRetriesPerRequest: null })

redis.ping().then(res => {
  console.log('Redis ping:', res) // should print "PONG"
  redis.quit()
}).catch(err => {
  console.error('Redis failed:', err.message)
})