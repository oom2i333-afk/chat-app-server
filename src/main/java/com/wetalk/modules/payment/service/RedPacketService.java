package com.wetalk.modules.payment.service;

import com.wetalk.modules.payment.entity.RedPacket;
import com.wetalk.modules.payment.entity.RedPacketRecord;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

public interface RedPacketService {
    Map<String, Object> sendRedPacket(String userId, String chatId, BigDecimal amount,
                                       Integer count, String blessing, int type);
    Map<String, Object> openRedPacket(String userId, String packetId);
    RedPacket getRedPacket(String packetId);
    List<RedPacketRecord> getRecords(String packetId);
}
