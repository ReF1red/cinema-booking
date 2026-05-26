import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  ApiError,
  cancelBookingRequest,
  fetchMe,
  fetchMyBookings,
  loginUser,
  logoutUser,
  probeAdminAccess,
  probeCinemaAdminAccess,
  refreshAccessToken,
  registerUser,
} from "../lib/api";
import type { Booking, UserProfile } from "../lib/types";

interface AppContextValue {
  user: UserProfile | null;
  isAuthResolved: boolean;
  selectedCity: number | null;
  selectedCinema: number | null;
  bookings: Booking[];
  setSelectedCity: (cityId: number | null) => void;
  setSelectedCinema: (cinemaId: number | null) => void;
  login: (email: string, password: string) => Promise<void>;
  register: (fullName: string, email: string, password: string) => Promise<void>;
  guestLogin: () => Promise<void>;   // новая функция
  logout: () => Promise<void>;
  refreshBookings: () => Promise<void>;
  cancelBooking: (bookingId: number) => Promise<void>;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

const PROFILE_STORAGE_KEY = "cinemax_user_profile";
const LOCATION_STORAGE_KEY = "cinemax_location";

function isAdminLikeRole(role?: string): boolean {
  return role === "admin" || role === "cinema_admin";
}

function isGuest(role?: string): boolean {
  return role === "guest";
}

function saveProfile(profile: UserProfile | null) {
  if (!profile) { localStorage.removeItem(PROFILE_STORAGE_KEY); return; }
  localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
}

function loadProfile(): UserProfile | null {
  const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as UserProfile; } catch { return null; }
}

function saveLocation(cityId: number | null, cinemaId: number | null) {
  localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify({ cityId, cinemaId }));
}

function loadLocation(): { cityId: number | null; cinemaId: number | null } {
  const raw = localStorage.getItem(LOCATION_STORAGE_KEY);
  if (!raw) return { cityId: null, cinemaId: null };
  try {
    const parsed = JSON.parse(raw) as { cityId?: number | null; cinemaId?: number | null };
    return { cityId: parsed.cityId ?? null, cinemaId: parsed.cinemaId ?? null };
  } catch { return { cityId: null, cinemaId: null }; }
}

