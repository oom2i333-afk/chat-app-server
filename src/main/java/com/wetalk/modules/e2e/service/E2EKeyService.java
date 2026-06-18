package com.wetalk.modules.e2e.service;

import java.util.List;
import java.util.Map;

public interface E2EKeyService {
    void registerPublicKey(String userId, String publicKey, String keyType, String signature);
    String getPublicKey(String userId);
    List<Map<String, String>> getPreKeys(String userId);
}
