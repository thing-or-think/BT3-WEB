// Test script xác thực cơ chế lưu tài khoản trong Cookie
const fs = require('fs');
const assert = require('assert');

// 1. Giả lập môi trường document.cookie của Trình duyệt
let cookieStore = {};
global.document = {
  get cookie() {
    return Object.entries(cookieStore).map(([k, v]) => `${k}=${v}`).join('; ');
  },
  set cookie(val) {
    const parts = val.split(';');
    const first = parts[0];
    const eqIdx = first.indexOf('=');
    const key = first.substring(0, eqIdx).trim();
    const value = first.substring(eqIdx + 1).trim();
    
    // Nếu ngày hết hạn là epoch 1970 thì xóa
    if (val.includes('expires=Thu, 01 Jan 1970')) {
      delete cookieStore[key];
    } else {
      cookieStore[key] = value;
    }
  }
};

global.window = {
  location: { protocol: 'http:' },
  crypto: null
};

global.localStorage = {
  data: {},
  getItem(k) { return this.data[k] || null; },
  setItem(k, v) { this.data[k] = String(v); },
  removeItem(k) { delete this.data[k]; }
};

// 2. Định nghĩa các hàm Cookie chuẩn như trong AuthService
const COOKIE_SESSION = 'rps_arena_user_session';

function setCookie(name, value, days = 7) {
  let expires = '';
  if (days > 0) {
    const date = new Date();
    date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
    expires = '; expires=' + date.toUTCString();
  }
  document.cookie = `${name}=${encodeURIComponent(value)}${expires}; path=/; SameSite=Lax`;
}

function getCookie(name) {
  const nameEQ = name + '=';
  const parts = document.cookie.split(';');
  for (let i = 0; i < parts.length; i++) {
    let c = parts[i];
    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) {
      try {
        return decodeURIComponent(c.substring(nameEQ.length, c.length));
      } catch (_) {
        return c.substring(nameEQ.length, c.length);
      }
    }
  }
  return null;
}

function deleteCookie(name) {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax`;
}

console.log('--- [TEST 1] ĐĂNG NHẬP VÀ GHI COOKIE TÀI KHOẢN ---');
const userSession = {
  id: 'usr_test_1001',
  username: 'CaoThu_Cookie',
  email: 'caothu@arena.vn',
  role: 'USER',
  elo: 1250,
  lastLogin: new Date().toISOString()
};

setCookie(COOKIE_SESSION, JSON.stringify(userSession), 7);
console.log('Giá trị document.cookie sau khi đăng nhập:', document.cookie);
assert(document.cookie.includes('rps_arena_user_session='), 'Cookie phải chứa rps_arena_user_session');

console.log('--- [TEST 2] ĐỌC VÀ KHÔI PHỤC TÀI KHOẢN TỪ COOKIE (AUTO-LOGIN) ---');
const readRaw = getCookie(COOKIE_SESSION);
assert(readRaw !== null, 'Phải đọc được cookie');
const restoredUser = JSON.parse(readRaw);
assert.strictEqual(restoredUser.username, 'CaoThu_Cookie');
assert.strictEqual(restoredUser.role, 'USER');
assert.strictEqual(restoredUser.elo, 1250);
console.log('Khôi phục tài khoản thành công:', restoredUser);

console.log('--- [TEST 3] CẬP NHẬT ELO VÀ GHI ĐÈ COOKIE KHI THẮNG TRẬN ---');
restoredUser.elo += 50;
setCookie(COOKIE_SESSION, JSON.stringify(restoredUser), 7);
const updatedRaw = getCookie(COOKIE_SESSION);
const updatedUser = JSON.parse(updatedRaw);
assert.strictEqual(updatedUser.elo, 1300);
console.log('Cập nhật Elo thành công vào Cookie:', updatedUser.elo);

console.log('--- [TEST 4] ĐĂNG XUẤT VÀ XÓA COOKIE ---');
deleteCookie(COOKIE_SESSION);
assert.strictEqual(getCookie(COOKIE_SESSION), null, 'Cookie phải bị xóa');
console.log('Giá trị document.cookie sau khi đăng xuất:', document.cookie || '(Trống)');

console.log('✅ TẤT CẢ TEST COOKIE AUTH ĐỀU VƯỢT QUA!');