async function resolveRoleFromBackend(): Promise<UserProfile["role"]> {
  try { if (await probeAdminAccess()) return "admin"; } catch { }
  try { if (await probeCinemaAdminAccess()) return "cinema_admin"; } catch { }
  return "client";
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(loadProfile());
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isAuthResolved, setIsAuthResolved] = useState(false);
  const [selectedCity, setSelectedCityState] = useState<number | null>(() => loadLocation().cityId);
  const [selectedCinema, setSelectedCinemaState] = useState<number | null>(() => loadLocation().cinemaId);

  useEffect(() => { saveLocation(selectedCity, selectedCinema); }, [selectedCity, selectedCinema]);

  useEffect(() => {
    let isMounted = true;

    const bootstrap = async () => {
      if (user && isGuest(user.role)) {
        if (isMounted) {
          setBookings([]);
          setIsAuthResolved(true);
        }
        return;
      }

      if (!user) {
        if (isMounted) { setBookings([]); setIsAuthResolved(true); }
        return;
      }
      if (isAdminLikeRole(user.role)) {
        if (isMounted) { setBookings([]); setIsAuthResolved(true); }
        return;
      }

      try {
        // Получаем актуальный профиль с бэка — теперь full_name всегда правильное
        const freshProfile = await fetchMe();
        if (isMounted) {
          const updatedProfile: UserProfile = { ...user, ...freshProfile };
          setUser(updatedProfile);
          saveProfile(updatedProfile);
        }

        const currentBookings = await fetchMyBookings();
        if (!isMounted) return;
        setBookings(currentBookings);
      } catch (initialError) {
        if (initialError instanceof ApiError && (initialError.status === 401 || initialError.status === 403)) {
          try {
            await refreshAccessToken();
            const freshProfile = await fetchMe();
            if (isMounted) {
              const updatedProfile: UserProfile = { ...user, ...freshProfile };
              setUser(updatedProfile);
              saveProfile(updatedProfile);
            }
            const currentBookings = await fetchMyBookings();
            if (!isMounted) return;
            setBookings(currentBookings);
          } catch {
            if (!isMounted) return;
            setBookings([]);
            setUser(null);
            saveProfile(null);
          }
        } else if (isMounted) {
          setBookings([]);
        }
      } finally {
        if (isMounted) setIsAuthResolved(true);
      }
    };

    void bootstrap();
    return () => { isMounted = false; };
  }, []);

  const setSelectedCity = (cityId: number | null) => {
    setSelectedCityState(cityId);
    if (!cityId) setSelectedCinemaState(null);
  };

  const setSelectedCinema = (cinemaId: number | null) => setSelectedCinemaState(cinemaId);

  const refreshBookings = async () => {
    // Гость или админ – не запрашиваем брони
    if (!user || isAdminLikeRole(user.role) || isGuest(user.role)) {
      setBookings([]);
      return;
    }
    const currentBookings = await fetchMyBookings();
    setBookings(currentBookings);
  };

  const login = async (email: string, password: string) => {
    await loginUser({ email, password });

    // Получаем реальный профиль сразу после логина — full_name из БД
    let fullProfile: UserProfile | null = null;
    try { fullProfile = await fetchMe(); } catch { }

    const role = fullProfile?.role ?? await resolveRoleFromBackend();

    const nextProfile: UserProfile = {
      email: fullProfile?.email ?? email,
      full_name: fullProfile?.full_name ?? email.split("@")[0],
      role,
      is_active: true,
      user_id: fullProfile?.user_id,
      created_at: fullProfile?.created_at,
    };

    setUser(nextProfile);
    saveProfile(nextProfile);

    if (role === "client") {
      try { await refreshBookings(); } catch { setBookings([]); }
    } else {
      setBookings([]);
    }
  };

  const register = async (fullName: string, email: string, password: string) => {
    const createdUser = await registerUser({ email, full_name: fullName, password });
    await loginUser({ email, password });

    const nextProfile: UserProfile = {
      email: createdUser.email,
      full_name: createdUser.full_name,
      user_id: createdUser.user_id,
      role: createdUser.role,
      is_active: createdUser.is_active,
      created_at: createdUser.created_at,
    };

    setUser(nextProfile);
    saveProfile(nextProfile);

    if (!isAdminLikeRole(nextProfile.role)) {
      try { await refreshBookings(); } catch { setBookings([]); }
    } else {
      setBookings([]);
    }
  };

  const guestLogin = async () => {
    const guestProfile: UserProfile = {
      user_id: 0,
      email: "guest@example.com",
      full_name: "Гость",
      role: "guest",
      is_active: true,
      created_at: new Date().toISOString(),
    };
    setUser(guestProfile);
    saveProfile(guestProfile);
    setBookings([]);
    setIsAuthResolved(prev => prev || true);
  };

  const logout = async () => {
    if (user && !isGuest(user.role)) {
      try { await logoutUser(); } catch { }
    }
    setUser(null);
    setBookings([]);
    saveProfile(null);
    setIsAuthResolved(false);
  };

  const cancelBooking = async (bookingId: number) => {
    await cancelBookingRequest(bookingId);
    await refreshBookings();
  };

  const value = useMemo<AppContextValue>(
      () => ({
        user,
        isAuthResolved,
        selectedCity,
        selectedCinema,
        bookings,
        setSelectedCity,
        setSelectedCinema,
        login,
        register,
        guestLogin,
        logout,
        refreshBookings,
        cancelBooking,
      }),
      [user, isAuthResolved, selectedCity, selectedCinema, bookings],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp должен вызываться внутри AppProvider");
  return context;
}