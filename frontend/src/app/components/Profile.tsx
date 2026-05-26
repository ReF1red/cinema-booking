import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "motion/react";
import { CheckCircle2, Clock, Lock, Mail, Shield, UserRound } from "lucide-react";
import { useApp } from "../../context/AppContext";
import { changePassword, getErrorMessage, updateProfile } from "../../lib/api";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Input } from "./ui/input";

export function Profile() {
  const { user, bookings, logout } = useApp();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isGuest = user?.role === "guest";

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [changingPassword, setChangingPassword] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(searchParams.get("reset") === "true");

  const [paidCount, setPaidCount] = useState(0);
  const [unpaidCount, setUnpaidCount] = useState(0);

  const [profileName, setProfileName] = useState(user?.full_name ?? "");
  const [profileEmail, setProfileEmail] = useState(user?.email ?? "");
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [updatingProfile, setUpdatingProfile] = useState(false);
  const [showProfileForm, setShowProfileForm] = useState(false);

  const handleUpdateProfile = async (e: React.FormEvent) => {
      e.preventDefault();
      setProfileError(null);
      setProfileSuccess(null);
      setUpdatingProfile(true);
      try {
          await updateProfile({ full_name: profileName, email: profileEmail });
          setProfileSuccess("Профиль обновлён.");
      } catch (err) {
          setProfileError(getErrorMessage(err, "Не удалось обновить профиль."));
      } finally {
          setUpdatingProfile(false);
      }
  };

  useEffect(() => {
    if (isGuest) return;
    const active = bookings.filter((b) => b.status !== "cancelled");
    const paid = active.filter((b) => b.is_paid);
    setPaidCount(paid.length);
    setUnpaidCount(active.length - paid.length);
  }, [bookings, isGuest]);

  if (!user) {
    return (
        <div className="flex-1 flex items-center justify-center p-6">
          <Card className="max-w-md w-full p-8 text-center bg-[#1A1A1F] border-[#F5F5F7]/10">
            <h1 className="text-3xl font-heading text-white uppercase tracking-wide mb-3">Профиль недоступен</h1>
            <p className="text-[#9CA3AF] mb-6">Сначала выполните вход, чтобы открыть профиль пользователя.</p>
            <Button onClick={() => navigate("/")}>Перейти ко входу</Button>
          </Card>
        </div>
    );
  }

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!oldPassword || !newPassword || !confirmPassword) {
      setPasswordError("Заполните все поля.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Новый пароль и подтверждение не совпадают.");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError("Пароль должен быть не менее 6 символов.");
      return;
    }
    if (newPassword === oldPassword) {
      setPasswordError("Новый пароль должен отличаться от старого.");
      return;
    }

    setChangingPassword(true);
    try {
      await changePassword(oldPassword, newPassword);
      setPasswordSuccess("Пароль успешно изменён.");
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setShowPasswordForm(false);
    } catch (err) {
      setPasswordError(getErrorMessage(err, "Не удалось изменить пароль. Проверьте старый пароль."));
    } finally {
      setChangingPassword(false);
    }
  };

  // Гостевой профиль
  if (isGuest) {
    return (
        <div className="flex-1 container mx-auto px-4 py-8 lg:py-16">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl mx-auto space-y-8">
            <header className="space-y-3">
              <h1 className="text-4xl md:text-5xl font-heading text-white uppercase tracking-wide">Гостевой доступ</h1>
              <p className="text-[#9CA3AF] text-lg">Вы просматриваете сайт без регистрации.</p>
            </header>
            <Card className="bg-[#1A1A1F] border-[#F5F5F7]/10 p-6 md:p-8">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-full bg-[#E50914]/20 flex items-center justify-center border border-[#E50914]/30">
                  <UserRound className="w-7 h-7 text-[#E50914]" />
                </div>
                <div>
                  <p className="text-[#9CA3AF] text-sm uppercase tracking-widest mb-1">Имя</p>
                  <h2 className="text-3xl font-heading text-white uppercase tracking-wide leading-tight">Гость</h2>
                </div>
              </div>
              <div className="mt-8 grid sm:grid-cols-2 gap-4">
                <div className="rounded-xl border border-[#F5F5F7]/10 bg-[#0B0B0D] p-4">
                  <p className="text-[#9CA3AF] text-xs uppercase tracking-widest mb-2 flex items-center gap-2">
                    <Mail className="w-4 h-4" /> Email
                  </p>
                  <p className="text-white">guest@example.com</p>
                </div>
                <div className="rounded-xl border border-[#F5F5F7]/10 bg-[#0B0B0D] p-4">
                  <p className="text-[#9CA3AF] text-xs uppercase tracking-widest mb-2 flex items-center gap-2">
                    <Shield className="w-4 h-4" /> Роль
                  </p>
                  <p className="text-white capitalize">Гость</p>
                </div>
              </div>
            </Card>
            <Card className="bg-[#1A1A1F] border-[#F5F5F7]/10 p-6 md:p-8">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h3 className="text-2xl font-heading text-white uppercase tracking-wide">Выход из гостевого режима</h3>
                  <p className="text-[#9CA3AF] mt-1">Вы можете выйти и войти как зарегистрированный пользователь.</p>
                </div>
                <Button variant="destructive" onClick={handleLogout}>Выйти</Button>
              </div>
            </Card>
          </motion.div>
        </div>
    );
  }

  // Обычный профиль
  return (
      <div className="flex-1 container mx-auto px-4 py-8 lg:py-16">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl mx-auto space-y-8">
          <header className="space-y-3">
            <h1 className="text-4xl md:text-5xl font-heading text-white uppercase tracking-wide">Мой Профиль</h1>
          </header>

          <div className="grid md:grid-cols-3 gap-6">
            <Card className="md:col-span-2 bg-[#1A1A1F] border-[#F5F5F7]/10 p-6 md:p-8">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-full bg-[#E50914]/20 flex items-center justify-center border border-[#E50914]/30">
                  <UserRound className="w-7 h-7 text-[#E50914]" />
                </div>
                <div>
                  <p className="text-[#9CA3AF] text-sm uppercase tracking-widest mb-1">Имя</p>
                  <h2 className="text-3xl font-heading text-white uppercase tracking-wide leading-tight">{user.full_name}</h2>
                </div>
              </div>
              <div className="mt-8 grid sm:grid-cols-2 gap-4">
                <div className="rounded-xl border border-[#F5F5F7]/10 bg-[#0B0B0D] p-4">
                  <p className="text-[#9CA3AF] text-xs uppercase tracking-widest mb-2 flex items-center gap-2">
                    <Mail className="w-4 h-4" /> Email
                  </p>
                  <p className="text-white">{user.email}</p>
                </div>
                <div className="rounded-xl border border-[#F5F5F7]/10 bg-[#0B0B0D] p-4">
                  <p className="text-[#9CA3AF] text-xs uppercase tracking-widest mb-2 flex items-center gap-2">
                    <Shield className="w-4 h-4" /> Роль
                  </p>
                  <p className="text-white capitalize">
                    {user.role === "admin" ? "Администратор" : user.role === "cinema_admin" ? "Администратор кинотеатра" : "Клиент"}
                  </p>
                </div>
              </div>
            </Card>

            <Card className="bg-[#1A1A1F] border-[#F5F5F7]/10 p-6 flex flex-col gap-6">
              <p className="text-[#9CA3AF] text-xs uppercase tracking-widest">Мои билеты</p>
              <div className="flex items-center justify-between bg-[#0B0B0D] rounded-xl p-4 border border-[#FFC857]/20">
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-[#FFC857]" />
                  <span className="text-white text-sm">Забронировано</span>
                </div>
                <span className="text-3xl font-heading text-[#FFC857]">{unpaidCount}</span>
              </div>
              <div className="flex items-center justify-between bg-[#0B0B0D] rounded-xl p-4 border border-emerald-500/20">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <span className="text-white text-sm">Оплачено</span>
                </div>
                <span className="text-3xl font-heading text-emerald-400">{paidCount}</span>
              </div>
              <Button variant="outline" className="w-full mt-auto" onClick={() => navigate("/bookings")}>Открыть мои билеты</Button>
            </Card>
          </div>

          {/* Смена данных */}
          <Card className="bg-[#1A1A1F] border-[#F5F5F7]/10 p-6 md:p-8">
            <div className="flex justify-between items-center flex-wrap gap-4 mb-4">
              <div>
                <h3 className="text-2xl font-heading text-white uppercase tracking-wide">Редактировать профиль</h3>
                <p className="text-[#9CA3AF] mt-1">Изменение имени и email.</p>
              </div>
              {!showProfileForm && <Button variant="outline" onClick={() => setShowProfileForm(true)}>Редактировать</Button>}
            </div>

            {showProfileForm && (
                <form onSubmit={handleUpdateProfile} className="space-y-4 mt-4 border-t border-[#F5F5F7]/10 pt-6">
                  <div>
                    <label className="text-sm text-[#9CA3AF] block mb-1">Имя</label>
                    <Input value={profileName} onChange={(e) => setProfileName(e.target.value)} required className="bg-[#0B0B0D] border-[#F5F5F7]/10" />
                  </div>
                  <div>
                    <label className="text-sm text-[#9CA3AF] block mb-1">Email</label>
                    <Input type="email" value={profileEmail} onChange={(e) => setProfileEmail(e.target.value)} required className="bg-[#0B0B0D] border-[#F5F5F7]/10" />
                  </div>
                  {profileError && <p className="text-red-400 text-sm">{profileError}</p>}
                  {profileSuccess && <p className="text-emerald-400 text-sm">{profileSuccess}</p>}
                  <div className="flex gap-3">
                    <Button type="submit" disabled={updatingProfile}>{updatingProfile ? "Сохранение..." : "Сохранить"}</Button>
                    <Button type="button" variant="outline" onClick={() => {
                      setShowProfileForm(false);
                      setProfileError(null);
                      setProfileSuccess(null);
                      setProfileName(user?.full_name ?? "");
                      setProfileEmail(user?.email ?? "");
                    }}>Отмена</Button>
                  </div>
                </form>
            )}
          </Card>

          {/* Смена пароля */}
          <Card className="bg-[#1A1A1F] border-[#F5F5F7]/10 p-6 md:p-8">
            <div className="flex justify-between items-center flex-wrap gap-4 mb-4">
              <div>
                <h3 className="text-2xl font-heading text-white uppercase tracking-wide flex items-center gap-2"> Безопасность
                </h3>
                <p className="text-[#9CA3AF] mt-1">Изменение пароля аккаунта.</p>
              </div>
              {!showPasswordForm && <Button variant="outline" onClick={() => setShowPasswordForm(true)}>Сменить пароль</Button>}
            </div>

            {showPasswordForm && (
                <form onSubmit={handleChangePassword} className="space-y-4 mt-4 border-t border-[#F5F5F7]/10 pt-6">
                  <div>
                    <label className="text-sm text-[#9CA3AF] block mb-1">Старый пароль</label>
                    <Input type="password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} required className="bg-[#0B0B0D] border-[#F5F5F7]/10" />
                  </div>
                  <div>
                    <label className="text-sm text-[#9CA3AF] block mb-1">Новый пароль</label>
                    <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required className="bg-[#0B0B0D] border-[#F5F5F7]/10" />
                  </div>
                  <div>
                    <label className="text-sm text-[#9CA3AF] block mb-1">Подтвердите новый пароль</label>
                    <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required className="bg-[#0B0B0D] border-[#F5F5F7]/10" />
                  </div>
                  {passwordError && <p className="text-red-400 text-sm">{passwordError}</p>}
                  {passwordSuccess && <p className="text-emerald-400 text-sm">{passwordSuccess}</p>}
                  <div className="flex gap-3">
                    <Button type="submit" disabled={changingPassword}>{changingPassword ? "Изменение..." : "Изменить пароль"}</Button>
                    <Button type="button" variant="outline" onClick={() => {
                      setShowPasswordForm(false);
                      setPasswordError(null);
                      setPasswordSuccess(null);
                      setOldPassword("");
                      setNewPassword("");
                      setConfirmPassword("");
                    }}>Отмена</Button>
                  </div>
                </form>
            )}
          </Card>
        </motion.div>
      </div>
  );
}