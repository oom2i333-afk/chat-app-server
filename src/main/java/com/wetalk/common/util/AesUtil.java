package com.wetalk.common.util;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.security.SecureRandom;

public class AesUtil {
    private static final String ALGORITHM = "AES/GCM/NoPadding";
    private static final int GCM_TAG_LENGTH = 128;
    private static final int IV_LENGTH = 12;
    private static final byte[] KEY = "wetalk-aes-key-32bytes!!00123456".getBytes();

    public static byte[] encrypt(String plaintext) {
        try {
            byte[] iv = new byte[IV_LENGTH];
            new SecureRandom().nextBytes(iv);
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
