package com.wetalk.im.session;

import com.google.protobuf.InvalidProtocolBufferException;
import com.wetalk.im.codec.ImProtocol;
import io.netty.channel.Channel;
import io.netty.handler.codec.http.websocketx.BinaryWebSocketFrame;
import io.netty.handler.codec.http.websocketx.WebSocketFrame;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

@Slf4j
@Component
public class ConnectionManager {

    private final Map<String, Map<String, Channel>> connections = new ConcurrentHashMap<>();
    private final StringRedisTemplate redis;

    public ConnectionManager(StringRedisTemplate redis) {
        this.redis = redis;
    }

    public void register(String userId, String devId, Channel channel) {
        connections.computeIfAbsent(userId, k -> new ConcurrentHashMap<>()).put(devId, channel);
        redis.opsForValue().set("im:online:" + userId + ":" + devId,
                channel.id().asLongText(), 5, TimeUnit.MINUTES);
        log.debug("User online: {} dev={}", userId, devId);
    }

    public void unregister(String userId, String devId) {
        Map<String, Channel> devs = connections.get(userId);
        if (devs != null) {
            devs.remove(devId);
            if (devs.isEmpty()) connections.remove(userId);
        }
        redis.delete("im:online:" + userId + ":" + devId);
        log.debug("User offline: {} dev={}", userId, devId);
    }

    public void pushToUser(String userId, ImProtocol.ImPacket packet) {
        Map<String, Channel> devs = connections.get(userId);
        if (devs == null) return;
        byte[] data = packet.toByteArray();
        for (Channel ch : devs.values()) {
            if (ch.isActive()) {
                ch.writeAndFlush(new BinaryWebSocketFrame(io.netty.buffer.Unpooled.wrappedBuffer(data)));
            }
        }
    }

    public void pushToUser(String userId, byte[] data) {
        Map<String, Channel> devs = connections.get(userId);
        if (devs == null) return;
        for (Channel ch : devs.values()) {
            if (ch.isActive()) {
                ch.writeAndFlush(new BinaryWebSocketFrame(io.netty.buffer.Unpooled.wrappedBuffer(data)));
            }
        }
    }

    public void pushToAllDevices(String userId, ImProtocol.ImPacket packet) {
        pushToUser(userId, packet);
    }

    public void pushToOtherDevices(String userId, String excludeDevId, byte[] data) {
        Map<String, Channel> devs = connections.get(userId);
        if (devs == null) return;
        for (Map.Entry<String, Channel> e : devs.entrySet()) {
            if (!e.getKey().equals(excludeDevId) && e.getValue().isActive()) {
                e.getValue().writeAndFlush(
                    new BinaryWebSocketFrame(io.netty.buffer.Unpooled.wrappedBuffer(data)));
            }
        }
    }

    public boolean isOnline(String userId) {
        Map<String, Channel> devs = connections.get(userId);
        return devs != null && !devs.isEmpty();
    }

    public Set<String> getOnlineFriends(Set<String> friendIds) {
        Set<String> online = ConcurrentHashMap.newKeySet();
        for (String fid : friendIds) {
            if (isOnline(fid)) online.add(fid);
        }
        return online;
    }

    public int getOnlineCount() {
        return connections.size();
    }
}
