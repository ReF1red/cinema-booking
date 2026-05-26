import React, { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { Film, User } from "lucide-react";
import { useApp } from "../../context/AppContext";
import { getErrorMessage } from "../../lib/api";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./ui/card";

const adminEmailFromEnv = (import.meta.env.VITE_ADMIN_EMAIL ?? "").trim();
const cinemaAdminEmailFromEnv = (import.meta.env.VITE_CINEMA_ADMIN_EMAIL ?? "").trim();
const ADMIN_EMAIL = adminEmailFromEnv || "Admin@example.com";
const CINEMA_ADMIN_EMAIL = cinemaAdminEmailFromEnv || "cinema-admin@example.com";

export function Auth() {
  const { user, login, register, guestLogin, isAuthResolved } = useApp();
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
  });

  const validateMaxLength = (value: string, fieldName: string): string | null => {
    if (value.length > 40) return `${fieldName} не может быть длиннее 40 символов`;
    return null;
  };

  if (isAuthResolved && user) {
      if (user.role === "admin" || user.role === "cinema_admin") {
          return <Navigate to="/admin" replace />;
      }
      const raw = localStorage.getItem("cinemax_location");
      if (raw) {
          try {
              const loc = JSON.parse(raw);
              if (loc.cityId && loc.cinemaId) {
                  return <Navigate to="/home" replace />;
              }
          } catch {}
      }
      return <Navigate to="/cities" replace />;
  }

  const handleChange = (key: "fullName" | "email" | "password", value: string) => {
    const truncated = value.slice(0, 40);
    setForm((prev) => ({ ...prev, [key]: truncated }));
    if (error) setError(null);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    if (!isLogin) {
      const nameErr = validateMaxLength(form.fullName, "Имя");
      if (nameErr) {
        setError(nameErr);
        setLoading(false);
        return;
      }
    }
    const emailErr = validateMaxLength(form.email, "Email");
    if (emailErr) {
      setError(emailErr);
      setLoading(false);
      return;
    }
    const passErr = validateMaxLength(form.password, "Пароль");
    if (passErr) {
      setError(passErr);
      setLoading(false);
      return;
    }

    try {
      if (isLogin) {
        const email = form.email.trim();
        await login(email, form.password);
        const normalizedEmail = email.toLowerCase();
        if (normalizedEmail === ADMIN_EMAIL.trim().toLowerCase()) {
          navigate("/admin");
          return;
        }
        if (CINEMA_ADMIN_EMAIL && normalizedEmail === CINEMA_ADMIN_EMAIL.trim().toLowerCase()) {
          navigate("/admin");
          return;
        }
      } else {
        await register(form.fullName.trim(), form.email.trim(), form.password);
      }
      navigate("/cities");
    } catch (submitError) {
      setError(getErrorMessage(submitError, "Не удалось выполнить вход. Попробуйте еще раз."));
    } finally {
      setLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      await guestLogin();
      navigate("/cities");
    } catch (err) {
      setError("Ошибка при входе как гость. Попробуйте позже.");
    } finally {
      setLoading(false);
    }
  };

  return (
      <div className="flex-1 flex flex-col items-center justify-center p-4 relative overflow-hidden bg-[#0B0B0D]">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#E50914] rounded-full blur-[150px] opacity-20 pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-[#FFC857] rounded-full blur-[200px] opacity-10 pointer-events-none" />

        <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.35, type: "spring" }}
            className="w-full max-w-md z-10"
        >
          <Card className="backdrop-blur-xl bg-[#1A1A1F]/80 border-[#F5F5F7]/10 shadow-[0_0_50px_rgba(0,0,0,0.5)]">
            <CardHeader className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 rounded-2xl bg-[#E50914] flex items-center justify-center box-glow mb-4">
                <Film className="w-8 h-8 text-white" />
              </div>
              <CardTitle className="text-3xl">{isLogin ? "С возвращением" : "Создать аккаунт"}</CardTitle>
              <CardDescription className="text-base text-[#9CA3AF]">
                {isLogin
                    ? "Введите ваши данные для входа в CINEMAX."
                    : "Зарегистрируйтесь, чтобы начать бронировать места."}
              </CardDescription>
            </CardHeader>

            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {!isLogin && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-[#F5F5F7]" htmlFor="full-name">
                        Полное имя
                      </label>
                      <Input
                          id="full-name"
                          placeholder="Иван Иванов"
                          required
                          maxLength={40}
                          value={form.fullName}
                          onChange={(event) => handleChange("fullName", event.target.value)}
                      />
                    </div>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-medium text-[#F5F5F7]" htmlFor="email">
                    Email
                  </label>
                  <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      required
                      maxLength={40}
                      value={form.email}
                      onChange={(event) => handleChange("email", event.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-[#F5F5F7]" htmlFor="password">
                    Пароль
                  </label>
                  <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      required
                      maxLength={40}
                      value={form.password}
                      onChange={(event) => handleChange("password", event.target.value)}
                  />
                </div>

                {error && (
                    <p className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                      {error}
                    </p>
                )}

                <Button
                    type="submit"
                    className="w-full text-lg h-12 mt-4 relative overflow-hidden group"
                    disabled={loading}
                >
                  {loading ? (
                      <span className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                        {isLogin ? "Входим..." : "Создаем аккаунт..."}
                  </span>
                  ) : (
                      <span>{isLogin ? "Войти" : "Зарегистрироваться"}</span>
                  )}
                  <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12" />
                </Button>
              </form>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[#F5F5F7]/10"></div>
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-[#1A1A1F] px-2 text-[#9CA3AF]">или</span>
                </div>
              </div>

              <Button
                  type="button"
                  variant="outline"
                  className="w-full bg-transparent border-[#F5F5F7]/20 hover:bg-white/5 text-white"
                  onClick={handleGuestLogin}
                  disabled={loading}
              >
                <User className="w-4 h-4 mr-2" />
                Войти как гость
              </Button>
            </CardContent>

            <CardFooter className="justify-center border-t border-[#F5F5F7]/10 pt-6 flex flex-col gap-3">
              <p className="text-[#9CA3AF] text-sm">
                {isLogin ? "Нет аккаунта? " : "Уже есть аккаунт? "}
                <button
                    type="button"
                    onClick={() => {
                      setIsLogin((prev) => !prev);
                      setError(null);
                    }}
                    className="text-[#FFC857] hover:underline font-medium focus:outline-none"
                >
                  {isLogin ? "Зарегистрироваться" : "Войти"}
                </button>
              </p>
            </CardFooter>
          </Card>
        </motion.div>
      </div>
  );
}