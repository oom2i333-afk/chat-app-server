package com.wetalk.config;

import org.springframework.data.redis.connection.BitFieldSubCommands;
import org.springframework.data.redis.core.*;

import java.time.Duration;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;

/**
 * 内存版 StringRedisTemplate，用于 dev profile 无真实 Redis 场景。
 * 独立外部类，不涉及 @Configuration 代理问题。
 */
public class InMemoryRedisTemplate extends StringRedisTemplate {

    private final ConcurrentHashMap<String, String> store = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Long> expires = new ConcurrentHashMap<>();

    // ── 核心覆盖 ──

    @Override
    public ValueOperations<String, String> opsForValue() {
        return new InMemoryValueOperations(store, expires);
    }

    @Override
    public SetOperations<String, String> opsForSet() {
        return new InMemorySetOperations();
    }

    @Override
    public Boolean hasKey(String key) {
        evictExpired();
        return store.containsKey(key);
    }

    @Override
    public Boolean delete(String key) {
        store.remove(key);
        expires.remove(key);
        return true;
    }

    @Override
    public Boolean expire(String key, long timeout, TimeUnit unit) {
        if (store.containsKey(key)) {
            expires.put(key, System.currentTimeMillis() + unit.toMillis(timeout));
            return true;
        }
        return false;
    }

    @Override
    public Long getExpire(String key) {
        return getExpire(key, TimeUnit.MILLISECONDS);
    }

    @Override
    public Long getExpire(String key, TimeUnit timeUnit) {
        Long exp = expires.get(key);
        if (exp == null) return -1L;
        long remain = exp - System.currentTimeMillis();
        return remain <= 0 ? -2L : timeUnit.convert(remain, TimeUnit.MILLISECONDS);
    }

    private void evictExpired() {
        long now = System.currentTimeMillis();
        List<String> expired = new ArrayList<>();
        expires.forEach((k, v) -> { if (v <= now) expired.add(k); });
        expired.forEach(k -> { store.remove(k); expires.remove(k); });
    }

    // ═══════════════════════════════════════════════
    //  InMemoryValueOperations
    // ═══════════════════════════════════════════════

    private static class InMemoryValueOperations implements ValueOperations<String, String> {

        private final ConcurrentHashMap<String, String> store;
        private final ConcurrentHashMap<String, Long> expires;

        InMemoryValueOperations(ConcurrentHashMap<String, String> store, ConcurrentHashMap<String, Long> expires) {
            this.store = store;
            this.expires = expires;
        }

        private void evict() {
            long now = System.currentTimeMillis();
            expires.entrySet().removeIf(e -> e.getValue() <= now);
            expires.keySet().forEach(k -> store.remove(k));
        }

        @Override public void set(String key, String value) { store.put(key, value); }
        @Override public void set(String key, String value, long timeout, TimeUnit unit) {
            store.put(key, value);
            if (timeout > 0) expires.put(key, System.currentTimeMillis() + unit.toMillis(timeout));
        }
        @Override public void set(String key, String value, long seconds) {
            store.put(key, value);
            if (seconds > 0) expires.put(key, System.currentTimeMillis() + seconds * 1000);
        }
        @Override public void set(String key, String value, Duration ttl) {
            set(key, value, ttl.toMillis(), TimeUnit.MILLISECONDS);
        }

        @Override public Boolean setIfAbsent(String key, String value) { return store.putIfAbsent(key, value) == null; }
        @Override public Boolean setIfAbsent(String key, String value, long timeout, TimeUnit unit) {
            boolean absent = store.putIfAbsent(key, value) == null;
            if (absent && timeout > 0) expires.put(key, System.currentTimeMillis() + unit.toMillis(timeout));
            return absent;
        }
        @Override public Boolean setIfAbsent(String key, String value, Duration ttl) {
            return setIfAbsent(key, value, ttl.toMillis(), TimeUnit.MILLISECONDS);
        }
        @Override public Boolean setIfPresent(String key, String value) { return store.replace(key, value) != null; }
        @Override public Boolean setIfPresent(String key, String value, long timeout, TimeUnit unit) {
            boolean present = store.replace(key, value) != null;
            if (present && timeout > 0) expires.put(key, System.currentTimeMillis() + unit.toMillis(timeout));
            return present;
        }
        @Override public Boolean setIfPresent(String key, String value, Duration ttl) {
            return setIfPresent(key, value, ttl.toMillis(), TimeUnit.MILLISECONDS);
        }

        @Override public void multiSet(Map<? extends String, ? extends String> map) { store.putAll((Map<String, String>) map); }
        @Override public Boolean multiSetIfAbsent(Map<? extends String, ? extends String> map) {
            boolean allAbsent = true;
            for (String key : map.keySet()) { if (store.containsKey(key)) { allAbsent = false; break; } }
            if (allAbsent) store.putAll((Map<String, String>) map);
            return allAbsent;
        }

