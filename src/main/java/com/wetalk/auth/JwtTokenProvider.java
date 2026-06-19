package com.wetalk.auth;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
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
        // Ensure key is at least 256 bits (32 bytes) by hashing if needed
        byte[] keyBytes = deriveKey(secret, "access");
        byte[] refreshKeyBytes = deriveKey(secret, "refresh");
        this.accessSecret = Keys.hmacShaKeyFor(keyBytes);
        this.refreshSecret = Keys.hmacShaKeyFor(refreshKeyBytes);
        this.accessExpiration = accessExp;
        this.refreshExpiration = refreshExp;
    }

    private byte[] deriveKey(String secret, String salt) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            md.update(secret.getBytes(StandardCharsets.UTF_8));
            md.update(salt.getBytes(StandardCharsets.UTF_8));
            return md.digest();
        } catch (Exception e) {
            // Fallback: pad to 32 bytes
            byte[] raw = (secret + salt).getBytes(StandardCharsets.UTF_8);
            byte[] key = new byte[32];
            System.arraycopy(raw, 0, key, 0, Math.min(raw.length, 32));
            return key;
        }
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
