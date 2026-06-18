package com.wetalk.im;

import com.wetalk.im.handler.*;
import io.netty.bootstrap.ServerBootstrap;
import io.netty.channel.*;
import io.netty.channel.nio.NioEventLoopGroup;
import io.netty.channel.socket.SocketChannel;
import io.netty.channel.socket.nio.NioServerSocketChannel;
import io.netty.handler.codec.http.HttpObjectAggregator;
import io.netty.handler.codec.http.HttpServerCodec;
import io.netty.handler.codec.http.websocketx.WebSocketServerProtocolHandler;
import io.netty.handler.timeout.IdleStateHandler;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@Profile("!dev")
@RequiredArgsConstructor
public class NettyServer {

    @Value("${im.port:8088}")
    private int port;

    @Value("${im.heartbeat-timeout:45}")
    private int heartbeatTimeout;

    private final ImAuthHandler authHandler;
    private final HeartbeatHandler heartbeatHandler;
    private final MessageHandler messageHandler;
    private final ExceptionHandler exceptionHandler;

    private EventLoopGroup bossGroup;
    private EventLoopGroup workerGroup;
    private Channel serverChannel;

    @PostConstruct
    public void start() throws InterruptedException {
        bossGroup = new NioEventLoopGroup(1);
        workerGroup = new NioEventLoopGroup();

        ServerBootstrap bootstrap = new ServerBootstrap()
            .group(bossGroup, workerGroup)
            .channel(NioServerSocketChannel.class)
            .option(ChannelOption.SO_BACKLOG, 1024)
            .childOption(ChannelOption.TCP_NODELAY, true)
            .childOption(ChannelOption.SO_KEEPALIVE, true)
            .childHandler(new ChannelInitializer<SocketChannel>() {
                @Override
                protected void initChannel(SocketChannel ch) {
                    ChannelPipeline p = ch.pipeline();
                    p.addLast(new IdleStateHandler(heartbeatTimeout, 0, 0));
                    p.addLast(new HttpServerCodec());
                    p.addLast(new HttpObjectAggregator(65536));
                    p.addLast(new WebSocketServerProtocolHandler("/im", null, true));
                    p.addLast(authHandler);
                    p.addLast(heartbeatHandler);
                    p.addLast(messageHandler);
                    p.addLast(exceptionHandler);
                }
            });

        serverChannel = bootstrap.bind(port).sync().channel();
        log.info("Netty IM server started on port {}", port);
    }

    @PreDestroy
    public void stop() {
        if (serverChannel != null) {
            serverChannel.close();
        }
        if (bossGroup != null) {
            bossGroup.shutdownGracefully();
        }
        if (workerGroup != null) {
            workerGroup.shutdownGracefully();
        }
        log.info("Netty IM server stopped");
    }
}
