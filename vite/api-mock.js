var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
/**
 * Mock API plugin untuk Vite dev server.
 *
 * Menyediakan endpoint:
 *  - POST   /api/login        — sahkan nama pengguna + kata laluan
 *  - GET    /api/session      — pulangkan profil (jika ada)
 *  - DELETE /api/session      — kosongkan sesi
 *  - POST   /api/reset-request — cipta permintaan reset kata laluan
 *
 * Untuk pembangunan sahaja. Dalam produksi, gunakan Supabase Edge Functions
 * (lihat supabase/functions/).
 */
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
// Helper: hash kata laluan dengan SHA-256 (dev only fallback)
function devHashPassword(password) {
    return createHash("sha256").update(password).digest("hex");
}
// Simple session store (in-memory, dev only)
var sessions = new Map();
function getSupabase() {
    var url = process.env.VITE_SUPABASE_URL || "";
    var key = process.env.VITE_SUPABASE_ANON_KEY || "";
    if (!url || !key)
        return null;
    return createClient(url, key);
}
function readBody(req) {
    return new Promise(function (resolve, reject) {
        var data = "";
        req.on("data", function (chunk) { return (data += chunk); });
        req.on("end", function () {
            try {
                resolve(data ? JSON.parse(data) : {});
            }
            catch (_a) {
                resolve({});
            }
        });
        req.on("error", reject);
    });
}
function sendJson(res, status, body) {
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(body));
}
export function apiMockPlugin() {
    return {
        name: "quickrx-api-mock",
        configureServer: function (server) {
            var _this = this;
            server.middlewares.use(function (req, res, next) { return __awaiter(_this, void 0, void 0, function () {
                var url, body, nama_pengguna, kata_laluan, sb, _a, profile, error, stored, valid, bcrypt, _b, hash, _c, _, profileSafe, token, auth, token, session, sb, profile, _d, _, profileSafe, auth, token, body, userId, sb, existing, insertError, err_1;
                return __generator(this, function (_e) {
                    switch (_e.label) {
                        case 0:
                            url = req.url || "";
                            if (!url.startsWith("/api/"))
                                return [2 /*return*/, next()];
                            _e.label = 1;
                        case 1:
                            _e.trys.push([1, 16, , 17]);
                            if (!(url === "/api/login" && req.method === "POST")) return [3 /*break*/, 9];
                            return [4 /*yield*/, readBody(req)];
                        case 2:
                            body = _e.sent();
                            nama_pengguna = body.nama_pengguna, kata_laluan = body.kata_laluan;
                            if (!nama_pengguna || !kata_laluan) {
                                return [2 /*return*/, sendJson(res, 400, {
                                        error: "Nama pengguna dan kata laluan diperlukan.",
                                    })];
                            }
                            sb = getSupabase();
                            if (!sb) {
                                return [2 /*return*/, sendJson(res, 503, {
                                        error: "Supabase tidak dikonfigurasi. Sila isi .env dengan VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY.",
                                    })];
                            }
                            return [4 /*yield*/, sb
                                    .from("profiles")
                                    .select("*")
                                    .eq("nama_pengguna", nama_pengguna)
                                    .eq("aktif", true)
                                    .maybeSingle()];
                        case 3:
                            _a = _e.sent(), profile = _a.data, error = _a.error;
                            if (error || !profile) {
                                return [2 /*return*/, sendJson(res, 401, {
                                        error: "Nama pengguna atau kata laluan tidak sah.",
                                    })];
                            }
                            stored = profile.kata_laluan_hash;
                            if (!stored) {
                                return [2 /*return*/, sendJson(res, 401, {
                                        error: "Akaun belum menetapkan kata laluan. Sila hubungi pentadbir.",
                                    })];
                            }
                            valid = false;
                            _e.label = 4;
                        case 4:
                            _e.trys.push([4, 7, , 8]);
                            return [4 /*yield*/, import("bcryptjs")];
                        case 5:
                            bcrypt = _e.sent();
                            return [4 /*yield*/, bcrypt.compare(kata_laluan, stored)];
                        case 6:
                            valid = _e.sent();
                            return [3 /*break*/, 8];
                        case 7:
                            _b = _e.sent();
                            hash = devHashPassword(kata_laluan);
                            valid = hash === stored || stored === kata_laluan;
                            return [3 /*break*/, 8];
                        case 8:
                            if (!valid) {
                                return [2 /*return*/, sendJson(res, 401, {
                                        error: "Nama pengguna atau kata laluan tidak sah.",
                                    })];
                            }
                            _c = profile, _ = _c.kata_laluan_hash, profileSafe = __rest(_c, ["kata_laluan_hash"]);
                            token = Math.random().toString(36).slice(2) +
                                Date.now().toString(36);
                            sessions.set(token, {
                                userId: profileSafe.id,
                                createdAt: Date.now(),
                            });
                            return [2 /*return*/, sendJson(res, 200, {
                                    profile: profileSafe,
                                    token: token,
                                })];
                        case 9:
                            if (!(url === "/api/session" && req.method === "GET")) return [3 /*break*/, 11];
                            auth = req.headers.authorization || "";
                            token = auth.replace(/^Bearer\s+/i, "").trim();
                            if (!token) {
                                return [2 /*return*/, sendJson(res, 200, { profile: null })];
                            }
                            session = sessions.get(token);
                            if (!session) {
                                return [2 /*return*/, sendJson(res, 200, { profile: null })];
                            }
                            sb = getSupabase();
                            if (!sb) {
                                return [2 /*return*/, sendJson(res, 503, { error: "Supabase tidak dikonfigurasi." })];
                            }
                            return [4 /*yield*/, sb
                                    .from("profiles")
                                    .select("*")
                                    .eq("id", session.userId)
                                    .maybeSingle()];
                        case 10:
                            profile = (_e.sent()).data;
                            if (!profile) {
                                sessions.delete(token);
                                return [2 /*return*/, sendJson(res, 200, { profile: null })];
                            }
                            _d = profile, _ = _d.kata_laluan_hash, profileSafe = __rest(_d, ["kata_laluan_hash"]);
                            return [2 /*return*/, sendJson(res, 200, { profile: profileSafe })];
                        case 11:
                            // ===========================================================
                            // DELETE /api/session
                            // ===========================================================
                            if (url === "/api/session" && req.method === "DELETE") {
                                auth = req.headers.authorization || "";
                                token = auth.replace(/^Bearer\s+/i, "").trim();
                                if (token)
                                    sessions.delete(token);
                                return [2 /*return*/, sendJson(res, 200, { success: true })];
                            }
                            if (!(url === "/api/reset-request" && req.method === "POST")) return [3 /*break*/, 15];
                            return [4 /*yield*/, readBody(req)];
                        case 12:
                            body = _e.sent();
                            userId = body.userId;
                            if (!userId) {
                                return [2 /*return*/, sendJson(res, 400, { error: "userId diperlukan." })];
                            }
                            sb = getSupabase();
                            if (!sb) {
                                return [2 /*return*/, sendJson(res, 503, { error: "Supabase tidak dikonfigurasi." })];
                            }
                            return [4 /*yield*/, sb
                                    .from("password_reset_requests")
                                    .select("id")
                                    .eq("user_id", userId)
                                    .eq("status", "pending")
                                    .maybeSingle()];
                        case 13:
                            existing = (_e.sent()).data;
                            if (existing) {
                                return [2 /*return*/, sendJson(res, 409, {
                                        error: "Permintaan reset sudah wujud.",
                                        duplicate: true,
                                    })];
                            }
                            return [4 /*yield*/, sb
                                    .from("password_reset_requests")
                                    .insert({
                                    user_id: userId,
                                    status: "pending",
                                    notes: "Permintaan melalui halaman Lupa Kata Laluan",
                                })];
                        case 14:
                            insertError = (_e.sent()).error;
                            if (insertError) {
                                return [2 /*return*/, sendJson(res, 500, {
                                        error: "Gagal mencipta permintaan.",
                                    })];
                            }
                            return [2 /*return*/, sendJson(res, 200, { success: true })];
                        case 15: 
                        // Tiada padanan
                        return [2 /*return*/, sendJson(res, 404, { error: "Endpoint tidak dijumpai." })];
                        case 16:
                            err_1 = _e.sent();
                            // eslint-disable-next-line no-console
                            console.error("[api-mock]", err_1);
                            return [2 /*return*/, sendJson(res, 500, {
                                    error: "Ralat pelayan dalaman.",
                                })];
                        case 17: return [2 /*return*/];
                    }
                });
            }); });
        },
    };
}
