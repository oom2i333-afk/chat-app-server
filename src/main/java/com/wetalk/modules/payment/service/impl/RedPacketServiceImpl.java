package com.wetalk.modules.payment.service.impl;

import com.wetalk.common.BusinessException;
import com.wetalk.common.ErrorCode;
import com.wetalk.modules.payment.entity.RedPacket;
import com.wetalk.modules.payment.entity.RedPacketRecord;
import com.wetalk.modules.payment.mapper.RedPacketMapper;
import com.wetalk.modules.payment.mapper.RedPacketRecordMapper;
import com.wetalk.modules.payment.service.RedPacketService;
import com.wetalk.modules.payment.service.WalletService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.security.SecureRandom;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class RedPacketServiceImpl implements RedPacketService {

    private final RedPacketMapper redPacketMapper;
    private final RedPacketRecordMapper recordMapper;
    private final WalletService walletService;
    private static final SecureRandom RANDOM = new SecureRandom();

    @Override
    @Transactional
    public Map<String, Object> sendRedPacket(String userId, String chatId,
                                              BigDecimal amount, Integer count,
                                              String blessing, int type) {
        if (amount.compareTo(BigDecimal.ZERO) <= 0 || amount.compareTo(new BigDecimal("200")) > 0) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "金额需在 0.01~200 元之间");
        }

        String packetId = "rp_" + UUID.randomUUID().toString().substring(0, 12);

        RedPacket rp = new RedPacket();
        rp.setPacketId(packetId);
        rp.setSenderUid(userId);
        rp.setChatId(chatId);
        rp.setType(type);
        rp.setTotalAmount(amount);
        rp.setTotalCount(count != null ? count : 1);
        rp.setRemainAmount(amount);
        rp.setRemainCount(count != null ? count : 1);
        rp.setBlessing(blessing != null ? blessing : "恭喜发财，大吉大利");
        rp.setStatus(0);
        rp.setExpireAt(System.currentTimeMillis() + 86400000L); // 24h expiry
        rp.setCreatedAt(System.currentTimeMillis());
        redPacketMapper.insert(rp);

        // Deduct from balance
        walletService.createTransaction(userId, 4, amount, packetId, "发红包");

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("packetId", packetId);
        result.put("amount", amount);
        result.put("blessing", rp.getBlessing());
        return result;
    }

    @Override
    @Transactional
    public Map<String, Object> openRedPacket(String userId, String packetId) {
        RedPacket rp = redPacketMapper.selectOne(
                new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<RedPacket>()
                        .eq(RedPacket::getPacketId, packetId));

        if (rp == null) throw new BusinessException(ErrorCode.RED_PACKET_EXPIRED);
        if (rp.getStatus() == 1) throw new BusinessException(ErrorCode.RED_PACKET_CLAIMED);
        if (rp.getStatus() == 2) throw new BusinessException(ErrorCode.RED_PACKET_EXPIRED);
        if (rp.getSenderUid().equals(userId)) throw new BusinessException(ErrorCode.RED_PACKET_SELF);
        if (System.currentTimeMillis() > rp.getExpireAt()) {
            rp.setStatus(2);
            redPacketMapper.updateById(rp);
            throw new BusinessException(ErrorCode.RED_PACKET_EXPIRED);
        }

        // Check if already claimed
        long claimed = recordMapper.selectCount(
                new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<RedPacketRecord>()
                        .eq(RedPacketRecord::getPacketId, packetId)
                        .eq(RedPacketRecord::getUserId, userId));
        if (claimed > 0) throw new BusinessException(ErrorCode.RED_PACKET_CLAIMED);

        // Calculate amount (for group red packets, random split)
        BigDecimal amount;
        if (rp.getRemainCount() == 1) {
            amount = rp.getRemainAmount();
        } else {
            // Random split: at least 0.01, at most (remain * 2 / remainCount)
            BigDecimal max = rp.getRemainAmount().multiply(new BigDecimal("2"))
                    .divide(new BigDecimal(rp.getRemainCount()), 2, RoundingMode.DOWN);
            if (max.compareTo(new BigDecimal("0.01")) < 0) max = new BigDecimal("0.01");
            double rand = RANDOM.nextDouble();
            amount = max.multiply(new BigDecimal(rand)).setScale(2, RoundingMode.DOWN);
            if (amount.compareTo(new BigDecimal("0.01")) < 0) amount = new BigDecimal("0.01");
        }

        // Update red packet
        rp.setRemainAmount(rp.getRemainAmount().subtract(amount));
        rp.setRemainCount(rp.getRemainCount() - 1);
        if (rp.getRemainCount() == 0) rp.setStatus(1);
        rp.setUpdatedAt(System.currentTimeMillis());
        redPacketMapper.updateById(rp);

        // Save record
        RedPacketRecord record = new RedPacketRecord();
        record.setPacketId(packetId);
        record.setUserId(userId);
        record.setAmount(amount);
        record.setCreatedAt(System.currentTimeMillis());
        recordMapper.insert(record);

        // Credit to wallet
        walletService.createTransaction(userId, 3, amount, packetId, "领取红包");

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("amount", amount);
        result.put("senderName", rp.getSenderUid());
        result.put("blessing", rp.getBlessing());
        return result;
    }

    @Override
    public RedPacket getRedPacket(String packetId) {
        return redPacketMapper.selectOne(
                new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<RedPacket>()
                        .eq(RedPacket::getPacketId, packetId));
    }

    @Override
    public List<RedPacketRecord> getRecords(String packetId) {
        return recordMapper.selectList(
                new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<RedPacketRecord>()
                        .eq(RedPacketRecord::getPacketId, packetId)
                        .orderByDesc(RedPacketRecord::getCreatedAt));
    }
}
