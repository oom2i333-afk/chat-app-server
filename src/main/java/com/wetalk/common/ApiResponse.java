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
