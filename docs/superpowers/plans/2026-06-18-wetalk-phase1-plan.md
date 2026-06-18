# WeTalk Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a fully functional chat application (WeTalk v4.0) as a Spring Boot monolith deployed on Railway, supporting registration/login, messaging (text/image/voice/file), friends/groups, red packets, E2E encryption, and admin console.

**Architecture:** Single Spring Boot 3.x application with embedded Netty for WebSocket IM, MySQL + Redis on Railway plugins, OSS for file storage. Code organized by package (`wetalk-modules/*`) for future microservice extraction.

**Tech Stack:** Java 21, Spring Boot 3.x, Netty, MySQL 8.0, Redis 7, Thymeleaf (admin), BouncyCastle (E2E), Alibaba Cloud OSS

---

## Global Constraints

- Java 21+ required, no older JDK
- Spring Boot 3.2+, no 2.x versions
- WebSocket via Netty, NOT Socket.io or Spring WebSocket STOMP
- Protocol Buffers for IM wire format (not JSON over WebSocket by default)
- MySQL 8.0+ with `utf8mb4` charset everywhere
- Redis 7+ for online status, seqId, caching
- All passwords hashed with bcrypt(12) minimum
- E2E encryption using Curve25519 + AES-256-GCM
- Mobile number encrypted with AES-256 in DB, indexed via SHA-256 hash
- All file uploads go through OSS, not local disk (except temp cache)
- Admin frontend deployed separately to Vercel as static React SPA
- Every REST API prefixed with `/api/v1/`
- Every API response wraps in `ApiResponse<T>` { success, data, error, timestamp }
- JWT access token 15min + refresh token 7d
- Rate limiting on login (5/min), register (3/min), SMS (1/min), general API (120/min)
- Git commit messages follow `feat:`, `fix:`, `chore:`, `docs:` prefixes

---

## Project File Structure

```
wetalk-server/
├── pom.xml
├── src/main/java/com/wetalk/
│   ├── WetalkApplication.java                         # Spring Boot entry
│   ├── config/
│   │   ├── WebConfig.java                             # CORS, Jackson, interceptors
│   │   ├── SecurityConfig.java                        # JWT filter, password encoder
│   │   ├── RateLimitConfig.java                       # Rate limiting interceptor
│   │   ├── RedisConfig.java                           # RedisTemplate config
│   │   ├── MyBatisConfig.java                         # MyBatis Plus config
│   │   └── OSSConfig.java                             # OSS client config
│   │
│   ├── common/
│   │   ├── ApiResponse.java                           # Unified response wrapper
│   │   ├── BusinessException.java                     # Business exception
│   │   ├── ErrorCode.java                             # Error code enum
│   │   ├── desensitize/
│   │   │   ├── DesensitizedSerializer.java            # Log desensitization
│   │   │   └── AesEncryptTypeHandler.java             # MyBatis AES type handler
│   │   └── util/
│   │       ├── Md5Util.java
│   │       ├── AesUtil.java
│   │       └── SeqIdGenerator.java                    # Redis-based seqId
│   │
│   ├── auth/
│   │   ├── JwtTokenProvider.java                      # JWT issue/verify
│   │   ├── JwtAuthenticationFilter.java               # OncePerRequestFilter
│   │   ├── CurrentUser.java                           # @AuthenticationPrincipal annotation
│   │   └── UserPrincipal.java                         # Auth user DTO
│   │
│   ├── modules/
│   │   ├── user/
│   │   │   ├── controller/UserController.java
│   │   │   ├── service/UserService.java
│   │   │   ├── service/impl/UserServiceImpl.java
│   │   │   ├── mapper/UserMapper.java
│   │   │   ├── entity/User.java
│   │   │   ├── dto/
│   │   │   │   ├── LoginRequest.java
│   │   │   │   ├── RegisterRequest.java
│   │   │   │   ├── UserVO.java
│   │   │   │   └── ProfileRequest.java
│   │   │   └── UserControllerTest.java
│   │   │
│   │   ├── social/
│   │   │   ├── controller/FriendController.java
│   │   │   ├── controller/GroupController.java
│   │   │   ├── service/FriendService.java
│   │   │   ├── service/GroupService.java
│   │   │   ├── mapper/FriendMapper.java
│   │   │   ├── mapper/GroupMapper.java
│   │   │   ├── mapper/GroupMemberMapper.java
│   │   │   ├── entity/FriendRelation.java
│   │   │   ├── entity/GroupInfo.java
│   │   │   ├── entity/GroupMember.java
│   │   │   └── dto/...
│   │   │
│   │   ├── message/
│   │   │   ├── controller/MessageController.java      # REST sync/history
│   │   │   ├── service/MessageService.java
│   │   │   ├── service/impl/MessageServiceImpl.java
│   │   │   ├── mapper/MessageMapper.java
│   │   │   ├── entity/Message.java
│   │   │   └── dto/MessageSyncRequest.java
│   │   │
│   │   ├── payment/
│   │   │   ├── controller/WalletController.java
│   │   │   ├── controller/RedPacketController.java
│   │   │   ├── service/WalletService.java
│   │   │   ├── service/RedPacketService.java
│   │   │   ├── mapper/WalletMapper.java
│   │   │   ├── mapper/RedPacketMapper.java
│   │   │   ├── entity/Wallet.java
│   │   │   ├── entity/WalletTransaction.java
│   │   │   ├── entity/RedPacket.java
│   │   │   ├── entity/RedPacketRecord.java
│   │   │   └── dto/...
│   │   │
│   │   ├── file/
│   │   │   ├── controller/FileController.java
│   │   │   └── service/impl/FileServiceImpl.java
│   │   │
│   │   └── admin/
│   │       ├── controller/AdminController.java
│   │       ├── controller/AdminAuthController.java
│   │       ├── service/AdminService.java
│   │       ├── entity/AdminUser.java
│   │       └── dto/...
│   │
│   └── im/
│       ├── NettyServer.java                           # Netty bootstrap
│       ├── codec/
│       │   ├── ImProtobuf.proto                       # Protocol Buffers def
│       │   ├── ImPacket.java                          # Generated from proto
│       │   └── ImCodec.java                           # Protobuf codec
│       ├── handler/
│       │   ├── ImAuthHandler.java                     # JWT auth on connect
│       │   ├── HeartbeatHandler.java                  # Ping/Pong
│       │   ├── MessageHandler.java                    # Route messages
│       │   └── ExceptionHandler.java                  # Error handling
│       └── session/
│           ├── ConnectionManager.java                 # userId→devId→Channel
│           └── OnlineService.java                     # Redis online status
│
├── src/main/resources/
│   ├── application.yml                                # Main config
│   ├── application-dev.yml                            # Dev profile
│   ├── application-prod.yml                           # Prod profile
│   ├── mapper/
│   │   ├── UserMapper.xml
│   │   ├── FriendMapper.xml
│   │   ├── GroupMapper.xml
│   │   ├── GroupMemberMapper.xml
│   │   ├── MessageMapper.xml
│   │   ├── WalletMapper.xml
│   │   ├── RedPacketMapper.xml
│   │   └── AdminMapper.xml
│   └── db/
│       └── schema.sql                                 # DDL for all tables
│
├── src/test/java/com/wetalk/
│   ├── WetalkApplicationTests.java                    # Context load test
│   ├── modules/
│   │   ├── user/UserServiceTest.java
│   │   ├── social/FriendServiceTest.java
│   │   ├── social/GroupServiceTest.java
│   │   └── payment/RedPacketServiceTest.java
│   └── im/
│       └── ConnectionManagerTest.java
│
├── admin-frontend/                                     # React admin SPA
│   ├── package.json
│   ├── src/
│   │   ├── App.tsx
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx
│   │   │   ├── UserList.tsx
│   │   │   ├── GroupList.tsx
│   │   │   ├── MessageSearch.tsx
│   │   │   ├── PaymentList.tsx
│   │   │   ├── RedPacketList.tsx
│   │   │   ├── SensitiveWords.tsx
│   │   │   ├── InviteCodes.tsx
│   │   │   ├── SystemConfig.tsx
│   │   │   └── AuditLog.tsx
│   │   └── components/
│   │       ├── AdminLayout.tsx
│   │       └── PrivateRoute.tsx
│   └── vercel.json
│
└── Dockerfile
```

---

## Phase 1 Tasks Overview

The plan is divided into 8 build phases, each producing independently testable output:

| Phase | Tasks | Deliverable |
|-------|-------|-------------|
| **A: Foundation** | 1-3 | Spring Boot project boots, DB connected, JWT auth working |
| **B: User System** | 4-7 | Register, login, profile APIs working + tested |
| **C: IM Core** | 8-13 | Netty WebSocket up, messaging works, online status |
| **D: Social** | 14-18 | Friends, groups, contacts APIs working |
| **E: Multimedia** | 19-21 | Image/voice/file upload with OSS |
| **F: Payment** | 22-26 | Wallet, red packets, transactions |
| **G: Security** | 27-28 | E2E encryption, field-level encryption |
| **H: Admin** | 29-32 | Admin backend API + React frontend on Vercel |
| **I: Multi-device** | 33-34 | Multi-device sync, seqId, offline message pull |

---

### Task 1: Project Scaffold — Spring Boot + Dependencies

**Files:**
- Create: `wetalk-server/pom.xml`
- Create: `wetalk-server/src/main/java/com/wetalk/WetalkApplication.java`
- Create: `wetalk-server/src/main/resources/application.yml`
- Create: `wetalk-server/src/main/resources/application-dev.yml`
- Create: `wetalk-server/src/main/resources/application-prod.yml`
- Create: `wetalk-server/Dockerfile`
- Create: `wetalk-server/.gitignore`

**Interfaces:**
- Consumes: nothing (first task)
- Produces: A bootable Spring Boot application with all dependencies declared

