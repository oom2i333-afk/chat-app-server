package com.wetalk.im.session;

import io.netty.util.AttributeKey;

public final class ChannelAttrKeys {
    public static final AttributeKey<String> USER_ID = AttributeKey.valueOf("userId");
    public static final AttributeKey<String> DEV_ID = AttributeKey.valueOf("devId");
    public static final AttributeKey<Boolean> AUTHENTICATED = AttributeKey.valueOf("authenticated");

    private ChannelAttrKeys() {}
}
