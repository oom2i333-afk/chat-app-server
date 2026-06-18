package com.wetalk.modules.message.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.wetalk.common.util.SeqIdGenerator;
import com.wetalk.modules.message.entity.Message;
import com.wetalk.modules.message.mapper.MessageMapper;
import com.wetalk.modules.message.service.MessageService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class MessageServiceImpl implements MessageService {

    private final MessageMapper messageMapper;
    private final SeqIdGenerator seqIdGenerator;
    private final StringRedisTemplate redis;

    @Override
    @Transactional
    public void saveMessage(Message msg) {
        if (msg.getSeqId() == null) {
            msg.setSeqId(seqIdGenerator.nextSeqId(msg.getFromUid()));
        }
        if (msg.getCreatedAt() == null) {
            msg.setCreatedAt(System.currentTimeMillis());
        }
        messageMapper.insert(msg);
    }

    @Override
    public List<Message> getMessages(String chatId, int limit, long offset) {
        LambdaQueryWrapper<Message> wrapper = new LambdaQueryWrapper<Message>()
                .eq(Message::getToUid, chatId)
                .or(w -> w.eq(Message::getFromUid, chatId))
                .orderByAsc(Message::getSeqId)
                .last("LIMIT " + limit + " OFFSET " + offset);
        return messageMapper.selectList(wrapper);
    }

    @Override
    public List<Message> syncMessages(String userId, long fromSeq, Long toSeq, int limit) {
        long maxSeq = toSeq != null ? toSeq : seqIdGenerator.currentSeqId(userId);
        return messageMapper.findBySeqRange(userId, fromSeq, maxSeq, limit);
    }

    @Override
    public List<Message> searchMessages(String userId, String keyword) {
        // Phase 2 will use ES for full-text search
        // Phase 1: search by toUid (simple)
        LambdaQueryWrapper<Message> wrapper = new LambdaQueryWrapper<Message>()
                .eq(Message::getFromUid, userId)
                .or(w -> w.eq(Message::getToUid, userId))
                .orderByDesc(Message::getCreatedAt)
                .last("LIMIT 50");
        return messageMapper.selectList(wrapper);
    }

    @Override
    @Transactional
    public boolean recallMessage(String msgId, String userId) {
        LambdaQueryWrapper<Message> wrapper = new LambdaQueryWrapper<Message>()
                .eq(Message::getMsgId, msgId)
                .eq(Message::getFromUid, userId);
        Message msg = messageMapper.selectOne(wrapper);
        if (msg == null) return false;
        msg.setStatus(3); // Recalled
        msg.setUpdatedAt(System.currentTimeMillis());
        messageMapper.updateById(msg);
        return true;
    }

    @Override
    @Transactional
    public boolean deleteMessage(String msgId, String userId) {
        LambdaQueryWrapper<Message> wrapper = new LambdaQueryWrapper<Message>()
                .eq(Message::getMsgId, msgId)
                .eq(Message::getFromUid, userId);
        return messageMapper.delete(wrapper) > 0;
    }

    @Override
    public void markRead(String userId, String chatId, long seqId) {
        redis.opsForValue().set("user:read:" + userId + ":" + chatId, String.valueOf(seqId));
    }
}