- [ ] **Step 1: Create pom.xml with all dependencies**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>

    <parent>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-parent</artifactId>
        <version>3.2.5</version>
        <relativePath/>
    </parent>

    <groupId>com.wetalk</groupId>
    <artifactId>wetalk-server</artifactId>
    <version>4.0.0-SNAPSHOT</version>
    <name>WeTalk Server</name>

    <properties>
        <java.version>21</java.version>
        <mybatis-plus.version>3.5.7</mybatis-plus.version>
        <jjwt.version>0.12.6</jjwt.version>
        <bouncycastle.version>1.78</bouncycastle.version>
        <protobuf.version>3.25.3</protobuf.version>
        <netty.version>4.1.111.Final</netty.version>
    </properties>

    <dependencies>
        <!-- Web -->
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-web</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-validation</artifactId>
        </dependency>

        <!-- Security -->
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-security</artifactId>
        </dependency>

        <!-- Database -->
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-data-redis</artifactId>
        </dependency>
        <dependency>
            <groupId>com.mysql</groupId>
            <artifactId>mysql-connector-j</artifactId>
            <scope>runtime</scope>
        </dependency>
        <dependency>
            <groupId>com.baomidou</groupId>
            <artifactId>mybatis-plus-spring-boot3-starter</artifactId>
            <version>${mybatis-plus.version}</version>
        </dependency>

        <!-- JWT -->
        <dependency>
            <groupId>io.jsonwebtoken</groupId>
            <artifactId>jjwt-api</artifactId>
            <version>${jjwt.version}</version>
        </dependency>
        <dependency>
            <groupId>io.jsonwebtoken</groupId>
            <artifactId>jjwt-impl</artifactId>
            <version>${jjwt.version}</version>
            <scope>runtime</scope>
        </dependency>
        <dependency>
            <groupId>io.jsonwebtoken</groupId>
            <artifactId>jjwt-jackson</artifactId>
            <version>${jjwt.version}</version>
            <scope>runtime</scope>
        </dependency>

        <!-- Encryption -->
        <dependency>
            <groupId>org.bouncycastle</groupId>
            <artifactId>bcprov-jdk18on</artifactId>
            <version>${bouncycastle.version}</version>
        </dependency>

        <!-- Netty -->
        <dependency>
            <groupId>io.netty</groupId>
            <artifactId>netty-all</artifactId>
            <version>${netty.version}</version>
        </dependency>

        <!-- Protobuf -->
        <dependency>
            <groupId>com.google.protobuf</groupId>
            <artifactId>protobuf-java</artifactId>
            <version>${protobuf.version}</version>
        </dependency>

        <!-- OSS (Aliyun) -->
        <dependency>
            <groupId>com.aliyun.oss</groupId>
            <artifactId>aliyun-sdk-oss</artifactId>
            <version>3.17.4</version>
        </dependency>

        <!-- SMS (Aliyun) -->
        <dependency>
            <groupId>com.aliyun</groupId>
            <artifactId>dysmsapi20170525</artifactId>
            <version>2.0.24</version>
        </dependency>

        <!-- Utility -->
        <dependency>
            <groupId>org.projectlombok</groupId>
            <artifactId>lombok</artifactId>
            <optional>true</optional>
        </dependency>
        <dependency>
            <groupId>com.google.code.gson</groupId>
            <artifactId>gson</artifactId>
        </dependency>

        <!-- Test -->
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-test</artifactId>
            <scope>test</scope>
        </dependency>
        <dependency>
            <groupId>org.springframework.security</groupId>
            <artifactId>spring-security-test</artifactId>
            <scope>test</scope>
        </dependency>
        <dependency>
            <groupId>com.h2database</groupId>
            <artifactId>h2</artifactId>
            <scope>test</scope>
        </dependency>
    </dependencies>

    <build>
        <plugins>
            <plugin>
                <groupId>org.springframework.boot</groupId>
                <artifactId>spring-boot-maven-plugin</artifactId>
                <configuration>
                    <excludes>
                        <exclude>
                            <groupId>org.projectlombok</groupId>
                            <artifactId>lombok</artifactId>
                        </exclude>
                    </excludes>
                </configuration>
            </plugin>
            <plugin>
                <groupId>com.github.os72</groupId>
                <artifactId>protoc-jar-maven-plugin</artifactId>
                <version>3.11.4</version>
                <executions>
                    <execution>
                        <phase>generate-sources</phase>
                        <goals><goal>run</goal></goals>
                        <configuration>
                            <includeMavenTypes>direct</includeMavenTypes>
                            <inputDirectories>
                                <include>src/main/resources/proto</include>
                            </inputDirectories>
                            <outputTargets>
                                <outputTarget>
                                    <type>java</type>
                                    <outputDirectory>src/main/java</outputDirectory>
                                </outputTarget>
                            </outputTargets>
                        </configuration>
                    </execution>
                </executions>
            </plugin>
        </plugins>
    </build>
</project>
```

- [ ] **Step 2: Create application entry point**

```java
package com.wetalk;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class WetalkApplication {
    public static void main(String[] args) {
        SpringApplication.run(WetalkApplication.class, args);
    }
}
```

- [ ] **Step 3: Create application.yml**

```yaml
server:
  port: ${PORT:8080}

spring:
  application:
    name: wetalk-server
  datasource:
    url: jdbc:mysql://${MYSQL_HOST:localhost}:${MYSQL_PORT:3306}/${MYSQL_DB:wetalk}?useSSL=true&characterEncoding=utf8mb4&serverTimezone=Asia/Shanghai
    username: ${MYSQL_USER:root}
    password: ${MYSQL_PASS:root}
    hikari:
      maximum-pool-size: 20
      minimum-idle: 5
      idle-timeout: 300000
      connection-timeout: 10000
  data:
    redis:
      host: ${REDIS_HOST:localhost}
      port: ${REDIS_PORT:6379}
      password: ${REDIS_PASS:}
      timeout: 3000
      lettuce:
        pool:
          max-active: 16
          max-idle: 8
          min-idle: 4

