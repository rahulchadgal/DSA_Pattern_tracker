package com.dsatracker.backend.service;

import com.dsatracker.backend.dto.AuthResponse;
import com.dsatracker.backend.dto.LoginRequest;
import com.dsatracker.backend.dto.RegisterRequest;
import com.dsatracker.backend.model.UserHandle;
import com.dsatracker.backend.repository.UserHandleRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AuthService {
    private final UserHandleRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public AuthService(UserHandleRepository userRepository, PasswordEncoder passwordEncoder, JwtService jwtService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    public AuthResponse register(RegisterRequest request) {
        String normalizedHandle = request.handle().trim().toLowerCase();
        String normalizedEmail = request.email().trim().toLowerCase();

        if (userRepository.existsByHandle(normalizedHandle)) {
            throw new IllegalArgumentException("Handle already exists");
        }
        if (userRepository.existsByEmail(normalizedEmail)) {
            throw new IllegalArgumentException("Email already exists");
        }

        UserHandle user = new UserHandle();
        user.setHandle(normalizedHandle);
        user.setEmail(normalizedEmail);
        user.setFullName(request.fullName().trim());
        user.setBio(request.bio());
        user.setAvatarUrl(request.avatarUrl());
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        userRepository.save(user);

        return new AuthResponse(jwtService.generateToken(normalizedHandle), normalizedHandle);
    }

    public AuthResponse login(LoginRequest request) {
        String normalizedHandle = request.handle().trim().toLowerCase();
        UserHandle user = userRepository.findByHandle(normalizedHandle)
                .orElseThrow(() -> new IllegalArgumentException("Invalid credentials"));

        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new IllegalArgumentException("Invalid credentials");
        }

        return new AuthResponse(jwtService.generateToken(normalizedHandle), normalizedHandle);
    }
}
