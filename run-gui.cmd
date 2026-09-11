@echo off
rclone gui "%~dp0dist" ^
  --addr 127.0.0.1:63911 ^
  --api-addr 127.0.0.1:63912 ^
  --no-auth
