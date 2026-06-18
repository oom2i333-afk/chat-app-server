package com.wetalk.modules.payment.service;

import com.wetalk.modules.payment.entity.WalletTransaction;

import java.math.BigDecimal;
import java.util.List;

public interface WalletService {
    BigDecimal getBalance(String userId);
    List<WalletTransaction> getTransactions(String userId, int limit);
    String createTransaction(String userId, int type, BigDecimal amount, String relaId, String remark);
    boolean processPayment(String userId, String payPwd, BigDecimal amount);
}
