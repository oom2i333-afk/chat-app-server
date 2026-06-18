package com.wetalk.modules.e2e.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.wetalk.modules.e2e.entity.UserKey;
import com.wetalk.modules.e2e.mapper.UserKeyMapper;
import com.wetalk.modules.e2e.service.E2EKeyService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class E2EKeyServiceImpl implements E2EKeyService {

    private final UserKeyMapper userKeyMapper;

    @Override
    public void registerPublicKey(String userId, String publicKey, String keyType, String signature) {
        // Delete old key of same type
        userKeyMapper.delete(new LambdaQueryWrapper<UserKey>()
                .eq(UserKey::getUserId, userId)
                .eq(UserKey::getKeyType, keyType));

        UserKey key = new UserKey();
        key.setUserId(userId);
        key.setPublicKey(publicKey);
        key.setKeyType(keyType);
        key.setSignature(signature);
        key.setCreatedAt(System.currentTimeMillis());
        key.setUpdatedAt(System.currentTimeMillis());
        userKeyMapper.insert(key);
    }

    @Override
    public String getPublicKey(String userId) {
        UserKey key = userKeyMapper.selectOne(
                new LambdaQueryWrapper<UserKey>()
                        .eq(UserKey::getUserId, userId)
                        .eq(UserKey::getKeyType, "identity")
                        .last("LIMIT 1"));
        return key != null ? key.getPublicKey() : null;
    }

    @Override
    public List<Map<String, String>> getPreKeys(String userId) {
        List<UserKey> keys = userKeyMapper.selectList(
                new LambdaQueryWrapper<UserKey>()
                        .eq(UserKey::getUserId, userId)
                        .eq(UserKey::getKeyType, "one-time-pre")
                        .last("LIMIT 10"));
        return keys.stream().map(k -> {
            Map<String, String> m = new LinkedHashMap<>();
            m.put("keyId", String.valueOf(k.getId()));
            m.put("publicKey", k.getPublicKey());
            m.put("signature", k.getSignature());
            return m;
        }).collect(Collectors.toList());
    }
}
