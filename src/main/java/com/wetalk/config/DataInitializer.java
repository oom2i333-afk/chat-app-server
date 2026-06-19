package com.wetalk.config;

import com.wetalk.modules.admin.entity.AdminUser;
import com.wetalk.modules.admin.mapper.AdminUserMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.DependsOn;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.UUID;

@Slf4j
@Component
@Profile("dev")
@DependsOn("dataSourceScriptDatabaseInitializer")
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {

    private final AdminUserMapper adminUserMapper;
    private final PasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) {
        // Check if admin exists
        long count = adminUserMapper.selectCount(null);
        if (count == 0) {
            AdminUser admin = new AdminUser();
            admin.setUsername("admin");
            admin.setPasswordHash(passwordEncoder.encode("admin888"));
            admin.setNickname("超级管理员");
            admin.setRole("SUPER_ADMIN");
            admin.setStatus(1);
            admin.setCreatedAt(System.currentTimeMillis());
            admin.setUpdatedAt(System.currentTimeMillis());
            adminUserMapper.insert(admin);
            log.info("Default admin created: admin / admin888");
        }

        // Log available users for testing
        log.info("Dev profile: H2 in-memory database ready");
    }
}
