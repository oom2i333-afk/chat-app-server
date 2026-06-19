package com.wetalk.modules.message.event;

import com.wetalk.modules.message.entity.Message;
import lombok.Getter;
import org.springframework.context.ApplicationEvent;

@Getter
public class MessageEvent extends ApplicationEvent {

    private final Message message;
    private final String senderUid;
    private final long timestamp;

    public MessageEvent(Object source, Message message, String senderUid) {
        super(source);
        this.message = message;
        this.senderUid = senderUid;
        this.timestamp = System.currentTimeMillis();
    }
}
