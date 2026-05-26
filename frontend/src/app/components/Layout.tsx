import React from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { CalendarClock, Film, Shield, Ticket, User } from "lucide-react";
import { motion } from "motion/react";
import { useApp } from "../../context/AppContext";
import { Button } from "./ui/button";

export function Layout() {
  const { user, logout } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const canOpenAdminPanel = user?.role === "admin" || user?.role === "cinema_admin";
  const isGuest = user?.role === "guest";

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  return (
      <div className="min-h-screen flex flex-col bg-[#0B0B0D] text-[#F5F5F7]">
        <header className="sticky top-0 z-50 w-full border-b border-[#F5F5F7]/10 bg-[#0B0B0D]/80 backdrop-blur-lg">
          <div className="container mx-auto px-4 h-16 flex items-center justify-between">
            <Link to={user ? "/home" : "/"} className="flex items-center gap-2 group">
              <div className="w-8 h-8 rounded bg-[#E50914] flex items-center justify-center box-glow transition-transform group-hover:scale-105">
                <Film className="w-5 h-5 text-white" />
              </div>
              <span className="font-heading text-xl tracking-wider uppercase">
              <span className="font-heading text-2xl tracking-wider uppercase">
                  <span className="text-white">CINE</span><span className="text-[#E50914]">MAX</span>
              </span>
            </span>
            </Link>

            <nav className="hidden md:flex items-center gap-6">
              {user && (
                  <>
                    <Link
                        to="/home"
                        className={`text-sm font-medium transition-colors hover:text-white ${
                            location.pathname === "/home" ? "text-white" : "text-[#9CA3AF]"
                        }`}
                    >
                      Фильмы
                    </Link>

                    {!isGuest && (
                        <Link
                            to="/bookings"
                            className={`text-sm font-medium transition-colors hover:text-white ${
                                location.pathname === "/bookings" ? "text-white" : "text-[#9CA3AF]"
                            }`}
                        >
                          Мои билеты
                        </Link>
                    )}
                    <Link
                        to="/schedule"
                        className={`text-sm font-medium transition-colors hover:text-white ${
                            location.pathname === "/schedule" ? "text-white" : "text-[#9CA3AF]"
                        }`}
                    >
                      Расписание сеансов
                    </Link>
                    {canOpenAdminPanel && (
                        <Link
                            to="/admin"
                            className={`text-sm font-medium transition-colors hover:text-white ${
                                location.pathname.startsWith("/admin") ? "text-white" : "text-[#9CA3AF]"
                            }`}
                        >
                          Админ-панель
                        </Link>
                    )}
                  </>
              )}
            </nav>

            <div className="flex items-center gap-4">
              {user ? (
                  <div className="flex items-center gap-3">
                      {!isGuest && (
                          <Link
                              to="/profile"
                              className="flex items-center gap-2 bg-[#1A1A1F] rounded-full pl-2 pr-4 py-1 border border-[#F5F5F7]/10 hover:border-[#E50914]/40 transition-colors"
                          >
                              <div className="w-6 h-6 rounded-full bg-[#E50914]/20 flex items-center justify-center">
                                  <User className="w-3.5 h-3.5 text-[#E50914]" />
                              </div>
                              <span className="text-sm font-medium hidden sm:inline">{user.full_name}</span>
                          </Link>
                      )}
                      {isGuest ? (
                          <Button variant="default" size="sm" onClick={() => {
                              localStorage.removeItem("cinemax_user_profile");
                              window.location.href = "/";
                          }}>
                              Войти
                          </Button>
                      ) : (
                          <Button variant="ghost" size="sm" onClick={handleLogout} className="text-[#9CA3AF] hover:text-white">
                              Выйти
                          </Button>
                      )}
                  </div>
              ) : null}
            </div>
          </div>
        </header>

        <main className="flex-1 flex flex-col relative">
          <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="flex-1 flex flex-col"
          >
            <Outlet />
          </motion.div>
        </main>

        <footer className="border-t border-[#F5F5F7]/10 bg-[#0B0B0D] py-8">
          <div className="container mx-auto px-4 text-center text-sm text-[#9CA3AF]">
            <div className="flex justify-center items-center gap-2 mb-4">
              <Film className="w-4 h-4 text-[#E50914]" />
              <span className="font-heading tracking-widest">
              <span className="text-white">CINE</span><span className="text-[#E50914]">MAX</span>
            </span>
            </div>
            <p>© 2026 CINEMAX. Онлайн-бронирование мест в кинотеатре.</p>
          </div>
        </footer>

        {user && (
            <div className="md:hidden fixed bottom-0 left-0 right-0 border-t border-[#F5F5F7]/10 bg-[#0B0B0D]/90 backdrop-blur-lg pb-safe z-40">
              <div className="flex justify-around items-center h-16">
                <Link
                    to="/home"
                    className={`flex flex-col items-center gap-1 ${
                        location.pathname === "/home" ? "text-[#E50914]" : "text-[#9CA3AF]"
                    }`}
                >
                  <Film className="w-5 h-5" />
                  <span className="text-[10px] uppercase tracking-wider font-semibold">Фильмы</span>
                </Link>

                {!isGuest && (
                    <Link
                        to="/bookings"
                        className={`flex flex-col items-center gap-1 ${
                            location.pathname === "/bookings" ? "text-[#E50914]" : "text-[#9CA3AF]"
                        }`}
                    >
                      <Ticket className="w-5 h-5" />
                      <span className="text-[10px] uppercase tracking-wider font-semibold">Билеты</span>
                    </Link>
                )}
                <Link
                    to="/schedule"
                    className={`flex flex-col items-center gap-1 ${
                        location.pathname === "/schedule" ? "text-[#E50914]" : "text-[#9CA3AF]"
                    }`}
                >
                  <CalendarClock className="w-5 h-5" />
                  <span className="text-[10px] uppercase tracking-wider font-semibold">Сеансы</span>
                </Link>

                {!isGuest && (
                    canOpenAdminPanel ? (
                        <Link
                            to="/admin"
                            className={`flex flex-col items-center gap-1 ${
                                location.pathname.startsWith("/admin") ? "text-[#E50914]" : "text-[#9CA3AF]"
                            }`}
                        >
                          <Shield className="w-5 h-5" />
                          <span className="text-[10px] uppercase tracking-wider font-semibold">Админ</span>
                        </Link>
                    ) : (
                        <Link
                            to="/profile"
                            className={`flex flex-col items-center gap-1 ${
                                location.pathname === "/profile" ? "text-[#E50914]" : "text-[#9CA3AF]"
                            }`}
                        >
                          <User className="w-5 h-5" />
                          <span className="text-[10px] uppercase tracking-wider font-semibold">Профиль</span>
                        </Link>
                    )
                )}
              </div>
            </div>
        )}
      </div>
  );
}