        @Override public String get(Object key) { evict(); return store.get(key); }
        @Override public String getAndDelete(String key) { return store.remove(key); }
        @Override public String getAndExpire(String key, long timeout, TimeUnit unit) {
            String val = store.get(key);
            if (val != null && timeout > 0) expires.put(key, System.currentTimeMillis() + unit.toMillis(timeout));
            return val;
        }
        @Override public String getAndExpire(String key, Duration ttl) {
            return getAndExpire(key, ttl.toMillis(), TimeUnit.MILLISECONDS);
        }
        @Override public String getAndPersist(String key) { expires.remove(key); return store.get(key); }
        @Override public String getAndSet(String key, String value) { return store.replace(key, value); }
        @Override public String get(String key, long start, long end) {
            String val = store.get(key);
            if (val == null) return null;
            long s = Math.max(0, start);
            long e = end < 0 ? val.length() + end : Math.min(val.length(), end + 1);
            if (s >= val.length() || s >= e) return "";
            return val.substring((int) s, (int) Math.min(e, val.length()));
        }
        @Override public List<String> multiGet(Collection<String> keys) { evict(); return keys.stream().map(store::get).toList(); }
        @Override public Long increment(String key) { return increment(key, 1L); }
        @Override public Long increment(String key, long delta) {
            AtomicLong holder = new AtomicLong();
            store.compute(key, (k, v) -> { long n = (v == null ? 0 : Long.parseLong(v)) + delta; holder.set(n); return String.valueOf(n); });
            return holder.get();
        }
        @Override public Double increment(String key, double delta) {
            AtomicLong holder = new AtomicLong();
            store.compute(key, (k, v) -> { double n = (v == null ? 0 : Double.parseDouble(v)) + delta; holder.set((long)n); return String.valueOf(n); });
            return (double) holder.get();
        }
        @Override public Long decrement(String key) { return increment(key, -1L); }
        @Override public Long decrement(String key, long delta) { return increment(key, -delta); }
        @Override public Integer append(String key, String value) {
            int[] holder = new int[1];
            store.compute(key, (k, v) -> { String r = (v == null ? "" : v) + value; holder[0] = r.length(); return r; });
            return holder[0];
        }
        @Override public Long size(String key) { String v = store.get(key); return v == null ? 0L : (long) v.length(); }
        @Override public Boolean setBit(String key, long offset, boolean value) { return null; }
        @Override public Boolean getBit(String key, long offset) { return null; }
        @Override public List<Long> bitField(String key, BitFieldSubCommands subCommands) { return null; }
        @Override public RedisOperations<String, String> getOperations() { return null; }
    }

    // ═══════════════════════════════════════════════
    //  InMemorySetOperations
    // ═══════════════════════════════════════════════

    private static class InMemorySetOperations implements SetOperations<String, String> {
        private final ConcurrentHashMap<String, Set<String>> sets = new ConcurrentHashMap<>();

        @Override public Long add(String key, String... values) {
            boolean added = sets.computeIfAbsent(key, k -> ConcurrentHashMap.newKeySet()).addAll(Arrays.asList(values));
            return added ? 1L : 0L;
        }
        @Override public Set<String> members(String key) { return sets.getOrDefault(key, Collections.emptySet()); }
        @Override public Boolean isMember(String key, Object o) {
            Set<String> s = sets.get(key); return s != null && s.contains(o);
        }
        @Override public Map<Object, Boolean> isMember(String key, Object... values) { return null; }
        @Override public Long remove(String key, Object... values) {
            Set<String> s = sets.get(key); if (s == null) return 0L;
            long n = 0; for (Object v : values) if (s.remove(v)) n++;
            return n;
        }
        @Override public Long size(String key) { Set<String> s = sets.get(key); return s == null ? 0L : (long) s.size(); }
        @Override public String pop(String key) { return pop(key, 1).stream().findFirst().orElse(null); }
        @Override public List<String> pop(String key, long count) {
            Set<String> s = sets.get(key);
            if (s == null) return Collections.emptyList();
            List<String> popped = new ArrayList<>();
            Iterator<String> it = s.iterator();
            for (int i = 0; i < count && it.hasNext(); i++) { popped.add(it.next()); it.remove(); }
            return popped;
        }
        @Override public Boolean move(String key, String value, String destKey) {
            return remove(key, value) > 0 && add(destKey, value) > 0;
        }
        @Override public Set<String> intersect(String key, String otherKey) { return null; }
        @Override public Set<String> intersect(String key, Collection<String> otherKeys) { return null; }
        @Override public Set<String> intersect(Collection<String> keys) { return null; }
        @Override public Long intersectAndStore(String key, String otherKey, String destKey) { return null; }
        @Override public Long intersectAndStore(String key, Collection<String> otherKeys, String destKey) { return null; }
        @Override public Long intersectAndStore(Collection<String> keys, String destKey) { return null; }
        @Override public Set<String> union(String key, String otherKey) { return null; }
        @Override public Set<String> union(String key, Collection<String> otherKeys) { return null; }
        @Override public Set<String> union(Collection<String> keys) { return null; }
        @Override public Long unionAndStore(String key, String otherKey, String destKey) { return null; }
        @Override public Long unionAndStore(String key, Collection<String> otherKeys, String destKey) { return null; }
        @Override public Long unionAndStore(Collection<String> keys, String destKey) { return null; }
        @Override public Set<String> difference(String key, String otherKey) { return null; }
        @Override public Set<String> difference(String key, Collection<String> otherKeys) { return null; }
        @Override public Set<String> difference(Collection<String> keys) { return null; }
        @Override public Long differenceAndStore(String key, String otherKey, String destKey) { return null; }
        @Override public Long differenceAndStore(String key, Collection<String> otherKeys, String destKey) { return null; }
        @Override public Long differenceAndStore(Collection<String> keys, String destKey) { return null; }
        @Override public String randomMember(String key) { return null; }
        @Override public Set<String> distinctRandomMembers(String key, long count) { return null; }
        @Override public List<String> randomMembers(String key, long count) { return null; }
        @Override public Cursor<String> scan(String key, ScanOptions options) { return null; }
        @Override public RedisOperations<String, String> getOperations() { return null; }
    }
}