mybatis-plus:
  mapper-locations: classpath:mapper/*.xml
  type-aliases-package: com.wetalk.modules.*.entity
  configuration:
    map-underscore-to-camel-case: true
    log-impl: org.apache.ibatis.logging.stdout.StdOutImpl

# JWT
jwt:
  secret: ${JWT_SECRET:wetalk-default-secret-key-change-in-production-32chars}
  access-token-expiration: 900000    # 15 min
  refresh-token-expiration: 604800000 # 7 days

# OSS (Aliyun)
oss:
  endpoint: ${OSS_ENDPOINT:oss-cn-hangzhou.aliyuncs.com}
  access-key: ${OSS_ACCESS_KEY:}
  secret-key: ${OSS_SECRET_KEY:}
  bucket: ${OSS_BUCKET:wetalk-files}
  region: ${OSS_REGION:cn-hangzhou}

# SMS
sms:
  access-key: ${SMS_ACCESS_KEY:}
  secret-key: ${SMS_SECRET_KEY:}
  sign-name: ${SMS_SIGN_NAME:WeTalk}
  template-code: ${SMS_TEMPLATE_CODE:SMS_123456}

# IM Server
im:
  port: ${IM_PORT:8088}
  heartbeat-interval: 15
  heartbeat-timeout: 45

logging:
  level:
    com.wetalk: DEBUG
    org.springframework.security: INFO
```

- [ ] **Step 4: Create Dockerfile**

```dockerfile
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY target/wetalk-server-*.jar app.jar
EXPOSE 8080 8088
ENTRYPOINT ["java", "-jar", "app.jar", "--spring.profiles.active=prod"]
```

- [ ] **Step 5: Create .gitignore**

```
target/
*.class
*.jar
*.war
.idea/
*.iml
.settings/
.project
.classpath
.vscode/
node_modules/
logs/
*.log
.env
application-local.yml
```

- [ ] **Step 6: Verify it boots**

Run: `mvn clean compile -DskipTests`
Expected: BUILD SUCCESS

- [ ] **Step 7: Commit**

```bash
git init && git add -A && git commit -m "chore: initial Spring Boot project scaffold"
```

---

### Task 2: Common Infrastructure — ApiResponse, Exceptions, Error Codes

**Files:**
- Create: `src/main/java/com/wetalk/common/ApiResponse.java`
- Create: `src/main/java/com/wetalk/common/BusinessException.java`
- Create: `src/main/java/com/wetalk/common/ErrorCode.java`
- Create: `src/main/java/com/wetalk/common/desensitize/DesensitizedSerializer.java`

- [ ] **Step 1: Create ApiResponse**

```java
package com.wetalk.common;

import lombok.Data;
import java.time.Instant;

@Data
public class ApiResponse<T> {
    private boolean success;
    private T data;
    private String error;
    private long timestamp;

    public static <T> ApiResponse<T> success(T data) {
        ApiResponse<T> resp = new ApiResponse<>();
        resp.success = true;
        resp.data = data;
        resp.timestamp = Instant.now().toEpochMilli();
        return resp;
    }

    public static <T> ApiResponse<T> error(String error) {
        ApiResponse<T> resp = new ApiResponse<>();
        resp.success = false;
        resp.error = error;
        resp.timestamp = Instant.now().toEpochMilli();
        return resp;
    }

    public static <T> ApiResponse<T> error(ErrorCode code) {
        ApiResponse<T> resp = new ApiResponse<>();
        resp.success = false;
        resp.error = code.getMessage();
        resp.timestamp = Instant.now().toEpochMilli();
        return resp;
    }
}
```

- [ ] **Step 2: Create ErrorCode**

```java
package com.wetalk.common;

public enum ErrorCode {
    SUCCESS(0, "成功"),
    BAD_REQUEST(400, "请求参数错误"),
    UNAUTHORIZED(401, "未登录或登录已过期"),
    FORBIDDEN(403, "无权限操作"),
    NOT_FOUND(404, "资源不存在"),
    RATE_LIMITED(429, "请求过于频繁"),
    INTERNAL_ERROR(500, "服务器内部错误"),

    // Auth
    USER_NOT_FOUND(1001, "账号未注册"),
    PASSWORD_ERROR(1002, "密码错误"),
    ACCOUNT_BANNED(1003, "账号已被封禁"),
    ACCOUNT_LOCKED(1004, "账号已锁定，请稍后再试"),
    PHONE_EXISTS(1005, "该手机号已注册"),
    INVITE_CODE_INVALID(1006, "邀请码无效"),
    CAPTCHA_INVALID(1007, "验证码错误或已过期"),
    TOKEN_EXPIRED(1008, "令牌已过期，请重新登录"),
    MFA_REQUIRED(1009, "需要二次验证"),

    // Social
    FRIEND_ALREADY(2001, "已是好友"),
    FRIEND_REQUEST_EXISTS(2002, "已发送过请求"),
    FRIEND_NOT_FOUND(2003, "好友不存在"),
    GROUP_NOT_FOUND(2101, "群组不存在"),
    GROUP_ALREADY_MEMBER(2102, "已在群中"),
    GROUP_NO_PERMISSION(2103, "无权限操作"),
    GROUP_FULL(2104, "群成员已满"),

    // Message
    MSG_TOO_FREQUENT(3001, "消息发送过于频繁"),
    MSG_TOO_LONG(3002, "消息内容过长"),
    MSG_TYPE_INVALID(3003, "不支持的消息类型"),

    // Payment
    INSUFFICIENT_BALANCE(4001, "余额不足"),
    RED_PACKET_EXPIRED(4002, "红包已过期"),
    RED_PACKET_CLAIMED(4003, "红包已被领取"),
    RED_PACKET_SELF(4004, "不能抢自己的红包"),
    PAY_PWD_ERROR(4005, "支付密码错误");

    private final int code;
    private final String message;

    ErrorCode(int code, String message) {
        this.code = code;
        this.message = message;
    }

    public int getCode() { return code; }
    public String getMessage() { return message; }
}
```

- [ ] **Step 3: Create BusinessException**

```java
package com.wetalk.common;

import lombok.Getter;

@Getter
public class BusinessException extends RuntimeException {
    private final ErrorCode errorCode;

    public BusinessException(ErrorCode errorCode) {
        super(errorCode.getMessage());
        this.errorCode = errorCode;
    }

    public BusinessException(ErrorCode errorCode, String message) {
        super(message);
        this.errorCode = errorCode;
    }
}
```

- [ ] **Step 4: Create global exception handler (in config package)**

```java
package com.wetalk.config;

import com.wetalk.common.ApiResponse;
import com.wetalk.common.BusinessException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(BusinessException.class)
    @ResponseStatus(HttpStatus.OK)
    public ApiResponse<Void> handleBusiness(BusinessException e) {
        return ApiResponse.error(e.getErrorCode().getMessage());
    }

    @ExceptionHandler(Exception.class)
    @ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
    public ApiResponse<Void> handleUnknown(Exception e) {
        log.error("Unexpected error", e);
        return ApiResponse.error("服务器内部错误");
    }
}
```

- [ ] **Step 5: Compile to verify**

Run: `mvn compile -DskipTests`
Expected: BUILD SUCCESS

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "chore: add common ApiResponse and error handling"
```

---

### Task 3: Auth Layer — JWT + Spring Security + Rate Limiting

**Files:**
- Create: `src/main/java/com/wetalk/auth/JwtTokenProvider.java`
- Create: `src/main/java/com/wetalk/auth/JwtAuthenticationFilter.java`
- Create: `src/main/java/com/wetalk/auth/UserPrincipal.java`
- Create: `src/main/java/com/wetalk/config/SecurityConfig.java`
- Create: `src/main/java/com/wetalk/config/RateLimitConfig.java`

**Interfaces:**
- Consumes: `ApiResponse`, `ErrorCode`
- Produces: `JwtTokenProvider.generateToken(userId, role)`, `JwtTokenProvider.validateToken(token)` → UserPrincipal

- [ ] **Step 1: Create JwtTokenProvider**

```java
package com.wetalk.auth;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

@Component
public class JwtTokenProvider {

    private final SecretKey accessSecret;
    private final SecretKey refreshSecret;
    private final long accessExpiration;
    private final long refreshExpiration;

    public JwtTokenProvider(
            @Value("${jwt.secret}") String secret,
            @Value("${jwt.access-token-expiration}") long accessExp,
            @Value("${jwt.refresh-token-expiration}") long refreshExp) {
        this.accessSecret = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.refreshSecret = Keys.hmacShaKeyFor((secret + "_refresh").getBytes(StandardCharsets.UTF_8));
        this.accessExpiration = accessExp;
        this.refreshExpiration = refreshExp;
    }

    public String generateAccessToken(String userId, String role) {
        return Jwts.builder()
                .subject(userId)
                .claim("role", role)
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + accessExpiration))
                .signWith(accessSecret)
                .compact();
    }

    public String generateRefreshToken(String userId) {
        return Jwts.builder()
                .subject(userId)
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + refreshExpiration))
                .signWith(refreshSecret)
                .compact();
    }

    public UserPrincipal validateAccessToken(String token) {
        try {
            Claims claims = Jwts.parser()
                    .verifyWith(accessSecret)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
            return new UserPrincipal(
                    claims.getSubject(),
                    claims.get("role", String.class));
        } catch (JwtException | IllegalArgumentException e) {
            return null;
        }
    }

    public String refreshAccessToken(String refreshToken) {
        try {
            Claims claims = Jwts.parser()
                    .verifyWith(refreshSecret)
                    .build()
                    .parseSignedClaims(refreshToken)
                    .getPayload();
            String userId = claims.getSubject();
            return generateAccessToken(userId, "user");
        } catch (JwtException e) {
            return null;
        }
    }
}
```

- [ ] **Step 2: Create UserPrincipal**

```java
package com.wetalk.auth;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class UserPrincipal {
    private String userId;
    private String role;
}
```

- [ ] **Step 3: Create JwtAuthenticationFilter**

```java
package com.wetalk.auth;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Collections;

@Slf4j
@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtTokenProvider jwtTokenProvider;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain)
            throws ServletException, IOException {

        String token = extractToken(request);
        if (token != null) {
            UserPrincipal principal = jwtTokenProvider.validateAccessToken(token);
            if (principal != null) {
                UsernamePasswordAuthenticationToken auth =
                        new UsernamePasswordAuthenticationToken(
                                principal, null, Collections.emptyList());
                SecurityContextHolder.getContext().setAuthentication(auth);
                request.setAttribute("userId", principal.getUserId());
            }
        }

        filterChain.doFilter(request, response);
    }

    private String extractToken(HttpServletRequest request) {
        String bearer = request.getHeader("Authorization");
        if (StringUtils.hasText(bearer) && bearer.startsWith("Bearer ")) {
            return bearer.substring(7);
        }

        // Also check cookie for admin
        if (request.getCookies() != null) {
            for (var cookie : request.getCookies()) {
                if ("access_token".equals(cookie.getName())) {
                    return cookie.getValue();
                }
            }
        }
        return null;
    }
}
```

- [ ] **Step 4: Create SecurityConfig**

```java
package com.wetalk.config;

import com.wetalk.auth.JwtAuthenticationFilter;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtFilter;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/v1/auth/**").permitAll()
                .requestMatchers("/api/v1/admin/login").permitAll()
                .requestMatchers("/api/health").permitAll()
                .requestMatchers("/api/v1/admin/**").hasAuthority("ROLE_ADMIN")
                .anyRequest().authenticated()
            )
            .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }
}
```

- [ ] **Step 5: Create RateLimitConfig (simple in-memory)**

```java
package com.wetalk.config;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

@Configuration
public class RateLimitConfig implements WebMvcConfigurer {

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(loginRateLimit())
                .addPathPatterns("/api/v1/auth/login");
        registry.addInterceptor(registerRateLimit())
                .addPathPatterns("/api/v1/auth/register");
        registry.addInterceptor(generalRateLimit())
                .addPathPatterns("/api/v1/**");
    }

    @Bean
    public HandlerInterceptor loginRateLimit() {
        return new SlidingWindowRateLimiter(5, 60);  // 5/min
    }

    @Bean
    public HandlerInterceptor registerRateLimit() {
        return new SlidingWindowRateLimiter(3, 60);  // 3/min
    }

    @Bean
    public HandlerInterceptor generalRateLimit() {
        return new SlidingWindowRateLimiter(120, 60); // 120/min
    }

    static class SlidingWindowRateLimiter implements HandlerInterceptor {
        private final Map<String, SlidingWindow> store = new ConcurrentHashMap<>();
        private final int limit;
        private final int windowSeconds;

        SlidingWindowRateLimiter(int limit, int windowSeconds) {
            this.limit = limit;
            this.windowSeconds = windowSeconds;
        }

        @Override
        public boolean preHandle(HttpServletRequest request,
                                 HttpServletResponse response,
                                 Object handler) throws Exception {
            String key = request.getRemoteAddr();
            SlidingWindow window = store.computeIfAbsent(key,
                    k -> new SlidingWindow(limit, windowSeconds * 1000L));
            if (!window.tryAcquire()) {
                response.setStatus(429);
                response.setContentType("application/json;charset=UTF-8");
                response.getWriter().write("{\"success\":false,\"error\":\"请求过于频繁\",\"timestamp\":"
                        + System.currentTimeMillis() + "}");
                return false;
            }
            return true;
        }
    }

    static class SlidingWindow {
        private final long windowMs;
        private final int limit;
        private final long[] timestamps;
        private int idx = 0;

        SlidingWindow(int limit, long windowMs) {
            this.limit = limit;
            this.windowMs = windowMs;
            this.timestamps = new long[limit];
        }

        synchronized boolean tryAcquire() {
            long now = System.currentTimeMillis();
            timestamps[idx] = now;
            idx = (idx + 1) % limit;
            int count = 0;
            for (long t : timestamps) {
                if (now - t < windowMs) count++;
            }
            return count <= limit;
        }
    }
}
```

- [ ] **Step 6: Create WebConfig with CORS**

```java
package com.wetalk.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;

@Configuration
public class WebConfig {

    @Bean
    public CorsFilter corsFilter() {
        CorsConfiguration config = new CorsConfiguration();
        config.addAllowedOriginPattern("*");
        config.addAllowedMethod("*");
        config.addAllowedHeader("*");
        config.setAllowCredentials(true);
        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return new CorsFilter(source);
    }
}
```

- [ ] **Step 7: Create context load test**

```java
// src/test/java/com/wetalk/WetalkApplicationTests.java
package com.wetalk;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest
class WetalkApplicationTests {
    @Test
    void contextLoads() {
    }
}
```

- [ ] **Step 8: Verify tests pass**

Run: `mvn test`
Expected: BUILD SUCCESS, tests pass

- [ ] **Step 9: Commit**

```bash
git add -A && git commit -m "feat: add JWT auth, Spring Security, rate limiting"
```

---

### Task 4: Database Schema — All Tables DDL

**Files:**
- Create: `src/main/resources/db/schema.sql`
- Create: `src/main/java/com/wetalk/config/MyBatisConfig.java`
- Create: `src/main/java/com/wetalk/common/desensitize/AesEncryptTypeHandler.java`

- [ ] **Step 1: Create schema.sql with all tables**

```sql
CREATE DATABASE IF NOT EXISTS wetalk DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE wetalk;

-- ─── 用户表 ──────────────────────────────────────────
CREATE TABLE `user` (
    `id`            BIGINT          NOT NULL AUTO_INCREMENT,
    `uid`           VARCHAR(32)     NOT NULL COMMENT '对外展示ID',
    `phone_aes`     VARBINARY(256)  DEFAULT NULL COMMENT '手机号AES加密',
    `phone_hash`    VARCHAR(64)     DEFAULT NULL COMMENT '手机号SHA256(索引用)',
    `password_hash` VARCHAR(256)    NOT NULL COMMENT 'bcrypt哈希',
    `pay_pwd_hash`  VARCHAR(256)    DEFAULT NULL COMMENT '支付密码PBKDF2',
    `nickname`      VARCHAR(32)     DEFAULT NULL COMMENT '昵称',
    `avatar`        VARCHAR(512)    DEFAULT NULL COMMENT '头像URL',
    `gender`        TINYINT         DEFAULT 0 COMMENT '0未设 1男 2女',
    `real_name_aes` VARBINARY(256)  DEFAULT NULL COMMENT '真实姓名AES',
    `id_card_aes`   VARBINARY(256)  DEFAULT NULL COMMENT '身份证AES',
    `verify_status` TINYINT         DEFAULT 0 COMMENT '0未认证 1审核中 2已认证 3已拒绝',
    `balance`       DECIMAL(12,2)   DEFAULT 0.00,
    `points`        INT             DEFAULT 0,
    `status`        TINYINT         DEFAULT 1 COMMENT '1正常 0封禁 2冻结',
    `invite_code`   VARCHAR(10)     DEFAULT NULL,
    `reg_ip`        VARCHAR(45)     DEFAULT NULL,
    `reg_device`    VARCHAR(128)    DEFAULT NULL,
    `last_login_at` BIGINT          DEFAULT NULL,
    `last_login_ip` VARCHAR(45)     DEFAULT NULL,
    `created_at`    BIGINT          NOT NULL,
    `deleted_at`    BIGINT          DEFAULT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_uid` (`uid`),
    UNIQUE KEY `uk_phone_hash` (`phone_hash`),
    KEY `idx_nickname` (`nickname`),
    KEY `idx_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表';

-- ─── 管理员表 ─────────────────────────────────────────
CREATE TABLE `admin_user` (
    `id`            BIGINT      NOT NULL AUTO_INCREMENT,
    `username`      VARCHAR(32) NOT NULL,
    `password_hash` VARCHAR(256) NOT NULL,
    `nickname`      VARCHAR(32) DEFAULT NULL,
    `role`          VARCHAR(32) NOT NULL DEFAULT 'CUSTOMER',
    `mfa_secret`    VARCHAR(64) DEFAULT NULL,
    `mfa_enabled`   TINYINT     DEFAULT 0,
    `status`        TINYINT     DEFAULT 1,
    `last_login_ip` VARCHAR(45) DEFAULT NULL,
    `last_login_at` BIGINT      DEFAULT NULL,
    `created_at`    BIGINT      NOT NULL,
    `updated_at`    BIGINT      NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='管理员表';

-- ─── 好友关系表 ───────────────────────────────────────
CREATE TABLE `friend_relation` (
    `id`            BIGINT      NOT NULL AUTO_INCREMENT,
    `user_id`       VARCHAR(32) NOT NULL,
    `friend_id`     VARCHAR(32) NOT NULL,
    `remark`        VARCHAR(64) DEFAULT NULL,
    `source`        TINYINT     DEFAULT 1 COMMENT '1搜索 2扫一扫 3群聊 4推荐',
    `status`        TINYINT     DEFAULT 1 COMMENT '1好友 0已删除 2黑名单',
    `created_at`    BIGINT      NOT NULL,
    `deleted_at`    BIGINT      DEFAULT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_relationship` (`user_id`, `friend_id`),
    KEY `idx_user_status` (`user_id`, `status`),
    KEY `idx_friend` (`friend_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='好友关系';

-- ─── 好友请求表 ───────────────────────────────────────
CREATE TABLE `friend_request` (
    `id`            BIGINT      NOT NULL AUTO_INCREMENT,
    `from_uid`      VARCHAR(32) NOT NULL,
    `to_uid`        VARCHAR(32) NOT NULL,
    `remark`        VARCHAR(100) DEFAULT NULL,
    `status`        TINYINT     DEFAULT 0 COMMENT '0待处理 1已通过 2已拒绝 3已过期',
    `created_at`    BIGINT      NOT NULL,
    `handled_at`    BIGINT      DEFAULT NULL,
    PRIMARY KEY (`id`),
    KEY `idx_to_status` (`to_uid`, `status`),
    KEY `idx_from` (`from_uid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='好友请求';

-- ─── 群组表 ───────────────────────────────────────────
CREATE TABLE `group_info` (
    `id`            BIGINT      NOT NULL AUTO_INCREMENT,
    `group_id`      VARCHAR(32) NOT NULL,
    `name`          VARCHAR(64) NOT NULL,
    `avatar`        VARCHAR(512) DEFAULT NULL,
    `notice`        VARCHAR(500) DEFAULT NULL,
    `owner_uid`     VARCHAR(32) NOT NULL,
    `max_members`   INT         DEFAULT 500,
    `join_mode`     TINYINT     DEFAULT 0 COMMENT '0需审核 1直接加入 2禁止',
    `status`        TINYINT     DEFAULT 1 COMMENT '1正常 0已解散',
    `created_at`    BIGINT      NOT NULL,
    `dissolved_at`  BIGINT      DEFAULT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_group_id` (`group_id`),
    KEY `idx_owner` (`owner_uid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='群组';

-- ─── 群成员表 ─────────────────────────────────────────
CREATE TABLE `group_member` (
    `id`            BIGINT      NOT NULL AUTO_INCREMENT,
    `group_id`      VARCHAR(32) NOT NULL,
    `user_id`       VARCHAR(32) NOT NULL,
    `role`          TINYINT     DEFAULT 0 COMMENT '0成员 1管理员 2群主',
    `group_nick`    VARCHAR(32) DEFAULT NULL,
    `muted`         TINYINT     DEFAULT 0,
    `muted_until`   BIGINT      DEFAULT NULL,
    `joined_at`     BIGINT      NOT NULL,
    `leaved_at`     BIGINT      DEFAULT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_member` (`group_id`, `user_id`),
    KEY `idx_user` (`user_id`),
    KEY `idx_role` (`group_id`, `role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='群成员';

-- ─── 消息表 ───────────────────────────────────────────
CREATE TABLE `message` (
    `id`            BIGINT      NOT NULL AUTO_INCREMENT,
    `msg_id`        VARCHAR(64) NOT NULL,
    `seq_id`        BIGINT      NOT NULL,
    `from_uid`      VARCHAR(32) NOT NULL,
    `to_uid`        VARCHAR(32) NOT NULL COMMENT '单聊对方uid/群聊groupId',
    `chat_type`     TINYINT     NOT NULL COMMENT '1单聊 2群聊',
    `msg_type`      TINYINT     NOT NULL COMMENT '1文本 2图片 3语音 4文件 5红包 6系统 7视频通话 8语音通话',
    `content_aes`   MEDIUMBLOB  DEFAULT NULL COMMENT 'E2E加密内容',
    `file_url`      VARCHAR(512) DEFAULT NULL,
    `file_size`     INT         DEFAULT 0,
    `file_name`     VARCHAR(256) DEFAULT NULL,
    `duration`      INT         DEFAULT 0 COMMENT '语音/视频秒数',
    `ref_msg_id`    VARCHAR(64) DEFAULT NULL COMMENT '回复引用消息ID',
    `status`        TINYINT     DEFAULT 0 COMMENT '0发送中 1已送达 2已读 3已撤回',
    `is_mentioned`  TINYINT     DEFAULT 0,
    `created_at`    BIGINT      NOT NULL,
    `updated_at`    BIGINT      DEFAULT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_msg_id` (`msg_id`),
    KEY `idx_chat` (`to_uid`, `created_at`),
    KEY `idx_seq_from` (`from_uid`, `seq_id`),
    KEY `idx_seq_to` (`to_uid`, `seq_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='消息表';
-- Phase 2: 按月分表 message_202607, 需要时用定时任务自动建表

-- ─── 红包表 ───────────────────────────────────────────
CREATE TABLE `red_packet` (
    `id`            BIGINT          NOT NULL AUTO_INCREMENT,
    `packet_id`     VARCHAR(64)     NOT NULL,
    `sender_uid`    VARCHAR(32)     NOT NULL,
    `chat_id`       VARCHAR(64)     NOT NULL,
    `type`          TINYINT         DEFAULT 1 COMMENT '1普通 2拼手气群红包 3专属',
    `total_amount`  DECIMAL(12,2)   NOT NULL,
    `total_count`   INT             NOT NULL,
    `remain_amount` DECIMAL(12,2)   NOT NULL,
    `remain_count`  INT             NOT NULL,
    `blessing`      VARCHAR(100)    DEFAULT NULL,
    `status`        TINYINT         DEFAULT 0 COMMENT '0待领取 1已领完 2已过期 3已退回',
    `expire_at`     BIGINT          NOT NULL,
    `created_at`    BIGINT          NOT NULL,
    `updated_at`    BIGINT          DEFAULT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_packet_id` (`packet_id`),
    KEY `idx_sender` (`sender_uid`),
    KEY `idx_chat` (`chat_id`),
    KEY `idx_status` (`status`, `expire_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='红包';

-- ─── 红包领取记录 ─────────────────────────────────────
CREATE TABLE `red_packet_record` (
    `id`            BIGINT          NOT NULL AUTO_INCREMENT,
    `packet_id`     VARCHAR(64)     NOT NULL,
    `user_id`       VARCHAR(32)     NOT NULL,
    `amount`        DECIMAL(12,2)   NOT NULL,
    `created_at`    BIGINT          NOT NULL,
    PRIMARY KEY (`id`),
    KEY `idx_packet` (`packet_id`),
    KEY `idx_user` (`user_id`),
    UNIQUE KEY `uk_packet_user` (`packet_id`, `user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='红包领取记录';

-- ─── 钱包流水表 ───────────────────────────────────────
CREATE TABLE `wallet_transaction` (
    `id`             BIGINT          NOT NULL AUTO_INCREMENT,
    `tx_id`          VARCHAR(64)     NOT NULL,
    `user_id`        VARCHAR(32)     NOT NULL,
    `type`           TINYINT         NOT NULL COMMENT '1充值 2提现 3红包收入 4红包支出 5转账收入 6转账支出',
    `amount`         DECIMAL(12,2)   NOT NULL,
    `balance_before` DECIMAL(12,2)   NOT NULL,
    `balance_after`  DECIMAL(12,2)   NOT NULL,
    `rela_id`        VARCHAR(64)     DEFAULT NULL,
    `remark`         VARCHAR(200)    DEFAULT NULL,
    `status`         TINYINT         DEFAULT 1 COMMENT '1成功 0处理中 2失败',
    `created_at`     BIGINT          NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_tx_id` (`tx_id`),
    KEY `idx_user` (`user_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='钱包流水';

-- ─── 审计日志表 ───────────────────────────────────────
CREATE TABLE `audit_log` (
    `id`            BIGINT      NOT NULL AUTO_INCREMENT,
    `log_id`        VARCHAR(64) NOT NULL,
    `operator`      VARCHAR(32) NOT NULL,
    `action`        VARCHAR(64) NOT NULL,
    `target_type`   VARCHAR(32) DEFAULT NULL,
    `target_id`     VARCHAR(64) DEFAULT NULL,
    `detail`        JSON        DEFAULT NULL,
    `ip`            VARCHAR(45) DEFAULT NULL,
    `user_agent`    VARCHAR(256) DEFAULT NULL,
    `result`        TINYINT     DEFAULT 1,
    `created_at`    BIGINT      NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_log_id` (`log_id`),
    KEY `idx_operator` (`operator`, `created_at`),
    KEY `idx_action` (`action`, `created_at`),
    KEY `idx_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='审计日志';

-- ─── 管理员操作日志 ───────────────────────────────────
CREATE TABLE `admin_operation_log` (
    `id`            BIGINT      NOT NULL AUTO_INCREMENT,
    `log_id`        VARCHAR(64) NOT NULL,
    `admin_id`      BIGINT      NOT NULL,
    `admin_name`    VARCHAR(32) NOT NULL,
    `action`        VARCHAR(64) NOT NULL,
    `target_type`   VARCHAR(32) DEFAULT NULL,
    `target_id`     VARCHAR(64) DEFAULT NULL,
    `detail`        JSON        DEFAULT NULL,
    `ip`            VARCHAR(45) NOT NULL,
    `user_agent`    VARCHAR(256) DEFAULT NULL,
    `result`        TINYINT     DEFAULT 1,
    `created_at`    BIGINT      NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_log_id` (`log_id`),
    KEY `idx_admin` (`admin_id`, `created_at`),
    KEY `idx_action` (`action`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='管理员操作日志';

-- ─── 敏感词表 ─────────────────────────────────────────
CREATE TABLE `sensitive_word` (
    `id`         BIGINT      NOT NULL AUTO_INCREMENT,
    `word`       VARCHAR(64) NOT NULL,
    `category`   VARCHAR(32) DEFAULT 'general',
    `created_at` BIGINT      NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_word` (`word`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='敏感词';

-- ─── 收藏表 ───────────────────────────────────────────
CREATE TABLE `favorites` (
    `id`         BIGINT      NOT NULL AUTO_INCREMENT,
    `user_id`    VARCHAR(32) NOT NULL,
    `msg_id`     VARCHAR(64) NOT NULL,
    `chat_id`    VARCHAR(64) NOT NULL,
    `msg_type`   TINYINT     NOT NULL,
    `content`    TEXT        DEFAULT NULL,
    `file_url`   VARCHAR(512) DEFAULT NULL,
    `created_at` BIGINT      NOT NULL,
    PRIMARY KEY (`id`),
    KEY `idx_user` (`user_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='收藏';

-- ─── 签到表 ───────────────────────────────────────────
CREATE TABLE `sign_in` (
    `id`         BIGINT      NOT NULL AUTO_INCREMENT,
    `user_id`    VARCHAR(32) NOT NULL,
    `date`       VARCHAR(10) NOT NULL COMMENT 'yyyy-MM-dd',
    `streak`     INT         DEFAULT 0,
    `points`     INT         DEFAULT 0,
    `created_at` BIGINT      NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_user_date` (`user_id`, `date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='签到';

-- ─── 聊天设置表 ───────────────────────────────────────
CREATE TABLE `chat_settings` (
    `id`         BIGINT      NOT NULL AUTO_INCREMENT,
    `user_id`    VARCHAR(32) NOT NULL,
    `chat_id`    VARCHAR(64) NOT NULL,
    `pinned`     TINYINT     DEFAULT 0,
    `muted`      TINYINT     DEFAULT 0,
    `group_nick` VARCHAR(32) DEFAULT NULL,
    `updated_at` BIGINT      NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_user_chat` (`user_id`, `chat_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='聊天设置';

-- ─── 系统配置表 ───────────────────────────────────────
CREATE TABLE `system_config` (
    `id`         BIGINT      NOT NULL AUTO_INCREMENT,
    `config_key` VARCHAR(64) NOT NULL,
    `config_value` TEXT      NOT NULL,
    `desc`       VARCHAR(200) DEFAULT NULL,
    `updated_at` BIGINT      NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_key` (`config_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统配置';

-- Insert default admin
INSERT INTO `admin_user` (`username`, `password_hash`, `nickname`, `role`, `created_at`, `updated_at`)
VALUES ('admin', '$2a$12$LJ3m4ys3Lk0TSwHnbfOMiOXPm1Qlq5GzH5x7Y5F5e5y5d5e5f5g5h', '超级管理员', 'SUPER_ADMIN', UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000);

-- Insert default invite codes
INSERT INTO `system_config` (`config_key`, `config_value`, `desc`, `updated_at`) VALUES
('invite_codes', '["888888","666666","123456"]', '默认邀请码', UNIX_TIMESTAMP()*1000),
('sensitive_words', '["暴力","赌博","毒品","枪"]', '默认敏感词', UNIX_TIMESTAMP()*1000);

-- Insert default sensitivity words
INSERT INTO `sensitive_word` (`word`, `category`, `created_at`) VALUES
('暴力', 'general', UNIX_TIMESTAMP()*1000),
('赌博', 'general', UNIX_TIMESTAMP()*1000),
('毒品', 'general', UNIX_TIMESTAMP()*1000),
('枪', 'general', UNIX_TIMESTAMP()*1000);
```

- [ ] **Step 2: Create MyBatisConfig**

```java
package com.wetalk.config;

import com.baomidou.mybatisplus.annotation.DbType;
import com.baomidou.mybatisplus.extension.plugins.MybatisPlusInterceptor;
import com.baomidou.mybatisplus.extension.plugins.inner.PaginationInnerInterceptor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class MyBatisConfig {

    @Bean
    public MybatisPlusInterceptor mybatisPlusInterceptor() {
        MybatisPlusInterceptor interceptor = new MybatisPlusInterceptor();
        interceptor.addInnerInterceptor(new PaginationInnerInterceptor(DbType.MYSQL));
        return interceptor;
    }
}
```

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: add database schema and MyBatis config"
```

---

### Task 5: User Module — Registration & Login API

**Files:**
- Create: `src/main/java/com/wetalk/modules/user/entity/User.java`
- Create: `src/main/java/com/wetalk/modules/user/mapper/UserMapper.java`
- Create: `src/main/java/com/wetalk/modules/user/dto/RegisterRequest.java`
- Create: `src/main/java/com/wetalk/modules/user/dto/LoginRequest.java`
- Create: `src/main/java/com/wetalk/modules/user/dto/UserVO.java`
- Create: `src/main/java/com/wetalk/modules/user/service/UserService.java`
- Create: `src/main/java/com/wetalk/modules/user/service/impl/UserServiceImpl.java`
- Create: `src/main/java/com/wetalk/modules/user/controller/AuthController.java`
- Create: `src/main/java/com/wetalk/modules/user/controller/UserController.java`
- Create: `src/main/java/com/wetalk/modules/user/UserControllerTest.java`
- Create: `src/main/resources/mapper/UserMapper.xml`

- [ ] **Step 1: Create User entity**

```java
package com.wetalk.modules.user.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

@Data
@TableName("user")
public class User {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String uid;
    private byte[] phoneAes;
    private String phoneHash;
    private String passwordHash;
    private String payPwdHash;
    private String nickname;
    private String avatar;
    private Integer gender;       // 0未设 1男 2女
    private byte[] realNameAes;
    private byte[] idCardAes;
    private Integer verifyStatus; // 0未认证 1审核中 2已认证 3已拒绝
    private java.math.BigDecimal balance;
    private Integer points;
    private Integer status;       // 1正常 0封禁 2冻结
    private String inviteCode;
    private String regIp;
    private String regDevice;
    private Long lastLoginAt;
    private String lastLoginIp;
    private Long createdAt;
    @TableLogic
    private Long deletedAt;
}
```

- [ ] **Step 2: Create UserMapper**

```java
package com.wetalk.modules.user.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.wetalk.modules.user.entity.User;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

@Mapper
public interface UserMapper extends BaseMapper<User> {
    User findByPhoneHash(@Param("phoneHash") String phoneHash);
    User findByUid(@Param("uid") String uid);
}
```

UserMapper.xml:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE mapper PUBLIC "-//mybatis.org//DTD Mapper 3.0//EN" "http://mybatis.org/dtd/mybatis-3-mapper.dtd">
<mapper namespace="com.wetalk.modules.user.mapper.UserMapper">
    <select id="findByPhoneHash" resultType="com.wetalk.modules.user.entity.User">
        SELECT * FROM user WHERE phone_hash = #{phoneHash} AND deleted_at IS NULL
    </select>
    <select id="findByUid" resultType="com.wetalk.modules.user.entity.User">
        SELECT * FROM user WHERE uid = #{uid} AND deleted_at IS NULL
    </select>
</mapper>
```

- [ ] **Step 3: Create DTOs**

```java
// RegisterRequest.java
package com.wetalk.modules.user.dto;

import jakarta.validation.constraints.*;
import lombok.Data;

@Data
public class RegisterRequest {
    @NotBlank(message = "手机号不能为空")
    @Pattern(regexp = "^1[3-9]\\d{9}$", message = "请输入有效手机号")
    private String phone;

    @NotBlank(message = "密码不能为空")
    @Size(min = 8, max = 64, message = "密码长度需8-64位")
    private String password;

    @NotBlank(message = "验证码不能为空")
    private String captcha;

    @NotBlank(message = "验证码ID不能为空")
    private String captchaId;

    @NotBlank(message = "邀请码不能为空")
    @Size(min = 6, max = 6, message = "邀请码为6位")
    private String inviteCode;
}

// LoginRequest.java
package com.wetalk.modules.user.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class LoginRequest {
    @NotBlank
    private String phone;
    @NotBlank
    private String password;
}

// UserVO.java
package com.wetalk.modules.user.dto;

import lombok.Data;

@Data
public class UserVO {
    private String uid;
    private String nickname;
    private String avatar;
    private Integer gender;
    private String phone;          // 脱敏: 138****1234
    private Integer verifyStatus;
    private java.math.BigDecimal balance;
    private Integer points;
    private Long createdAt;
}
```

- [ ] **Step 4: Create UserService**

```java
// UserService.java
package com.wetalk.modules.user.service;

import com.wetalk.modules.user.dto.*;
import com.wetalk.modules.user.entity.User;

public interface UserService {
    UserVO register(RegisterRequest req, String ip);
    LoginResponse login(LoginRequest req, String ip);
    UserVO getProfile(String userId);
    UserVO updateProfile(String userId, ProfileRequest req);
    UserVO findByPhone(String phone);
    User findById(Long id);
    User findByUid(String uid);
}

// LoginResponse.java (inner)
@Data
public class LoginResponse {
    private String accessToken;
    private String refreshToken;
    private UserVO user;
}
```

- [ ] **Step 5: Implement UserService**

```java
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
        // Check phone uniqueness
        String phoneHash = sha256(req.getPhone());
        User existing = userMapper.findByPhoneHash(phoneHash);
        if (existing != null) {
            throw new BusinessException(ErrorCode.PHONE_EXISTS);
        }

        // Create user
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
        log.info("User registered: phone={} uid={}", req.getPhone().substring(0, 3) + "****" + req.getPhone().substring(7), user.getUid());

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

        // Update login info
        user.setLastLoginAt(System.currentTimeMillis());
        user.setLastLoginIp(ip);
        userMapper.updateById(user);

        // Generate tokens
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

    private UserVO toVO(User user) {
        UserVO vo = new UserVO();
        vo.setUid(user.getUid());
        vo.setNickname(user.getNickname());
        vo.setAvatar(user.getAvatar());
        vo.setGender(user.getGender());
        // Phone desensitized
        String phone = AesUtil.decryptToString(user.getPhoneAes());
        vo.setPhone(phone != null ? phone.substring(0, 3) + "****" + phone.substring(7) : null);
        vo.setVerifyStatus(user.getVerifyStatus());
        vo.setBalance(user.getBalance());
        vo.setPoints(user.getPoints());
        vo.setCreatedAt(user.getCreatedAt());
        return vo;
    }

    @Override public User findById(Long id) { return userMapper.selectById(id); }
    @Override public User findByUid(String uid) { return userMapper.findByUid(uid); }
    @Override public UserVO findByPhone(String phone) { return toVO(userMapper.findByPhoneHash(sha256(phone))); }
    @Override public UserVO updateProfile(String userId, ProfileRequest req) { return null; } // TODO Task 6
}
```

- [ ] **Step 6: Create AuthController**

```java
package com.wetalk.modules.user.controller;

import com.wetalk.common.ApiResponse;
import com.wetalk.modules.user.dto.*;
import com.wetalk.modules.user.service.UserService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    private final UserService userService;

    @PostMapping("/register")
    public ApiResponse<UserVO> register(@Valid @RequestBody RegisterRequest req,
                                         HttpServletRequest request) {
        UserVO user = userService.register(req, request.getRemoteAddr());
        return ApiResponse.success(user);
    }

    @PostMapping("/login")
    public ApiResponse<LoginResponse> login(@Valid @RequestBody LoginRequest req,
                                             HttpServletRequest request) {
        LoginResponse resp = userService.login(req, request.getRemoteAddr());
        return ApiResponse.success(resp);
    }
}
```

- [ ] **Step 7: Create AES utility**

```java
package com.wetalk.common.util;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.security.SecureRandom;
import java.util.Base64;

public class AesUtil {
    private static final String ALGORITHM = "AES/GCM/NoPadding";
    private static final int GCM_TAG_LENGTH = 128;
    private static final int IV_LENGTH = 12;
    // In production, key comes from KMS/vault, not hardcoded
    private static final byte[] KEY = "wetalk-aes-key-32bytes!!0123456".getBytes();

    public static byte[] encrypt(String plaintext) {
        try {
            byte[] iv = new byte[IV_LENGTH];
            SecureRandom.getInstanceStrong().nextBytes(iv);
            Cipher cipher = Cipher.getInstance(ALGORITHM);
            cipher.init(Cipher.ENCRYPT_MODE,
                    new SecretKeySpec(KEY, "AES"),
                    new GCMParameterSpec(GCM_TAG_LENGTH, iv));
            byte[] ciphertext = cipher.doFinal(plaintext.getBytes());
            byte[] result = new byte[IV_LENGTH + ciphertext.length];
            System.arraycopy(iv, 0, result, 0, IV_LENGTH);
            System.arraycopy(ciphertext, 0, result, IV_LENGTH, ciphertext.length);
            return result;
        } catch (Exception e) {
            throw new RuntimeException("AES encrypt failed", e);
        }
    }

    public static String decryptToString(byte[] encrypted) {
        if (encrypted == null || encrypted.length < IV_LENGTH) return null;
        try {
            byte[] iv = new byte[IV_LENGTH];
            System.arraycopy(encrypted, 0, iv, 0, IV_LENGTH);
            byte[] ciphertext = new byte[encrypted.length - IV_LENGTH];
            System.arraycopy(encrypted, IV_LENGTH, ciphertext, 0, ciphertext.length);
            Cipher cipher = Cipher.getInstance(ALGORITHM);
            cipher.init(Cipher.DECRYPT_MODE,
                    new SecretKeySpec(KEY, "AES"),
                    new GCMParameterSpec(GCM_TAG_LENGTH, iv));
            return new String(cipher.doFinal(ciphertext));
        } catch (Exception e) {
            return null;
        }
    }
}
```

- [ ] **Step 8: Compile and commit**

Run: `mvn compile -DskipTests`
Expected: BUILD SUCCESS

```bash
git add -A && git commit -m "feat: add user registration and login API"
```

---

### Task 6: User Module — Profile Management

**Files:**
- Modify: `src/main/java/com/wetalk/modules/user/service/impl/UserServiceImpl.java`
- Create: `src/main/java/com/wetalk/modules/user/dto/ProfileRequest.java`

- [ ] **Step 1: Create ProfileRequest DTO**

```java
package com.wetalk.modules.user.dto;

import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class ProfileRequest {
    @Size(max = 12, message = "昵称不能超过12个字符")
    private String nickname;
    private Integer gender;
    private String avatar;
}
```

- [ ] **Step 2: Implement updateProfile in UserServiceImpl**

```java
@Override
@Transactional
public UserVO updateProfile(String userId, ProfileRequest req) {
    User user = userMapper.findByUid(userId);
    if (user == null) throw new BusinessException(ErrorCode.USER_NOT_FOUND);

    if (req.getNickname() != null) {
        String clean = req.getNickname().trim().replaceAll("[<>&\"']", "");
        if (!clean.isEmpty()) user.setNickname(clean.length() > 12 ? clean.substring(0, 12) : clean);
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
```

- [ ] **Step 3: Create UserController**

```java
package com.wetalk.modules.user.controller;

import com.wetalk.auth.UserPrincipal;
import com.wetalk.common.ApiResponse;
import com.wetalk.modules.user.dto.*;
import com.wetalk.modules.user.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/user")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @GetMapping("/profile")
    public ApiResponse<UserVO> getProfile(@AuthenticationPrincipal UserPrincipal principal) {
        return ApiResponse.success(userService.getProfile(principal.getUserId()));
    }

    @PutMapping("/profile")
    public ApiResponse<UserVO> updateProfile(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody ProfileRequest req) {
        return ApiResponse.success(userService.updateProfile(principal.getUserId(), req));
    }
}
```

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: add user profile management"
```

---

### Task 7: Captcha + SMS Verification Code

**Files:**
- Create: `src/main/java/com/wetalk/modules/user/controller/CaptchaController.java`
- Create: `src/main/java/com/wetalk/modules/user/service/CaptchaService.java`
- Create: `src/main/java/com/wetalk/modules/user/service/impl/CaptchaServiceImpl.java`

- [ ] **Step 1: Create CaptchaService**

```java
package com.wetalk.modules.user.service;

public interface CaptchaService {
    String generateCaptcha();           // returns captchaId
    boolean verifyCaptcha(String captchaId, String code);
    String sendSmsCode(String phone);   // returns code for dev
    boolean verifySmsCode(String phone, String code);
}
```

- [ ] **Step 2: Implement CaptchaService with Redis**

```java
package com.wetalk.modules.user.service.impl;

import com.wetalk.common.BusinessException;
import com.wetalk.common.ErrorCode;
import com.wetalk.modules.user.service.CaptchaService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.util.concurrent.TimeUnit;

@Service
@RequiredArgsConstructor
public class CaptchaServiceImpl implements CaptchaService {

    private final StringRedisTemplate redis;
    private static final SecureRandom RANDOM = new SecureRandom();

    @Override
    public String generateCaptcha() {
        String captchaId = "cap_" + System.currentTimeMillis() + "_" + RANDOM.nextInt(10000);
        String code = randomString(6).toUpperCase();
        redis.opsForValue().set("captcha:" + captchaId, code, 5, TimeUnit.MINUTES);
        return captchaId + ":" + code; // In dev mode, return code directly
    }

    @Override
    public boolean verifyCaptcha(String captchaId, String code) {
        String key = "captcha:" + captchaId;
        String stored = redis.opsForValue().get(key);
        if (stored == null) return false;
        redis.delete(key);
        return stored.equalsIgnoreCase(code);
    }

    @Override
    public String sendSmsCode(String phone) {
        String code = String.format("%06d", RANDOM.nextInt(1000000));
        redis.opsForValue().set("sms:" + phone, code, 5, TimeUnit.MINUTES);
        // TODO: Integrate with Aliyun SMS SDK
        log.info("SMS code for {}: {}", phone, code);
        return code;
    }

    @Override
    public boolean verifySmsCode(String phone, String code) {
        String key = "sms:" + phone;
        String stored = redis.opsForValue().get(key);
        if (stored == null) return false;
        redis.delete(key);
        return stored.equals(code);
    }

    private String randomString(int len) {
        String chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        StringBuilder sb = new StringBuilder(len);
        for (int i = 0; i < len; i++) sb.append(chars.charAt(RANDOM.nextInt(chars.length())));
        return sb.toString();
    }
}
```

- [ ] **Step 3: Create CaptchaController**

```java
@RestController
@RequestMapping("/api/v1/auth")
public class CaptchaController {

    @PostMapping("/captcha")
    public ApiResponse<Map<String, String>> captcha() {
        String result = captchaService.generateCaptcha();
        String[] parts = result.split(":");
        return ApiResponse.success(Map.of("captchaId", parts[0], "code", parts[1]));
    }

    @PostMapping("/send-sms")
    public ApiResponse<Void> sendSms(@RequestBody Map<String, String> body) {
        String phone = body.get("phone");
        captchaService.sendSmsCode(phone);
        return ApiResponse.success(null);
    }
}
```

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: add captcha and SMS verification"
```

---

### Task 8: Netty IM Server — Bootstrap and Connection

**Files:**
- Create: `src/main/resources/proto/im.proto`
- Create: `src/main/java/com/wetalk/im/NettyServer.java`
- Create: `src/main/java/com/wetalk/im/codec/ImCodec.java`
- Create: `src/main/java/com/wetalk/im/handler/ImAuthHandler.java`
- Create: `src/main/java/com/wetalk/im/handler/HeartbeatHandler.java`
- Create: `src/main/java/com/wetalk/im/handler/ExceptionHandler.java`
- Create: `src/main/java/com/wetalk/im/session/ConnectionManager.java`
- Create: `src/main/java/com/wetalk/im/session/OnlineService.java`

- [ ] **Step 1: Create Protobuf definition**

```protobuf
syntax = "proto3";
package wetalk.im;

message ImPacket {
    Header header = 1;
    bytes payload = 2;
}

message Header {
    int32 cmd = 1;              // 100:Ping 101:Pong 200:Auth 201:AuthResp 300:Send 301:Ack 302:Read 400:Push 500:Error
    string msgId = 2;
    string fromUid = 3;
    string toUid = 4;
    int64 timestamp = 5;
    int64 seqId = 6;
    string devId = 7;
}
```

- [ ] **Step 2: Create NettyServer (startup bean)**

```java
package com.wetalk.im;

import com.wetalk.im.handler.*;
import io.netty.bootstrap.ServerBootstrap;
import io.netty.channel.*;
import io.netty.channel.nio.NioEventLoopGroup;
import io.netty.channel.socket.SocketChannel;
import io.netty.channel.socket.nio.NioServerSocketChannel;
import io.netty.handler.codec.http.HttpObjectAggregator;
import io.netty.handler.codec.http.HttpServerCodec;
import io.netty.handler.codec.http.websocketx.WebSocketServerProtocolHandler;
import io.netty.handler.timeout.IdleStateHandler;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class NettyServer {

    @Value("${im.port:8088}")
    private int port;

    private final ImAuthHandler authHandler;
    private final HeartbeatHandler heartbeatHandler;
    private final com.wetalk.im.handler.MessageHandler messageHandler;
    private final ExceptionHandler exceptionHandler;

    private EventLoopGroup bossGroup;
    private EventLoopGroup workerGroup;

    @PostConstruct
    public void start() throws InterruptedException {
        bossGroup = new NioEventLoopGroup(1);
        workerGroup = new NioEventLoopGroup();

        ServerBootstrap bootstrap = new ServerBootstrap()
            .group(bossGroup, workerGroup)
            .channel(NioServerSocketChannel.class)
            .option(ChannelOption.SO_BACKLOG, 1024)
            .childOption(ChannelOption.TCP_NODELAY, true)
            .childOption(ChannelOption.SO_KEEPALIVE, true)
            .childHandler(new ChannelInitializer<SocketChannel>() {
                @Override
                protected void initChannel(SocketChannel ch) {
                    ChannelPipeline p = ch.pipeline();
                    p.addLast(new IdleStateHandler(30, 0, 0));
                    p.addLast(new HttpServerCodec());
                    p.addLast(new HttpObjectAggregator(65536));
                    p.addLast(new WebSocketServerProtocolHandler("/im", null, true));
                    p.addLast(authHandler);
                    p.addLast(heartbeatHandler);
                    p.addLast(messageHandler);
                    p.addLast(exceptionHandler);
                }
            });

        ChannelFuture future = bootstrap.bind(port).sync();
        log.info("Netty IM server started on port {}", port);
        future.channel().closeFuture().addListener(f -> {
            log.info("Netty IM server stopped");
        });
    }

    @PreDestroy
    public void stop() {
        if (bossGroup != null) bossGroup.shutdownGracefully();
        if (workerGroup != null) workerGroup.shutdownGracefully();
    }
}
```

- [ ] **Step 3: Create ConnectionManager**

```java
package com.wetalk.im.session;

import io.netty.channel.Channel;
import io.netty.handler.codec.http.websocketx.TextWebSocketFrame;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

@Slf4j
@Component
public class ConnectionManager {

    private final Map<String, Map<String, Channel>> connections = new ConcurrentHashMap<>();
    private final StringRedisTemplate redis;

    public ConnectionManager(StringRedisTemplate redis) {
        this.redis = redis;
    }

    public void register(String userId, String devId, Channel channel) {
        connections.computeIfAbsent(userId, k -> new ConcurrentHashMap<>()).put(devId, channel);
        redis.opsForValue().set("im:online:" + userId + ":" + devId,
                channel.id().asLongText(), 5, TimeUnit.MINUTES);
        log.debug("User online: {} dev={}", userId, devId);
    }

    public void unregister(String userId, String devId) {
        Map<String, Channel> devs = connections.get(userId);
        if (devs != null) {
            devs.remove(devId);
            if (devs.isEmpty()) connections.remove(userId);
        }
        redis.delete("im:online:" + userId + ":" + devId);
        log.debug("User offline: {} dev={}", userId, devId);
    }

    public void pushToUser(String userId, Object msg) {
        Map<String, Channel> devs = connections.get(userId);
        if (devs == null) return;
        for (Channel ch : devs.values()) {
            if (ch.isActive()) {
                ch.writeAndFlush(new TextWebSocketFrame(msg.toString()));
            }
        }
    }

    public void pushToAllDevices(String userId, Object msg) {
        pushToUser(userId, msg);
    }

    public void pushToOtherDevices(String userId, String excludeDevId, Object msg) {
        Map<String, Channel> devs = connections.get(userId);
        if (devs == null) return;
        for (Map.Entry<String, Channel> e : devs.entrySet()) {
            if (!e.getKey().equals(excludeDevId) && e.getValue().isActive()) {
                e.getValue().writeAndFlush(new TextWebSocketFrame(msg.toString()));
            }
        }
    }

    public boolean isOnline(String userId) {
        return connections.containsKey(userId) && !connections.get(userId).isEmpty();
    }

    public Set<String> getOnlineFriends(Set<String> friendIds) {
        Set<String> online = ConcurrentHashMap.newKeySet();
        for (String fid : friendIds) {
            if (isOnline(fid)) online.add(fid);
        }
        return online;
    }
}
```

- [ ] **Step 4: Create Auth Handler**

```java
package com.wetalk.im.handler;

import com.wetalk.auth.JwtTokenProvider;
import com.wetalk.im.session.ConnectionManager;
import io.netty.channel.*;
import io.netty.handler.codec.http.FullHttpRequest;
import io.netty.handler.codec.http.HttpHeaders;
import io.netty.handler.codec.http.websocketx.WebSocketServerProtocolHandler;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@ChannelHandler.Sharable
@RequiredArgsConstructor
public class ImAuthHandler extends ChannelInboundHandlerAdapter {

    private final JwtTokenProvider jwtTokenProvider;
    private final ConnectionManager connectionManager;

    @Override
    public void userEventTriggered(ChannelHandlerContext ctx, Object evt) {
        if (evt instanceof WebSocketServerProtocolHandler.HandshakeComplete) {
            // Extract token from URL query: ws://host/im?token=xxx&devId=yyy
            String uri = ((WebSocketServerProtocolHandler.HandshakeComplete) evt).requestUri();
            String token = getQueryParam(uri, "token");
            String devId = getQueryParam(uri, "devId");

            if (token == null || devId == null) {
                ctx.close();
                return;
            }

            var principal = jwtTokenProvider.validateAccessToken(token);
            if (principal == null) {
                ctx.close();
                return;
            }

            ctx.channel().attr(ChannelAttrKeys.USER_ID).set(principal.getUserId());
            ctx.channel().attr(ChannelAttrKeys.DEV_ID).set(devId);

            connectionManager.register(principal.getUserId(), devId, ctx.channel());
            log.info("IM auth success: uid={} devId={}", principal.getUserId(), devId);
        }
    }

    private String getQueryParam(String uri, String key) {
        int idx = uri.indexOf(key + "=");
        if (idx < 0) return null;
        int start = idx + key.length() + 1;
        int end = uri.indexOf('&', start);
        return end < 0 ? uri.substring(start) : uri.substring(start, end);
    }
}

// ChannelAttrKeys.java
import io.netty.util.AttributeKey;

public class ChannelAttrKeys {
    public static final AttributeKey<String> USER_ID = AttributeKey.valueOf("userId");
    public static final AttributeKey<String> DEV_ID = AttributeKey.valueOf("devId");
}
```

- [ ] **Step 5: Create HeartbeatHandler**

```java
@ChannelHandler.Sharable
public class HeartbeatHandler extends ChannelInboundHandlerAdapter {
    @Override
    public void userEventTriggered(ChannelHandlerContext ctx, Object evt) {
        if (evt instanceof IdleStateEvent) {
            ctx.close();
        }
    }
}
```

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: add Netty IM server with WebSocket and connection management"
```

---

### Task 9: IM Message Handler — Send and Route Messages

**Files:**
- Create: `src/main/java/com/wetalk/im/handler/MessageHandler.java`
- Create: `src/main/java/com/wetalk/common/util/SeqIdGenerator.java`
- Create: `src/main/java/com/wetalk/config/RedisConfig.java`

- [ ] **Step 1: Create SeqIdGenerator**

```java
package com.wetalk.common.util;

import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class SeqIdGenerator {

    private final StringRedisTemplate redis;

    public long nextSeqId(String userId) {
        return redis.opsForValue().increment("im:seq:" + userId);
    }

    public long currentSeqId(String userId) {
        String val = redis.opsForValue().get("im:seq:" + userId);
        return val != null ? Long.parseLong(val) : 0;
    }
}
```

- [ ] **Step 2: Create RedisConfig**

```java
package com.wetalk.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.StringRedisSerializer;

@Configuration
public class RedisConfig {

    @Bean
    public RedisTemplate<String, Object> redisTemplate(RedisConnectionFactory factory) {
        RedisTemplate<String, Object> template = new RedisTemplate<>();
        template.setConnectionFactory(factory);
        template.setKeySerializer(new StringRedisSerializer());
        template.setValueSerializer(new GenericJackson2JsonRedisSerializer());
        return template;
    }
}
```

- [ ] **Step 3: Create MessageHandler (IM → forward to MessageService)**

```java
package com.wetalk.im.handler;

import com.google.gson.Gson;
import com.wetalk.common.util.SeqIdGenerator;
import com.wetalk.im.session.ConnectionManager;
import io.netty.channel.ChannelHandler;
import io.netty.channel.ChannelHandlerContext;
import io.netty.channel.SimpleChannelInboundHandler;
import io.netty.handler.codec.http.websocketx.TextWebSocketFrame;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import java.util.Map;

@Slf4j
@ChannelHandler.Sharable
@RequiredArgsConstructor
public class MessageHandler extends SimpleChannelInboundHandler<TextWebSocketFrame> {

    private final ConnectionManager connectionManager;
    private final SeqIdGenerator seqIdGenerator;
    private final Gson gson = new Gson();

    @Override
    protected void channelRead0(ChannelHandlerContext ctx, TextWebSocketFrame frame) {
        String text = frame.text();
        Map<String, Object> msg;
        try {
            msg = gson.fromJson(text, Map.class);
        } catch (Exception e) {
            ctx.writeAndFlush(new TextWebSocketFrame("{\"error\":\"invalid json\"}"));
            return;
        }

        String type = (String) msg.get("type");
        String userId = ctx.channel().attr(ChannelAttrKeys.USER_ID).get();
        String devId = ctx.channel().attr(ChannelAttrKeys.DEV_ID).get();

        switch (type) {
            case "ping":
                ctx.writeAndFlush(new TextWebSocketFrame("{\"type\":\"pong\"}"));
                break;

            case "send_msg":
                handleSendMessage(ctx, msg, userId);
                break;

            case "ack":
                handleAck(msg, userId);
                break;

            case "read":
                handleRead(msg, userId);
                break;

            default:
                ctx.writeAndFlush(new TextWebSocketFrame("{\"error\":\"unknown type\"}"));
        }
    }

    private void handleSendMessage(ChannelHandlerContext ctx, Map<String, Object> msg, String fromUid) {
        String toUid = (String) msg.get("to");
        Object content = msg.get("content");
        Integer msgType = msg.get("msgType") != null ? ((Number) msg.get("msgType")).intValue() : 1;
        String msgId = (String) msg.get("msgId");
        if (msgId == null) msgId = java.util.UUID.randomUUID().toString();

        // Assign seqId
        long seqId = seqIdGenerator.nextSeqId(fromUid);

        // Build push message
        Map<String, Object> pushMsg = new java.util.LinkedHashMap<>();
        pushMsg.put("type", "new_msg");
        pushMsg.put("msgId", msgId);
        pushMsg.put("from", fromUid);
        pushMsg.put("to", toUid);
        pushMsg.put("content", content);
        pushMsg.put("msgType", msgType);
        pushMsg.put("seqId", seqId);
        pushMsg.put("timestamp", System.currentTimeMillis());

        String json = gson.toJson(pushMsg);

        // Push to receiver
        boolean isGroup = toUid.startsWith("g_");
        if (isGroup) {
            // Group chat: push to all online group members (except sender)
            // Group member list fetched from SocialService
            // For now, broadcast to the group channel
            ctx.writeAndFlush(new TextWebSocketFrame("{\"type\":\"msg_ack\",\"msgId\":\"" + msgId + "\",\"seqId\":" + seqId + "}"));
        } else {
            // Single chat
            connectionManager.pushToAllDevices(toUid, json);

            // ACK to sender
            ctx.writeAndFlush(new TextWebSocketFrame(
                "{\"type\":\"msg_ack\",\"msgId\":\"" + msgId + "\",\"seqId\":" + seqId + "}"));
        }

        // Persist asynchronously (TODO: write to DB via MQ or thread pool)
        log.debug("Message {} -> {}: type={} seq={}", fromUid, toUid, msgType, seqId);
    }

    private void handleAck(Map<String, Object> msg, String userId) {
        // Update message status to delivered
        log.debug("ACK from {}: msgId={}", userId, msg.get("msgId"));
    }

    private void handleRead(Map<String, Object> msg, String userId) {
        String chatId = (String) msg.get("chatId");
        Long seqId = msg.get("seqId") != null ? ((Number) msg.get("seqId")).longValue() : null;
        // Update read status in Redis
        if (seqId != null) {
            // Redis: user:read:{userId}:{chatId} = seqId
            // Notify the other party's devices
        }
        log.debug("Read from {}: chatId={} seq={}", userId, chatId, seqId);
    }
}
```

- [ ] **Step 4: Wire everything together and compile**

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add IM message routing and push"
```

---

### Task 10: Message Service — Persist and Retrieve Messages

**Files:**
- Create: `src/main/java/com/wetalk/modules/message/entity/Message.java`
- Create: `src/main/java/com/wetalk/modules/message/mapper/MessageMapper.java`
- Create: `src/main/java/com/wetalk/modules/message/service/MessageService.java`
- Create: `src/main/java/com/wetalk/modules/message/service/impl/MessageServiceImpl.java`
- Create: `src/main/java/com/wetalk/modules/message/controller/MessageController.java`
- Create: `src/main/java/com/wetalk/modules/message/dto/MessageSyncRequest.java`
- Create: `src/main/resources/mapper/MessageMapper.xml`

- [ ] **Step 1: Create Message entity**

```java
package com.wetalk.modules.message.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

@Data
@TableName("message")
public class Message {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String msgId;
    private Long seqId;
    private String fromUid;
    private String toUid;
    private Integer chatType;    // 1单聊 2群聊
    private Integer msgType;     // 1文本 2图片 3语音 4文件 5红包 6系统 7视频 8语音通话
    private byte[] contentAes;
    private String fileUrl;
    private Integer fileSize;
    private String fileName;
    private Integer duration;
    private String refMsgId;
    private Integer status;      // 0发送中 1已送达 2已读 3已撤回
    private Integer isMentioned;
    private Long createdAt;
    private Long updatedAt;
}
```

- [ ] **Step 2: Create MessageMapper + XML**

```java
@Mapper
public interface MessageMapper extends BaseMapper<Message> {
    List<Message> findByChatId(@Param("chatId") String chatId,
                                @Param("limit") int limit,
                                @Param("offset") long offset);
    List<Message> findBySeqRange(@Param("uid") String uid,
                                  @Param("fromSeq") long fromSeq,
                                  @Param("toSeq") long toSeq,
                                  @Param("limit") int limit);
    List<Message> searchMessages(@Param("keyword") String keyword,
                                  @Param("uid") String uid,
                                  @Param("limit") int limit);
}
```

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE mapper PUBLIC "-//mybatis.org//DTD Mapper 3.0//EN" "http://mybatis.org/dtd/mybatis-3-mapper.dtd">
<mapper namespace="com.wetalk.modules.message.mapper.MessageMapper">
    <select id="findByChatId" resultType="com.wetalk.modules.message.entity.Message">
        SELECT * FROM message
        WHERE (from_uid = #{chatId} OR to_uid = #{chatId})
           OR (from_uid = #{chatId} AND to_uid = #{chatId})
        ORDER BY seq_id ASC
        LIMIT #{limit} OFFSET #{offset}
    </select>
    <select id="findBySeqRange" resultType="com.wetalk.modules.message.entity.Message">
        SELECT * FROM message
        WHERE (from_uid = #{uid} OR to_uid = #{uid})
          AND seq_id BETWEEN #{fromSeq} AND #{toSeq}
        ORDER BY seq_id ASC
        LIMIT #{limit}
    </select>
    <select id="searchMessages" resultType="com.wetalk.modules.message.entity.Message">
        SELECT * FROM message
        WHERE (from_uid = #{uid} OR to_uid = #{uid})
          AND content_aes IS NOT NULL
        ORDER BY created_at DESC
        LIMIT #{limit}
    </select>
</mapper>
```

- [ ] **Step 3: Create MessageService**

```java
public interface MessageService {
    void saveMessage(Message msg);
    List<Message> getMessages(String chatId, int limit, long offset);
    List<Message> syncMessages(String userId, long fromSeq, Long toSeq, int limit);
    List<Message> searchMessages(String userId, String keyword);
    boolean deleteMessage(String msgId, String userId);
    boolean recallMessage(String msgId, String userId);           // No time limit per spec
    boolean adminRecallMessage(String msgId, String groupId);     // Admin/owner recall anyone
    void markRead(String userId, String chatId, long seqId);
}
```

- [ ] **Step 4: Implement MessageServiceImpl**

```java
@Service
@RequiredArgsConstructor
public class MessageServiceImpl implements MessageService {

    private final MessageMapper messageMapper;
    private final SeqIdGenerator seqIdGenerator;

    @Override
    @Transactional
    public void saveMessage(Message msg) {
        if (msg.getSeqId() == null) {
            msg.setSeqId(seqIdGenerator.nextSeqId(msg.getFromUid()));
        }
        messageMapper.insert(msg);
    }

    @Override
    public List<Message> getMessages(String chatId, int limit, long offset) {
        return messageMapper.findByChatId(chatId, limit, offset);
    }

    @Override
    public List<Message> syncMessages(String userId, long fromSeq, Long toSeq, int limit) {
        long maxSeq = toSeq != null ? toSeq : seqIdGenerator.currentSeqId(userId);
        return messageMapper.findBySeqRange(userId, fromSeq, maxSeq, limit);
    }

    @Override
    @Transactional
    public boolean recallMessage(String msgId, String userId) {
        Message msg = messageMapper.selectOne(
                new LambdaQueryWrapper<Message>().eq(Message::getMsgId, msgId));
        if (msg == null || !msg.getFromUid().equals(userId)) return false;
        msg.setStatus(3); // recalled
        msg.setUpdatedAt(System.currentTimeMillis());
        messageMapper.updateById(msg);
        return true;
    }

    @Override
    @Transactional
    public boolean adminRecallMessage(String msgId, String groupId) {
        Message msg = messageMapper.selectOne(
                new LambdaQueryWrapper<Message>().eq(Message::getMsgId, msgId));
        if (msg == null || !msg.getToUid().equals(groupId)) return false;
        msg.setStatus(3);
        msg.setUpdatedAt(System.currentTimeMillis());
        messageMapper.updateById(msg);
        return true;
    }

    @Override
    public void markRead(String userId, String chatId, long seqId) {
        // Update in Redis: user:read:{userId}:{chatId} = seqId
    }

    @Override
    public List<Message> searchMessages(String userId, String keyword) {
        return messageMapper.searchMessages(keyword, userId, 50);
    }

    @Override @Transactional
    public boolean deleteMessage(String msgId, String userId) {
        return messageMapper.delete(
                new LambdaQueryWrapper<Message>()
                        .eq(Message::getMsgId, msgId)
                        .eq(Message::getFromUid, userId)) > 0;
    }
}
```

- [ ] **Step 5: Create MessageController**

```java
@RestController
@RequestMapping("/api/v1/message")
@RequiredArgsConstructor
public class MessageController {

    private final MessageService messageService;

    @GetMapping("/sync")
    public ApiResponse<List<Message>> sync(
            @AuthenticationPrincipal UserPrincipal user,
            @RequestParam long fromSeq,
            @RequestParam(required = false) Long toSeq,
            @RequestParam(defaultValue = "500") int limit) {
        return ApiResponse.success(messageService.syncMessages(user.getUserId(), fromSeq, toSeq, limit));
    }

    @GetMapping("/history")
    public ApiResponse<List<Message>> history(
            @RequestParam String chatId,
            @RequestParam(defaultValue = "50") int limit,
            @RequestParam(defaultValue = "0") long offset) {
        return ApiResponse.success(messageService.getMessages(chatId, limit, offset));
    }

    @PostMapping("/recall")
    public ApiResponse<Void> recall(
            @AuthenticationPrincipal UserPrincipal user,
            @RequestBody Map<String, String> body) {
        messageService.recallMessage(body.get("msgId"), user.getUserId());
        return ApiResponse.success(null);
    }
}
```

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: add message persistence and sync API"
```

---

### Task 11: Social Module — Friend System

**Files:**
- Create: all files under `modules/social/` for friends (controller, service, mapper, entity, DTO)

- [ ] **Step 1: FriendRelation entity + FriendMapper + XML (CREATE TABLE already done)**

- [ ] **Step 2: FriendService — add, remove, block, search, list, get requests**

- [ ] **Step 3: FriendController — REST endpoints**

- [ ] **Step 4: Commit**

---

### Task 12: Social Module — Group System

**Files:**
- Create: GroupInfo.java, GroupMember.java, GroupMapper, GroupMemberMapper, GroupService, GroupController

- [ ] **Step 1: Create group, join, leave, dissolve, set role, mute, notice, transfer**

- [ ] **Step 2: GroupController — REST + IM integration**

- [ ] **Step 3: Commit**

---

### Task 13: IM — Group Message Broadcasting

**Files:**
- Modify: `MessageHandler.java` — add group routing via Redis member list

- [ ] **Step 1: Add group members lookup in MessageHandler**

```java
// In handleSendMessage, when toUid starts with "g_":
// Fetch group member IDs from Redis (cached from DB)
Set<String> members = redis.opsForSet().members("group:members:" + toUid);
for (String member : members) {
    if (!member.equals(fromUid)) {
        connectionManager.pushToAllDevices(member, json);
    }
}
```

- [ ] **Step 2: Commit**

---

### Task 14: File Module — Upload to OSS

**Files:**
- Create: `FileController.java`, `FileService.java`, `FileServiceImpl.java`, `OSSConfig.java`

- [ ] **Step 1: OSSConfig**

```java
@Configuration
public class OSSConfig {
    @Bean
    public OSS ossClient(@Value("${oss.endpoint}") String endpoint,
                          @Value("${oss.access-key}") String accessKey,
                          @Value("${oss.secret-key}") String secretKey) {
        return new OSSClientBuilder().build(endpoint, accessKey, secretKey);
    }
}
```

- [ ] **Step 2: FileService — upload returns URL, download generates signed URL**

```java
public String upload(String objectName, InputStream input, long size, String contentType) {
    ossClient.putObject(bucket, objectName, input, new ObjectMetadata());
    return "https://" + bucket + "." + endpoint + "/" + objectName;
}
```

- [ ] **Step 3: FileController — upload API with multipart**

- [ ] **Step 4: Commit**

---

### Task 15: Payment Module — Wallet

**Files:**
- Create: Wallet entity, WalletMapper, WalletService, WalletController
- Create: wallet_transaction entity, WalletTransactionMapper

- [ ] **Step 1: Wallet entity**

- [ ] **Step 2: WalletService — balance, transaction history**

- [ ] **Step 3: WalletController — get balance, list transactions**

- [ ] **Step 4: Commit**

---

### Task 16: Payment Module — Red Packets

**Files:**
- Create: RedPacket entity, RedPacketRecord, RedPacketMapper, RedPacketService, RedPacketController

- [ ] **Step 1: Send red packet (validate amount, create record, expire later)**

- [ ] **Step 2: Open/openRedPacket (check: not self, not expired, not claimed)**

- [ ] **Step 3: RedPacketController — send, open, get info**

- [ ] **Step 4: Commit**

---

### Task 17: E2E Encryption — Key Exchange

**Files:**
- Create: `E2EKeyService.java`, `E2EController.java`

- [ ] **Step 1: Key registration API — client posts public key**

- [ ] **Step 2: Key retrieval API — get peer's public key**

- [ ] **Step 3: Commit**

---

### Task 18: Admin Backend — API Layer

**Files:**
- Create: `AdminAuthController.java`, `AdminUserController.java`, `AdminGroupController.java`, `AdminMessageController.java`, `AdminPaymentController.java`, `AdminConfigController.java`, `AdminAuditController.java`

**Endpoints:**
- `POST /api/v1/admin/login` — admin login with MFA
- `GET /api/v1/admin/dashboard` — stats summary
- `GET /api/v1/admin/users` — user list with search/filter
- `POST /api/v1/admin/users/{uid}/ban` — ban user
- `POST /api/v1/admin/users/{uid}/verify` — approve/reject real name
- `GET /api/v1/admin/groups` — group list
- `POST /api/v1/admin/groups/{gid}/dissolve` — dissolve group
- `GET /api/v1/admin/messages` — message search
- `DELETE /api/v1/admin/messages/{msgId}` — delete message
- `GET /api/v1/admin/payments` — transaction list
- `GET /api/v1/admin/redpackets` — red packet list
- `GET/POST /api/v1/admin/sensitive-words` — manage sensitive words
- `GET/POST /api/v1/admin/invite-codes` — manage invite codes
- `GET /api/v1/admin/config` — system configuration
- `PUT /api/v1/admin/config` — update configuration
- `GET /api/v1/admin/audit-logs` — operation logs

- [ ] **Step 1-10: Implement each controller with adminAuth filter**

- [ ] **Step 11: Commit**

---

### Task 19: Admin Frontend — React SPA

**Files:**
- Create: `admin-frontend/` directory with React + Ant Design Pro

- [ ] **Step 1: Initialize project**

```bash
npx create-react-app admin-frontend --template typescript
cd admin-frontend
npm install antd @ant-design/icons @ant-design/pro-components axios react-router-dom dayjs
```

- [ ] **Step 2: Create AdminLayout, PrivateRoute, login page**

- [ ] **Step 3: Create Dashboard page with ECharts**

- [ ] **Step 4: Create UserList, GroupList, MessageSearch pages**

- [ ] **Step 5: Create PaymentList, RedPacketList pages**

- [ ] **Step 6: Create SensitiveWords, InviteCodes, SystemConfig pages**

- [ ] **Step 7: Create AuditLog page**

- [ ] **Step 8: Create vercel.json for deployment**

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "build",
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

- [ ] **Step 9: Build and verify locally**

Run: `npm run build`
Expected: BUILD SUCCESS

- [ ] **Step 10: Commit**

---

### Task 20: Multi-Device Sync — seqId and Pull

- [ ] **Step 1: Implement seqId in all message paths**

- [ ] **Step 2: Sync endpoint for offline devices**

- [ ] **Step 3: Device registration on IM connect**

- [ ] **Step 4: Read status sync across devices (Redis → broadcast)**

- [ ] **Step 5: Commit**

---

### Task 21: Railway Deployment Configuration

**Files:**
- Create: `railway.json`, `Procfile`
- Modify: `application-prod.yml`

- [ ] **Step 1: Create railway.json**

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile"
  },
  "deploy": {
    "numReplicas": 1,
    "healthcheckPath": "/api/health",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
}
```

- [ ] **Step 2: Create Procfile**

```
web: java -jar target/wetalk-server-*.jar --spring.profiles.active=prod
```

- [ ] **Step 3: Configure application-prod.yml**

```yaml
spring:
  config:
    activate:
      on-profile: prod
  datasource:
    url: ${MYSQL_URL}
    username: ${MYSQL_USER}
    password: ${MYSQL_PASS}
  data:
    redis:
      host: ${REDIS_HOST}
      port: ${REDIS_PORT}
      password: ${REDIS_PASS}

jwt:
  secret: ${JWT_SECRET}

oss:
  endpoint: ${OSS_ENDPOINT}
  access-key: ${OSS_ACCESS_KEY}
  secret-key: ${OSS_SECRET_KEY}
  bucket: ${OSS_BUCKET}

logging:
  level:
    com.wetalk: INFO
```

- [ ] **Step 4: Full build test**

Run: `mvn clean package -DskipTests -Pprod`
Expected: BUILD SUCCESS, JAR created

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "chore: add Railway deployment configuration"
```

---

## Execution Order Summary

| Order | Task | Dependent On | Time Estimate |
|-------|------|-------------|---------------|
| 1 | Project scaffold | — | 30 min |
| 2 | Common infra | 1 | 15 min |
| 3 | Auth layer | 2 | 45 min |
| 4 | Database schema | 1 | 15 min |
| 5 | User registration/login | 3, 4 | 1 hr |
| 6 | User profile | 5 | 30 min |
| 7 | Captcha/SMS | 4 | 30 min |
| 8 | Netty IM server | 3, 4 | 1 hr |
| 9 | IM message handler | 8 | 1 hr |
| 10 | Message persistence | 4, 9 | 1 hr |
| 11 | Friend system | 5 | 1 hr |
| 12 | Group system | 5 | 1.5 hr |
| 13 | Group message broadcast | 9, 12 | 30 min |
| 14 | File upload OSS | 4 | 45 min |
| 15 | Wallet | 5 | 45 min |
| 16 | Red packets | 15 | 1 hr |
| 17 | E2E encryption | 5 | 45 min |
| 18 | Admin backend API | 3, 4 | 2 hr |
| 19 | Admin frontend SPA | 18 | 3 hr |
| 20 | Multi-device sync | 10 | 1 hr |
| 21 | Railway deployment | all above | 30 min |

**Total Phase 1 Estimate:** ~20 hours of implementation time
