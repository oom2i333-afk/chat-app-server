package com.wetalk.modules.payment.service.impl;

import com.wetalk.common.BusinessException;
import com.wetalk.common.ErrorCode;
import com.wetalk.modules.payment.entity.WalletTransaction;
import com.wetalk.modules.payment.mapper.WalletTransactionMapper;
import com.wetalk.modules.payment.service.WalletService;
import com.wetalk.modules.user.entity.User;
import com.wetalk.modules.user.mapper.UserMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class WalletServiceImpl implements WalletService {

    private final UserMapper userMapper;
    private final WalletTransactionMapper transactionMapper;

    @Override
    public BigDecimal getBalance(String userId) {
        User user = userMapper.findByUid(userId);
        return user != null ? user.getBalance() : BigDecimal.ZERO;
    }

    @Override
    public List<WalletTransaction> getTransactions(String userId, int limit) {
        return transactionMapper.selectList(
                new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<WalletTransaction>()
                        .eq(WalletTransaction::getUserId, userId)
                        .orderByDesc(WalletTransaction::getCreatedAt)
                        .last("LIMIT " + limit));
    }

    @Override
    @Transactional
    public String createTransaction(String userId, int type, BigDecimal amount,
                                     String relaId, String remark) {
        User user = userMapper.findByUid(userId);
        if (user == null) throw new BusinessException(ErrorCode.USER_NOT_FOUND);

        String txId = "tx_" + UUID.randomUUID().toString().substring(0, 12);
        BigDecimal before = user.getBalance() != null ? user.getBalance() : BigDecimal.ZERO;
        BigDecimal after;

        // type: 1=recharge, 2=withdraw, 3=redPacketIncome, 4=redPacketExpense
        if (type == 3 || type == 5) {
            after = before.add(amount);
        } else if (type == 4 || type == 6 || type == 2) {
            after = before.subtract(amount);
            if (after.compareTo(BigDecimal.ZERO) < 0) {
                throw new BusinessException(ErrorCode.INSUFFICIENT_BALANCE);
            }
        } else {
            after = before.add(amount);
        }

        user.setBalance(after);
        userMapper.updateById(user);

        WalletTransaction tx = new WalletTransaction();
        tx.setTxId(txId); tx.setUserId(userId); tx.setType(type);
        tx.setAmount(amount); tx.setBalanceBefore(before);
        tx.setBalanceAfter(after); tx.setRelaId(relaId);
        tx.setRemark(remark); tx.setStatus(1);
        tx.setCreatedAt(System.currentTimeMillis());
        transactionMapper.insert(tx);

        return txId;
    }

    @Override
    public boolean processPayment(String userId, String payPwd, BigDecimal amount) {
        // Pay password verification (to be implemented with PBKDF2 in Phase 2)
        // For Phase 1, just check if balance is sufficient
        User user = userMapper.findByUid(userId);
        if (user == null) return false;
        BigDecimal bal = user.getBalance() != null ? user.getBalance() : BigDecimal.ZERO;
        return bal.compareTo(amount) >= 0;
    }
}
