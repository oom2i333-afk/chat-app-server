package com.wetalk.modules.user.service;

import com.wetalk.modules.user.dto.*;
import com.wetalk.modules.user.entity.User;

public interface UserService {
    UserVO register(RegisterRequest req, String ip);
    LoginResponse login(LoginRequest req, String ip);
    UserVO getProfile(String userId);
    UserVO updateProfile(String userId, ProfileRequest req);
    User findByUid(String uid);
}
