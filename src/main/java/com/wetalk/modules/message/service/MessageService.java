package com.wetalk.modules.message.service;

import com.wetalk.modules.message.entity.Message;

import java.util.List;

public interface MessageService {
    void saveMessage(Message msg);
    List<Message> getMessages(String chatId, int limit, long offset);
    List<Message> syncMessages(String userId, long fromSeq, Long toSeq, int limit);
    List<Message> searchMessages(String userId, String keyword);
    boolean deleteMessage(String msgId, String userId);
    boolean recallMessage(String msgId, String userId);
    void markRead(String userId, String chatId, long seqId);
}
