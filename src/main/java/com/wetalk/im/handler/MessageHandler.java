package com.wetalk.im.handler;

import com.google.protobuf.InvalidProtocolBufferException;
import com.wetalk.common.util.SeqIdGenerator;
import com.wetalk.im.codec.ImProtocol;
import com.wetalk.im.session.ChannelAttrKeys;
import com.wetalk.im.session.ConnectionManager;
import io.netty.buffer.ByteBuf;
import io.netty.buffer.Unpooled;
import io.netty.channel.ChannelHandler;
import io.netty.channel.ChannelHandlerContext;
import io.netty.channel.SimpleChannelInboundHandler;
import io.netty.handler.codec.http.websocketx.BinaryWebSocketFrame;
import io.netty.handler.codec.http.websocketx.WebSocketFrame;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.util.Set;
import java.util.UUID;

@Slf4j
@ChannelHandler.Sharable
@Component
@RequiredArgsConstructor
public class MessageHandler extends SimpleChannelInboundHandler<WebSocketFrame> {

    private final ConnectionManager connectionManager;
    private final SeqIdGenerator seqIdGenerator;
    private final StringRedisTemplate redis;

    @Override
    protected void channelRead0(ChannelHandlerContext ctx, WebSocketFrame frame) {
        if (!(frame instanceof BinaryWebSocketFrame)) {
            return;
        }

        Boolean authenticated = ctx.channel().attr(ChannelAttrKeys.AUTHENTICATED).get();
        if (authenticated == null || !authenticated) {
            ctx.close();
            return;
        }

        ByteBuf buf = frame.content();
        byte[] data = new byte[buf.readableBytes()];
        buf.readBytes(data);

        ImProtocol.ImPacket packet;
        try {
            packet = ImProtocol.ImPacket.parseFrom(data);
        } catch (InvalidProtocolBufferException e) {
            log.warn("Invalid protobuf message: {}", e.getMessage());
            return;
        }

        ImProtocol.Header header = packet.getHeader();
        String userId = ctx.channel().attr(ChannelAttrKeys.USER_ID).get();
        String devId = ctx.channel().attr(ChannelAttrKeys.DEV_ID).get();

        int cmd = header.getCmd();
        switch (cmd) {
            case 100: // Ping
                handlePing(ctx);
                break;
            case 200: // Auth (already handled by ImAuthHandler for handshake)
                break;
            case 300: // Send message
                handleSendMessage(ctx, header, packet.getPayload().toByteArray(), userId, devId);
                break;
            case 301: // Delivery ACK
                handleAck(header, userId);
                break;
            case 302: // Read ACK
                handleRead(header, userId);
                break;
            default:
                log.warn("Unknown cmd: {}", cmd);
                sendError(ctx, header.getMsgId(), 500, "Unknown command");
        }
    }

    private void handlePing(ChannelHandlerContext ctx) {
        ImProtocol.ImPacket pong = ImProtocol.ImPacket.newBuilder()
                .setHeader(ImProtocol.Header.newBuilder()
                        .setCmd(101) // Pong
                        .setTimestamp(System.currentTimeMillis())
                        .build())
                .build();
        ctx.writeAndFlush(new BinaryWebSocketFrame(Unpooled.wrappedBuffer(pong.toByteArray())));
    }

    private void handleSendMessage(ChannelHandlerContext ctx, ImProtocol.Header reqHeader,
                                    byte[] payload, String fromUid, String devId) {
        String toUid = reqHeader.getToUid();
        String msgId = reqHeader.getMsgId();
        if (msgId.isEmpty()) msgId = UUID.randomUUID().toString();

        long seqId = seqIdGenerator.nextSeqId(fromUid);

        // Build push packet
        ImProtocol.ImPacket pushPacket = ImProtocol.ImPacket.newBuilder()
                .setHeader(ImProtocol.Header.newBuilder()
                        .setCmd(400) // Push
                        .setMsgId(msgId)
                        .setFromUid(fromUid)
                        .setToUid(toUid)
                        .setSeqId(seqId)
                        .setTimestamp(System.currentTimeMillis())
                        .setDevId(devId)
                        .build())
                .setPayload(com.google.protobuf.ByteString.copyFrom(payload))
                .build();

        boolean isGroup = toUid.startsWith("g_");
        if (isGroup) {
            // Group chat: push to all online members
            String membersKey = "group:members:" + toUid;
            Set<String> members = redis.opsForSet().members(membersKey);
            if (members != null) {
                for (String member : members) {
                    if (!member.equals(fromUid)) {
                        connectionManager.pushToUser(member, pushPacket);
                    }
                }
            }
        } else {
            // Single chat: push to receiver
            connectionManager.pushToAllDevices(toUid, pushPacket);
        }

        // Send ACK to sender
        ImProtocol.ImPacket ackPacket = ImProtocol.ImPacket.newBuilder()
                .setHeader(ImProtocol.Header.newBuilder()
                        .setCmd(301) // Msg ACK
                        .setMsgId(msgId)
                        .setFromUid(fromUid)
                        .setToUid(toUid)
                        .setSeqId(seqId)
                        .setTimestamp(System.currentTimeMillis())
                        .build())
                .build();
        ctx.writeAndFlush(new BinaryWebSocketFrame(Unpooled.wrappedBuffer(ackPacket.toByteArray())));

        // TODO: Persist to MySQL asynchronously
        log.debug("Message {} -> {} msgId={} seqId={}", fromUid, toUid, msgId, seqId);
    }

    private void handleAck(ImProtocol.Header header, String userId) {
        log.debug("Delivery ACK from {}: msgId={}", userId, header.getMsgId());
    }

    private void handleRead(ImProtocol.Header header, String userId) {
        String chatId = header.getToUid();
        long seqId = header.getSeqId();
        // Store read status in Redis
        redis.opsForValue().set("user:read:" + userId + ":" + chatId, String.valueOf(seqId));

        // Notify sender's other devices
        ImProtocol.ImPacket readNotify = ImProtocol.ImPacket.newBuilder()
                .setHeader(ImProtocol.Header.newBuilder()
                        .setCmd(302) // Read notification
                        .setFromUid(userId)
                        .setToUid(chatId)
                        .setSeqId(seqId)
                        .setTimestamp(System.currentTimeMillis())
                        .build())
                .build();
        // The sender would be notified through the message flow
        log.debug("Read ACK from {}: chatId={} seqId={}", userId, chatId, seqId);
    }

    private void sendError(ChannelHandlerContext ctx, String msgId, int code, String message) {
        ImProtocol.ImPacket errorPacket = ImProtocol.ImPacket.newBuilder()
                .setHeader(ImProtocol.Header.newBuilder()
                        .setCmd(500) // Error
                        .setMsgId(msgId)
                        .setTimestamp(System.currentTimeMillis())
                        .build())
                .setPayload(com.google.protobuf.ByteString.copyFrom(java.nio.ByteBuffer.allocate(4).putInt(code).array()))
                .build();
        ctx.writeAndFlush(new BinaryWebSocketFrame(Unpooled.wrappedBuffer(errorPacket.toByteArray())));
    }
}
