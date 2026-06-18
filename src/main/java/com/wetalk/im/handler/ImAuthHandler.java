package com.wetalk.im.handler;

import com.wetalk.auth.JwtTokenProvider;
import com.wetalk.auth.UserPrincipal;
import com.wetalk.im.session.ChannelAttrKeys;
import com.wetalk.im.session.ConnectionManager;
import io.netty.channel.ChannelHandler;
import io.netty.channel.ChannelHandlerContext;
import io.netty.channel.ChannelInboundHandlerAdapter;
import io.netty.handler.codec.http.websocketx.WebSocketServerProtocolHandler;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@ChannelHandler.Sharable
@RequiredArgsConstructor
public class ImAuthHandler extends ChannelInboundHandlerAdapter {

    private final JwtTokenProvider jwtTokenProvider;
    private final ConnectionManager connectionManager;

    @Override
    public void userEventTriggered(ChannelHandlerContext ctx, Object evt) {
        if (evt instanceof WebSocketServerProtocolHandler.HandshakeComplete) {
            String uri = ((WebSocketServerProtocolHandler.HandshakeComplete) evt).requestUri();
            String token = getQueryParam(uri, "token");
            String devId = getQueryParam(uri, "devId");

            if (token == null || devId == null) {
                log.warn("IM connect rejected: missing token or devId");
                ctx.close();
                return;
            }

            UserPrincipal principal = jwtTokenProvider.validateAccessToken(token);
            if (principal == null) {
                log.warn("IM connect rejected: invalid token");
                ctx.close();
                return;
            }

            ctx.channel().attr(ChannelAttrKeys.USER_ID).set(principal.getUserId());
            ctx.channel().attr(ChannelAttrKeys.DEV_ID).set(devId);
            ctx.channel().attr(ChannelAttrKeys.AUTHENTICATED).set(true);

            connectionManager.register(principal.getUserId(), devId, ctx.channel());
            log.info("IM auth success: uid={} devId={}", principal.getUserId(), devId);
        }
    }

    @Override
    public void channelInactive(ChannelHandlerContext ctx) {
        String userId = ctx.channel().attr(ChannelAttrKeys.USER_ID).get();
        String devId = ctx.channel().attr(ChannelAttrKeys.DEV_ID).get();
        if (userId != null && devId != null) {
            connectionManager.unregister(userId, devId);
        }
        ctx.fireChannelInactive();
    }

    private String getQueryParam(String uri, String key) {
        int idx = uri.indexOf(key + "=");
        if (idx < 0) return null;
        int start = idx + key.length() + 1;
        int end = uri.indexOf('&', start);
        return end < 0 ? uri.substring(start) : uri.substring(start, end);
    }
}
