package com.dsatracker.backend.repository;

import com.dsatracker.backend.model.UserHandle;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UserHandleRepository extends JpaRepository<UserHandle, Long> {
    Optional<UserHandle> findByHandle(String handle);
    boolean existsByHandle(String handle);
    boolean existsByEmail(String email);
}
