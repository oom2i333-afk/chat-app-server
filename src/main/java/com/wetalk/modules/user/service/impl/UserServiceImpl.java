package com.wetalk.modules.user.service.impl;

import com.wetalk.auth.JwtTokenProvider;
import com.wetalk.common.BusinessException;
import com.wetalk.common.ErrorCode;
import com.wetalk.common.util.AesUtil;
import com.wetalk.modules.user.dto.*;
import com.wetalk.modules.user.entity.User;
import com.wetalk.modules.user.mapper.UserMapper;
import com.wetalk.modules.user.service.UserService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class UserServiceImpl implements UserService {

    private final UserMapper userMapper;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;

    @Override
    @Transactional
    public UserVO register(RegisterRequest req, String ip) {
        String phoneHash = sha256(req.getPhone());
        User existing = userMapper.findByPhoneHash(phoneHash);
        if (existing != null) {
            throw new BusinessException(ErrorCode.PHONE_EXISTS);
        }

        User user = new User();
        user.setUid(generateUid());
        user.setPhoneAes(AesUtil.encrypt(req.getPhone()));
        user.setPhoneHash(phoneHash);
        user.setPasswordHash(passwordEncoder.encode(req.getPassword()));
        user.setNickname("用户" + req.getPhone().substring(7));
        user.setGender(0);
        user.setVerifyStatus(0);
        user.setBalance(BigDecimal.ZERO);
        user.setPoints(0);
        user.setStatus(1);
        user.setInviteCode(req.getInviteCode());
        user.setRegIp(ip);
        user.setCreatedAt(System.currentTimeMillis());

        userMapper.insert(user);
        log.info("User registered: phone={} uid={}",
                req.getPhone().substring(0, 3) + "****" + req.getPhone().substring(7),
                user.getUid());

        return toVO(user);
    }

    @Override
    public LoginResponse login(LoginRequest req, String ip) {
        String phoneHash = sha256(req.getPhone());
        User user = userMapper.findByPhoneHash(phoneHash);
        if (user == null) {
            throw new BusinessException(ErrorCode.USER_NOT_FOUND);
        }
        if (user.getStatus() == 0) {
            throw new BusinessException(ErrorCode.ACCOUNT_BANNED);
        }
        if (!passwordEncoder.matches(req.getPassword(), user.getPasswordHash())) {
            throw new BusinessException(ErrorCode.PASSWORD_ERROR);
        }

        user.setLastLoginAt(System.currentTimeMillis());
        user.setLastLoginIp(ip);
        userMapper.updateById(user);

        LoginResponse resp = new LoginResponse();
        resp.setAccessToken(jwtTokenProvider.generateAccessToken(user.getUid(), "user"));
        resp.setRefreshToken(jwtTokenProvider.generateRefreshToken(user.getUid()));
        resp.setUser(toVO(user));

        log.info("User login: uid={}", user.getUid());
        return resp;
    }

    @Override
    public UserVO getProfile(String userId) {
        User user = userMapper.findByUid(userId);
        if (user == null) throw new BusinessException(ErrorCode.USER_NOT_FOUND);
        return toVO(user);
    }

    @Override
    @Transactional
    public UserVO updateProfile(String userId, ProfileRequest req) {
        User user = userMapper.findByUid(userId);
        if (user == null) throw new BusinessException(ErrorCode.USER_NOT_FOUND);

        if (req.getNickname() != null) {
            String clean = req.getNickname().trim().replaceAll("[<>&\"']", "");
            if (!clean.isEmpty()) {
                user.setNickname(clean.length() > 12 ? clean.substring(0, 12) : clean);
            }
        }
        if (req.getGender() != null && (req.getGender() == 1 || req.getGender() == 2)) {
            user.setGender(req.getGender());
        }
        if (req.getAvatar() != null && req.getAvatar().startsWith("http")) {
            user.setAvatar(req.getAvatar());
        }
        userMapper.updateById(user);
        return toVO(user);
    }

    @Override
    public User findByUid(String uid) {
        return userMapper.findByUid(uid);
    }

    private String sha256(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(input.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder();
            for (byte b : hash) hex.append(String.format("%02x", b));
            return hex.toString();
        } catch (Exception e) {
            throw new RuntimeException("SHA-256 failed", e);
        }
    }

    private String generateUid() {
        return "u_" + UUID.randomUUID().toString().substring(0, 8);
    }

    UserVO toVO(User user) {
        UserVO vo = new UserVO();
        vo.setUid(user.getUid());
        vo.setNickname(user.getNickname());
        vo.setAvatar(user.getAvatar());
        vo.setGender(user.getGender());
        String phone = AesUtil.decryptToString(user.getPhoneAes());
        vo.setPhone(phone != null ? phone.substring(0, 3) + "****" + phone.substring(7) : null);
        vo.setVerifyStatus(user.getVerifyStatus());
        vo.setBalance(user.getBalance());
        vo.setPoints(user.getPoints());
        vo.setCreatedAt(user.getCreatedAt());
        return vo;
    }
}
